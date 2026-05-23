import { useEffect, useRef, useState } from "react";
import { Play, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Waveform } from "@/components/Waveform";
import { useSession } from "@/store/session";
import { getDemoSentence } from "@/lib/ovozData";

interface Props {
  onContinue: () => void;
  onRetry: () => void;
}

/**
 * GOLDEN VOICE — plays the user's cloned voice saying the Mandarin
 * correctly. If `golden` isn't set we render a placeholder with a play
 * button; in production this is wired to the ElevenLabs synth response.
 */
export function GoldenStage({ onContinue, onRetry }: Props) {
  const golden = useSession((s) => s.golden);
  const clone = useSession((s) => s.clone);
  const sentence = getDemoSentence(useSession((s) => s.sentenceId));

  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const [pulse, setPulse] = useState<number[]>([]);

  // Animate a gold "pulse" while playing — purely cosmetic.
  useEffect(() => {
    if (!playing) return;
    let i = 0;
    const id = setInterval(() => {
      const next: number[] = [];
      for (let k = 0; k < 80; k++) {
        const phase = (i + k) * 0.18;
        next.push(0.12 + 0.55 * Math.abs(Math.sin(phase)));
      }
      setPulse(next);
      i++;
    }, 60);
    return () => clearInterval(id);
  }, [playing]);

  // Auto-play once on mount if audio is ready.
  useEffect(() => {
    if (golden?.url && audioRef.current) {
      audioRef.current.play().catch(() => undefined);
    }
  }, [golden]);

  return (
    <div className="container py-14 grid place-items-center">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-10">
          <Badge variant="gold">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
            GOLDEN VOICE · YOUR TIMBRE
          </Badge>
          <span className="font-data text-[10px] uppercase tracking-[0.22em] text-fg/40">
            {golden?.source === "elevenlabs"
              ? "ElevenLabs Flash v2.5"
              : golden?.source === "prerendered"
              ? "Pre-rendered fallback"
              : "Awaiting clip"}
          </span>
        </div>

        <div className="text-center mb-10">
          <div className="font-stamp uppercase tracking-tighter text-fg/40 text-sm mb-3">
            Same voice. Mandarin. Correct.
          </div>
          <div className="font-cjk text-5xl md:text-6xl text-gold leading-none">
            {sentence?.hanzi}
          </div>
          <div className="font-data text-fg/60 mt-3">{sentence?.pinyin}</div>
        </div>

        <div className="clinical-card p-6">
          <div className="flex items-center justify-between mb-3 font-data text-[10px] uppercase tracking-[0.2em] text-fg/40">
            <span>Voice ID · {clone?.voiceId?.slice(0, 12) ?? "demo-fallback"}</span>
            <span className="text-gold">PLAYING</span>
          </div>
          <Waveform samples={pulse} tone="gold" height={100} />
          {golden?.url && (
            <audio
              ref={audioRef}
              src={golden.url}
              onPlay={() => setPlaying(true)}
              onEnded={() => {
                setPlaying(false);
                setDone(true);
              }}
              className="hidden"
            />
          )}
        </div>

        <div className="mt-10 flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            size="lg"
            onClick={() => {
              audioRef.current?.play().catch(() => undefined);
            }}
          >
            <Play className="h-4 w-4" /> Replay
          </Button>
          <Button variant="outline" size="lg" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" /> Retry capture
          </Button>
          <Button variant="gold" size="lg" onClick={onContinue} disabled={!done && !!golden}>
            Mirror the lips <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
