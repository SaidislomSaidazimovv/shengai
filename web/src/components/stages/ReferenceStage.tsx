import { Mic, ArrowLeft, ArrowRight, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Waveform } from "@/components/Waveform";
import { REFERENCE_SCRIPTS } from "@/lib/ovozData";
import { useSession } from "@/store/session";
import { formatSeconds } from "@/lib/utils";

interface Props {
  recording: boolean;
  liveSamples: number[];
  elapsed: number;
  maxSeconds: number;
  onStart: () => void;
  onStop: () => void;
  onBack: () => void;
}

/**
 * Reference capture screen. Per OVOZ_DevHandover §3 the user reads a short
 * paragraph *in their L1* so we clone their timbre without Mandarin
 * contamination. This is a separate sub-state from the main loop.
 */
export function ReferenceStage({
  recording,
  liveSamples,
  elapsed,
  maxSeconds,
  onStart,
  onStop,
  onBack,
}: Props) {
  const l1 = useSession((s) => s.l1);
  const script = REFERENCE_SCRIPTS[l1];

  return (
    <div className="container py-14">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Badge variant={recording ? "live" : "gold"}>
            STEP 0 · REFERENCE CAPTURE · {l1.toUpperCase()}
          </Badge>
          <div className="font-data text-[10px] uppercase tracking-[0.22em] text-fg/40">
            ≤ {maxSeconds}s
          </div>
        </div>

        <div className="text-center mb-10">
          <div className="font-stamp text-4xl tracking-tight mb-3">Read this in your own language.</div>
          <div className="font-data text-fg/40 text-xs uppercase tracking-[0.22em]">
            We extract your timbre — never your Mandarin attempt.
          </div>
        </div>

        <div className="clinical-card p-8 mb-8">
          <div className="font-data text-[10px] uppercase tracking-[0.2em] text-fg/40 mb-4">
            Reference script · {l1}
          </div>
          <p className="text-fg/90 text-lg leading-relaxed font-sans">{script}</p>
        </div>

        {recording && (
          <div className="clinical-card p-6 mb-8">
            <div className="flex items-center justify-between mb-3 font-data text-[10px] uppercase tracking-[0.2em] text-fg/40">
              <span>Live · 16 kHz mono</span>
              <span className="text-signal">REC · {formatSeconds(elapsed)}</span>
            </div>
            <Waveform samples={liveSamples} tone="gold" height={80} />
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          {!recording ? (
            <Button variant="gold" size="xl" onClick={onStart}>
              <Mic className="h-5 w-5" /> Start reference capture
            </Button>
          ) : (
            <Button variant="signal" size="xl" onClick={onStop}>
              <Square className="h-5 w-5" fill="currentColor" /> Stop & clone voice <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
