/**
 * The SHENG demo session state machine.
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
import type { L1 } from "@/lib/demoData";

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

interface SessionState {
  /* ----- Demo configuration ----- */
  l1: L1;
  sentenceId: string;
  setL1: (l1: L1) => void;
  setSentenceId: (id: string) => void;

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

  golden: GoldenClip | null;
  setGolden: (g: GoldenClip | null) => void;

  /* ----- Stats for "attempts" display ----- */
  attemptsThisSession: number;
  bumpAttempts: () => void;
}

export const useSession = create<SessionState>((set) => ({
  l1: "russian",
  sentenceId: "wo_xi_huan_xue_zhong_wen",
  setL1: (l1) => set({ l1 }),
  setSentenceId: (sentenceId) => set({ sentenceId }),

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
      golden: null,
    }),

  reference: null,
  setReference: (reference) => set({ reference }),

  clone: null,
  setClone: (clone) => set({ clone }),

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

  golden: null,
  setGolden: (golden) => set({ golden }),

  attemptsThisSession: 0,
  bumpAttempts: () => set((s) => ({ attemptsThisSession: s.attemptsThisSession + 1 })),
}));
