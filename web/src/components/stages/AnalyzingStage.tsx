import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSession } from "@/store/session";
import { getDemoSentence } from "@/lib/demoData";

/**
 * Clinical loading state — the calm before the diagnosis card slams in.
 *
 * Animation choreography (mirrors the timing in App.tsx where we hold
 * for 1.8s before advancing to DIAGNOSIS):
 *   0.0–1.2 s : scan-bar walks across all phonemes, lighting them up
 *   1.2–1.8 s : everything goes muted, the trigger phoneme pulses red
 *   1.8 s     : caller transitions away to DIAGNOSIS
 *
 * The trigger we pulse is the *diagnosis's* trigger phoneme (hardcoded
 * per L1 + sentence), which keeps the analyzing visual consistent with
 * the card that lands next. If the MDD response has come back with a
 * different worst phoneme, App.tsx has already stored it; we use that
 * when available and fall back to the script otherwise.
 */
export function AnalyzingStage() {
  const sentenceId = useSession((s) => s.sentenceId);
  const triggeredPhoneme = useSession((s) => s.triggeredPhoneme);
  const triggeredPhonemeIdx = useSession((s) => s.triggeredPhonemeIdx);
  const asrProvider = useSession((s) => s.asrProvider);
  const l1 = useSession((s) => s.l1);

  // Provider label shown in the top-right while analyzing — clarifies
  // which engine produced the transcript driving the trigger phoneme.
  const providerLabel =
    asrProvider === "huggingface"
      ? "Whisper Large V3 · HuggingFace"
      : asrProvider === "browser"
      ? "Web Speech API · Browser"
      : "wav2vec2-xlsr · L2-arctic";

  const sentence = getDemoSentence(sentenceId);
  const phonemes = sentence?.expectedPhonemes ?? [];

  // Prefer the explicit index from the store (set by App after ASR);
  // fall back to the scripted trigger only if nothing else is set.
  const triggerHardcoded = sentence?.diagnoses[l1].triggerPhoneme;
  const trigger = triggeredPhoneme ?? triggerHardcoded ?? null;
  const triggerIdx =
    triggeredPhonemeIdx !== null && triggeredPhonemeIdx >= 0
      ? triggeredPhonemeIdx
      : trigger
      ? phonemes.indexOf(trigger)
      : -1;

  const [scanIdx, setScanIdx] = useState(-1);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (phonemes.length === 0) return;
    let i = 0;
    const step = Math.max(50, Math.floor(1200 / phonemes.length));
    const scanner = setInterval(() => {
      setScanIdx(i);
      i++;
      if (i >= phonemes.length) {
        clearInterval(scanner);
        setTimeout(() => setSettled(true), 150);
      }
    }, step);
    return () => clearInterval(scanner);
  }, [phonemes.length]);

  return (
    <div className="container py-14 grid place-items-center animate-in fade-in duration-500">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-10">
          <Badge variant="default">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-fg/60 animate-pulse" />
            PHONEME DETECTION
          </Badge>
          <span className="font-data text-[10px] uppercase tracking-[0.22em] text-fg/40">
            {providerLabel}
          </span>
        </div>

        <div className="text-center mb-12">
          <div className="font-stamp text-3xl tracking-tight text-fg/80">
            {settled ? "Anomaly located." : "Running differential phoneme analysis…"}
          </div>
          <div className="font-data text-fg/40 text-sm mt-3 uppercase tracking-[0.2em]">
            {settled ? `Trigger · /${trigger}/` : "Comparing produced vs expected articulation"}
          </div>
        </div>

        <div className="relative clinical-card p-6 overflow-hidden">
          {/* Scan line — only while scanning */}
          {!settled && (
            <div
              className="absolute inset-x-0 h-px bg-signal/80 animate-scan-line pointer-events-none"
              aria-hidden
            />
          )}

          <div className="flex flex-wrap gap-2 justify-center">
            {phonemes.map((p, i) => {
              const isTrigger = settled && i === triggerIdx;
              const isLitByScan = !settled && scanIdx >= i;
              const isCurrent = !settled && scanIdx === i;
              return (
                <div
                  key={i}
                  className={cn(
                    "min-w-[44px] h-12 grid place-items-center border font-data text-sm transition-all duration-200",
                    isTrigger
                      ? "border-signal text-signal bg-signal/15 shadow-[0_0_0_1px_rgba(255,56,56,0.4)] animate-pulse"
                      : isCurrent
                      ? "border-signal text-signal bg-signal/10 scale-[1.04]"
                      : isLitByScan
                      ? "border-fg/30 text-fg/80"
                      : settled
                      ? "border-line text-fg/20"
                      : "border-line text-fg/30"
                  )}
                >
                  /{p}/
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 font-data text-[10px] uppercase tracking-[0.18em] text-fg/40">
          <Metric label="Frames" value="seg=20ms" />
          <Metric label="Window" value="hann · 25ms" />
          <Metric label="Model" value="xlsr-53 · L2" />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line p-3">
      <div className="text-fg/40">{label}</div>
      <div className="text-fg/80 mt-1">{value}</div>
    </div>
  );
}
