import { useState } from "react";
import { LogIn, LogOut, Loader2, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { signInWithGoogle, signOut } from "@/lib/firebase";
import { useUserStore } from "@/store/userStore";
import { cn } from "@/lib/utils";

/**
 * Compact sign-in chip used in the header.
 *
 * When Firebase is unconfigured, the chip simply isn't rendered — sign-in
 * is opt-in infrastructure, not a hard dependency for the diagnostic.
 */
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, ready, enabled } = useAuth();
  const syncing = useUserStore((s) => s.syncing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  if (!enabled) return null;

  const handleSignIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error(e);
      setError("Sign-in was cancelled or blocked.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await signOut();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", compact && "px-2")}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {!compact && <span>Loading…</span>}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={handleSignIn} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          Sign in
        </Button>
        {error && <span className="text-xs text-rose-600">{error}</span>}
      </div>
    );
  }

  const initial = (user.displayName?.[0] ?? user.email?.[0] ?? "U").toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-border bg-secondary/40 py-1 pl-1 pr-3 text-sm transition-colors hover:bg-secondary"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground overflow-hidden">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </span>
        {!compact && (
          <span className="hidden max-w-[10rem] truncate sm:block">
            {user.displayName ?? user.email ?? "Account"}
          </span>
        )}
        {syncing && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-border bg-card p-2 shadow-lg">
            <div className="rounded-md px-3 py-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{user.displayName ?? "Signed in"}</span>
              </div>
              {user.email && (
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</div>
              )}
            </div>
            <div className="my-1 h-px bg-border" />
            <button
              onClick={handleSignOut}
              disabled={busy}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-secondary disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
