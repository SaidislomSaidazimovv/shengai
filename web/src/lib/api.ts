/**
 * Backend API client. All endpoints are optional — every caller must
 * tolerate a failure and fall back to the client-side result.
 */

import type { PitchPoint } from "./pitch";

const BASE = import.meta.env.VITE_API_BASE_URL || "";

export type Lang = "uz" | "ru" | "en";

export interface ScoreResponse {
  toneScore: number;
  initialScore: number;
  finalScore: number;
  overall: number;
  detectedTone: number;
  /** Server-side aligned reference contour (normalized). */
  reference: number[];
}

export interface ExplainResponse {
  text: string;
  source: "gemini" | "fallback";
}

export interface ScoreRequest {
  pinyin: string;
  intendedTone: number;
  contour: PitchPoint[];
}

export interface ExplainRequest {
  pinyin: string;
  intendedTone: number;
  detectedTone: number;
  toneScore: number;
  initialScore: number;
  finalScore: number;
  lang: Lang;
}

async function postJson<T>(path: string, body: unknown, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  async score(req: ScoreRequest): Promise<ScoreResponse> {
    return postJson<ScoreResponse>("/api/score", req);
  },
  async explain(req: ExplainRequest): Promise<ExplainResponse> {
    return postJson<ExplainResponse>("/api/explain", req, 12000);
  },
};

/** Wrap an API call with a graceful fallback. */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => T,
  onError?: (err: unknown) => void
): Promise<T> {
  try {
    return await primary();
  } catch (err) {
    onError?.(err);
    return fallback();
  }
}
