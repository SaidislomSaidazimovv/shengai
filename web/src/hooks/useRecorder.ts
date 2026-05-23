/**
 * Live microphone recording hook.
 *
 * Returns:
 *   - state: idle / recording / processing
 *   - liveSamples: short RMS history for the waveform component
 *   - start() / stop() — async; stop resolves with a Recording
 *
 * The mic is requested lazily on start() and torn down on stop(). We tap
 * the analyser node for live RMS so the waveform reacts in real time.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Recorder, type Recording } from "@/lib/audio";

const HISTORY = 96;

export type RecorderState = "idle" | "recording" | "processing" | "error";

export interface UseRecorderResult {
  state: RecorderState;
  error: string | null;
  liveSamples: number[];
  elapsed: number;
  start: () => Promise<void>;
  stop: () => Promise<Recording | null>;
}

export function useRecorder(maxSeconds = 8): UseRecorderResult {
  const recorderRef = useRef<Recorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);

  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [liveSamples, setLiveSamples] = useState<number[]>([]);
  const [elapsed, setElapsed] = useState(0);

  const teardown = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      void audioCtxRef.current.close();
    }
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    setLiveSamples((prev) => {
      const next = [...prev, rms];
      return next.length > HISTORY ? next.slice(-HISTORY) : next;
    });

    const e = (performance.now() - startedAtRef.current) / 1000;
    setElapsed(e);

    if (e >= maxSeconds) {
      // Soft stop via the public stop() so cleanup is consistent.
      void stopAndDeliver();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxSeconds]);

  const start = useCallback(async () => {
    setError(null);
    setLiveSamples([]);
    setElapsed(0);
    try {
      const rec = new Recorder();
      await rec.start();
      recorderRef.current = rec;

      // Parallel analyser — sniffs the mic stream for live RMS.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;

      startedAtRef.current = performance.now();
      setState("recording");
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      console.error(e);
      setError("Microphone access was denied or no device is available.");
      setState("error");
    }
  }, [tick]);

  const stopAndDeliver = useCallback(async (): Promise<Recording | null> => {
    const rec = recorderRef.current;
    if (!rec) return null;
    setState("processing");
    try {
      const result = await rec.stop();
      recorderRef.current = null;
      teardown();
      setState("idle");
      return result;
    } catch (e) {
      console.error(e);
      setError("Could not finalize the recording.");
      setState("error");
      teardown();
      return null;
    }
  }, [teardown]);

  const stop = useCallback(() => stopAndDeliver(), [stopAndDeliver]);

  return { state, error, liveSamples, elapsed, start, stop };
}
