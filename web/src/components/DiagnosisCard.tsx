/**
 * The "Unforgettable Moment" per Mirror DevHandover v02 §6.5.
 *
 * This card slams in at second 10 of the demo. It is the single
 * screenshot judges will share. The composition follows §6.5 exactly:
 *
 *     ●  L1 PATTERN DETECTED          ← pulsing red dot + mono label
 *     ─────────────────
 *     RUSSIAN L1                       ← text-display headline (80px)
 *     Palatalization on /zh/.          ← text-title subhead
 *     Tone 4 → Tone 2 drift on 中.
 *
 *     ┌──────────────────────────┐
 *     │  ʈʂ  →  ʐʲ               │   ← phoneme shift box (bg-muted)
 *     │  Expected vs detected    │
 *     └──────────────────────────┘
 *
 *     Pattern 7 of 11 known Russian L1
 *     → Mandarin error families
 *
 *     ─────────────────
 *     CHEN ET AL. INTERSPEECH 2013    ← text-micro citation
 *
 * Spring entrance 800ms {stiffness: 140, damping: 22, mass: 1}, then
 * internal elements stagger in: dot+label 100ms, headline 250ms,
 * subhead 400ms, phoneme-shift 500ms, pattern 600ms, citation 700ms.
 * The red dot keeps pulsing — the only thing moving once the card
 * has landed.
 */

import { useState } from "react";
import { motion, type Variants } from "motion/react";
import { cn, timestamp } from "@/lib/utils";
import type { Diagnosis, L1 } from "@/lib/demoData";
import { L1_PHONEME_SUBSTITUTIONS } from "@/lib/demoData";
import { ease } from "@/motion/presets";

interface Props {
  diagnosis: Diagnosis;
  /** The L1 the user picked — drives the pattern-family copy. */
  l1?: L1;
  /**
   * The phoneme actually triggered by the live ASR diff. When set, the
   * card's phoneme-shift box uses this real value (looking up the L1's
   * typical substitution) instead of the static `diagnosis.phonemeShift`.
   * Without it the box falls back to the sentence-level scripted shift.
   */
  triggeredPhoneme?: string | null;
  /** When true, the card is in screen-takeover hero mode. */
  hero?: boolean;
}

// Outer card: spring entrance (800ms-ish via {stiffness 140, damping 22}).
const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 24 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 140,
      damping: 22,
      mass: 1,
    },
  },
};

/**
 * v02 §6.5 internal stagger — each element gets the same fade+slide
 * variant, but the parent stamps an explicit delay (in seconds) so the
 * timing matches the spec exactly: dot+label 100ms, headline 250ms,
 * subhead 400ms, detail+phoneme box 500ms, pattern 550ms,
 * hairline+citation 600ms, footer 700ms. Each element itself fades in
 * over 500ms with --ease-out.
 */
const ITEM_DURATION = 0.5;

function itemVariantsAt(delaySec: number): Variants {
  return {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: ITEM_DURATION, ease: ease.out, delay: delaySec },
    },
  };
}

// Frozen per-element delays (seconds), keyed by visual order.
const DELAYS = {
  header: 0.0,
  dot: 0.1,
  headline: 0.25,
  subhead: 0.4,
  detail: 0.5,
  phoneme: 0.5,
  pattern: 0.55,
  hairline: 0.6,
  citation: 0.6,
  footer: 0.7,
} as const;

const L1_NAME: Record<L1, string> = {
  russian: "Russian",
  uzbek: "Uzbek",
};

export function DiagnosisCard({
  diagnosis,
  l1 = "russian",
  triggeredPhoneme = null,
  hero = true,
}: Props) {
  // Stamp a deterministic "patient id" so the card feels like a reading.
  const [stampedAt] = useState<string>(() => timestamp());

  // Build the phoneme-shift display dynamically when a real triggered
  // phoneme is available. expected = the phoneme the user was supposed
  // to produce; detected = the L1-typical substitution for that phoneme
  // (from L1_PHONEME_SUBSTITUTIONS). If the trigger isn't in our
  // substitution table or we don't have one, fall back to the scripted
  // sentence-level shift hardcoded in demoData.
  const shift = (() => {
    if (triggeredPhoneme) {
      const sub = L1_PHONEME_SUBSTITUTIONS[l1][triggeredPhoneme];
      if (sub) return { expected: triggeredPhoneme, detected: sub };
      // Known phoneme but no L1 substitution mapping — show the trigger
      // alone so the box still reflects the live signal.
      return { expected: triggeredPhoneme, detected: "—" };
    }
    return diagnosis.phonemeShift;
  })();

  return (
    <motion.div
      initial={hero ? "hidden" : false}
      animate="visible"
      variants={cardVariants}
      className={cn(
        // v02 §6.5: card sits on --bg-surface (#FFFFFF) with --radius-xl,
        // --shadow-4 (the dramatic depth), 64px padding, max-width 720px.
        // Padding scales down on mobile so the 80px display headline has
        // room to breathe instead of slamming into the card edges.
        "relative w-full max-w-180 mx-auto bg-white rounded-xl shadow-4",
        hero ? "p-6 sm:p-10 md:p-12 lg:p-16" : "p-5 sm:p-8"
      )}
    >
      {/* Top instrument header — corner registration marks + meta line. */}
      <motion.div
        variants={itemVariantsAt(DELAYS.header)}
        className="flex items-center justify-between border-b border-line/60 pb-3 mb-8 font-data text-micro tracking-[0.2em] uppercase text-fg/40"
      >
        <div className="flex items-center gap-4">
          <CornerMark />
          <span>Phonetic Analysis · Mirror/v01</span>
        </div>
        <div className="flex items-center gap-4">
          <span>READING #{stampedAt.replace(/:/g, "")}</span>
          <CornerMark mirrored />
        </div>
      </motion.div>

      {/* v02 §6.5 — pulsing red dot + L1 PATTERN DETECTED label. The
          red dot pulse is the only thing moving once the card lands. */}
      <motion.div
        variants={itemVariantsAt(DELAYS.dot)}
        className="flex items-center gap-3 mb-6"
      >
        <span
          className="inline-block w-2 h-2 rounded-full bg-signal"
          style={{
            animation: "diagnosisPulse 1200ms ease-in-out infinite",
          }}
          aria-hidden
        />
        <span className="font-mono text-micro uppercase tracking-[0.22em] text-signal">
          L1 Pattern Detected
        </span>
      </motion.div>

      {/* Headline — signal red, heavy condensed.
          v02 §5.3 text-display (80px / 0.95 line / weight 700) on
          desktop. Steps down to 36/48/60 below md so it never
          overflows narrow viewports — the 80px is the wow size, not
          a viewport-killer. `wrap-break-word` is the safety net for
          headlines like "INSUFFICIENT VOWEL SPACE" that can run
          longer than expected. */}
      <motion.h1
        variants={itemVariantsAt(DELAYS.headline)}
        className={cn(
          "font-stamp text-signal tracking-tightest wrap-break-word",
          hero
            ? "text-4xl sm:text-5xl md:text-6xl lg:text-display"
            : "text-3xl md:text-4xl"
        )}
      >
        {diagnosis.headline}
      </motion.h1>

      {/* Subhead — clinical descriptor.
          v02 §5.3 text-title (32px / 1.1 line / weight 500) on
          desktop, smaller on mobile. */}
      <motion.div
        variants={itemVariantsAt(DELAYS.subhead)}
        className={cn(
          "font-stamp text-fg mt-4 wrap-break-word",
          hero ? "text-xl sm:text-2xl md:text-title" : "text-lg md:text-xl"
        )}
      >
        {diagnosis.subhead}
      </motion.div>

      {/* Detail — physician-note tone.
          v02 §5.3 text-body-lg (20px / 1.4 line). */}
      <motion.p
        variants={itemVariantsAt(DELAYS.detail)}
        className={cn(
          "text-fg/60 font-data mt-2",
          hero ? "text-body-lg" : "text-sm"
        )}
      >
        {diagnosis.detail}
      </motion.p>

      {/* v02 §6.5 — phoneme shift box: bg-muted, radius-md, mono.
          Expected stays in fg, detected pops in signal-red. */}
      <motion.div
        variants={itemVariantsAt(DELAYS.phoneme)}
        className="mt-8 bg-muted rounded-md p-6 flex items-center gap-4 font-mono"
      >
        <span className="text-2xl text-fg tracking-tighter">
          {shift.expected}
        </span>
        <span className="text-fg/40" aria-hidden>
          →
        </span>
        <span className="text-2xl text-signal tracking-tighter">
          {shift.detected}
        </span>
        <span className="ml-auto text-micro uppercase tracking-[0.2em] text-fg/40">
          Expected vs detected
        </span>
      </motion.div>

      {/* v02 §6.5 — pattern counter. */}
      <motion.p
        variants={itemVariantsAt(DELAYS.pattern)}
        className="mt-6 text-fg/60 font-data text-body"
      >
        Pattern {diagnosis.patternNumber} of {diagnosis.patternTotal} known {L1_NAME[l1]} L1
        <span className="text-fg/40"> → </span>
        Mandarin error families.
      </motion.p>

      {/* Hairline rule — animates in left-to-right beneath the body. */}
      <motion.div
        variants={itemVariantsAt(DELAYS.hairline)}
        className="relative h-px my-8 overflow-hidden"
      >
        <div className="absolute inset-0 bg-line" />
        <div className="absolute inset-y-0 left-0 bg-signal animate-hairline" />
      </motion.div>

      {/* Footer citation — text-micro, the legitimacy stamp. */}
      <motion.div
        variants={itemVariantsAt(DELAYS.citation)}
        className="flex items-center justify-between font-data text-micro tracking-[0.22em] uppercase text-fg/40"
      >
        <span>{diagnosis.citation}</span>
        <span className="text-signal/80">SIGNAL</span>
      </motion.div>

      {/* Bottom instrument footer — frame closure. */}
      <motion.div
        variants={itemVariantsAt(DELAYS.footer)}
        className="mt-2 flex items-center justify-between border-t border-line/60 pt-3 font-data text-micro tracking-[0.2em] uppercase text-fg/30"
      >
        <div className="flex items-center gap-2">
          <CornerMark inverted />
          <span>Recorded {stampedAt}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>END OF READING</span>
          <CornerMark inverted mirrored />
        </div>
      </motion.div>
    </motion.div>
  );
}

function CornerMark({ mirrored = false, inverted = false }: { mirrored?: boolean; inverted?: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className={cn(
        "shrink-0 text-fg/40",
        mirrored && "scale-x-[-1]",
        inverted && "scale-y-[-1]"
      )}
      aria-hidden
    >
      <path d="M0 0 L0 6 M0 0 L6 0" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}
