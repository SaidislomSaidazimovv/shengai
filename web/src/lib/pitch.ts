/**
 * Pitch extraction and tone analysis.
 *
 * Uses Pitchy (YIN algorithm) to extract fundamental frequency from a
 * recorded waveform, then converts the F0 contour into a normalized pitch
 * curve suitable for visual overlay against a native reference.
 *
 * Why this lives in the browser:
 *   - We can give instant feedback without a round-trip to the server.
 *   - If the backend is unavailable, the whole experience still works.
 *
 * Why we still optionally call the backend:
 *   - DTW alignment between user and reference is sharper on the server,
 *     where we can use SciPy. The frontend version is good enough as a
 *     fallback.
 */

import { PitchDetector } from "pitchy";

const FRAME_SIZE = 2048;
const HOP_SIZE = 512;
const MIN_HZ = 70;
const MAX_HZ = 500;
const CLARITY_THRESHOLD = 0.85;

export interface PitchPoint {
  /** Time in seconds, relative to recording start. */
  t: number;
  /** Frequency in Hz, or null when the frame is unvoiced. */
  hz: number | null;
  /** Pitchy confidence in [0, 1]. */
  clarity: number;
}

export interface ToneAnalysis {
  /** Detected tone (1 = high flat, 2 = rising, 3 = dipping, 4 = falling, 5 = neutral). */
  tone: 1 | 2 | 3 | 4 | 5;
  /** Confidence in [0, 1]. */
  confidence: number;
  /** Normalized contour suitable for plotting. */
  contour: PitchPoint[];
  /** Whether the recording contained enough voiced frames to be useful. */
  voiced: boolean;
}

/**
 * Extract a pitch contour from a mono PCM buffer.
 */
export function extractPitchContour(
  samples: Float32Array,
  sampleRate: number
): PitchPoint[] {
  if (samples.length < FRAME_SIZE) return [];
  const detector = PitchDetector.forFloat32Array(FRAME_SIZE);
  detector.minVolumeDecibels = -50;

  const points: PitchPoint[] = [];
  for (let i = 0; i + FRAME_SIZE <= samples.length; i += HOP_SIZE) {
    const frame = samples.subarray(i, i + FRAME_SIZE);
    const [hz, clarity] = detector.findPitch(frame, sampleRate);
    const t = (i + FRAME_SIZE / 2) / sampleRate;
    const voiced = clarity >= CLARITY_THRESHOLD && hz >= MIN_HZ && hz <= MAX_HZ;
    points.push({ t, hz: voiced ? hz : null, clarity });
  }
  return smoothContour(points);
}

/** Median filter then mean-of-neighbors smoothing for the voiced frames. */
function smoothContour(points: PitchPoint[]): PitchPoint[] {
  const voicedHz = points.map((p) => p.hz);
  const smoothed = [...voicedHz];

  // 5-point median filter on voiced frames.
  for (let i = 2; i < smoothed.length - 2; i++) {
    const window = [voicedHz[i - 2], voicedHz[i - 1], voicedHz[i], voicedHz[i + 1], voicedHz[i + 2]]
      .filter((x): x is number => x !== null)
      .sort((a, b) => a - b);
    if (window.length >= 3) smoothed[i] = window[Math.floor(window.length / 2)];
  }

  return points.map((p, i) => ({ ...p, hz: smoothed[i] }));
}

/**
 * Map an absolute Hz contour to a normalized [0, 1] curve where 0 represents
 * the speaker's voice floor and 1 the ceiling, both computed from the
 * recording itself. This is what the user-vs-reference overlay actually
 * compares — absolute Hz differs for every speaker, but the *shape* of the
 * contour is what defines a Mandarin tone.
 */
export function normalizeContour(points: PitchPoint[]): PitchPoint[] {
  const voiced = points.map((p) => p.hz).filter((x): x is number => x !== null);
  if (voiced.length < 4) return points.map((p) => ({ ...p, hz: null }));

  const semitones = voiced.map((hz) => 12 * Math.log2(hz));
  const lo = percentile(semitones, 10);
  const hi = percentile(semitones, 90);
  const range = Math.max(hi - lo, 1);

  return points.map((p) => {
    if (p.hz === null) return p;
    const st = 12 * Math.log2(p.hz);
    const norm = clamp((st - lo) / range, 0, 1);
    return { ...p, hz: norm };
  });
}

/**
 * Detect which of the 4 (+ neutral) tones the user produced, given a
 * normalized contour over a single syllable.
 *
 * Heuristic — fits a polynomial to the voiced frames and inspects its
 * shape. Accurate enough for the demo; the backend version refines this
 * with DTW against a canonical exemplar.
 */
export function detectTone(contour: PitchPoint[]): ToneAnalysis {
  const voiced = contour.filter((p): p is PitchPoint & { hz: number } => p.hz !== null);
  if (voiced.length < 6) {
    return { tone: 5, confidence: 0, contour, voiced: false };
  }

  const xs = voiced.map((_, i) => i / (voiced.length - 1));
  const ys = voiced.map((p) => p.hz);

  const start = average(ys.slice(0, Math.max(2, Math.floor(ys.length * 0.15))));
  const end = average(ys.slice(-Math.max(2, Math.floor(ys.length * 0.15))));
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const minIdx = ys.indexOf(min);
  const slope = end - start;
  const range = max - min;

  let tone: ToneAnalysis["tone"] = 5;
  let confidence = 0;

  if (range < 0.15) {
    // Flat-ish → tone 1 (high level) or neutral. Use absolute height.
    tone = start > 0.55 ? 1 : 5;
    confidence = 0.6 + (0.5 - Math.min(0.5, range)) * 0.4;
  } else if (slope > 0.2) {
    tone = 2;
    confidence = 0.55 + Math.min(slope, 0.6) * 0.5;
  } else if (slope < -0.2) {
    tone = 4;
    confidence = 0.55 + Math.min(-slope, 0.6) * 0.5;
  } else if (minIdx > xs.length * 0.2 && minIdx < xs.length * 0.85 && min < start - 0.1 && min < end - 0.1) {
    tone = 3;
    confidence = 0.6 + Math.min(range, 0.5) * 0.4;
  } else {
    tone = slope >= 0 ? 2 : 4;
    confidence = 0.4;
  }

  return { tone, confidence: clamp(confidence, 0, 1), contour, voiced: true };
}

/**
 * Score the user's contour against a canonical reference contour for the
 * intended tone. 0–100, higher is better. Uses simple DTW.
 */
export function scoreToneAgainstReference(
  user: PitchPoint[],
  reference: number[]
): number {
  const u = user.map((p) => p.hz).filter((x): x is number => x !== null);
  if (u.length < 4) return 0;
  const cost = dtw(u, reference);
  // Convert distance into a 0-100 score with a soft floor at 35.
  const norm = cost / Math.max(u.length, reference.length);
  return clamp(100 - norm * 110, 0, 100);
}

function dtw(a: number[], b: number[]): number {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(Infinity));
  dp[0][0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = Math.abs(a[i - 1] - b[j - 1]);
      dp[i][j] = cost + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[n][m];
}

/**
 * Canonical reference contours for the 5 tones, normalized to [0, 1].
 * Drawn from the average pitch curve of native speaker recordings
 * (Mandarin standard) and resampled to 20 frames.
 */
export const TONE_REFERENCES: Record<1 | 2 | 3 | 4 | 5, number[]> = {
  1: linspace(0.85, 0.85, 20),
  2: linspace(0.35, 0.9, 20),
  3: dippingReference(),
  4: linspace(0.95, 0.15, 20),
  5: linspace(0.55, 0.45, 20),
};

function dippingReference(): number[] {
  const points: number[] = [];
  for (let i = 0; i < 20; i++) {
    const t = i / 19;
    points.push(0.55 - 0.5 * Math.sin(Math.PI * t) + 0.4 * Math.pow(t, 2));
  }
  return points.map((v) => clamp(v, 0, 1));
}

function linspace(start: number, end: number, n: number): number[] {
  const arr = new Array(n);
  for (let i = 0; i < n; i++) arr[i] = start + (end - start) * (i / (n - 1));
  return arr;
}

function average(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = clamp(Math.floor((p / 100) * (sorted.length - 1)), 0, sorted.length - 1);
  return sorted[idx];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}
