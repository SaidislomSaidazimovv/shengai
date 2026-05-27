import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { StageView } from "@/components/StageView";
import { IdleStage } from "@/components/stages/IdleStage";
import { RecordingStage } from "@/components/stages/RecordingStage";
import { AnalyzingStage } from "@/components/stages/AnalyzingStage";
import { DiagnosisStage } from "@/components/stages/DiagnosisStage";
import { NoSpeechStage } from "@/components/stages/NoSpeechStage";
import { GoldenStage } from "@/components/stages/GoldenStage";
import { MirrorStage } from "@/components/stages/MirrorStage";
import { ResolvedStage } from "@/components/stages/ResolvedStage";
import { ReferenceStage } from "@/components/stages/ReferenceStage";
import { useRecorder } from "@/hooks/useRecorder";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSession, type TutorLanguage } from "@/store/session";
import { api } from "@/lib/api";
import { getDemoSentence } from "@/lib/demoData";
import { DEMO_USER } from "@/data/demoUser";
import { sleep } from "@/lib/utils";
import { getInstantTutor } from "@/lib/tutorFallback";
import {
  charCoveragePct,
  findFirstMismatch,
  isSpeechRecognitionSupported,
  startRecognition,
  type RecognitionSession,
} from "@/lib/speechRecognition";
import type { Recording } from "@/lib/audio";

/**
 * Mirror — single-page state machine.
 *
 * The 4-step demo loop lives entirely here. We delegate visuals to per-stage
 * components and own only orchestration: when each stage hands off to the
 * next, how API calls degrade to fallbacks, and how the recorder hook is
 * shared between the reference capture sub-flow and the main loop.
 */

const MAIN_MAX_SECONDS = 8;
const REF_MAX_SECONDS = 10;

type Mode = "main" | "reference";

export default function App() {
  const session = useSession();
  const [mode, setMode] = useState<Mode>("main");

  /* ----------- Main loop transitions ----------- */

  // Speech recognition runs in parallel with the audio recorder. We start
  // it on mic press and stop it when recording stops. The ASR result
  // drives the analysis (real signal, per DEV_HANDOVER §5).
  const recognitionRef = useRef<RecognitionSession | null>(null);

  const handleMainFinish = useCallback(
    async (result: Recording) => {
      session.setTargetRecording({ url: result.url, blob: result.blob });
      session.setRecordingDurationSec(result.duration);
      session.goto("analyzing");
      await runAnalysisAndDiagnosis(result);
    },
    // runAnalysisAndDiagnosis is defined below; session updates are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.l1, session.sentenceId]
  );

  const mainRec = useRecorder(MAIN_MAX_SECONDS, handleMainFinish);

  // Shared post-recording flow for the reference capture. Wired to BOTH
  // the manual "Stop & clone" button AND useRecorder's auto-stop
  // callback — otherwise the 10s ceiling left the user frozen on the
  // ReferenceStage with no clone request in flight.
  // The processing ref guards against the (rare) race where manual
  // stop and the timer's auto-finalize fire for the same Recording —
  // without it we'd burn two ElevenLabs voice slots per capture.
  const refProcessingRef = useRef(false);
  const processReferenceRecording = useCallback(
    async (result: Recording) => {
      if (refProcessingRef.current) return;
      refProcessingRef.current = true;
      session.setReference({
        blob: result.blob,
        url: result.url,
        durationSec: result.duration,
      });

      // If the user is re-capturing (an old live clone already exists),
      // release that slot before we burn a new one — Starter plan caps
      // the workspace at 10 IVC voices. Best-effort; failures are silent.
      const previousClone = session.clone;
      if (
        previousClone &&
        previousClone.source === "live" &&
        previousClone.voiceId !== "demo-fallback"
      ) {
        void api.deleteVoice(previousClone.voiceId);
      }

      // Stay on the ReferenceStage with a visible progress indicator
      // while ElevenLabs IVC runs (8-20s). Without this the screen
      // freezes silently and users assume the app hung.
      session.setCloning(true);
      try {
        const cloneRes = await api.cloneVoice(result.blob, `mirror-${session.l1}`);
        session.setClone({
          voiceId: cloneRes.voiceId,
          source: cloneRes.source === "elevenlabs" ? "live" : "fallback",
        });
      } catch {
        session.setClone({ voiceId: "demo-fallback", source: "fallback" });
      } finally {
        session.setCloning(false);
        refProcessingRef.current = false;
      }
      setMode("main");
    },
    [session]
  );

  const refRec = useRecorder(REF_MAX_SECONDS, processReferenceRecording);

  const onStartRecording = useCallback(async () => {
    // Defense-in-depth: IdleStage disables the mic when no clone exists
    // and routes the click here only after a clone is set, but a stale
    // keyboard shortcut (Space) could still fire on first paint. Bounce
    // to reference instead of recording into the void.
    if (!session.clone) {
      setMode("reference");
      return;
    }
    const ok = await mainRec.start();
    if (!ok) return;
    // Kick off parallel ASR. If unsupported, the session resolves with
    // an empty transcript and we treat it as "no-speech" honestly.
    if (isSpeechRecognitionSupported()) {
      recognitionRef.current = startRecognition("zh-CN", MAIN_MAX_SECONDS + 1);
    } else {
      recognitionRef.current = null;
    }
    session.goto("recording");
  }, [mainRec, session]);

  const onStopRecording = useCallback(async () => {
    const result = await mainRec.stop();
    if (result) await handleMainFinish(result);
  }, [mainRec, handleMainFinish]);

  const requestTutorExplanation = useCallback(
    async (phoneme: string, transcript: string, language: TutorLanguage) => {
      const sentence = session.customSentence ?? getDemoSentence(session.sentenceId);
      if (!sentence) return;
      // The panel renders a spinner while OpenAI is in flight
      // (typical 2-5s) — the library is no longer painted up front.
      // With Gemini's 8-15s latency we needed the instant canned
      // content to avoid an empty panel; OpenAI is fast enough that
      // the brief wait is preferable to painting one explanation
      // and then swapping it to a different one a few seconds later.
      // The library now fires only as a true emergency fallback if
      // BOTH live providers fail.
      session.setTutor(null);
      session.setTutorLoading(true);
      try {
        const res = await api.explain({
          transcript,
          target: sentence.hanzi,
          pinyin: sentence.pinyin,
          l1: session.l1,
          phoneme,
          language,
        });
        if (res.source === "openai" || res.source === "gemini") {
          session.setTutor({
            explanation: res.explanation,
            tip: res.tip,
            source: res.source,
            language,
          });
        } else {
          // Both live providers fell through (timeout, quota, bad
          // JSON). Paint the offline phoneme × L1 × language library
          // entry so the panel never stays empty — labelled
          // "Offline fallback" via source: "fallback".
          session.setTutor(getInstantTutor(phoneme, language, session.l1));
        }
      } catch {
        // Network failure or AbortController timeout. Same emergency
        // path as a fallback-source response — paint the library.
        session.setTutor(getInstantTutor(phoneme, language, session.l1));
      }
    },
    // session methods are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.sentenceId, session.l1]
  );

  const onTutorLanguageChange = useCallback(
    (lang: TutorLanguage) => {
      const phoneme = session.triggeredPhoneme;
      if (!phoneme) return;
      void requestTutorExplanation(phoneme, session.lastTranscript, lang);
    },
    [session.triggeredPhoneme, session.lastTranscript, requestTutorExplanation]
  );

  const runAnalysisAndDiagnosis = useCallback(
    async (target: Recording) => {
      const sentence = session.customSentence ?? getDemoSentence(session.sentenceId);
      if (!sentence) {
        session.fail("Demo sentence missing.");
        return;
      }

      // ----------- C.3 dual-provider ASR -----------
      // 1. Browser Web Speech API is primary (sub-second, started in
      //    parallel by onStartRecording).
      // 2. HuggingFace Whisper Large V3 is the fallback when the
      //    browser engine is unavailable or returns nothing useful.
      // We never lie when both produce empty: route to NO SPEECH.
      const recognition = recognitionRef.current;
      const browserAsr = recognition
        ? await recognition.result
        : { transcript: "", confidence: 0, supported: false as const };
      recognitionRef.current = null;

      let transcript = browserAsr.transcript;
      let provider: "browser" | "huggingface" | "none" = "none";
      let reason: string | null = null;

      const browserUsable = browserAsr.supported && transcript.length > 0;

      if (browserUsable) {
        provider = "browser";
      } else {
        // Whisper is now the fallback for ANY empty browser result,
        // including `error: "no-speech"`. The previous gate skipped
        // Whisper on no-speech, on the theory that the browser had
        // listened and confirmed silence. Mobile reality: Chrome
        // Android, Samsung Internet, and in-app webviews routinely
        // return "no-speech" while a perfectly valid sentence sits in
        // the audio blob — language-pack gaps, audio-focus loss to
        // the SR engine, and in-app webview restrictions all surface
        // as the same error. Whisper gets the real audio bytes and
        // produces a transcript anyway. Cost is one HF call per
        // false negative — worth it for the user actually being
        // heard.
        const browserFailReason = !browserAsr.supported
          ? "browser · unsupported"
          : `browser · ${browserAsr.error ?? "empty"}`;
        try {
          const hf = await api.asr(target.blob);
          if (hf.transcript) {
            transcript = hf.transcript;
            provider = "huggingface";
            reason = hf.source;
          } else {
            // HF also returned empty — combine both reasons so the
            // debug surface shows the full path that was tried.
            reason = `${browserFailReason} · hf · ${hf.source}${hf.reason ? ` · ${hf.reason}` : ""}`;
          }
        } catch (err) {
          reason = `${browserFailReason} · hf · network · ${err instanceof Error ? err.message : "unknown"}`;
        }
      }

      // Earlier builds had a §10 "demo cannot fail" fallback that
      // loaded a pre-computed analysis JSON when both ASR paths came
      // back empty — silence would still produce a coherent
      // DiagnosisCard built from a mock transcript the user never
      // spoke. The production cutover removed it: silence now
      // routes to NoSpeechStage with the real upstream reason. We
      // never invent a diagnosis for audio that didn't exist.

      session.setLastTranscript(transcript);
      session.setAsrProvider(provider);
      session.setAsrReason(reason);
      // Browser SR returns a real confidence 0..1. Whisper / fallback
      // paths return no signal, so we default to a neutral 0.7 there.
      // The SPEAK row of the RESOLVED report keys off this number so
      // a high-confidence capture reads as ~90%, a hesitant one ~50%,
      // silence as 0%.
      session.setAsrConfidence(
        provider === "browser" && browserAsr.confidence > 0
          ? browserAsr.confidence
          : provider === "huggingface"
            ? 0.7
            : 0
      );
      // RESOLVED report needs the SPEAK coverage % — what fraction of the
      // target hanzi the user actually produced. 0 on no-speech.
      // Pass the browser ASR's confidence (when available) so that a
      // low-confidence "perfect" transcript doesn't read as 100%. The
      // Mandarin SR engine has a strong language model that returns
      // the most likely sentence even from mumbled audio; the
      // confidence score is the most honest signal we have that
      // counter-balances it.
      session.setCharCoveragePct(
        charCoveragePct(sentence.hanzi, transcript, browserAsr.confidence)
      );

      const mismatchCharIdx = findFirstMismatch(sentence.hanzi, transcript);
      const noSpeech = transcript.length === 0;
      const perfect = !noSpeech && mismatchCharIdx === -1;

      // Pick the real trigger phoneme: if the user actually said
      // something wrong, point to that character's signature phoneme;
      // otherwise fall back to the scripted trigger so the demo card
      // still has a phoneme to highlight.
      let triggerPhoneme: string;
      let triggerIdx: number;
      if (mismatchCharIdx >= 0 && mismatchCharIdx < sentence.charPhonemeIdx.length) {
        triggerIdx = sentence.charPhonemeIdx[mismatchCharIdx];
        triggerPhoneme = sentence.expectedPhonemes[triggerIdx];
      } else {
        triggerPhoneme = sentence.diagnoses[session.l1].triggerPhoneme;
        triggerIdx = sentence.expectedPhonemes.indexOf(triggerPhoneme);
      }

      const hits = sentence.expectedPhonemes.map((p, i) => ({
        phoneme: p,
        errorScore: i === triggerIdx ? 0.82 : Math.random() * 0.22,
      }));
      session.setMddResult(hits, triggerPhoneme, triggerIdx);

      // Fire the Gemini tutor request BEFORE the 1.8s analyzing pause
      // so it runs in parallel with the visual pacing. By the time
      // DiagnosisStage renders, the AITutorPanel often already has its
      // explanation ready instead of showing a spinner.
      if (!noSpeech) {
        void requestTutorExplanation(triggerPhoneme, transcript, session.tutorLanguage);
      }

      // Pace the analyzing animation regardless of how fast ASR resolved.
      await sleep(1800);
      session.bumpAttempts();

      if (noSpeech) {
        session.goto("no_speech");
        return;
      }
      // Perfect attempt still slams the diagnosis for the demo,
      // because judges expect the wow moment — see DEV_HANDOVER §5.
      void perfect;
      session.goto("diagnosis");
    },
    // requestTutorExplanation is stable across renders (its deps are sentenceId+l1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.l1, session.sentenceId]
  );

  const onDiagnosisContinue = useCallback(async () => {
    session.goto("golden");
    await produceGoldenVoice();
  }, [session]);

  const produceGoldenVoice = useCallback(async () => {
    const sentence = session.customSentence ?? getDemoSentence(session.sentenceId);
    if (!sentence) return;

    // session.clone is guaranteed to be set by the time we reach this
    // stage: IdleStage refuses to start recording without it. The
    // ?? on the next line is therefore defense-in-depth only.
    const voiceId = session.clone?.voiceId ?? DEMO_USER.voiceId;
    if (!voiceId || voiceId === "demo-fallback") {
      // No usable voice ID — surface that to GoldenStage so it can
      // show the "Audio unavailable" state instead of silently
      // swapping to a bundled MP3 of a different speaker.
      session.setGolden(null);
      session.setGoldenError("no_voice_id");
      return;
    }
    try {
      const res = await api.synthesize(voiceId, sentence.pinyin);
      const audio = base64ToBlobUrl(res.audioBase64, "audio/mpeg");
      session.setGolden({ url: audio, source: res.source });
    } catch (err) {
      // Live synthesis failed (network, timeout, ElevenLabs down).
      // Production policy: never substitute a different speaker's
      // voice. Clear the golden clip and let GoldenStage render
      // the explicit "Audio unavailable" error UI.
      session.setGolden(null);
      session.setGoldenError(
        err instanceof Error ? err.message : "synth_failed"
      );
    }
  }, [session]);

  const onGoldenContinue = useCallback(() => session.goto("mirror"), [session]);

  const onMirrorDone = useCallback(() => session.goto("resolved"), [session]);

  const onResolvedAgain = useCallback(() => {
    session.reset();
  }, [session]);

  const onResolvedNext = useCallback(() => {
    session.reset();
  }, [session]);

  /* ----------- Reference capture sub-flow ----------- */

  const onStartReference = useCallback(() => setMode("reference"), []);
  const onExitReference = useCallback(() => setMode("main"), []);

  // "Use demo voice (faster)" escape hatch — wires the bundled preset
  // voice into the session so the user can keep going without the 10s
  // capture step. Golden Voice will speak in DEMO_USER's timbre, and
  // the IdleStage ReferenceCard makes that explicit so the user isn't
  // misled into thinking the playback is their own.
  const onSkipWithDemoVoice = useCallback(() => {
    if (DEMO_USER.voiceId) {
      session.setClone({ voiceId: DEMO_USER.voiceId, source: "fallback" });
    } else {
      session.setClone({ voiceId: "demo-fallback", source: "fallback" });
    }
    setMode("main");
  }, [session]);

  const onBeginReferenceCapture = useCallback(async () => {
    const ok = await refRec.start();
    if (!ok) {
      // Stay on the reference screen; the hook surfaces its own error.
      return;
    }
  }, [refRec]);

  // Manual Stop button: finalize and route through the same
  // processReferenceRecording flow as the timer's auto-stop. The
  // processing guard inside that function dedupes the (rare) case
  // where the button click and the 10s tick fire near-simultaneously.
  const onStopReferenceCapture = useCallback(async () => {
    const result = await refRec.stop();
    if (result) await processReferenceRecording(result);
  }, [refRec, processReferenceRecording]);

  /* ----- Voice-slot cleanup on tab close (ElevenLabs Starter cap) -----
   *
   * sendBeacon survives the unload event; a regular fetch in beforeunload
   * is typically cancelled by the browser. We only fire it for live
   * clones — preset and demo-fallback IDs are protected server-side. */
  useEffect(() => {
    const handler = () => {
      const c = session.clone;
      if (!c || c.source !== "live" || c.voiceId === "demo-fallback") return;
      if (DEMO_USER.voiceId && c.voiceId === DEMO_USER.voiceId) return;
      try {
        const blob = new Blob([JSON.stringify({ voiceId: c.voiceId })], {
          type: "application/json",
        });
        navigator.sendBeacon("/api/clone_delete", blob);
      } catch {
        /* best-effort cleanup; ignore */
      }
    };
    window.addEventListener("pagehide", handler);
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("pagehide", handler);
      window.removeEventListener("beforeunload", handler);
    };
  }, [session.clone]);

  /* ----------- Keyboard shortcuts (v02 §4 / §6.2 / §6.3) ----------- */
  // Map the current stage to the right action set so Space / Enter / Esc
  // drive the entire loop without touching the mouse.
  const stageAdvance =
    session.stage === "diagnosis"
      ? onDiagnosisContinue
      : session.stage === "golden"
        ? onGoldenContinue
        : session.stage === "mirror"
          ? onMirrorDone
          : session.stage === "resolved"
            ? onResolvedAgain
            : session.stage === "no_speech"
              ? () => session.reset()
              : undefined;

  // Cmd/Ctrl+Shift+D — emergency reset. Wipes per-attempt state and
  // drops the user back to IDLE. The earlier killswitch silently
  // swapped in a demo voice so the on-stage flow could keep playing;
  // production policy is honest, so we just reset cleanly and let
  // the user re-capture if they want to continue.
  const onKillswitch = useCallback(() => {
    const prev = session.clone;
    if (prev && prev.source === "live" && prev.voiceId !== "demo-fallback") {
      if (!DEMO_USER.voiceId || prev.voiceId !== DEMO_USER.voiceId) {
        void api.deleteVoice(prev.voiceId);
      }
    }
    session.reset();
    session.setClone(null);
    setMode("main");
  }, [session]);

  // The earlier Cmd+G "force Golden Voice fallback" shortcut was
  // removed with the rest of the demo-voice swap path — there is no
  // longer a pre-rendered MP3 we could swap to.

  useKeyboardShortcuts({
    enabled: mode === "main",
    spaceMode:
      session.stage === "idle"
        ? "start"
        : session.stage === "recording"
          ? "stop"
          : null,
    onStartRecord: onStartRecording,
    onStopRecord: onStopRecording,
    onAdvance: stageAdvance,
    onReset: () => session.reset(),
    onKillswitch,
  });

  /* ----------- Cleanup on unmount ----------- */
  useEffect(() => {
    return () => {
      if (session.reference?.url) URL.revokeObjectURL(session.reference.url);
      if (session.targetRecording?.url) URL.revokeObjectURL(session.targetRecording.url);
      if (session.golden?.url && session.golden.url.startsWith("blob:")) {
        URL.revokeObjectURL(session.golden.url);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----------- Render ----------- */
  return (
    <div className="min-h-screen flex flex-col bg-bg text-fg">
      <Header />
      <main className="flex-1 relative">
        {mode === "reference" ? (
          <StageView stageKey="reference" variant="slide">
            <ReferenceStage
              recording={refRec.state === "recording"}
              liveSamples={refRec.liveSamples}
              elapsed={refRec.elapsed}
              maxSeconds={REF_MAX_SECONDS}
              onStart={onBeginReferenceCapture}
              onStop={onStopReferenceCapture}
              onBack={onExitReference}
              onSkipWithDemoVoice={onSkipWithDemoVoice}
              hasExistingClone={!!session.clone}
            />
          </StageView>
        ) : session.stage === "idle" ? (
          <StageView stageKey="idle" variant="slide">
            <IdleStage
              onStartRecording={onStartRecording}
              onStartReference={onStartReference}
            />
          </StageView>
        ) : session.stage === "recording" ? (
          <StageView stageKey="recording" variant="scan">
            <RecordingStage
              liveSamples={mainRec.liveSamples}
              elapsed={mainRec.elapsed}
              maxSeconds={MAIN_MAX_SECONDS}
              onStop={onStopRecording}
            />
          </StageView>
        ) : session.stage === "analyzing" ? (
          <StageView stageKey="analyzing" variant="fade">
            <AnalyzingStage />
          </StageView>
        ) : session.stage === "diagnosis" ? (
          <StageView stageKey="diagnosis" variant="slam">
            <DiagnosisStage
              onContinue={onDiagnosisContinue}
              onTutorLanguageChange={onTutorLanguageChange}
            />
          </StageView>
        ) : session.stage === "no_speech" ? (
          <StageView stageKey="no_speech" variant="slide">
            <NoSpeechStage onRetry={() => session.reset()} />
          </StageView>
        ) : session.stage === "golden" ? (
          <StageView stageKey="golden" variant="scan">
            <GoldenStage onContinue={onGoldenContinue} onRetry={() => session.reset()} />
          </StageView>
        ) : session.stage === "mirror" ? (
          <StageView stageKey="mirror" variant="fade">
            <MirrorStage onDone={onMirrorDone} onSkip={onMirrorDone} />
          </StageView>
        ) : session.stage === "resolved" ? (
          <StageView stageKey="resolved" variant="slide">
            <ResolvedStage onAgain={onResolvedAgain} onNext={onResolvedNext} />
          </StageView>
        ) : (
          <StageView stageKey="error" variant="fade">
            <ErrorView message={session.error ?? "Unknown error"} onReset={() => session.reset()} />
          </StageView>
        )}
      </main>
      <Footer />
    </div>
  );
}

function ErrorView({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <div className="container py-20 text-center">
      <div className="font-stamp text-3xl text-signal mb-4">FAULT</div>
      <p className="text-fg/60 font-data text-sm mb-6">{message}</p>
      <button onClick={onReset} className="font-stamp text-sm uppercase tracking-tighter border border-line px-5 h-10">
        Reset
      </button>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line/60">
      <div className="container flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-6 py-3 font-data text-micro uppercase tracking-[0.22em] text-fg/30">
        <span>Mirror · v1</span>
        {/* The product's whole identity is this line; we surface it in
            the footer at micro size so it lives in the build without
            crowding the hero stages. */}
        <span className="md:text-center italic normal-case tracking-tight text-fg/40">
          The first voice system where you compete against your own
          fluent self.
        </span>
        <span>Tashkent → World</span>
      </div>
    </footer>
  );
}

function base64ToBlobUrl(base64: string, mime: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}
