/**
 * Lightweight persistent state — progress, attempts, language preference.
 * Backed by localStorage so the experience survives a refresh without
 * requiring auth for the demo.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lang } from "@/lib/api";

export interface Attempt {
  id: string;
  ts: number;
  pinyin: string;
  intendedTone: number;
  toneScore: number;
  initialScore: number;
  finalScore: number;
  overall: number;
  detectedTone: number;
}

interface UserState {
  language: Lang;
  attempts: Attempt[];
  setLanguage: (lang: Lang) => void;
  pushAttempt: (a: Attempt) => void;
  clear: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      language: "uz",
      attempts: [],
      setLanguage: (language) => set({ language }),
      pushAttempt: (a) =>
        set((s) => ({ attempts: [a, ...s.attempts].slice(0, 200) })),
      clear: () => set({ attempts: [] }),
    }),
    { name: "shengai:user" }
  )
);

/** Compute weak-spot summary across recent attempts. */
export function summarizeWeakSpots(attempts: Attempt[]): {
  tone: number;
  initial: number;
  final: number;
  topMistakes: { pinyin: string; intendedTone: number; detectedTone: number; count: number }[];
} {
  if (attempts.length === 0) {
    return { tone: 0, initial: 0, final: 0, topMistakes: [] };
  }
  const avg = (sel: (a: Attempt) => number) =>
    attempts.reduce((s, a) => s + sel(a), 0) / attempts.length;

  const errorKey = new Map<string, { pinyin: string; intendedTone: number; detectedTone: number; count: number }>();
  for (const a of attempts) {
    if (a.detectedTone !== a.intendedTone) {
      const key = `${a.pinyin}:${a.intendedTone}→${a.detectedTone}`;
      const prev = errorKey.get(key);
      if (prev) prev.count++;
      else errorKey.set(key, { pinyin: a.pinyin, intendedTone: a.intendedTone, detectedTone: a.detectedTone, count: 1 });
    }
  }
  const topMistakes = [...errorKey.values()].sort((a, b) => b.count - a.count).slice(0, 5);

  return {
    tone: avg((a) => a.toneScore),
    initial: avg((a) => a.initialScore),
    final: avg((a) => a.finalScore),
    topMistakes,
  };
}
