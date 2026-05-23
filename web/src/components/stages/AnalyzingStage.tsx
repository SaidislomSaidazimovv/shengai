import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSession } from "@/store/session";
import { getDemoSentence } from "@/lib/ovozData";

/**
 * Clinical loading state — the calm before the diagnosis card slams in.
 * Phoneme boxes light up one at a time, suggesting machine perception is
 * marching through the utterance. A scan line sweeps top-to-bottom.
 */
export function AnalyzingStage() {
  const sentenceId = useSession((s) => s.sentenceId);
  const sentence = getDemoSentence(sentenceId);
  const phonemes = sentence?.expectedPhonemes ?? [];

  const [active, setActive] = useState<number>(-1);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setActive(i);
      i = (i + 1) % Math.max(phonemes.length, 1);
    }, 110);
    return () => clearInterval(interval);
  }, [phonemes.length]);

  return (
    <div className="container py-14 grid place-items-center">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-10">
          <Badge variant="default">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-fg/60 animate-pulse" />
            PHONEME DETECTION
          </Badge>
          <span className="font-data text-[10px] uppercase tracking-[0.22em] text-fg/40">
            wav2vec2-xlsr · L2-arctic
          </span>
        </div>

        <div className="text-center mb-12">
          <div className="font-stamp text-3xl tracking-tight text-fg/80">
            Running differential phoneme analysis…
          </div>
          <div className="font-data text-fg/40 text-sm mt-3 uppercase tracking-[0.2em]">
            Comparing produced vs expected articulation
          </div>
        </div>

        <div className="relative clinical-card p-6 overflow-hidden">
          {/* Scan line */}
          <div
            className="absolute inset-x-0 h-px bg-signal/80 animate-scan-line pointer-events-none"
            aria-hidden
          />

          <div className="flex flex-wrap gap-2 justify-center">
            {phonemes.map((p, i) => (
              <div
                key={i}
                className={cn(
                  "min-w-[44px] h-12 grid place-items-center border font-data text-sm transition-colors",
                  active === i
                    ? "border-signal text-signal bg-signal/10"
                    : active > i
                    ? "border-fg/20 text-fg/80"
                    : "border-line text-fg/30"
                )}
              >
                /{p}/
              </div>
            ))}
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
