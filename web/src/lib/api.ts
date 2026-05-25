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

export interface ExplainRequest {
  transcript: string;
  target: string;
  pinyin: string;
  l1: "russian" | "uzbek";
  phoneme: string;
  language: "uz" | "ru" | "en";
}

export interface ExplainResponse {
  explanation: string;
  tip: string;
  source: "gemini" | "fallback";
  reason?: string | null;
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
    // Match the filename extension to the Blob's actual mime type so
    // ElevenLabs doesn't see a "reference.wav" claim with WebM bytes
    // and 400 the request. MediaRecorder typically produces audio/webm
    // on Chrome/Firefox and audio/mp4 on Safari.
    const mime = reference.type || "audio/webm";
    const ext = mime.includes("mp4")
      ? "mp4"
      : mime.includes("ogg")
        ? "ogg"
        : mime.includes("mpeg")
          ? "mp3"
          : mime.includes("wav")
            ? "wav"
            : "webm";
    fd.append("audio", reference, `reference.${ext}`);
    fd.append("label", label);
    // We've measured ElevenLabs IVC at 18-28s during peak load (the
    // 30s ceiling was getting hit and falling back to demo voice).
    // 45s gives the server's 30s upstream budget room plus proxy
    // overhead while still bounded enough that a truly dead network
    // fails loud instead of hanging indefinitely.
    return postWithTimeout<CloneResponse>("/api/clone", fd, 45000);
  },

  async synthesize(voiceId: string, text: string): Promise<SynthResponse> {
    // 20s was racing the actual ElevenLabs response — the
    // (cancelled) entries in the user's network tab fired at 20.4s
    // because our AbortController hit the budget right when the API
    // was about to return. Flash v2.5 fresh-clone calls can take
    // 15-25s on cold paths; 35s clears that window comfortably while
    // still bounded enough that a truly hung backend fails fast.
    return postWithTimeout<SynthResponse>("/api/synth", { voiceId, text }, 35000);
  },

  /**
   * Release an ElevenLabs IVC voice slot. Called on session end (tab
   * close / explicit re-capture) so the Starter plan's 10-slot cap
   * doesn't fill up after a few users. Best-effort: failure here is
   * never user-visible — the next user just sees a slightly older
   * pool until ElevenLabs garbage-collects.
   *
   * For tab-close, callers prefer navigator.sendBeacon() over this
   * (sendBeacon survives the unload); this method is the fallback
   * for explicit in-tab cleanup (e.g. the "Re-capture" button).
   */
  async deleteVoice(voiceId: string): Promise<{ ok: boolean; reason?: string }> {
    try {
      return await postWithTimeout<{ ok: boolean; reason?: string }>(
        "/api/clone_delete",
        { voiceId },
        4000
      );
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : "network" };
    }
  },

  /**
   * Gemini 2.0 Flash native-language explanation of the L1 phoneme error.
   * Returns within a few seconds; the backend always returns a usable
   * payload (canned fallback if the Gemini call fails) so the UI can
   * surface *something* on every diagnosis.
   */
  async explain(req: ExplainRequest): Promise<ExplainResponse> {
    // Gemini 2.0 Flash is usually <5s but can hit 15-20s on cold
    // starts. Bumped to 30s so the AI Tutor panel actually fills with
    // a Gemini answer instead of falling back to the canned copy.
    return postWithTimeout<ExplainResponse>("/api/explain", req, 30000);
  },

  async health(): Promise<{ ok: boolean; elevenlabs: boolean; hf: boolean }> {
    const res = await fetch(`${BASE}/api/health`, { method: "POST" });
    return res.json();
  },
};
