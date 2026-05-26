import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useSession } from "@/store/session";
import { DEMO_SENTENCES } from "@/lib/demoData";
import { useActiveSentence } from "@/lib/activeSentence";
import { ease } from "@/motion/presets";
import { cn } from "@/lib/utils";

interface Props {
  onAgain: () => void;
  onNext: () => void;
}

/**
 * RESOLVED — close of the loop. Replaces the spec's three aspirational
 * figures with an honest, real-data Step Report: how completely the
 * user finished each of the four steps, plus a composite overall %.
 *
 *     01 SPEAK            100 %    captured
 *     02 DIAGNOSE          83 %    coverage
 *     03 GOLDEN VOICE     100 %    listened
 *     04 MIRROR            96 %    peak match
 *                ────────────
 *     OVERALL              95 %
 *
 * Each row reveals sequentially (120ms apart — the upper bound of
 * the v02 §7.3 stagger range) for the spec's "calm, number-driven
 * close" feel. Per Mirror v02 §10 we deliberately
 * phrase the numbers as "completion" / "coverage" / "match" rather
 * than "accuracy" or "score" — the app makes no grading claims.
 */

interface StepRow {
  key: string;
  num: string;
  label: string;
  value: number | null;
  note: string;
}

export function ResolvedStage({ onAgain, onNext }: Props) {
  const sentenceId = useSession((s) => s.sentenceId);
  const setSentenceId = useSession((s) => s.setSentenceId);
  const sentence = useActiveSentence();
  const attempts = useSession((s) => s.attemptsThisSession);

  const recordingDurationSec = useSession((s) => s.recordingDurationSec);
  const lastTranscript = useSession((s) => s.lastTranscript);
  const asrConfidence = useSession((s) => s.asrConfidence);
  const charCoveragePct = useSession((s) => s.charCoveragePct);
  const goldenListenedPct = useSession((s) => s.goldenListenedPct);
  const peakMirrorAlignmentPct = useSession((s) => s.peakMirrorAlignmentPct);

  // SPEAK now reflects how confidently the mic captured speech:
  //   - no recording                       → null (step skipped, excluded)
  //   - recording but no transcript        → 0   (silence / unintelligible)
  //   - recording + transcript             → ASR confidence × 100
  // The Mandarin SR engine's language model means a binary "captured"
  // boolean always reads 100% and looks fake. Using confidence here
  // gives a smooth 30-95% range that tracks how clearly the user spoke.
  const speakPct: number | null =
    recordingDurationSec === null
      ? null
      : lastTranscript.length === 0
        ? 0
        : Math.max(0, Math.min(100, Math.round(asrConfidence * 100)));

  // The other three only get a value if their step actually executed,
  // so a skipped step doesn't drag the overall down — it's excluded.
  const rows: StepRow[] = [
    { key: "speak", num: "01", label: "Speak", value: speakPct, note: "captured" },
    { key: "diagnose", num: "02", label: "Diagnose", value: charCoveragePct, note: "coverage" },
    { key: "golden", num: "03", label: "Golden Voice", value: goldenListenedPct, note: "listened" },
    { key: "mirror", num: "04", label: "Mirror", value: peakMirrorAlignmentPct, note: "peak match" },
  ];

  // Composite — equal-weight average of the steps that actually ran
  // (null = skipped, doesn't count for or against). Clamped 0-100 to
  // avoid the occasional rounding overshoot on perfect runs.
  const present = rows
    .map((r) => r.value)
    .filter((v): v is number => v !== null);
  const overall = present.length > 0
    ? Math.max(0, Math.min(100, Math.round(present.reduce((a, b) => a + b, 0) / present.length)))
    : 0;

  // Sequential reveal — 120ms between rows (top of v02 §7.3 range)
  // + 600ms beat before OVERALL (v02 --duration-slow).
  const STAGGER_MS = 120;
  const FIRST_DELAY_MS = 200;
  const OVERALL_BEAT_MS = 600;
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    const timers: number[] = [];
    rows.forEach((_, i) =>
      timers.push(
        window.setTimeout(
          () => setRevealed((r) => Math.max(r, i + 1)),
          FIRST_DELAY_MS + i * STAGGER_MS
        )
      )
    );
    timers.push(
      window.setTimeout(
        () => setRevealed((r) => Math.max(r, rows.length + 1)),
        FIRST_DELAY_MS + rows.length * STAGGER_MS + OVERALL_BEAT_MS
      )
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNext = () => {
    const idx = DEMO_SENTENCES.findIndex((s) => s.id === sentenceId);
    const next = DEMO_SENTENCES[(idx + 1) % DEMO_SENTENCES.length];
    setSentenceId(next.id);
    onNext();
  };

  return (
    <div className="container py-20 grid place-items-center text-center">
      <div className="max-w-2xl w-full">
        <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/40 mb-12">
          Loop {attempts.toString().padStart(2, "0")} · resolved
        </div>

        {/* Per-step report */}
        <div className="flex flex-col items-stretch gap-4 mb-8 text-left">
          {rows.map((row, i) => (
            <motion.div
              key={row.key}
              initial={{ opacity: 0, y: 12 }}
              animate={revealed > i ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
              transition={{ duration: 0.4, ease: ease.out }}
              className="grid grid-cols-[3rem_1fr_auto_6rem] items-baseline gap-4 border-b border-line/60 pb-3"
            >
              <span className="font-data text-micro tracking-[0.22em] text-fg/40 tabular-nums">
                {row.num}
              </span>
              <span className="font-stamp text-xl text-fg">
                {row.label}
              </span>
              <span className="font-data text-micro uppercase tracking-[0.22em] text-fg/40">
                {row.note}
              </span>
              <span
                className={cn(
                  "font-mono text-2xl tabular-nums text-right",
                  row.value === null
                    ? "text-fg/30"
                    : row.value >= 90
                      ? "text-success"
                      : "text-fg"
                )}
              >
                {row.value === null ? "—" : `${row.value}%`}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Composite overall */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={revealed > rows.length ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: 0.6, ease: ease.out }}
          className="flex flex-col items-center mt-10"
        >
          <div
            className={cn(
              "font-mono text-hero tabular-nums",
              overall >= 90 ? "text-success" : "text-fg"
            )}
            style={
              overall >= 90
                ? { textShadow: "0 0 32px rgba(22, 128, 74, 0.20)" }
                : undefined
            }
          >
            {overall}%
          </div>
          <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/40 mt-2">
            Overall completion
          </div>
        </motion.div>

        {/* Disclaimer + buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: ease.out, delay: 1.6 }}
          className="mt-10 flex flex-col items-center gap-3"
        >
          <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/30">
            demo readout · not an assessment
          </div>
          <div className="flex flex-col items-center gap-4 mt-6">
            <button
              onClick={handleNext}
              className={cn(
                "font-stamp uppercase tracking-tighter text-base text-fg",
                "transition-colors duration-200 ease-out hover:text-fg/60"
              )}
            >
              Try another sentence
            </button>
            <button
              onClick={onAgain}
              className={cn(
                "font-stamp uppercase tracking-tighter text-base text-fg/60",
                "transition-colors duration-200 ease-out hover:text-fg"
              )}
            >
              Start over
            </button>
          </div>
        </motion.div>

        {sentence && (
          <div className="mt-14 font-data text-micro uppercase tracking-[0.2em] text-fg/30">
            Just completed · {sentence.hanzi} · {sentence.pinyin}
          </div>
        )}
      </div>
    </div>
  );
}
