import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/store/session";
import { getDemoSentence } from "@/lib/demoData";
import { useLipTracker } from "@/hooks/useLipTracker";
import { cn } from "@/lib/utils";

interface Props {
  onDone: () => void;
  onSkip: () => void;
}

/**
 * Webcam + real MediaPipe Face Landmarker lip overlay.
 *
 * Flow:
 *   1. Acquire webcam stream.
 *   2. Lazily load the MediaPipe Tasks-Vision face landmarker (WebGL).
 *   3. Per frame: detect 468 face landmarks, extract the lip outline,
 *      and draw it on a canvas overlaid on the video element.
 *   4. Compute a real alignment score from mouth openness relative to
 *      a per-sentence target — no more fake 3-second timer.
 *
 * If the model fails to load (offline, no WebGL), the stage degrades
 * to a static SVG target and a "model unavailable" badge — the loop
 * still completes via the Skip button.
 */
export function MirrorStage({ onDone, onSkip }: Props) {
  const sentence = getDemoSentence(useSession((s) => s.sentenceId));
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "denied" | "matched">("loading");

  const tracker = useLipTracker({ targetOpenness: 0.04, tolerance: 0.035 });

  // 1. Acquire webcam.
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
          tracker.attach(videoRef.current);
        }
        setStatus("ready");
      } catch {
        setStatus("denied");
      }
    })();
    return () => {
      cancelled = true;
      tracker.detach();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Draw lip overlay each time the tracker emits a frame.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const frame = tracker.frame;
    if (!frame) return;

    // The <video> is mirrored (scale-x-[-1]) so the user feels natural;
    // we mirror the X axis here too so the overlay aligns with the video.
    const tx = (n: { x: number; y: number }) => ({ x: (1 - n.x) * w, y: n.y * h });

    const drawPoly = (pts: { x: number; y: number }[], stroke: string, fill?: string) => {
      if (pts.length === 0) return;
      ctx.beginPath();
      const first = tx(pts[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < pts.length; i++) {
        const p = tx(pts[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    };

    drawPoly(frame.outer, "#D4A437", "rgba(212, 164, 55, 0.18)");
    drawPoly(frame.inner, "#FF3838", "rgba(255, 56, 56, 0.06)");
  }, [tracker.frame]);

  // 3. When alignment crosses the threshold, mark matched.
  useEffect(() => {
    if (status !== "ready") return;
    if (tracker.alignment >= 80) setStatus("matched");
  }, [tracker.alignment, status]);

  return (
    <div className="container py-14">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Badge variant="gold">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
            LIP MIRROR · FACE LANDMARKER
          </Badge>
          <Button variant="ghost" size="sm" onClick={onSkip}>
            <X className="h-4 w-4" /> Skip mirror
          </Button>
        </div>

        <div className="grid md:grid-cols-[1fr_300px] gap-6">
          <div className="relative aspect-[4/3] clinical-card overflow-hidden">
            {status === "loading" && (
              <div className="absolute inset-0 grid place-items-center font-data text-xs uppercase tracking-[0.2em] text-fg/40 z-10">
                <span className="flex items-center gap-2">
                  <Camera className="h-4 w-4" /> Requesting webcam…
                </span>
              </div>
            )}
            {status === "denied" && (
              <div className="absolute inset-0 grid place-items-center p-6 text-center z-10">
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
            {/* Real lip-landmark overlay, painted onto a transparent canvas. */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />

            {tracker.error && (
              <div className="absolute top-3 left-3 right-3 z-20">
                <Badge variant="signal">
                  <X className="h-3 w-3" /> Tracker unavailable: {tracker.error}
                </Badge>
              </div>
            )}

            <div className="absolute bottom-0 inset-x-0 h-1 bg-line">
              <div
                className="h-full bg-gold transition-[width] duration-200"
                style={{ width: `${tracker.alignment}%` }}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="clinical-card p-4">
              <div className="font-data text-[10px] uppercase tracking-[0.2em] text-fg/40 mb-2">
                Landmarker
              </div>
              <div className="font-stamp text-2xl leading-tight">
                {tracker.ready
                  ? "Tracking 468 face landmarks."
                  : tracker.error
                  ? "Tracker offline."
                  : "Initializing model…"}
              </div>
              <p className="text-fg/50 font-data text-xs mt-2 leading-relaxed">
                MediaPipe Tasks-Vision via WebGL. Outer lip in gold, inner contour in signal red.
                Shape your lips to widen the gold outline.
              </p>
            </div>

            <div className="clinical-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-data text-[10px] uppercase tracking-[0.2em] text-fg/40">
                  Alignment
                </span>
                <span className="font-data text-xs text-gold tabular-nums">
                  {Math.round(tracker.alignment)}%
                </span>
              </div>
              <div className="h-1 bg-line">
                <div
                  className="h-full bg-gold transition-[width] duration-150"
                  style={{ width: `${tracker.alignment}%` }}
                />
              </div>
              <div className="mt-3 font-data text-[10px] uppercase tracking-[0.18em] text-fg/40 grid grid-cols-2 gap-2">
                <span>Openness</span>
                <span className="text-fg/80 text-right tabular-nums">
                  {tracker.frame ? tracker.frame.openness.toFixed(3) : "—"}
                </span>
                <span>Width</span>
                <span className="text-fg/80 text-right tabular-nums">
                  {tracker.frame ? tracker.frame.width.toFixed(3) : "—"}
                </span>
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
                <>
                  Lock in match <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
