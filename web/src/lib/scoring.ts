/**
 * Local scoring pipeline — used as the fallback when the backend is down,
 * and also as the primary path for the free diagnostic (zero round-trips).
 *
 * Returns the same shape as the backend so the rest of the UI is agnostic.
 */

import {
  detectTone,
  extractPitchContour,
  normalizeContour,
  scoreToneAgainstReference,
  TONE_REFERENCES,
  type PitchPoint,
} from "./pitch";
import type { Tone } from "./data";

export interface LocalScore {
  toneScore: number;
  initialScore: number;
  finalScore: number;
  overall: number;
  detectedTone: number;
  contour: PitchPoint[];
  reference: number[];
  voiced: boolean;
}

/**
 * Score a recording against an intended tone. We approximate initial/final
 * scores from signal quality features because we don't run a phoneme
 * classifier in the browser — the backend can refine these when available.
 */
export function scoreLocally(
  samples: Float32Array,
  sampleRate: number,
  intendedTone: Tone
): LocalScore {
  const raw = extractPitchContour(samples, sampleRate);
  const normalized = normalizeContour(raw);
  const analysis = detectTone(normalized);
  const reference = TONE_REFERENCES[intendedTone];

  const toneScore = analysis.voiced
    ? scoreToneAgainstReference(normalized, reference)
    : 0;

  const voicedFrames = normalized.filter((p) => p.hz !== null).length;
  const totalFrames = normalized.length || 1;
  const voiceRatio = voicedFrames / totalFrames;

  // Heuristics for initial/final clarity from waveform energy + clarity.
  const energy = rms(samples);
  const energyScore = Math.min(100, Math.max(35, (energy * 1800) | 0));
  const clarityAvg =
    normalized.reduce((sum, p) => sum + p.clarity, 0) / Math.max(normalized.length, 1);
  const clarityScore = Math.round(40 + clarityAvg * 60);

  // The initial is captured in the attack of the signal; the final in the
  // sustained voiced segment. Approximate accordingly.
  const initialScore = clamp(Math.round(0.5 * energyScore + 0.5 * clarityScore + (voiceRatio - 0.5) * 20), 30, 99);
  const finalScore = clamp(Math.round(0.4 * clarityScore + 0.4 * toneScore + 20 + voiceRatio * 10), 30, 99);

  const overall = Math.round(toneScore * 0.5 + initialScore * 0.25 + finalScore * 0.25);

  return {
    toneScore: Math.round(toneScore),
    initialScore,
    finalScore,
    overall,
    detectedTone: analysis.tone,
    contour: normalized,
    reference,
    voiced: analysis.voiced,
  };
}

function rms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(samples.length, 1));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}
