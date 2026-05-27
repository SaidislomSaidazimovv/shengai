import { useCallback, useEffect, useRef, useState } from "react";
import { Play, ArrowRight, RotateCcw, AlertTriangle, Pause, Gauge, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/store/session";
import { useActiveSentence } from "@/lib/activeSentence";
import { cn } from "@/lib/utils";

// Discrete playback rates exposed to the user — useful for picking
// apart Mandarin consonant clusters at slow rates and quickly
// confirming match at fast rates. Browsers clamp below ~0.0625;
// all values here are well within range.
const PLAYBACK_RATES = [0.1, 0.2, 0.3, 0.4, 0.5, 1, 1.5, 2] as const;
type PlaybackRate = (typeof PLAYBACK_RATES)[number];

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
  const goldenError = useSession((s) => s.goldenError);
  const clone = useSession((s) => s.clone);
  const sentence = useActiveSentence();
  const setGoldenListenedPct = useSession((s) => s.setGoldenListenedPct);

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  // Track WHICH audio element the analyser is wired to. Each retry
  // (golden cleared → set again) destroys the old <audio> and mounts
  // a fresh one with the same ref slot, so just checking
  // analyserRef.current isn't enough — we'd resume a context that
  // captured an element no longer in the DOM and bars would stay
  // flat while playback ran through the default output.
  const wiredElementRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const [audioMissing, setAudioMissing] = useState(false);
  const [bars, setBars] = useState<number[]>(() => new Array(64).fill(0));
  // Real audio duration once loaded — drives the "X.Xs synthesized" label
  // beneath the waveform (Mirror DevHandover v02 §6.6).
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [currentSec, setCurrentSec] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1);

  // GOLDEN VOICE stage: no auto-advance. User listens, optionally
  // replays, then clicks "Mirror the lips" (or presses Enter) to
  // continue. Earlier builds auto-advanced 400ms after audio.onEnded
  // per v02 §6.6 — removed by user request for full manual control.

  // Lazy-wire the WebAudio graph at the FIRST `play` event rather
  // than when the src changes. Two reasons:
  //   1. createMediaElementSource captures the element's output stream
  //      AT CALL TIME. If we wired before play() ran, the autoplay
  //      attempt would route through our graph; if the wiring effect
  //      ran AFTER autoplay started (browser timing), audio would
  //      have already bypassed the graph and we'd get a silent
  //      AnalyserNode — the symptom the user saw (bars stay flat at
  //      4 px while the clip plays normally).
  //   2. Most browsers won't resume an AudioContext outside a user
  //      gesture, so creating it on src change leaves it suspended
  //      anyway.
  // The handler is idempotent — second play just resumes the ctx.
  // Wire the WebAudio analyser to the <audio> element on EVERY play.
  //
  // We use `HTMLMediaElement.captureStream()` rather than the older
  // `createMediaElementSource()` because the latter redirects the
  // element's output through the AudioContext — a suspended context
  // (autoplay policy) would then leave the audio dead-silent. The
  // captureStream path is a tap: audio still plays through the
  // element's native output, and we just observe a copy.
  //
  // Critical: we tear down + rebuild on every call, not just when the
  // element changes. captureStream's tracks transition to "ended"
  // when the first playback finishes — reusing the same graph on
  // Replay would feed the analyser dead tracks and the bars would
  // stay flat. Building fresh each time costs ~1 ms and guarantees
  // the bars track the *current* playback. The Safari < 16 path
  // keeps createMediaElementSource for that narrow audience; there
  // we DO have to keep the graph alive across plays because the
  // element can only be captured once.
  const safariFallbackSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const wireAnalyser = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;

    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    wiredElementRef.current = null;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      const elWithCapture = el as HTMLMediaElement & {
        captureStream?: () => MediaStream;
      };
      if (typeof elWithCapture.captureStream === "function") {
        // Fresh stream tap for THIS playback. The previous stream's
        // tracks ended when the prior clip finished.
        const stream = elWithCapture.captureStream();
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
      } else {
        // Safari < 16: createMediaElementSource permanently captures
        // the element. We can only ever create ONE source per element
        // for the page's lifetime — cache it so subsequent wires
        // reuse it instead of throwing InvalidStateError.
        let source = safariFallbackSourceRef.current;
        if (!source) {
          source = ctx.createMediaElementSource(el);
          safariFallbackSourceRef.current = source;
        }
        source.connect(analyser);
        analyser.connect(ctx.destination);
      }

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      wiredElementRef.current = el;
      void ctx.resume();
    } catch (err) {
      // WebAudio unsupported, or the element is in a state where the
      // stream cannot be captured. The bars stay flat in that case —
      // honest about the visualizer being off rather than running a
      // fake animation.
      if (import.meta.env.DEV) {
        console.warn("[GoldenStage] AnalyserNode wiring failed:", err);
      }
    }
  }, []);

  // We deliberately do NOT close the AudioContext in a cleanup
  // function. React StrictMode in dev runs effects setup→cleanup→
  // setup, and our cleanup would close the ctx then the second
  // setup would try to re-capture the same <audio> via
  // createMediaElementSource — which throws InvalidStateError in
  // Safari and is hit-or-miss in Chrome. Keeping one context per
  // page session avoids that whole class of bug; on real navigation
  // the browser garbage-collects everything.

  // Drive the bar visualisation from the FFT magnitudes while playing —
  // a frequency-domain view reads as cleaner "speech bars" than the
  // time-domain RMS we had before. 64 bars across the spectrum gives
  // enough resolution without thrashing the canvas.
  useEffect(() => {
    if (!playing) return;
    const analyser = analyserRef.current;
    if (!analyser) {
      // Analyser never wired (shouldn't happen with captureStream, but
      // guard anyway). Hold flat — running a procedural breathing
      // here would lie to the user about the bars being driven by
      // their audio.
      setBars(new Array(64).fill(0.02));
      return;
    }

    analyser.fftSize = 256;
    const freqBuf = new Uint8Array(analyser.frequencyBinCount);
    const targetBars = 64;
    const tick = () => {
      analyser.getByteFrequencyData(freqBuf);
      const next = new Array<number>(targetBars);
      // Logarithmic bucketing so low-frequency speech energy isn't
      // crammed into a few left-side bars while highs get most of
      // the spectrum.
      const totalBins = freqBuf.length;
      for (let i = 0; i < targetBars; i++) {
        const t0 = i / targetBars;
        const t1 = (i + 1) / targetBars;
        const startBin = Math.floor(Math.pow(t0, 1.6) * totalBins);
        const endBin = Math.max(startBin + 1, Math.floor(Math.pow(t1, 1.6) * totalBins));
        let max = 0;
        for (let b = startBin; b < endBin && b < totalBins; b++) {
          if (freqBuf[b] > max) max = freqBuf[b];
        }
        next[i] = max / 255;
      }
      setBars((prev) => {
        // Light EMA smoothing — calms the bar tops without losing
        // the speech rhythm.
        const out = new Array<number>(targetBars);
        for (let i = 0; i < targetBars; i++) {
          out[i] = prev[i] * 0.5 + next[i] * 0.5;
        }
        return out;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  // Auto-play once on mount if a URL is set. We do NOT pre-wire the
  // analyser here: captureStream() returns an empty MediaStream when
  // the element hasn't begun rendering yet, leaving the analyser
  // bound to a silent tap forever. Wiring is deferred to the onPlay
  // event below, where the element is guaranteed to be rendering
  // audio.
  useEffect(() => {
    if (golden?.url && audioRef.current) {
      audioRef.current.play().catch(() => {
        // Autoplay blocked or URL invalid; the Play button below
        // will trigger play() inside a user gesture, which then
        // fires onPlay → wireAnalyser.
      });
    }
  }, [golden]);

  // When the user changes playback speed, push it into the audio
  // element. Default 1.0 covers the normal listening case. We also
  // force preservesPitch on every change because some browsers reset
  // it to false when playbackRate is touched — and pitch-shifted slow
  // playback (the "chipmunk" effect) is the main source of perceived
  // distortion below 0.5x.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.preservesPitch = true;
    // Vendor-prefixed properties on older Safari / older Chrome — keep
    // these set so all engines pick up the pitch-preserving path.
    (el as unknown as { mozPreservesPitch?: boolean }).mozPreservesPitch = true;
    (el as unknown as { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;
    el.playbackRate = playbackRate;
  }, [playbackRate]);

  // While not playing — show a flat resting line. Any procedural
  // breathing here gets in the way of the real FFT-driven bars the
  // user actually wants: a placeholder animation that runs WHEN audio
  // isn't playing reads as "the visualizer is fake", which is the
  // opposite of the intent. Flat is honest.
  useEffect(() => {
    if (playing) return;
    setBars(new Array(64).fill(0.02));
  }, [playing]);

  const providerLabel =
    golden?.source === "elevenlabs"
      ? "ElevenLabs Flash v2.5"
      : golden?.source === "prerendered"
      ? "Pre-rendered fallback"
      : "Awaiting clip";

  // Mirror the session's goldenError into the local audioMissing flag
  // — App.tsx flips goldenError when /api/synth fails or the clone
  // is unusable; we want the error UI to render immediately on stage
  // entry in that case, not only after the <audio> element's onError
  // fires (which would never fire because there is no clip to load).
  useEffect(() => {
    if (goldenError) setAudioMissing(true);
  }, [goldenError]);

  // Synthesizing — App.tsx fired /api/synth on stage entry but the
  // ElevenLabs response hasn't landed yet (2-12s, longer on cold
  // start). Without this state the user just sees a flat waveform
  // and assumes the player is broken. Once goldenError is set we
  // jump straight to the error UI instead of the spinner.
  const synthesizing = !golden && !audioMissing && !goldenError;

  // Elapsed timer for the synthesizing state — same affordance as
  // the Reference clone spinner so the wait feels like progress.
  const [synthElapsed, setSynthElapsed] = useState(0);
  useEffect(() => {
    if (!synthesizing) {
      setSynthElapsed(0);
      return;
    }
    const start = performance.now();
    const id = window.setInterval(() => {
      setSynthElapsed((performance.now() - start) / 1000);
    }, 100);
    return () => window.clearInterval(id);
  }, [synthesizing]);

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

        {/* v02 §6.6 headline — text-display (80px) is the desktop wow
            size; on mobile it would crash through the 343px usable
            width, so we step down through 36/48/60 below md. The
            hanzi line follows the same scale curve. */}
        <div className="text-center mb-10">
          <h1 className="font-stamp text-4xl sm:text-5xl md:text-6xl lg:text-display text-fg leading-none wrap-break-word">
            YOUR VOICE.
            <br />
            PERFECT MANDARIN.
          </h1>
          <div className="font-cjk text-4xl sm:text-5xl md:text-6xl text-gold leading-none mt-6 sm:mt-8 wrap-break-word">
            {sentence?.hanzi}
          </div>
          <div className="font-data text-fg/60 mt-3 text-sm sm:text-base">{sentence?.pinyin}</div>
        </div>

        {/* Spectrum bar visualisation — cleaner than the earlier RMS
            history; reads as "this is speech" instead of a flat sine
            placeholder when the audio is between syllables. */}
        <div
          className="clinical-card p-8"
          style={{
            boxShadow:
              "0 0 0 1px rgba(200,147,46,0.18), 0 12px 32px rgba(200,147,46,0.18), 0 1px 2px rgba(10,10,10,0.04)",
          }}
        >
          <div className="flex items-center justify-between mb-5 font-data text-micro uppercase tracking-[0.22em] text-fg/40">
            <span>Voice ID · {clone?.voiceId?.slice(0, 12) ?? "demo-fallback"}</span>
            <span
              className={
                audioMissing
                  ? "text-signal"
                  : synthesizing
                    ? "text-fg/60"
                    : "text-gold"
              }
            >
              {audioMissing
                ? "AUDIO MISSING"
                : synthesizing
                  ? "SYNTHESIZING"
                  : playing
                    ? "PLAYING"
                    : "READY"}
            </span>
          </div>

          {/* Synthesizing state — drops the empty waveform for a spinner
              + elapsed timer so the 2-12s ElevenLabs wait feels like
              progress, not a hang. Matches the Reference clone affordance. */}
          {synthesizing ? (
            <div className="flex flex-col items-center justify-center gap-3 h-30">
              <Loader2 className="h-7 w-7 text-gold animate-spin" strokeWidth={1.5} />
              <div className="text-center">
                <div className="font-stamp text-lg leading-tight text-fg">
                  Synthesizing your voice…
                </div>
                <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/50 mt-1.5 tabular-nums">
                  ElevenLabs Flash v2.5 · {synthElapsed.toFixed(1)}s
                </div>
              </div>
            </div>
          ) : (
            /* Spectrum bars — symmetrical, mirrored top/bottom, gold gradient.
               64 bars × 6px wide, 4px gap. The CSS handles all rendering;
               we just supply the per-bar amplitude from FFT. */
            <div className="flex items-center justify-center gap-0.75 h-30">
              {bars.map((amp, i) => {
                const minH = 4;
                const maxH = 100;
                const h = Math.max(minH, minH + amp * (maxH - minH));
                return (
                  <div
                    key={i}
                    className="rounded-full bg-linear-to-b from-gold via-gold to-gold/70 transition-[height] duration-75 ease-out"
                    style={{
                      width: 4,
                      height: `${h}px`,
                      opacity: 0.55 + amp * 0.45,
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Progress + scrubber line. Shows real playback position
              through the clip so the user can see how far through they
              are at any speed. */}
          {durationSec !== null && (
            <div className="mt-6">
              <div className="flex justify-between font-mono text-[10px] tabular-nums text-fg/50 mb-1.5">
                <span>{currentSec.toFixed(1)}s</span>
                <span>{durationSec.toFixed(1)}s</span>
              </div>
              <div className="h-0.5 bg-fg/10 overflow-hidden">
                <div
                  className="h-full bg-gold transition-[width] duration-100 ease-linear"
                  style={{ width: `${(currentSec / durationSec) * 100}%` }}
                />
              </div>
            </div>
          )}

          {golden?.url && (
            <audio
              ref={audioRef}
              src={golden.url}
              onLoadedMetadata={(e) => {
                const a = e.currentTarget as HTMLAudioElement;
                // Lock pitch BEFORE setting playbackRate so the very
                // first frame after load is already pitch-corrected.
                a.preservesPitch = true;
                (a as unknown as { mozPreservesPitch?: boolean }).mozPreservesPitch = true;
                (a as unknown as { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;
                a.playbackRate = playbackRate;
                if (Number.isFinite(a.duration) && a.duration > 0) setDurationSec(a.duration);
              }}
              onPlay={() => {
                // Belt-and-braces: if the analyser somehow wasn't wired
                // during auto-play (browser refused, ref wasn't ready),
                // wire it now. This fires on every play() incl. resume
                // from pause; wireAnalyser is idempotent.
                wireAnalyser();
                setPlaying(true);
                setAudioMissing(false);
              }}
              onPause={() => setPlaying(false)}
              onEnded={() => {
                setPlaying(false);
                setDone(true);
                // RESOLVED report — the user heard the full clip.
                setGoldenListenedPct(100);
              }}
              onTimeUpdate={(e) => {
                const a = e.currentTarget as HTMLAudioElement;
                setCurrentSec(a.currentTime);
                if (a.duration > 0 && Number.isFinite(a.duration)) {
                  const pct = Math.min(100, Math.round((a.currentTime / a.duration) * 100));
                  setGoldenListenedPct(pct);
                }
              }}
              onError={() => setAudioMissing(true)}
              className="hidden"
              preload="auto"
            />
          )}
        </div>

        {/* Playback speed selector — 0.1× through 2×. Slow rates help
            isolate Mandarin consonant clusters; fast rates let the user
            confirm match quickly. Browser handles re-timing natively. */}
        <div className="mt-5 clinical-card p-3">
          <div className="flex items-center gap-3">
            <Gauge className="h-3.5 w-3.5 text-fg/50 shrink-0 ml-1" strokeWidth={1.5} />
            <span className="font-data text-micro uppercase tracking-[0.22em] text-fg/40 mr-2 hidden md:inline">
              Speed
            </span>
            <div className="flex items-center gap-1 flex-1 flex-wrap justify-center md:justify-start">
              {PLAYBACK_RATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setPlaybackRate(rate)}
                  className={cn(
                    "font-data text-[11px] tabular-nums uppercase tracking-widest h-7 min-w-11 px-2 border transition-colors duration-150",
                    playbackRate === rate
                      ? "border-gold text-gold bg-gold/5"
                      : "border-line text-fg/50 hover:text-fg hover:border-fg/30"
                  )}
                  aria-label={`Playback speed ${rate}x`}
                >
                  {rate}×
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* "● Same person · 7.2s synthesized" label below the
            waveform. The duration is real, sourced from the audio element. */}
        <div className="mt-4 flex items-center justify-center gap-2 font-data text-micro uppercase tracking-[0.22em] text-fg/60">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-gold"
            aria-hidden
          />
          <span>
            Same person ·{" "}
            {durationSec !== null ? durationSec.toFixed(1) : "—"}s synthesized
            {playbackRate !== 1 && (
              <span className="ml-2 text-gold">· {playbackRate}× speed</span>
            )}
          </span>
        </div>

        {/* The earlier "Using demo voice" transparent-fallback banner
            was removed — there is no longer a demo MP3 to silently
            swap to. /api/synth failures now route to the explicit
            "Audio unavailable" state below. */}

        {audioMissing && (
          <div className="mt-4 clinical-card p-4 border-signal/40 bg-signal/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-signal mt-0.5 shrink-0" />
              <div className="text-sm font-data text-fg/70 leading-relaxed">
                <strong className="text-fg">Audio unavailable.</strong> The
                live synthesis call didn't return. We deliberately don't
                play a substitute speaker — only your own cloned voice
                ships from this screen. Try Retry capture if the issue
                persists, or check your network.
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
              const el = audioRef.current;
              if (!el) return;
              if (playing) {
                el.pause();
                return;
              }
              // If the clip already finished, snap back to the start
              // so Replay actually replays instead of being a no-op.
              if (el.ended || el.currentTime >= (el.duration || 0) - 0.05) {
                el.currentTime = 0;
              }
              wireAnalyser();
              el.play().catch(() => setAudioMissing(true));
            }}
          >
            {playing ? (
              <>
                <Pause className="h-4 w-4" /> Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> {done ? "Replay" : "Play"}
              </>
            )}
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
