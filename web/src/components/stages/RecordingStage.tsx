import { Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Waveform } from "@/components/Waveform";
import { SentencePrompt } from "@/components/SentencePrompt";
import { formatSeconds } from "@/lib/utils";

interface Props {
  liveSamples: number[];
  elapsed: number;
  maxSeconds: number;
  onStop: () => void;
  /** Optional label for whether we're recording the reference vs the target. */
  label?: string;
}

export function RecordingStage({ liveSamples, elapsed, maxSeconds, onStop, label = "Target capture" }: Props) {
  const remaining = Math.max(0, maxSeconds - elapsed);

  return (
    <div className="container py-14 grid place-items-center">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <Badge variant="live">
            <span className="inline-block w-2 h-2 rounded-full bg-fg animate-pulse" />
            LIVE · {label}
          </Badge>
          <div className="font-data text-xs text-fg/60 uppercase tracking-[0.2em]">
            <span className="text-signal">{formatSeconds(elapsed)}</span>
            <span className="text-fg/30"> / {formatSeconds(maxSeconds)}</span>
            <span className="text-fg/30 mx-2">·</span>
            <span>−{formatSeconds(remaining)}</span>
          </div>
        </div>

        <SentencePrompt allowSwitch={false} />

        <div className="mt-12 clinical-card p-6">
          <div className="flex items-center justify-between mb-3 font-data text-[10px] uppercase tracking-[0.2em] text-fg/40">
            <span>Microphone · 16 kHz · mono</span>
            <span className="text-signal">REC</span>
          </div>
          <Waveform samples={liveSamples} tone="signal" height={100} />
        </div>

        <div className="mt-10 flex justify-center">
          <Button variant="outline" size="lg" onClick={onStop}>
            <Square className="h-4 w-4" fill="currentColor" /> Stop
          </Button>
        </div>
      </div>
    </div>
  );
}
