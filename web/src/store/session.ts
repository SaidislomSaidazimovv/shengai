/**
 * The Mirror demo session state machine.
 *
 * Per the dev handover §4, every recording loop walks through:
 *   IDLE → RECORDING → ANALYZING → DIAGNOSIS → GOLDEN_VOICE → MIRROR → RESOLVED
 *
 * State is intentionally global and singleton — there is one demo running
 * at a time, and the components do not need to thread props for it. We
 * also keep the cached reference clone here so cloning happens once per
 * session, not once per attempt.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { L1, DemoSentence } from "@/lib/demoData";

export type Stage =
  | "idle"
  | "recording"
  | "analyzing"
  | "diagnosis"
  | "no_speech"
  | "golden"
  | "mirror"
  | "resolved"
  | "error";

export interface PhonemeHit {
  phoneme: string;
  /** 0..1 — model confidence that this phoneme is wrong. */
  errorScore: number;
}

export interface ReferenceClip {
  blob: Blob;
  url: string;
  durationSec: number;
}

export interface VoiceClone {
  /** ElevenLabs voice id once cloning has completed. */
  voiceId: string;
  /** Whether we generated from the live recording or fell back to the canned voice. */
  source: "live" | "fallback";
}

export interface GoldenClip {
  url: string;
  source: "elevenlabs" | "prerendered";
}

export type TutorLanguage = "uz" | "ru" | "en";

export interface TutorExplanation {
  explanation: string;
  tip: string;
  /** Which engine produced this content:
   *  - "openai"   — primary (GPT-4o-mini, set in /api/explain.py)
   *  - "gemini"   — automatic backup when OpenAI is unreachable
   *  - "fallback" — the offline phoneme × L1 × language library
   *    (used when both live providers fail or while a live call
   *    is in flight) */
  source: "openai" | "gemini" | "fallback";
  language: TutorLanguage;
}

interface SessionState {
  /* ----- Demo configuration ----- */
  l1: L1;
  sentenceId: string;
  setL1: (l1: L1) => void;
  setSentenceId: (id: string) => void;

  /** User-supplied sentence created via /api/translate. When set,
   *  takes priority over `sentenceId` everywhere — App.tsx reads
   *  `getActiveSentence()` rather than calling `getDemoSentence`
   *  directly. Selecting one of the three built-in sentences clears
   *  this back to null. */
  customSentence: DemoSentence | null;
  setCustomSentence: (s: DemoSentence | null) => void;

  /* ----- State machine ----- */
  stage: Stage;
  error: string | null;
  goto: (s: Stage) => void;
  fail: (msg: string) => void;
  reset: () => void;

  /* ----- Reference + clone (cached per session) ----- */
  reference: ReferenceClip | null;
  setReference: (r: ReferenceClip | null) => void;

  clone: VoiceClone | null;
  setClone: (c: VoiceClone | null) => void;

  /** True while /api/clone is in flight. Drives the ReferenceStage
   *  progress indicator so the user sees the 10-20s ElevenLabs IVC
   *  wait isn't a frozen screen. */
  cloning: boolean;
  setCloning: (v: boolean) => void;

  /* ----- Per-attempt artifacts ----- */
  targetRecording: { url: string; blob: Blob } | null;
  setTargetRecording: (r: { url: string; blob: Blob } | null) => void;

  phonemeHits: PhonemeHit[];
  triggeredPhoneme: string | null;
  /** Phoneme index inside expectedPhonemes (so AnalyzingStage can flash the right cell). */
  triggeredPhonemeIdx: number | null;
  setMddResult: (hits: PhonemeHit[], trigger: string | null, idx: number | null) => void;

  /** What the ASR (browser OR Whisper) actually heard. Empty if no-speech. */
  lastTranscript: string;
  setLastTranscript: (t: string) => void;

  /** Which engine produced the transcript — surfaced in the UI for honesty. */
  asrProvider: "browser" | "huggingface" | "none";
  setAsrProvider: (p: "browser" | "huggingface" | "none") => void;

  /** Reason string from the failing ASR call — shown in NoSpeechStage for debug. */
  asrReason: string | null;
  setAsrReason: (r: string | null) => void;

  /** ASR confidence 0..1 — browser SR returns a real number, Whisper
   *  doesn't (we use 0.7 as the default). Drives the SPEAK row of
   *  the RESOLVED report so it isn't a binary captured/not. */
  asrConfidence: number;
  setAsrConfidence: (v: number) => void;

  golden: GoldenClip | null;
  setGolden: (g: GoldenClip | null) => void;

  /** Set when produceGoldenVoice() decided NOT to provide a clip
   *  (synth failure, missing clone, etc). Drives the explicit
   *  "Audio unavailable" UI on GoldenStage — production policy is
   *  to refuse to play a substitute speaker. Null means we're
   *  still waiting on the live synthesis to complete. */
  goldenError: string | null;
  setGoldenError: (e: string | null) => void;

  /* ----- Gemini-powered native-language tutor ----- */
  tutorLanguage: TutorLanguage;
  setTutorLanguage: (l: TutorLanguage) => void;

  tutor: TutorExplanation | null;
  tutorLoading: boolean;
  setTutor: (t: TutorExplanation | null) => void;
  setTutorLoading: (loading: boolean) => void;

  /* ----- Step completion metrics (driven into RESOLVED report) ----- */
  /** Recording duration in seconds — captured after the user stops. */
  recordingDurationSec: number | null;
  setRecordingDurationSec: (v: number | null) => void;
  /** Character-level coverage % between target hanzi and the ASR transcript. */
  charCoveragePct: number | null;
  setCharCoveragePct: (v: number | null) => void;
  /** How much of the Golden Voice clip the user actually heard, 0-100. */
  goldenListenedPct: number | null;
  setGoldenListenedPct: (v: number | null) => void;
  /** Highest match score reached during the Mirror stage, 0-100. */
  peakMirrorAlignmentPct: number | null;
  setPeakMirrorAlignmentPct: (v: number | null) => void;

  /* ----- Stats for "attempts" display ----- */
  attemptsThisSession: number;
  bumpAttempts: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
  l1: "russian",
  sentenceId: "wo_xi_huan_xue_zhong_wen",
  // Setting a built-in sentence clears any active custom one — the
  // two are mutually exclusive sources of truth for "what is the
  // current sentence".
  setL1: (l1) => set({ l1 }),
  setSentenceId: (sentenceId) => set({ sentenceId, customSentence: null }),

  customSentence: null,
  setCustomSentence: (customSentence) => set({ customSentence }),

  stage: "idle",
  error: null,
  goto: (stage) => set({ stage, error: null }),
  fail: (error) => set({ stage: "error", error }),
  reset: () =>
    set({
      stage: "idle",
      error: null,
      targetRecording: null,
      phonemeHits: [],
      triggeredPhoneme: null,
      triggeredPhonemeIdx: null,
      lastTranscript: "",
      asrProvider: "none",
      asrReason: null,
      asrConfidence: 0,
      golden: null,
      goldenError: null,
      tutor: null,
      tutorLoading: false,
      recordingDurationSec: null,
      charCoveragePct: null,
      goldenListenedPct: null,
      peakMirrorAlignmentPct: null,
    }),

  reference: null,
  setReference: (reference) => set({ reference }),

  clone: null,
  setClone: (clone) => set({ clone }),

  cloning: false,
  setCloning: (cloning) => set({ cloning }),

  targetRecording: null,
  setTargetRecording: (targetRecording) => set({ targetRecording }),

  phonemeHits: [],
  triggeredPhoneme: null,
  triggeredPhonemeIdx: null,
  setMddResult: (phonemeHits, triggeredPhoneme, triggeredPhonemeIdx) =>
    set({ phonemeHits, triggeredPhoneme, triggeredPhonemeIdx }),

  lastTranscript: "",
  setLastTranscript: (lastTranscript) => set({ lastTranscript }),

  asrProvider: "none",
  setAsrProvider: (asrProvider) => set({ asrProvider }),

  asrReason: null,
  setAsrReason: (asrReason) => set({ asrReason }),

  asrConfidence: 0,
  setAsrConfidence: (asrConfidence) => set({ asrConfidence }),

  golden: null,
  // Clear the error whenever a valid golden clip lands — keeps the
  // two fields from getting out of sync. Manual reset still works
  // via setGoldenError(null).
  setGolden: (golden) =>
    set(golden ? { golden, goldenError: null } : { golden }),

  goldenError: null,
  setGoldenError: (goldenError) => set({ goldenError }),

  tutorLanguage: "uz",
  setTutorLanguage: (tutorLanguage) => set({ tutorLanguage }),

  tutor: null,
  tutorLoading: false,
  setTutor: (tutor) => set({ tutor, tutorLoading: false }),
  setTutorLoading: (tutorLoading) => set({ tutorLoading }),

  recordingDurationSec: null,
  setRecordingDurationSec: (recordingDurationSec) => set({ recordingDurationSec }),
  charCoveragePct: null,
  setCharCoveragePct: (charCoveragePct) => set({ charCoveragePct }),
  goldenListenedPct: null,
  setGoldenListenedPct: (goldenListenedPct) => set({ goldenListenedPct }),
  peakMirrorAlignmentPct: null,
  setPeakMirrorAlignmentPct: (peakMirrorAlignmentPct) => set({ peakMirrorAlignmentPct }),

  attemptsThisSession: 0,
  bumpAttempts: () => set((s) => ({ attemptsThisSession: s.attemptsThisSession + 1 })),
    }),
    {
      name: "mirror-session",
      storage: createJSONStorage(() => localStorage),
      // Persist ONLY user preferences — language pair, last sentence,
      // tutor language. The voice clone is deliberately NOT persisted
      // any more: keeping it across refreshes meant the mic landed
      // unlocked on a fresh visit with a stale "YOUR VOICE CLONED"
      // badge, defeating the Reference Capture gate (the user's
      // production-mode complaint). Now every fresh load forces a
      // re-capture, which matches what a first-time visitor sees.
      // Blob URLs, per-attempt scores and Gemini explanations are
      // also intentionally excluded — they'd lie or 404 after reload.
      partialize: (state) => ({
        l1: state.l1,
        sentenceId: state.sentenceId,
        tutorLanguage: state.tutorLanguage,
      }),
      version: 2,
    }
  )
);
