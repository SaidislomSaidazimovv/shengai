/**
 * Motion presets per Mirror DevHandover v02 §7.2.
 *
 * Central place for the easing curves, transitions, and variants the rest
 * of the app pulls in. Keeps the motion vocabulary disciplined — every
 * stage transitions with the same Apple-ease, every hero entrance uses
 * the same diagnosis spring.
 */
import type { Transition, Variants } from "motion/react";

export const ease = {
  out: [0.16, 1, 0.3, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
  /** Slight overshoot — used sparingly for accent moments only (v02 §5.5). */
  spring: [0.34, 1.56, 0.64, 1] as const,
} as const;

export const transitions = {
  /** v02 §5.5 --duration-instant 100ms — focus-ring / tap microflashes. */
  instant: { duration: 0.1, ease: ease.out } satisfies Transition,
  fast: { duration: 0.2, ease: ease.out } satisfies Transition,
  normal: { duration: 0.4, ease: ease.out } satisfies Transition,
  slow: { duration: 0.6, ease: ease.out } satisfies Transition,
  /** v02 §5.5 --duration-cinematic 1000ms — match-score counter, page-level reveals. */
  cinematic: { duration: 1.0, ease: ease.out } satisfies Transition,
  /** The hero entrance for the DiagnosisCard — slow, weighted, lands once. */
  diagnosis: {
    type: "spring",
    stiffness: 140,
    damping: 22,
    mass: 1,
  } satisfies Transition,
} as const;

export const variants = {
  fadeUp: {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0 },
  } satisfies Variants,
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  } satisfies Variants,
  diagnosisCard: {
    hidden: { opacity: 0, scale: 0.92, y: 24 },
    visible: { opacity: 1, scale: 1, y: 0 },
  } satisfies Variants,
} as const;
