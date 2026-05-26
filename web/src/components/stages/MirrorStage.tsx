import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, ArrowRight, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MatchScore } from "@/components/MatchScore";
import { SyntheticAvatar } from "@/components/SyntheticAvatar";
import { useSession } from "@/store/session";
import { useActiveSentence } from "@/lib/activeSentence";
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
  const sentence = useActiveSentence();
  const setPeakMirrorAlignmentPct = useSession((s) => s.setPeakMirrorAlignmentPct);
  const peakSoFar = useSession((s) => s.peakMirrorAlignmentPct);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "denied" | "matched">("loading");
  // v02 §6.7 lock beat — single 180ms flash when match crosses 95%.
  const [lockBeat, setLockBeat] = useState(false);
  // The Mirror left panel renders only the 2D synthetic avatar. The
  // 3D variants (RealisticAvatar3D, ProceduralAvatar3D, the wireframe
  // mesh) were removed at the user's request — they will be revisited
  // in a future pass. The 2D version's mouth animation is sourced
  // from the same per-sentence mouth_open_series JSON, so the
  // animation contract for downstream components is unchanged.

  const tracker = useLipTracker({ targetOpenness: 0.04, tolerance: 0.035 });

  // We render the raw alignment straight from the MediaPipe tracker —
  // no multiplier, no time-based ramp. Users actually have to match
  // the target openness to see the score climb; partial matches stay
  // in the 40-70% range, which is the truthful reading.
  const displayedAlignment = Math.round(tracker.alignment);

  // onDone is wired straight to the user's button click — no auto-
  // advance, so no need to keep a ref to it.

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

    // Landmarks come back normalized to the FULL native video frame
    // (e.g. 720×540). The <video> uses object-cover inside a square
    // container, which scales it up until the smaller dimension fills
    // and crops the larger. We have to undo that crop or the lip
    // outline drifts off the actual mouth as the camera aspect ratio
    // diverges from the container. On top of that the video has
    // scale-x-[-1] applied so the user sees themselves mirrored —
    // we apply the same flip to keep the overlay locked to the lips.
    const video = videoRef.current;
    const vw = video?.videoWidth ?? 0;
    const vh = video?.videoHeight ?? 0;
    const videoAspect = vw > 0 && vh > 0 ? vw / vh : 1;
    const containerAspect = h > 0 ? w / h : 1;

    // Compute the visible (uncropped) sub-rect of the native video:
    //   visibleNativeW, visibleNativeH ∈ (0, 1]
    //   cropX, cropY = offset of that visible rect inside the native frame.
    let visibleNativeW = 1;
    let visibleNativeH = 1;
    let cropX = 0;
    let cropY = 0;
    if (videoAspect > containerAspect) {
      // Video wider than container — sides are clipped.
      visibleNativeW = containerAspect / videoAspect;
      cropX = (1 - visibleNativeW) / 2;
    } else if (videoAspect < containerAspect) {
      // Video taller — top/bottom clipped.
      visibleNativeH = videoAspect / containerAspect;
      cropY = (1 - visibleNativeH) / 2;
    }

    const tx = (n: { x: number; y: number }) => {
      // Move landmark from native-frame coords (0..1) to visible-rect
      // coords (0..1) by subtracting the crop and scaling to the
      // visible window.
      const visX = (n.x - cropX) / visibleNativeW;
      const visY = (n.y - cropY) / visibleNativeH;
      // Mirror X to match the scale-x-[-1] flip applied to the video.
      return { x: (1 - visX) * w, y: visY * h };
    };

    const drawPoly = (
      pts: { x: number; y: number }[],
      stroke: string,
      lineWidth = 1.5,
      fill?: string,
      closed = true
    ) => {
      if (pts.length === 0) return;
      ctx.beginPath();
      const first = tx(pts[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < pts.length; i++) {
        const p = tx(pts[i]);
        ctx.lineTo(p.x, p.y);
      }
      if (closed) ctx.closePath();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    };

    const drawDots = (
      pts: { x: number; y: number }[],
      color: string,
      radius = 1.5
    ) => {
      ctx.fillStyle = color;
      for (const p of pts) {
        const t = tx(p);
        ctx.beginPath();
        ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    // Layer 1 — All 468 landmarks as soft gray dots so the live side
    // matches the synthetic avatar's "instrument" feel instead of
    // showing only sparse lip lines on the user's face.
    drawDots(frame.all, "rgba(10, 10, 10, 0.55)", 1.4);

    // Layer 2 — Feature outlines. Face oval first (faint), then eyes
    // and brows in fg-primary, nose centerline, and finally the gold/
    // red lip lines so the mouth still leads the eye.
    drawPoly(frame.faceOval, "rgba(10, 10, 10, 0.55)", 1.2);
    drawPoly(frame.leftEye, "rgba(10, 10, 10, 0.85)", 1.5);
    drawPoly(frame.rightEye, "rgba(10, 10, 10, 0.85)", 1.5);
    drawPoly(frame.leftBrow, "rgba(10, 10, 10, 0.75)", 1.5, undefined, false);
    drawPoly(frame.rightBrow, "rgba(10, 10, 10, 0.75)", 1.5, undefined, false);
    drawPoly(frame.nose, "rgba(10, 10, 10, 0.55)", 1.2, undefined, false);

    // v02 §5.2 — gold #C8932E (outer lip) + signal red #E5484D (inner).
    drawPoly(frame.outer, "#C8932E", 2, "rgba(200, 147, 46, 0.20)");
    drawPoly(frame.inner, "#E5484D", 2, "rgba(229, 72, 77, 0.08)");
  }, [tracker.frame]);

  // 3. When alignment crosses the threshold, mark matched.
  useEffect(() => {
    if (status !== "ready") return;
    if (displayedAlignment >= 80) setStatus("matched");
  }, [displayedAlignment, status]);

  // 3b. Record the peak alignment for the RESOLVED report — but
  // require the score to HOLD above a threshold for several frames
  // before counting it. Without this, a single spurious frame
  // (random MediaPipe blip, the user adjusting their seat, a sneeze)
  // could lock in a "peak match" the user never actually produced.
  // We use a small ring buffer of the last 8 raw scores (~270 ms at
  // 30 fps) and only update the peak when the *minimum* of that
  // window beats the current best — meaning the user genuinely
  // sustained the match for a quarter-second.
  const sustainedBufferRef = useRef<number[]>([]);
  useEffect(() => {
    const buf = sustainedBufferRef.current;
    buf.push(tracker.alignment);
    if (buf.length > 8) buf.shift();
    if (buf.length < 8) return;
    const sustained = Math.round(Math.min(...buf));
    if (peakSoFar === null || sustained > peakSoFar) {
      setPeakMirrorAlignmentPct(sustained);
    }
    // peakSoFar is updated by this same effect; intentionally read-only
    // dependency so we only refire when alignment moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracker.alignment]);

  // MIRROR stage: no auto-advance. User watches the synthetic avatar
  // mouth the sentence, mimics it on the right, and clicks "Lock in
  // match" (or presses Enter) when satisfied. Earlier builds auto-
  // advanced after ≥95% match held 1s per v02 §6.7 — removed by
  // user request for full manual control. The lock beat stays — it
  // now fires off the raw alignment, so users who genuinely cross
  // 95% get the gold pulse.

  // Lock beat — fire a single 180ms flash the first time we cross 95%.
  const crossed95Ref = useRef(false);
  useEffect(() => {
    if (crossed95Ref.current) return;
    if (displayedAlignment >= 95) {
      crossed95Ref.current = true;
      setLockBeat(true);
      const t = window.setTimeout(() => setLockBeat(false), 180);
      return () => window.clearTimeout(t);
    }
  }, [displayedAlignment]);

  return (
    <div className="container py-14">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Badge variant="gold">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
            LIP MIRROR · FACE LANDMARKER
          </Badge>
          <Button variant="ghost" size="sm" onClick={onSkip}>
            <X className="h-4 w-4" /> Skip mirror
          </Button>
        </div>

        {/* Hero match score — large mono number, counts up smoothly,
            turns success-green at ≥90 with a soft glow. The displayed
            value is the raw alignment from the tracker; there is no
            multiplier behind it. */}
        <div className="flex justify-center mb-10">
          <MatchScore value={displayedAlignment} />
        </div>

        {/* v02 §6.7 split layout — left = synthetic Mandarin avatar,
            right = live webcam tracking. Both square cards, 400×400
            target, gap 48px on desktop. Lock beat: when match crosses
            95%, both cards pulse a single 180ms gold ring. */}
        <div className="grid md:grid-cols-2 gap-12 mb-8">
          {/* LEFT — YOUR AVATAR */}
          <div className="flex flex-col items-center gap-3">
            <div
              className={cn(
                "relative w-full aspect-square clinical-card overflow-hidden transition-shadow duration-200 ease-out",
                lockBeat &&
                  "ring-2 ring-gold shadow-[0_0_32px_rgba(200,147,46,0.4)]"
              )}
            >
              <SyntheticAvatar speaking sentenceId={sentence?.id} />
            </div>
            <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/60">
              Your Avatar
            </div>
          </div>

          {/* RIGHT — YOUR FACE (live tracking) */}
          <div className="flex flex-col items-center gap-3">
            <div
              className={cn(
                "relative w-full aspect-square clinical-card overflow-hidden transition-shadow duration-200 ease-out",
                lockBeat &&
                  "ring-2 ring-gold shadow-[0_0_32px_rgba(200,147,46,0.4)]"
              )}
            >
              {status === "loading" && (
                <div className="absolute inset-0 grid place-items-center font-data text-micro uppercase tracking-[0.22em] text-fg/40 z-10">
                  <span className="flex items-center gap-2">
                    <Camera className="h-4 w-4" /> Requesting webcam…
                  </span>
                </div>
              )}
              {/* MediaPipe model warm-up state — webcam is alive but the
                  468-point landmarker is still streaming WASM + .task
                  bytes from Google's CDN. Without this overlay the user
                  sees their bare face for 2-4s and assumes the demo
                  hung. */}
              {status === "ready" && !tracker.ready && !tracker.error && (
                <div className="absolute inset-0 z-10 grid place-items-center bg-fg/30 backdrop-blur-[2px]">
                  <div className="bg-white/90 px-4 py-3 rounded-md shadow-2 flex items-center gap-3">
                    <Loader2 className="h-4 w-4 text-fg animate-spin" strokeWidth={1.5} />
                    <div>
                      <div className="font-stamp text-sm leading-tight">
                        Loading face tracker
                      </div>
                      <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/50 mt-0.5">
                        MediaPipe · 468 landmarks
                      </div>
                    </div>
                  </div>
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
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
              {tracker.error && (
                <div className="absolute top-3 left-3 right-3 z-20">
                  <Badge variant="signal">
                    <X className="h-3 w-3" /> Tracker offline: {tracker.error}
                  </Badge>
                </div>
              )}
              <div className="absolute bottom-0 inset-x-0 h-1 bg-fg/10">
                <div
                  className="h-full bg-gold transition-[width] duration-200"
                  style={{ width: `${displayedAlignment}%` }}
                />
              </div>
            </div>
            <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/60">
              Your Face
            </div>
          </div>
        </div>

        {/* Compact stats row + sentence reference + continue button. */}
        <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
          <div className="clinical-card p-4 flex items-center gap-6">
            <div className="flex-1">
              <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/40">
                Sentence
              </div>
              <div className="font-cjk text-xl mt-1">{sentence?.hanzi}</div>
              <div className="font-data text-xs text-fg/50 mt-0.5">{sentence?.pinyin}</div>
            </div>
            <div className="hidden md:block">
              <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/40">
                Landmarks
              </div>
              <div className="font-stamp text-lg leading-tight mt-1">
                {tracker.ready ? "468 tracked" : tracker.error ? "Tracker offline" : "Initializing…"}
              </div>
            </div>
            <div className="hidden md:block">
              <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/40">
                Openness
              </div>
              <div className="font-mono text-lg tabular-nums mt-1">
                {tracker.frame ? tracker.frame.openness.toFixed(3) : "—"}
              </div>
            </div>
          </div>

          <Button
            variant={status === "matched" ? "gold" : "outline"}
            size="lg"
            onClick={onDone}
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
  );
}
