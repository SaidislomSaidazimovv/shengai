/**
 * Live microphone recording hook — rewritten on top of MediaRecorder.
 *
 * Design notes after the previous iteration's auto-stop bug:
 *   - Pipeline state lives in refs, not in useCallback closures, so RAF
 *     re-renders can't strand the loop.
 *   - There is exactly ONE active pipeline at a time. start() refuses
 *     to spin up a second one until the first is finalized.
 *   - finalize() is guarded against re-entry — once it starts, a second
 *     call resolves with the same promise.
 *   - Auto-stop and manual stop go through the same `stop()` codepath,
 *     so there's a single place where the recorder ends.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  abortPipeline,
  startPipeline,
  stopPipeline,
  type AudioPipeline,
  type Recording,
} from "@/lib/audio";

const HISTORY = 96;
const RMS_INTERVAL_MS = 60;
const ELAPSED_INTERVAL_MS = 100;

export type RecorderState = "idle" | "recording" | "processing" | "error";

export interface UseRecorderResult {
  state: RecorderState;
  error: string | null;
  liveSamples: number[];
  elapsed: number;
  start: () => Promise<boolean>;
  stop: () => Promise<Recording | null>;
}

export function useRecorder(
  maxSeconds = 8,
  onFinish?: (recording: Recording) => void
): UseRecorderResult {
  const pipelineRef = useRef<AudioPipeline | null>(null);
  const startedAtRef = useRef<number>(0);
  const finalizePromiseRef = useRef<Promise<Recording | null> | null>(null);
  const rmsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [liveSamples, setLiveSamples] = useState<number[]>([]);
  const [elapsed, setElapsed] = useState(0);

  /** Stop both timers without touching the pipeline. */
  const clearTimers = useCallback(() => {
    if (rmsTimerRef.current) {
      clearInterval(rmsTimerRef.current);
      rmsTimerRef.current = null;
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  /** Finalize the active pipeline. Idempotent: parallel calls share one promise. */
  const finalize = useCallback(async (): Promise<Recording | null> => {
    if (finalizePromiseRef.current) return finalizePromiseRef.current;
    const pipeline = pipelineRef.current;
    if (!pipeline) return null;
    pipelineRef.current = null;
    setState("processing");
    clearTimers();

    const startedAt = startedAtRef.current;
    const promise = (async (): Promise<Recording | null> => {
      try {
        const result = await stopPipeline(pipeline);
        const duration = startedAt ? (performance.now() - startedAt) / 1000 : 0;
        setState("idle");
        return { ...result, duration };
      } catch (err) {
        console.error("finalize failed", err);
        setError("Could not finalize the recording.");
        setState("error");
        return null;
      } finally {
        finalizePromiseRef.current = null;
      }
    })();

    finalizePromiseRef.current = promise;
    return promise;
  }, [clearTimers]);

  /** Start recording. Resolves true on success, false if mic denied. */
  const start = useCallback(async (): Promise<boolean> => {
    if (pipelineRef.current) {
      // Already running — refuse rather than overlap streams.
      return state === "recording";
    }
    setError(null);
    setLiveSamples([]);
    setElapsed(0);
    setState("processing");

    let pipeline: AudioPipeline;
    try {
      pipeline = await startPipeline();
    } catch (err) {
      console.error("startPipeline failed", err);
      setError("Microphone access was denied or no device is available.");
      setState("error");
      return false;
    }

    pipelineRef.current = pipeline;
    startedAtRef.current = performance.now();
    setState("recording");

    // Sample RMS off the analyser node at a steady interval. Interval is
    // a kinder fit than RAF here: we don't need 60fps and we avoid the
    // closure-rebinding traps the old RAF loop had.
    rmsTimerRef.current = setInterval(() => {
      const live = pipelineRef.current;
      if (!live) return;
      const buf = new Float32Array(live.analyser.fftSize);
      live.analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      setLiveSamples((prev) => {
        const next = prev.length >= HISTORY ? prev.slice(-(HISTORY - 1)) : prev.slice();
        next.push(rms);
        return next;
      });
    }, RMS_INTERVAL_MS);

    // Independent elapsed-time tick handles the auto-stop.
    elapsedTimerRef.current = setInterval(() => {
      const e = (performance.now() - startedAtRef.current) / 1000;
      setElapsed(e);
      if (e >= maxSeconds) {
        clearTimers();
        void finalize().then((result) => {
          if (result && onFinishRef.current) onFinishRef.current(result);
        });
      }
    }, ELAPSED_INTERVAL_MS);

    return true;
  }, [state, maxSeconds, finalize, clearTimers]);

  /** Manual stop. Returns the recording (or null on failure). */
  const stop = useCallback(() => finalize(), [finalize]);

  /** On unmount, dispose any live pipeline. */
  useEffect(() => {
    return () => {
      clearTimers();
      const live = pipelineRef.current;
      if (live) {
        pipelineRef.current = null;
        abortPipeline(live);
      }
    };
  }, [clearTimers]);

  return { state, error, liveSamples, elapsed, start, stop };
}
