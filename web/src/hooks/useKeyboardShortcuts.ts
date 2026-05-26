/**
 * Stage-aware global keyboard shortcuts — implements Mirror DevHandover
 * v02 §6.2 ("Auto-focus the page. Listen for spacebar. Spacebar press →
 * enter RECORDING."), §6.3 ("Release space to stop."), and closes the
 * last gap in §4 State Machine ("keyboard shortcuts" per §11 P0).
 *
 * Spacebar is hold-to-record: pressing on the IDLE screen starts the
 * recording loop; releasing while on the RECORDING screen ends it.
 * Enter advances through the post-recording stages so the demo can be
 * driven from the keyboard alone. Escape resets back to IDLE.
 *
 * Inputs are explicitly ignored when focus is in a text-input element,
 * so typing inside a future search box / form never triggers a stage
 * change.
 */
import { useEffect, useRef } from "react";

interface Options {
  /** Disable all shortcuts (e.g. while in the reference sub-flow). */
  enabled?: boolean;
  /**
   * What spacebar should do at this moment:
   *   - "start" → keydown triggers `onStartRecord` (IDLE)
   *   - "stop"  → keyup triggers `onStopRecord` (RECORDING)
   *   - null    → spacebar ignored
   */
  spaceMode: "start" | "stop" | null;
  onStartRecord?: () => void;
  onStopRecord?: () => void;
  /** Enter handler — typically the current stage's "continue" action. */
  onAdvance?: () => void;
  /** Escape handler — typically session.reset(). */
  onReset?: () => void;
  /**
   * Cmd/Ctrl+Shift+D — emergency reset. Wipes per-attempt state and
   * drops the user back to IDLE without re-using any live data
   * from the previous attempt.
   */
  onKillswitch?: () => void;
}

function isTextInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  return (el as HTMLElement).isContentEditable;
}

export function useKeyboardShortcuts({
  enabled = true,
  spaceMode,
  onStartRecord,
  onStopRecord,
  onAdvance,
  onReset,
  onKillswitch,
}: Options) {
  // Track whether a Space keydown originated from this stage to avoid
  // the case where a user starts recording, the stage transitions, and
  // their later keyup fires a stop for a stage that wasn't listening.
  const spaceHeldRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTextInputFocused()) return;

      // Cmd/Ctrl+Shift+D — emergency reset. Caught before the
      // per-key branches so it overrides everything.
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.shiftKey && (e.code === "KeyD" || e.key === "d" || e.key === "D")) {
        if (onKillswitch) {
          e.preventDefault();
          onKillswitch();
        }
        return;
      }

      if (e.code === "Space") {
        // Ignore the browser's auto-repeat keydowns while held.
        if (e.repeat || spaceHeldRef.current) return;
        spaceHeldRef.current = true;
        if (spaceMode === "start" && onStartRecord) {
          e.preventDefault();
          onStartRecord();
        }
        return;
      }

      if (e.code === "Enter" && onAdvance) {
        e.preventDefault();
        onAdvance();
        return;
      }

      if (e.code === "Escape" && onReset) {
        e.preventDefault();
        onReset();
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const wasHeld = spaceHeldRef.current;
      spaceHeldRef.current = false;
      if (!wasHeld) return;
      if (spaceMode === "stop" && onStopRecord) {
        e.preventDefault();
        onStopRecord();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    enabled,
    spaceMode,
    onStartRecord,
    onStopRecord,
    onAdvance,
    onReset,
    onKillswitch,
  ]);
}
