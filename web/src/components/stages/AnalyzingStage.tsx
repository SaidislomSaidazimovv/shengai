import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSession } from "@/store/session";
import { useActiveSentence } from "@/lib/activeSentence";
import { ease } from "@/motion/presets";

/**
 * Mirror DevHandover v02 §6.4 ANALYZING — six syllable tiles, a thin
 * progress bar, and a label that swaps through "Listening" → "Reading"
 * → "Pattern matched" over ~1.5 s before the DIAGNOSIS card slams in.
 *
 *     ┌──────┬──────┬──────┬──────┬──────┐
 *     │  wǒ  │ xǐ   │ huan │ xué  │ zhōng│ ...
 *     └──────┴──────┴──────┴──────┴──────┘
 *
 *     ▰▰▰▰▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱             progress 360×2px
 *     Listening
 *
 * Tile spec: 80×80px, gap 8px, bg-surface, radius-md, shadow-1. Each
 * tile fades+scales in 80ms apart. The trigger syllable stays lit in
 * signal red once analysis settles; everything else dims.
 */

const TILE_STAGGER_MS = 80;
const ANALYZE_DURATION_MS = 1500;
const LABEL_TIMINGS = [
  { at: 0, text: "Listening" },
  { at: 500, text: "Reading" },
  { at: 1200, text: "Pattern matched" },
] as const;

export function AnalyzingStage() {
  const triggeredPhoneme = useSession((s) => s.triggeredPhoneme);
  const triggeredPhonemeIdx = useSession((s) => s.triggeredPhonemeIdx);
  const asrProvider = useSession((s) => s.asrProvider);
  const l1 = useSession((s) => s.l1);

  const sentence = useActiveSentence();
  const syllables = sentence?.syllables ?? [];

  // Map the triggered phoneme back to a syllable index. Prefer the
  // store's explicit triggeredPhonemeIdx; fall back to the scripted
  // diagnosis trigger when nothing else is set.
  const triggerSyllableIdx = (() => {
    if (!sentence) return -1;
    const triggerPhonemeIdx =
      triggeredPhonemeIdx !== null && triggeredPhonemeIdx >= 0
        ? triggeredPhonemeIdx
        : sentence.expectedPhonemes.indexOf(
            triggeredPhoneme ?? sentence.diagnoses[l1].triggerPhoneme
          );
    if (triggerPhonemeIdx < 0) return -1;
    // Last char whose phoneme index is ≤ trigger index.
    for (let i = sentence.charPhonemeIdx.length - 1; i >= 0; i--) {
      if (sentence.charPhonemeIdx[i] <= triggerPhonemeIdx) return i;
    }
    return 0;
  })();

  const [labelIdx, setLabelIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [settled, setSettled] = useState(false);

  // Sequential label swap per spec: 0ms / 500ms / 1200ms.
  useEffect(() => {
    const timers = LABEL_TIMINGS.map((entry, i) =>
      window.setTimeout(() => setLabelIdx(i), entry.at)
    );
    const settleTimer = window.setTimeout(() => setSettled(true), ANALYZE_DURATION_MS);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(settleTimer);
    };
  }, []);

  // Smoothly drive the progress bar with RAF.
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ANALYZE_DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const providerLabel =
    asrProvider === "huggingface"
      ? "Whisper Large V3 · HuggingFace"
      : asrProvider === "browser"
      ? "Web Speech API · Browser"
      : "wav2vec2-xlsr · L2-arctic";

  return (
    <div className="container py-14 grid place-items-center animate-in fade-in duration-500">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-12">
          <Badge variant="default">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-fg/60 animate-pulse" />
            PHONEME DETECTION
          </Badge>
          <span className="font-data text-micro uppercase tracking-[0.22em] text-fg/40">
            {providerLabel}
          </span>
        </div>

        {/* v02 §5.6 wireframe — mesh dot grid behind the tile row to
            sell the "instrument" feel. The tiles sit on top in solid
            white surfaces so legibility is preserved. */}
        <div className="relative mb-10">
          <div
            className="absolute -inset-6 bg-mesh-dots opacity-60 pointer-events-none rounded-md"
            aria-hidden
          />

          {/* v02 §6.4 — syllable tile grid. 80×80px, gap 8px, bg-surface,
              radius-md, shadow-1. Tiles fade+scale in 80ms apart. */}
          <div className="relative flex justify-center flex-wrap gap-2">
          {syllables.map((syl, i) => {
            const isTrigger = settled && i === triggerSyllableIdx;
            const dimAtRest = settled && !isTrigger;
            return (
              <motion.div
                key={`${syl}-${i}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{
                  opacity: dimAtRest ? 0.3 : 1,
                  scale: isTrigger ? 1.04 : 1,
                }}
                transition={{
                  delay: i * (TILE_STAGGER_MS / 1000),
                  duration: 0.4,
                  ease: ease.out,
                }}
                className={cn(
                  "w-20 h-20 grid place-items-center rounded-md font-cjk text-2xl font-medium",
                  "transition-colors duration-300 ease-out shadow-1 border",
                  isTrigger
                    ? "bg-signal/10 border-signal text-signal"
                    : "bg-white border-line text-fg"
                )}
              >
                {syl}
              </motion.div>
            );
          })}
          </div>
        </div>

        {/* v02 §6.4 — 360×2px progress bar. Track fg-quaternary, fill fg-primary. */}
        <div className="flex justify-center mb-4">
          <div className="w-90 h-0.5 bg-fg/10 overflow-hidden">
            <motion.div
              className="h-full bg-fg origin-left"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        {/* v02 §6.4 — swapping label: Listening / Reading / Pattern matched. */}
        <div className="text-center font-data text-meta uppercase tracking-[0.22em] text-fg/60 h-5">
          <motion.span
            key={LABEL_TIMINGS[labelIdx].text}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: ease.out }}
            className="inline-block"
          >
            {LABEL_TIMINGS[labelIdx].text}
            {settled && triggeredPhoneme && (
              <span className="text-signal ml-3">/{triggeredPhoneme}/</span>
            )}
          </motion.span>
        </div>
      </div>
    </div>
  );
}
