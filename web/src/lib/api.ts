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

export interface MddResponse {
  /** Phonemes the model heard. */
  detected: string[];
  /** Phonemes we expected. */
  expected: string[];
  /** Per-phoneme error score (0..1). */
  hits: { phoneme: string; errorScore: number }[];
  /** First phoneme above an error threshold — drives our diagnosis trigger. */
  worst: string | null;
  source: "huggingface" | "fallback";
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
  async mdd(audio: Blob, expectedPhonemes: string[]): Promise<MddResponse> {
    const fd = new FormData();
    fd.append("audio", audio, "target.wav");
    fd.append("expected", expectedPhonemes.join(" "));
    return postWithTimeout<MddResponse>("/api/mdd", fd, 5000);
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
