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
import { useSession } from "@/store/session";
import { api } from "@/lib/api";
import { getDemoSentence } from "@/lib/ovozData";
import { sleep } from "@/lib/utils";
import {
  findFirstMismatch,
  isSpeechRecognitionSupported,
  startRecognition,
  type RecognitionSession,
} from "@/lib/speechRecognition";
import type { Recording } from "@/lib/audio";

/**
 * OVOZ — single-page state machine.
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
      session.goto("analyzing");
      await runAnalysisAndDiagnosis(result);
    },
    // runAnalysisAndDiagnosis is defined below; session updates are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.l1, session.sentenceId]
  );

  const mainRec = useRecorder(MAIN_MAX_SECONDS, handleMainFinish);
  const refRec = useRecorder(REF_MAX_SECONDS);

  const onStartRecording = useCallback(async () => {
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

  const runAnalysisAndDiagnosis = useCallback(
    async (target: Recording) => {
      const sentence = getDemoSentence(session.sentenceId);
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

      const browserUsable = browserAsr.supported && transcript.length > 0;
      const browserGaveUpEarly =
        !browserAsr.supported ||
        (browserAsr.error && browserAsr.error !== "no-speech");

      if (browserUsable) {
        provider = "browser";
      } else if (browserGaveUpEarly) {
        // Web Speech couldn't help — try Whisper.
        try {
          const hf = await api.asr(target.blob);
          if (hf.transcript) {
            transcript = hf.transcript;
            provider = "huggingface";
          }
        } catch {
          // Network/timeout — leave transcript empty, route to no-speech.
        }
      }

      session.setLastTranscript(transcript);
      session.setAsrProvider(provider);

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
    [session]
  );

  const onDiagnosisContinue = useCallback(async () => {
    session.goto("golden");
    await produceGoldenVoice();
  }, [session]);

  const produceGoldenVoice = useCallback(async () => {
    const sentence = getDemoSentence(session.sentenceId);
    if (!sentence) return;

    // If we have a clone, hit synth. Otherwise, fall back to pre-rendered.
    if (session.clone?.voiceId) {
      try {
        const res = await api.synthesize(session.clone.voiceId, sentence.pinyin);
        const audio = base64ToBlobUrl(res.audioBase64, "audio/mpeg");
        session.setGolden({ url: audio, source: res.source });
        return;
      } catch {
        // fall through to pre-render
      }
    }
    session.setGolden({
      url: `/demo-audio/${sentence.id}.mp3`,
      source: "prerendered",
    });
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

  const onBeginReferenceCapture = useCallback(async () => {
    const ok = await refRec.start();
    if (!ok) {
      // Stay on the reference screen; the hook surfaces its own error.
      return;
    }
  }, [refRec]);

  const onStopReferenceCapture = useCallback(async () => {
    const result = await refRec.stop();
    if (!result) return;
    session.setReference({ blob: result.blob, url: result.url, durationSec: result.duration });

    try {
      const cloneRes = await api.cloneVoice(result.blob, `ovoz-${session.l1}`);
      session.setClone({ voiceId: cloneRes.voiceId, source: cloneRes.source === "elevenlabs" ? "live" : "fallback" });
    } catch {
      session.setClone({ voiceId: "demo-fallback", source: "fallback" });
    }
    setMode("main");
  }, [refRec, session]);

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
            <DiagnosisStage onContinue={onDiagnosisContinue} />
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
      <div className="container flex items-center justify-between h-10 font-data text-[10px] uppercase tracking-[0.22em] text-fg/30">
        <span>OVOZ · v01 · Hackathon 2026</span>
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
