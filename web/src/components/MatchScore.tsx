import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { ease } from "@/motion/presets";

/**
 * Mirror DevHandover v02 §6.7 match score visualization:
 *
 *     96
 *     MATCH
 *
 * Large mono number (text-hero 56px), counts up smoothly with
 * --ease-out over ~1.6s (v02 §5.5 "Match score counter 1.6s
 * --ease-out, easing decelerates"). When the score crosses 90 it
 * turns success green (#16804A) and emits a soft success-soft glow.
 * When it crosses 95 it flashes a single 180ms gold pulse — the
 * v02 §6.7 "lock" beat.
 *
 * This is the screen-level score component. Distinct from the
 * inline alignment % we already show on the right panel; that one
 * stays small and live, this one is the headline number.
 */

interface Props {
  /** Current alignment, 0–100. */
  value: number;
  className?: string;
}

const COUNT_DURATION_MS = 1600;

export function MatchScore({ value, className }: Props) {
  // Smooth counter that decelerates toward the live value.
  const [displayed, setDisplayed] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const targetRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Whenever the live value moves, retarget the smooth counter.
  useEffect(() => {
    fromRef.current = displayed;
    targetRef.current = Math.max(0, Math.min(100, Math.round(value)));
    startedAtRef.current = performance.now();

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const start = startedAtRef.current ?? now;
      const t = Math.min(1, (now - start) / COUNT_DURATION_MS);
      const eased = easeOut(t);
      const next = fromRef.current + (targetRef.current - fromRef.current) * eased;
      setDisplayed(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const shown = Math.round(displayed);
  const crossed90 = shown >= 90;
  const crossed95 = shown >= 95;

  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg px-8 py-4 transition-colors duration-300 ease-out",
        // v02 §5.2 — success-soft halo when match ≥ 90. Subtle warm
        // wash that pairs with the success-green text + text-shadow.
        crossed90 ? "bg-success-soft" : "bg-transparent",
        className
      )}
    >
      <motion.div
        animate={
          crossed95
            ? { scale: [1, 1.06, 1] }
            : crossed90
              ? { scale: [1, 1.02, 1] }
              : { scale: 1 }
        }
        transition={{ duration: 0.18, ease: ease.out }}
        className={cn(
          "font-mono text-hero tabular-nums transition-colors duration-300 ease-out",
          crossed90 ? "text-success" : "text-fg"
        )}
        style={
          crossed90
            ? {
                textShadow: "0 0 32px rgba(22, 128, 74, 0.25)",
              }
            : undefined
        }
      >
        {shown}
      </motion.div>
      <div
        className={cn(
          "font-data text-micro uppercase tracking-[0.22em] mt-2 transition-colors duration-300 ease-out",
          crossed90 ? "text-success" : "text-fg/40"
        )}
      >
        Match
      </div>
    </div>
  );
}
