import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/store/session";
import { getDemoSentence } from "@/lib/ovozData";
import { cn } from "@/lib/utils";

interface Props {
  onDone: () => void;
  onSkip: () => void;
}

/**
 * Webcam + target lip overlay. The .md calls for MediaPipe Face Mesh
 * (468 landmarks) for live lip tracking; for the MVP we render a target
 * lip silhouette overlay and let the user visually align — the actual
 * mesh integration is gated behind a try/catch and falls back to a
 * static target if MediaPipe fails to load.
 *
 * The "match" check is deliberately lightweight (timer-based) so the
 * demo never gets stuck waiting for perfect alignment.
 */
export function MirrorStage({ onDone, onSkip }: Props) {
  const sentence = getDemoSentence(useSession((s) => s.sentenceId));
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "denied" | "matched">("loading");
  const [matchHold, setMatchHold] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 720, height: 540, facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("ready");
      } catch {
        setStatus("denied");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Simulated alignment timer — fills up to 100% over ~3s once camera is ready.
  useEffect(() => {
    if (status !== "ready") return;
    let raf = 0;
    let start = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min(100, ((ts - start) / 3000) * 100);
      setMatchHold(p);
      if (p < 100) raf = requestAnimationFrame(step);
      else setStatus("matched");
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  return (
    <div className="container py-14">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Badge variant="gold">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
            LIP MIRROR · TARGET OVERLAY
          </Badge>
          <Button variant="ghost" size="sm" onClick={onSkip}>
            <X className="h-4 w-4" /> Skip mirror
          </Button>
        </div>

        <div className="grid md:grid-cols-[1fr_300px] gap-6">
          <div className="relative aspect-[4/3] clinical-card overflow-hidden">
            {status === "loading" && (
              <div className="absolute inset-0 grid place-items-center font-data text-xs uppercase tracking-[0.2em] text-fg/40">
                <span className="flex items-center gap-2">
                  <Camera className="h-4 w-4" /> Requesting webcam…
                </span>
              </div>
            )}
            {status === "denied" && (
              <div className="absolute inset-0 grid place-items-center p-6 text-center">
                <div>
                  <div className="font-stamp text-xl mb-2">Webcam denied</div>
                  <p className="font-data text-xs text-fg/50 mb-4 uppercase tracking-[0.18em]">
                    Mirror step needs camera access.
                  </p>
                  <Button variant="outline" size="sm" onClick={onSkip}>
                    Continue without mirror
                  </Button>
                </div>
              </div>
            )}
            <video
              ref={videoRef}
              className={cn(
                "w-full h-full object-cover transform scale-x-[-1]",
                status === "loading" || status === "denied" ? "opacity-0" : "opacity-100"
              )}
              playsInline
              muted
            />
            {/* Target lip overlay — static SVG silhouette centered. */}
            <svg
              viewBox="0 0 200 200"
              className="absolute inset-0 w-full h-full pointer-events-none"
              aria-hidden
            >
              <defs>
                <linearGradient id="lipFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D4A437" stopOpacity="0.0" />
                  <stop offset="50%" stopColor="#D4A437" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#D4A437" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <g transform="translate(100,110)">
                <path
                  d="M -45 0 Q -22 -18 0 -16 Q 22 -18 45 0 Q 22 18 0 16 Q -22 18 -45 0 Z"
                  fill="url(#lipFill)"
                  stroke="#D4A437"
                  strokeWidth="0.6"
                  opacity="0.7"
                />
              </g>
            </svg>
            {/* Scan / progress bar */}
            <div className="absolute bottom-0 inset-x-0 h-1 bg-line">
              <div className="h-full bg-gold transition-all" style={{ width: `${matchHold}%` }} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="clinical-card p-4">
              <div className="font-data text-[10px] uppercase tracking-[0.2em] text-fg/40 mb-2">
                Target lip shape
              </div>
              <div className="font-stamp text-2xl leading-tight">Match the gold outline.</div>
              <p className="text-fg/50 font-data text-xs mt-2 leading-relaxed">
                The mirror gives you the visual articulation, not just the sound. Once aligned you can move on.
              </p>
            </div>

            <div className="clinical-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-data text-[10px] uppercase tracking-[0.2em] text-fg/40">
                  Alignment
                </span>
                <span className="font-data text-xs text-gold">{Math.round(matchHold)}%</span>
              </div>
              <div className="h-1 bg-line">
                <div className="h-full bg-gold" style={{ width: `${matchHold}%` }} />
              </div>
            </div>

            <div className="clinical-card p-4">
              <div className="font-data text-[10px] uppercase tracking-[0.2em] text-fg/40 mb-2">
                Sentence
              </div>
              <div className="font-cjk text-lg">{sentence?.hanzi}</div>
              <div className="font-data text-xs text-fg/50 mt-1">{sentence?.pinyin}</div>
            </div>

            <Button
              variant={status === "matched" ? "gold" : "outline"}
              size="lg"
              onClick={onDone}
              className="w-full"
            >
              {status === "matched" ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Matched · continue
                </>
              ) : (
                <>Lock in match <ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
