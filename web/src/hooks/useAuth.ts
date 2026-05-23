/**
 * Tiny auth hook that wraps Firebase's `onAuthStateChanged` and exposes a
 * stable `user | null` value plus loading state. Components don't need to
 * know whether Firebase is configured — when it isn't, the hook simply
 * reports `user = null, ready = true` and the rest of the UI degrades.
 */

import { useEffect, useState } from "react";
import { isFirebaseConfigured, onUserChanged, type User } from "@/lib/firebase";

export interface AuthState {
  user: User | null;
  ready: boolean;
  enabled: boolean;
}

export function useAuth(): AuthState {
  const enabled = isFirebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState<boolean>(!enabled);

  useEffect(() => {
    if (!enabled) return;
    const unsub = onUserChanged((u) => {
      setUser(u);
      setReady(true);
    });
    return unsub;
  }, [enabled]);

  return { user, ready, enabled };
}
