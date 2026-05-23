/**
 * Persistent user state — language preference and pronunciation attempts.
 *
 * Two persistence layers, in order:
 *   1. localStorage (always) — keeps the demo working offline and without sign-in.
 *   2. Firestore (when signed in) — cross-device sync via `attachRemoteSync()`.
 *
 * The store remains the single source of truth for the UI; Firestore is a
 * best-effort mirror. If the remote write fails, the local copy survives.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lang } from "@/lib/api";
import {
  fetchAttemptsRemote,
  isFirebaseConfigured,
  pushAttemptRemote,
  tryRemote,
  type FirestoreAttempt,
} from "@/lib/firebase";

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
  remoteUid: string | null;
  syncing: boolean;
  setLanguage: (lang: Lang) => void;
  pushAttempt: (a: Attempt) => void;
  clear: () => void;
  setRemoteUid: (uid: string | null) => void;
  setSyncing: (s: boolean) => void;
  mergeRemoteAttempts: (remote: Attempt[]) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      language: "uz",
      attempts: [],
      remoteUid: null,
      syncing: false,
      setLanguage: (language) => set({ language }),
      pushAttempt: (a) => {
        set((s) => ({ attempts: [a, ...s.attempts].slice(0, 200) }));
        const uid = get().remoteUid;
        if (uid) void tryRemote(() => pushAttemptRemote(uid, a as FirestoreAttempt));
      },
      clear: () => set({ attempts: [] }),
      setRemoteUid: (uid) => set({ remoteUid: uid }),
      setSyncing: (s) => set({ syncing: s }),
      mergeRemoteAttempts: (remote) =>
        set((s) => {
          const seen = new Set(s.attempts.map((a) => a.id));
          const merged = [...s.attempts];
          for (const r of remote) {
            if (!seen.has(r.id)) {
              merged.push(r);
              seen.add(r.id);
            }
          }
          merged.sort((a, b) => b.ts - a.ts);
          return { attempts: merged.slice(0, 200) };
        }),
    }),
    {
      name: "shengai:user",
      partialize: (s) => ({ language: s.language, attempts: s.attempts }),
    }
  )
);

/**
 * Hook this up once at the app root — pass the current Firebase UID (or null
 * when signed out). On sign-in we pull the remote history and merge it with
 * whatever was captured offline; on sign-out we just stop mirroring writes.
 */
export async function attachRemoteSync(uid: string | null): Promise<void> {
  const store = useUserStore.getState();
  if (!isFirebaseConfigured()) {
    store.setRemoteUid(null);
    return;
  }

  store.setRemoteUid(uid);
  if (!uid) return;

  store.setSyncing(true);
  try {
    const remote = await tryRemote(() => fetchAttemptsRemote(uid));
    if (remote && remote.length > 0) {
      store.mergeRemoteAttempts(remote as unknown as Attempt[]);
    }
    // Push any local-only attempts that pre-date sign-in.
    const local = useUserStore.getState().attempts;
    const remoteIds = new Set((remote ?? []).map((a) => a.id));
    const onlyLocal = local.filter((a) => !remoteIds.has(a.id));
    await Promise.all(
      onlyLocal.map((a) => tryRemote(() => pushAttemptRemote(uid, a as FirestoreAttempt)))
    );
  } finally {
    store.setSyncing(false);
  }
}

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

  const errorKey = new Map<
    string,
    { pinyin: string; intendedTone: number; detectedTone: number; count: number }
  >();
  for (const a of attempts) {
    if (a.detectedTone !== a.intendedTone) {
      const key = `${a.pinyin}:${a.intendedTone}→${a.detectedTone}`;
      const prev = errorKey.get(key);
      if (prev) prev.count++;
      else
        errorKey.set(key, {
          pinyin: a.pinyin,
          intendedTone: a.intendedTone,
          detectedTone: a.detectedTone,
          count: 1,
        });
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
