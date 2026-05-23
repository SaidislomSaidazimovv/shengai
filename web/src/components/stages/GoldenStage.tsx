import { useEffect, useRef, useState } from "react";
import { Play, ArrowRight, RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Waveform } from "@/components/Waveform";
import { useSession } from "@/store/session";
import { getDemoSentence } from "@/lib/demoData";

interface Props {
  onContinue: () => void;
  onRetry: () => void;
}

/**
 * GOLDEN VOICE — plays the user's cloned voice saying the Mandarin
 * correctly.
 *
 * Two visual paths:
 *   - Audio actually plays (ElevenLabs key configured + bytes returned):
 *     drive the waveform from the playing audio via WebAudio analyser.
 *   - Audio not available (no key, missing pre-rendered MP3, 404):
 *     surface the missing-audio state honestly + animate a placeholder
 *     gold waveform so the UI doesn't look frozen. We do NOT pretend
 *     the audio is playing.
 */
export function GoldenStage({ onContinue, onRetry }: Props) {
  const golden = useSession((s) => s.golden);
  const clone = useSession((s) => s.clone);
  const sentence = getDemoSentence(useSession((s) => s.sentenceId));

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const [audioMissing, setAudioMissing] = useState(false);
  const [pulse, setPulse] = useState<number[]>([]);

  // Wire the <audio> element into a WebAudio AnalyserNode the first
  // time it's available; this lets us drive a real RMS waveform from
  // whatever's actually playing instead of faking it with Math.sin.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || analyserRef.current) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaElementSource(el);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    } catch {
      // Some browsers throw if the element wasn't user-gesture-triggered;
      // we'll just fall back to the placeholder animation.
    }
  }, [golden?.url]);

  // Sample the analyser while playing.
  useEffect(() => {
    if (!playing) return;
    const analyser = analyserRef.current;
    if (!analyser) {
      // Fallback: animate a placeholder gold wave so the UI is alive.
      let i = 0;
      const id = setInterval(() => {
        const next: number[] = [];
        for (let k = 0; k < 96; k++) {
          const phase = (i + k) * 0.22;
          next.push(0.18 + 0.5 * Math.abs(Math.sin(phase)) * Math.exp(-k / 80));
        }
        setPulse(next);
        i++;
      }, 50);
      return () => clearInterval(id);
    }

    const buf = new Float32Array(analyser.fftSize);
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      setPulse((prev) => {
        const next = prev.length >= 96 ? prev.slice(-95) : prev.slice();
        next.push(rms);
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  // Auto-play once on mount if a URL is set.
  useEffect(() => {
    if (golden?.url && audioRef.current) {
      void audioCtxRef.current?.resume();
      audioRef.current.play().catch(() => {
        // Autoplay blocked or URL invalid; we still show a play button.
      });
    }
  }, [golden]);

  // Also animate the placeholder when there's NO golden clip at all —
  // the gold-waveform should never look frozen, even before audio loads.
  useEffect(() => {
    if (playing) return;
    let i = 0;
    const id = setInterval(() => {
      const next: number[] = [];
      for (let k = 0; k < 96; k++) {
        const phase = (i + k) * 0.18;
        next.push(0.08 + 0.35 * Math.abs(Math.sin(phase)) * Math.exp(-k / 100));
      }
      setPulse(next);
      i++;
    }, 70);
    return () => clearInterval(id);
  }, [playing]);

  const providerLabel =
    golden?.source === "elevenlabs"
      ? "ElevenLabs Flash v2.5"
      : golden?.source === "prerendered"
      ? "Pre-rendered fallback"
      : "Awaiting clip";

  return (
    <div className="container py-14 grid place-items-center">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-10">
          <Badge variant="gold">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
            GOLDEN VOICE · YOUR TIMBRE
          </Badge>
          <span className="font-data text-[10px] uppercase tracking-[0.22em] text-fg/40">
            {providerLabel}
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
            <span className={audioMissing ? "text-signal" : "text-gold"}>
              {audioMissing ? "AUDIO MISSING" : playing ? "PLAYING" : "READY"}
            </span>
          </div>
          <Waveform samples={pulse} tone="gold" height={100} />
          {golden?.url && (
            <audio
              ref={audioRef}
              src={golden.url}
              onPlay={() => {
                setPlaying(true);
                setAudioMissing(false);
              }}
              onEnded={() => {
                setPlaying(false);
                setDone(true);
              }}
              onError={() => setAudioMissing(true)}
              className="hidden"
              preload="auto"
            />
          )}
        </div>

        {audioMissing && (
          <div className="mt-4 clinical-card p-4 border-signal/40 bg-signal/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-signal mt-0.5 shrink-0" />
              <div className="text-sm font-data text-fg/70 leading-relaxed">
                <strong className="text-fg">Golden clip not available yet.</strong> Connect an
                ElevenLabs key (or drop a pre-rendered MP3 in{" "}
                <code className="text-fg">web/public/demo-audio/</code>) to enable the cloned
                voice. The rest of the demo loop still runs.
              </div>
            </div>
          </div>
        )}

        <div className="mt-10 flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            size="lg"
            onClick={() => {
              setAudioMissing(false);
              void audioCtxRef.current?.resume();
              audioRef.current?.play().catch(() => setAudioMissing(true));
            }}
          >
            <Play className="h-4 w-4" /> Replay
          </Button>
          <Button variant="outline" size="lg" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" /> Retry capture
          </Button>
          <Button
            variant="gold"
            size="lg"
            onClick={onContinue}
            disabled={!done && !audioMissing && !!golden}
          >
            Mirror the lips <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
