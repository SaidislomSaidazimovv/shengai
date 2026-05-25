import { motion } from "motion/react";
import { Mic, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SentencePrompt } from "@/components/SentencePrompt";
import { useSession } from "@/store/session";
import { ease } from "@/motion/presets";

interface Props {
  onStartRecording: () => void;
  onStartReference: () => void;
}

/**
 * The opening screen — mic button, target sentence, language toggle.
 *
 * The mic is GATED on having a voice clone. Without a clone, the
 * Golden Voice step would either fall back to a stranger's voice
 * (Reference Audio Trap, §3) or quietly play the preset demo voice
 * pretending to be the user. Forcing reference capture first keeps
 * the "your own voice" claim honest. A judge-shortcut "Skip with
 * demo voice" button lives on the ReferenceStage for time-pressed
 * walkthroughs.
 */
export function IdleStage({ onStartRecording, onStartReference }: Props) {
  const reference = useSession((s) => s.reference);
  const clone = useSession((s) => s.clone);
  const micEnabled = !!clone;
  const usingDemoVoice = clone?.source === "fallback";
  // Differentiate explicit Skip (voiceId points at DEMO_USER) from a
  // failed clone attempt (voiceId === "demo-fallback"). The body copy
  // and CTA should not lie to a user who actually recorded a reference.
  const cloneFailed = usingDemoVoice && clone?.voiceId === "demo-fallback";

  return (
    <div className="container py-14 grid place-items-center">
      <div className="w-full max-w-3xl">
        <SentencePrompt />

        <div className="mt-16 flex flex-col items-center gap-6">
          <div className="relative">
            {/* v02 §5.6 mesh motif — corner accents framing the mic. */}
            <div
              className="absolute -top-6 -left-6 w-10 h-10 mesh-corner pointer-events-none"
              aria-hidden
            />
            <div
              className="absolute -top-6 -right-6 w-10 h-10 mesh-corner pointer-events-none"
              aria-hidden
            />
            <div
              className="absolute -bottom-6 -left-6 w-10 h-10 mesh-corner pointer-events-none"
              aria-hidden
            />
            <div
              className="absolute -bottom-6 -right-6 w-10 h-10 mesh-corner pointer-events-none"
              aria-hidden
            />
            {/* v02 §6.2 mic spec:
                 - 120px diameter circle
                 - bg --fg-primary (near black)
                 - subtle inset radial gradient
                 - icon lucide Mic 36px white
                 - idle breathing scale 1↔1.015 over 3s ease-in-out
                 - hover scale 1.04 + shadow-3 (200ms)
                 - press scale 0.96 (100ms)
                 Locked state: no breathing, no hover, opacity-40, cursor
                 not-allowed. Clicking the locked mic routes the user to
                 ReferenceStage instead of recording — that's the only
                 path forward when no clone exists. */}
            <motion.button
              onClick={micEnabled ? onStartRecording : onStartReference}
              className={
                "relative grid place-items-center w-30 h-30 rounded-full bg-fg text-bg shadow-2 transition-shadow duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-4 focus-visible:ring-offset-bg " +
                (micEnabled ? "" : "opacity-40 cursor-pointer")
              }
              style={{
                backgroundImage:
                  "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.08) 0%, transparent 60%)",
              }}
              animate={micEnabled ? { scale: [1, 1.015, 1] } : { scale: 1 }}
              transition={
                micEnabled
                  ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0 }
              }
              whileHover={
                micEnabled
                  ? { scale: 1.04, transition: { duration: 0.2, ease: ease.out } }
                  : undefined
              }
              whileTap={
                micEnabled
                  ? { scale: 0.96, transition: { duration: 0.1, ease: ease.out } }
                  : undefined
              }
              aria-label={micEnabled ? "Start recording" : "Capture reference first"}
            >
              {/* v02 §5.6 — subtle mesh dots inside the mic button. */}
              <span
                className="absolute inset-2 rounded-full bg-mesh-dots opacity-30 pointer-events-none"
                aria-hidden
              />
              <Mic className="h-9 w-9 relative" strokeWidth={1.5} />
            </motion.button>
          </div>

          <div className="text-center">
            {micEnabled ? (
              <div className="font-data text-[11px] uppercase tracking-[0.22em] text-fg/40">
                Press <kbd className="px-1.5 py-0.5 border border-line text-fg/60 font-data text-[10px]">SPACE</kbd> to speak · hold to record · auto-stops at 8s
              </div>
            ) : (
              <div className="font-data text-[11px] uppercase tracking-[0.22em] text-signal">
                Voice clone required — record a 10s reference first.
              </div>
            )}
          </div>

          {micEnabled && (
            <div className="mt-2 flex items-center gap-4">
              <LanguageToggle />
            </div>
          )}

          {!micEnabled && (
            <Button variant="signal" size="xl" onClick={onStartReference}>
              Capture reference <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="mt-14">
          <div className="hairline mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ReferenceCard
              ok={!!reference}
              hasClone={!!clone}
              usingDemoVoice={usingDemoVoice}
              cloneFailed={cloneFailed}
              onStart={onStartReference}
            />
            <BeliefCard />
          </div>
        </div>
      </div>
    </div>
  );
}

interface ReferenceCardProps {
  ok: boolean;
  hasClone: boolean;
  usingDemoVoice: boolean;
  cloneFailed: boolean;
  onStart: () => void;
}

function ReferenceCard({ ok, hasClone, usingDemoVoice, cloneFailed, onStart }: ReferenceCardProps) {
  // Four-state badge logic:
  //   - hasClone && !usingDemoVoice → user's live clone, the honest path
  //   - cloneFailed                 → reference recorded but /api/clone
  //     came back as "demo-fallback". We don't pretend the user skipped;
  //     we explicitly invite them to retry.
  //   - hasClone &&  usingDemoVoice → judge took the Skip route, demo
  //     voice is in use (we name it explicitly so the user knows what
  //     Golden Voice will play)
  //   - !hasClone                   → mandatory pre-flight state
  const badgeVariant: "default" | "signal" = hasClone && !cloneFailed ? "default" : "signal";
  const badgeLabel = !hasClone
    ? "REQUIRED"
    : cloneFailed
      ? "CLONE FAILED"
      : usingDemoVoice
        ? "DEMO VOICE ACTIVE"
        : "YOUR VOICE CLONED";

  const heading = !hasClone || cloneFailed ? "Capture native timbre first." : "Voice ready.";

  const body = !hasClone
    ? "Read a short paragraph in your own language so Golden Voice can clone your timbre without leaking your Mandarin accent."
    : cloneFailed
      ? "Voice cloning didn't complete — Golden Voice is using the bundled demo clip for now. Try re-capturing; check your mic and network if it fails again."
      : usingDemoVoice
        ? "You skipped reference capture — Golden Voice will play the bundled demo voice. Record a fresh reference any time to hear yourself instead."
        : ok
          ? "Your voice is cloned. Each Golden Voice playback will speak the sentence in your own timbre."
          : "Your voice is ready. Each Golden Voice playback will speak the sentence in your own timbre.";

  return (
    <div className="clinical-card clinical-card-interactive p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-data text-[10px] uppercase tracking-[0.2em] text-fg/40">Step 0 · Reference</span>
        <Badge variant={badgeVariant}>{badgeLabel}</Badge>
      </div>
      <div className="font-stamp text-2xl leading-tight mb-2">{heading}</div>
      <p className="text-fg/50 text-sm font-data leading-relaxed mb-4">{body}</p>
      <Button variant={cloneFailed ? "signal" : "outline"} size="sm" onClick={onStart}>
        {hasClone ? (cloneFailed ? "Re-capture reference" : "Re-capture reference") : "Capture reference"}
      </Button>
    </div>
  );
}

function BeliefCard() {
  return (
    <div className="clinical-card clinical-card-interactive p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-data text-[10px] uppercase tracking-[0.2em] text-fg/40">How it works</span>
        <span className="text-fg/30 inline-flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> <span className="font-data text-[10px] uppercase tracking-[0.18em]">10-sec loop</span>
        </span>
      </div>
      <ol className="space-y-2 text-sm font-data text-fg/60 leading-relaxed">
        <li className="flex gap-3"><span className="text-fg/30 w-5">01</span><span><span className="text-fg">Speak.</span> Read the Mandarin sentence into the mic.</span></li>
        <li className="flex gap-3"><span className="text-fg/30 w-5">02</span><span><span className="text-fg">Diagnose.</span> L1-specific phoneme error card.</span></li>
        <li className="flex gap-3"><span className="text-fg/30 w-5">03</span><span><span className="text-fg">Golden voice.</span> Your own voice — corrected.</span></li>
        <li className="flex gap-3"><span className="text-fg/30 w-5">04</span><span><span className="text-fg">Mirror.</span> Match the target lip shape.</span></li>
      </ol>
    </div>
  );
}
