import { useEffect, useState } from "react";
import { motion, type Variants } from "motion/react";
import { Mic, ArrowLeft, ArrowRight, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Waveform } from "@/components/Waveform";
import { REFERENCE_SCRIPTS } from "@/lib/demoData";
import { useSession } from "@/store/session";
import { formatSeconds } from "@/lib/utils";
import { ease } from "@/motion/presets";
import { cn } from "@/lib/utils";

interface Props {
  recording: boolean;
  liveSamples: number[];
  elapsed: number;
  maxSeconds: number;
  onStart: () => void;
  onStop: () => void;
  onBack: () => void;
  onSkipWithDemoVoice: () => void;
  /** True when the user already has a clone in this session — they came
   *  here to re-capture, not because they were forced. Drives whether
   *  we show "Back" vs. the "Skip with demo voice" escape hatch. */
  hasExistingClone: boolean;
}

// v02 §6.1 — entry stagger 100ms between heading / card / button.
const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: ease.out } },
};

/**
 * Mirror DevHandover v02 §6.1 ONBOARDING_REFERENCE.
 *
 *     One thing first.
 *     Read this in your own language.
 *
 *     [ Русский ] [ O'zbek ]            ← pill toggle, 32px height
 *
 *     ┌──────────────────────────────┐
 *     │  Меня зовут Акмаль...        │   ← passage card, radius-lg
 *     │  text-body-lg (20px / 1.5)    │     shadow-2, 48px padding
 *     └──────────────────────────────┘
 *
 *           [ 🎙 mic 96px ]              ← fg-primary, hover scale 1.02
 *
 *           Hold space to record
 */
export function ReferenceStage({
  recording,
  liveSamples,
  elapsed,
  maxSeconds,
  onStart,
  onStop,
  onBack,
  onSkipWithDemoVoice,
  hasExistingClone,
}: Props) {
  const l1 = useSession((s) => s.l1);
  const script = REFERENCE_SCRIPTS[l1];
  const cloning = useSession((s) => s.cloning);

  // Time the cloning step so the user sees real elapsed seconds — a
  // numeric counter alongside the spinner makes a 12-second silence
  // feel like progress rather than a hang.
  const [cloneElapsed, setCloneElapsed] = useState(0);
  useEffect(() => {
    if (!cloning) {
      setCloneElapsed(0);
      return;
    }
    const start = performance.now();
    const id = window.setInterval(() => {
      setCloneElapsed((performance.now() - start) / 1000);
    }, 100);
    return () => window.clearInterval(id);
  }, [cloning]);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="container py-14"
    >
      {/* v02 §6.1 thin top progress bar — ElevenLabs IVC doesn't expose
          per-step progress, so we drive a deterministic ease-out curve
          tuned to its typical 10-14s window: hits 95% at the upper
          bound and waits there until the API completes (the bar
          disappears when `cloning` flips false). No looping; the
          line travels the full width once. */}
      {cloning && (
        <div className="fixed top-0 left-0 right-0 h-0.5 bg-fg/10 overflow-hidden z-50">
          <div
            className="h-full bg-fg origin-left transition-[width] duration-100 ease-linear"
            style={{
              // Saturating curve: 1 - e^(-t/τ). τ chosen so we reach
              // ~63% at 7s, ~86% at 14s, asymptote 95%. Always leaves
              // the last 5% for the actual completion event.
              width: `${Math.min(95, 95 * (1 - Math.exp(-cloneElapsed / 7)))}%`,
            }}
          />
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-between mb-10"
        >
          {/* Back only appears when the user came here voluntarily
              (they already have a clone). Forced first-visit has no
              back path — Skip-with-demo is the only escape. */}
          {hasExistingClone ? (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          ) : (
            <div className="w-16" aria-hidden />
          )}
          <Badge variant={recording ? "live" : "default"}>
            STEP 0 · REFERENCE CAPTURE · {l1.toUpperCase()}
          </Badge>
          <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/40">
            ≤ {maxSeconds}s
          </div>
        </motion.div>

        {/* v02 §6.1 heading. */}
        <motion.div variants={itemVariants} className="text-center mb-10">
          <div className="font-stamp text-title leading-tight tracking-tighter mb-3">
            One thing first.
          </div>
          <div className="font-stamp text-2xl text-fg/60 tracking-tight">
            Read this in your own language.
          </div>
          <div className="font-data text-micro text-fg/40 uppercase tracking-[0.22em] mt-3">
            We extract your timbre — never your Mandarin attempt.
          </div>
        </motion.div>

        {/* v02 §6.1 passage card — bg-surface, radius-lg, shadow-2, padding 48px. */}
        <motion.div
          variants={itemVariants}
          className={cn(
            "bg-white rounded-lg shadow-2 mb-8",
            "p-8 md:p-12"
          )}
        >
          <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/40 mb-4">
            Reference script · {l1}
          </div>
          {/* v02 §5.3 text-body-lg (20px / 1.5) — PP Neue Montreal /
              Switzer for the passage body. */}
          <p className="text-fg text-body-lg leading-relaxed">{script}</p>
        </motion.div>

        {recording && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: ease.out }}
            className="clinical-card p-6 mb-8"
          >
            <div className="flex items-center justify-between mb-3 font-data text-micro uppercase tracking-[0.22em] text-fg/40">
              <span>Live · 16 kHz mono</span>
              <span className="text-signal">REC · {formatSeconds(elapsed)}</span>
            </div>
            <Waveform
              samples={liveSamples}
              tone="signal"
              height={80}
              barWidth={4}
              gap={4}
              bars={30}
            />
          </motion.div>
        )}

        {/* Three states: cloning (waiting for ElevenLabs) > recording > idle.
            Cloning takes priority so we never show a clickable mic while
            the previous capture is still in flight. */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col items-center justify-center gap-4"
        >
          {cloning ? (
            <div className="flex flex-col items-center gap-5 py-2">
              <div className="relative grid place-items-center w-24 h-24 rounded-full bg-fg/5 border border-fg/15">
                <Loader2 className="h-9 w-9 text-fg animate-spin" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <div className="font-stamp text-lg leading-tight">
                  Cloning your voice…
                </div>
                <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/50 mt-2 tabular-nums">
                  ElevenLabs IVC · {cloneElapsed.toFixed(1)}s · usually 8-15s
                </div>
              </div>
              <div className="font-data text-micro text-fg/40 leading-relaxed max-w-md text-center">
                We're extracting the timbre of your voice without the
                accent. Sit tight — this only happens once per session.
              </div>
            </div>
          ) : !recording ? (
            <>
              <motion.button
                onClick={onStart}
                className="relative grid place-items-center w-24 h-24 rounded-full bg-fg text-bg shadow-2 transition-shadow duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-4 focus-visible:ring-offset-bg"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.08) 0%, transparent 60%)",
                }}
                whileHover={{
                  scale: 1.02,
                  boxShadow:
                    "0 16px 40px rgba(10, 10, 10, 0.08), 0 4px 12px rgba(10, 10, 10, 0.04)",
                  transition: { duration: 0.2, ease: ease.out },
                }}
                whileTap={{
                  scale: 0.96,
                  transition: { duration: 0.1, ease: ease.out },
                }}
                aria-label="Start reference capture"
              >
                <Mic className="h-7 w-7" strokeWidth={1.5} />
              </motion.button>
              <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/40">
                Hold to record — auto-stops at {maxSeconds}s
              </div>
            </>
          ) : (
            <Button variant="signal" size="xl" onClick={onStop}>
              <Square className="h-5 w-5" fill="currentColor" /> Stop & clone voice <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </motion.div>

        {/* Judge-shortcut escape hatch. Hidden once a clone exists in
            the session (re-capture flow has the Back button instead).
            Spelt out so the user knows what they're trading away — we
            never want a quiet swap of timbre to the preset voice. */}
        {!hasExistingClone && !recording && (
          <motion.div
            variants={itemVariants}
            className="mt-14 pt-6 border-t border-line/60 text-center"
          >
            <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/40 mb-2">
              Short on time?
            </div>
            <button
              type="button"
              onClick={onSkipWithDemoVoice}
              className="font-data text-sm text-fg/60 hover:text-fg underline underline-offset-4 decoration-line transition-colors"
            >
              Skip with demo voice (faster)
            </button>
            <div className="font-data text-micro text-fg/40 mt-2 leading-relaxed max-w-md mx-auto">
              Golden Voice will play the bundled demo speaker instead of
              your own timbre. You can re-capture any time.
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
