/**
 * Frontend client for our Vercel serverless backend.
 *
 * Why a backend at all when the .md mentions calling HF + ElevenLabs
 * directly: we never want to ship our HF / ElevenLabs API keys in the
 * browser bundle. The serverless functions proxy those calls and inject
 * the secrets server-side.
 *
 * Every call is wrapped in a 3-second timeout per §7 of the handover
 * ("Demo Cannot Fail") so we degrade to pre-rendered fallbacks fast.
 */

const BASE = import.meta.env.VITE_API_BASE_URL || "";

export interface AsrResponse {
  /** Mandarin transcript Whisper produced. Empty when nothing usable. */
  transcript: string;
  source: "huggingface" | "fallback";
  reason?: string | null;
}

export interface CloneResponse {
  voiceId: string;
  source: "elevenlabs" | "fallback";
}

export interface SynthResponse {
  /** Base64-encoded audio/mpeg payload. */
  audioBase64: string;
  source: "elevenlabs" | "prerendered";
}

class TimeoutError extends Error {
  constructor() {
    super("timeout");
  }
}

async function postWithTimeout<T>(path: string, body: FormData | object, timeoutMs = 3000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new TimeoutError()), timeoutMs);
  try {
    const init: RequestInit = {
      method: "POST",
      signal: controller.signal,
    };
    if (body instanceof FormData) {
      init.body = body;
    } else {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${BASE}${path}`, init);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  /**
   * Server-side ASR via HuggingFace Whisper Large V3.
   * Used as a fallback when the browser's Web Speech API is unavailable
   * (Firefox) or returns an error. Generous timeout — Whisper may take
   * a few seconds on warm requests and significantly longer on a cold
   * start; callers can race this against a cheaper signal.
   */
  async asr(audio: Blob): Promise<AsrResponse> {
    const fd = new FormData();
    fd.append("audio", audio, "target.webm");
    // 90s — HF Whisper cold start can hit 60s + transcription time.
    // The backend sends `x-wait-for-model: true` so HF holds until ready.
    return postWithTimeout<AsrResponse>("/api/asr", fd, 90000);
  },

  async cloneVoice(reference: Blob, label: string): Promise<CloneResponse> {
    const fd = new FormData();
    fd.append("audio", reference, "reference.wav");
    fd.append("label", label);
    return postWithTimeout<CloneResponse>("/api/clone", fd, 8000);
  },

  async synthesize(voiceId: string, text: string): Promise<SynthResponse> {
    return postWithTimeout<SynthResponse>("/api/synth", { voiceId, text }, 6000);
  },

  async health(): Promise<{ ok: boolean; elevenlabs: boolean; hf: boolean }> {
    const res = await fetch(`${BASE}/api/health`, { method: "POST" });
    return res.json();
  },
};
