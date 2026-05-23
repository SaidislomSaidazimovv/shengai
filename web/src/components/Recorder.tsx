import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Recorder as MicRecorder, type Recording } from "@/lib/audio";
import { cn } from "@/lib/utils";

interface Props {
  /** Optional auto-stop after N seconds. */
  maxSeconds?: number;
  onComplete: (recording: Recording) => void;
  disabled?: boolean;
}

export function RecorderButton({ maxSeconds = 4, onComplete, disabled }: Props) {
  const [state, setState] = useState<"idle" | "recording" | "processing" | "error">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MicRecorder | null>(null);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) cancelAnimationFrame(tickRef.current);
      const rec = recorderRef.current;
      if (rec && rec.isRecording()) {
        rec.stop().catch(() => undefined);
      }
    };
  }, []);

  const stopAndDeliver = async () => {
    const rec = recorderRef.current;
    if (!rec) return;
    setState("processing");
    try {
      const recording = await rec.stop();
      recorderRef.current = null;
      setState("idle");
      setElapsed(0);
      onComplete(recording);
    } catch (e) {
      console.error(e);
      setError("Could not finalize the recording.");
      setState("error");
    }
  };

  const tick = (startedAt: number) => {
    const loop = () => {
      const e = (performance.now() - startedAt) / 1000;
      setElapsed(e);
      if (e >= maxSeconds) {
        stopAndDeliver();
        return;
      }
      tickRef.current = requestAnimationFrame(loop);
    };
    tickRef.current = requestAnimationFrame(loop);
  };

  const handleClick = async () => {
    if (state === "recording") {
      if (tickRef.current) cancelAnimationFrame(tickRef.current);
      await stopAndDeliver();
      return;
    }
    setError(null);
    try {
      const rec = new MicRecorder();
      await rec.start();
      recorderRef.current = rec;
      setState("recording");
      tick(performance.now());
    } catch (e) {
      console.error(e);
      setError("Microphone access denied. Please allow it in your browser settings.");
      setState("error");
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleClick}
        disabled={disabled || state === "processing"}
        className={cn(
          "relative grid h-24 w-24 place-items-center rounded-full shadow-lg transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:opacity-50 sm:h-28 sm:w-28",
          state === "recording"
            ? "bg-rose-500 text-white hover:bg-rose-600"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
        aria-label={state === "recording" ? "Stop recording" : "Start recording"}
      >
        {state === "recording" && (
          <span className="absolute inset-0 rounded-full bg-rose-500/40 animate-pulse-ring" />
        )}
        {state === "processing" ? (
          <Loader2 className="h-10 w-10 animate-spin" />
        ) : state === "recording" ? (
          <Square className="h-10 w-10" fill="currentColor" />
        ) : (
          <Mic className="h-10 w-10" />
        )}
      </button>

      <div className="text-center">
        {state === "recording" && (
          <div className="font-mono text-sm tabular-nums text-rose-600">
            {elapsed.toFixed(1)}s / {maxSeconds.toFixed(1)}s
          </div>
        )}
        {state === "idle" && <p className="text-sm text-muted-foreground">Tap to record · auto-stops at {maxSeconds}s</p>}
        {state === "processing" && <p className="text-sm text-muted-foreground">Analyzing…</p>}
        {state === "error" && error && (
          <div className="flex items-center gap-2 text-sm text-rose-600">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
        {state === "error" && (
          <Button size="sm" variant="outline" className="mt-2" onClick={() => setState("idle")}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
