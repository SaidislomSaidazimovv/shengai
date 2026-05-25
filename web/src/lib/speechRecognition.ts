/**
 * Browser-native ASR using the Web Speech API.
 *
 * Why we use this over a HuggingFace wav2vec2 endpoint:
 *   - The phoneme-level MDD models we'd ideally want
 *     (mrrubino/..., facebook/wav2vec2-xlsr-53-espeak-cv-ft) are not
 *     deployed to the HF Inference API. Calling /api/mdd would
 *     always fall back to a hardcoded trigger phoneme, so the real
 *     signal would be missing — the same /y/ would fire even when
 *     the user said nothing.
 *   - `SpeechRecognition` is free, zero-token, runs in Chrome / Edge
 *     / Safari, and returns Mandarin characters when zh-CN is
 *     selected. From the actual transcript we compare against the
 *     expected sentence character by character and pin the first
 *     true mismatch.
 *
 * Browser support note: Firefox does not implement SpeechRecognition.
 * `isSupported()` returns false there and callers fall back to the
 * L1-default trigger phoneme.
 */

// The Web Speech API type definitions are not in every TS lib version;
// declare the bits we use rather than depending on lib.dom edge cases.
interface SpeechResultAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechResult {
  isFinal: boolean;
  0: SpeechResultAlternative;
  length: number;
}
interface SpeechRecognitionEvent extends Event {
  results: { [index: number]: SpeechResult; length: number };
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  // Debug toggle: visiting "/?asr=hf" forces the HuggingFace Whisper
  // fallback path so we can validate the server-side ASR even on
  // Chrome where the browser engine would otherwise win the race.
  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("asr") === "hf") return false;
    } catch {
      // ignore — fall through to native detection
    }
  }
  return getCtor() !== null;
}

export interface RecognitionResult {
  transcript: string;
  confidence: number;
  supported: boolean;
  error?: string;
}

/**
 * One-shot recognizer: starts on the active mic stream, resolves when the
 * speech engine emits its first final result, errors out, or the caller
 * aborts via the returned `abort` function.
 *
 * The returned abort function is safe to call at any time and idempotent.
 */
export interface RecognitionSession {
  result: Promise<RecognitionResult>;
  abort: () => void;
}

export function startRecognition(lang = "zh-CN", maxSeconds = 9): RecognitionSession {
  const Ctor = getCtor();
  if (!Ctor) {
    return {
      result: Promise.resolve({ transcript: "", confidence: 0, supported: false }),
      abort: () => undefined,
    };
  }

  const recognizer = new Ctor();
  recognizer.lang = lang;
  recognizer.continuous = false;
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;

  let settled = false;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const result = new Promise<RecognitionResult>((resolve) => {
    const finish = (r: RecognitionResult) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      try {
        recognizer.stop();
      } catch {
        // ignore — likely already stopped
      }
      resolve(r);
    };

    recognizer.onresult = (event) => {
      const final = event.results[0];
      if (!final) {
        finish({ transcript: "", confidence: 0, supported: true });
        return;
      }
      const best = final[0];
      finish({
        transcript: (best.transcript || "").trim(),
        confidence: best.confidence || 0,
        supported: true,
      });
    };
    recognizer.onerror = (event) => {
      finish({
        transcript: "",
        confidence: 0,
        supported: true,
        error: event.error || "unknown",
      });
    };
    recognizer.onend = () => {
      // If we end without a result (silence), resolve as no-speech.
      finish({ transcript: "", confidence: 0, supported: true, error: "no-speech" });
    };

    try {
      recognizer.start();
    } catch (e) {
      finish({
        transcript: "",
        confidence: 0,
        supported: true,
        error: e instanceof Error ? e.message : "start_failed",
      });
      return;
    }

    timeout = setTimeout(() => {
      finish({ transcript: "", confidence: 0, supported: true, error: "timeout" });
    }, maxSeconds * 1000);
  });

  const abort = () => {
    if (settled) return;
    try {
      recognizer.abort();
    } catch {
      // ignore
    }
  };

  return { result, abort };
}

/**
 * Compare what the user actually said to what they were supposed to say.
 *
 * Returns the index of the first mismatching hanzi character, or -1 if
 * everything matched (or the transcript is empty).
 */
export function findFirstMismatch(expected: string, detected: string): number {
  if (!detected) return -1;
  // Normalize by stripping punctuation and whitespace.
  const norm = (s: string) => s.replace(/[\s　、。，！？.,!?]/g, "");
  const e = norm(expected);
  const d = norm(detected);
  const len = Math.min(e.length, d.length);
  for (let i = 0; i < len; i++) {
    if (e[i] !== d[i]) return i;
  }
  if (d.length < e.length) return d.length; // user said less than expected
  return -1;
}

/**
 * Character-level coverage between the target sentence and the ASR
 * transcript. Returns an integer percentage in [0, 100]. Used by the
 * RESOLVED report to show how completely the SPEAK step landed.
 *
 * We normalize by `max(expected, detected)` length rather than just
 * `expected.length` — that way a user who says extra characters
 * ("我喜欢学中文今天好啊") is penalized too, not rewarded with a
 * 100% because the first six chars happened to match. Whitespace and
 * CJK / Latin punctuation are stripped before comparison.
 *
 * Optional `confidence` (0..1, from the browser ASR's per-result
 * confidence score) multiplies the raw match — clear speech that
 * scores 0.95 keeps most of its coverage; mumbling that returns the
 * sentence with 0.4 confidence gets penalised honestly. Default 1.0
 * preserves backward compatibility when no confidence is available
 * (Whisper / fallback paths).
 */
export function charCoveragePct(
  expected: string,
  detected: string,
  confidence = 1
): number {
  const norm = (s: string) => s.replace(/[\s　、。，！？.,!?]/g, "");
  const e = norm(expected);
  const d = norm(detected);
  if (e.length === 0) return 0;
  let matched = 0;
  const minLen = Math.min(e.length, d.length);
  for (let i = 0; i < minLen; i++) {
    if (e[i] === d[i]) matched++;
  }
  const denom = Math.max(e.length, d.length);
  const positional = matched / denom;
  // Confidence ≥ 0.95 leaves the score essentially untouched; below
  // that we shrink linearly so a low-confidence "correct" transcript
  // never reads as a perfect attempt. Clamp to [0, 1].
  const confFactor = Math.max(0, Math.min(1, confidence < 0.95 ? confidence : 1));
  return Math.round(positional * confFactor * 100);
}
