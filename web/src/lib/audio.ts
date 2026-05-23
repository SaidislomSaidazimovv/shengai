/**
 * Microphone recording utilities backed by the Web Audio API + MediaRecorder.
 *
 * - Requests mic permission lazily (only when the user clicks "Record").
 * - Captures raw PCM samples for client-side pitch analysis (Pitchy).
 * - Encodes a WAV blob the user can play back and the backend can score.
 *
 * NOTE: We deliberately avoid 3rd-party audio encoders to keep bundle size
 * small and dependencies minimal — a 200-line WAV writer is plenty.
 */

export interface Recording {
  /** Mono float32 PCM samples, range [-1, 1]. */
  samples: Float32Array;
  /** Sample rate of the recording in Hz. */
  sampleRate: number;
  /** Playable blob (audio/wav). */
  blob: Blob;
  /** Object URL for the blob — caller is responsible for revoking. */
  url: string;
  /** Duration in seconds. */
  duration: number;
}

export class Recorder {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  private startedAt = 0;

  async start(): Promise<void> {
    if (this.stream) throw new Error("Recorder already running");

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
      },
    });

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.context = new AudioCtx({ sampleRate: 44100 });

    this.source = this.context.createMediaStreamSource(this.stream);
    this.processor = this.context.createScriptProcessor(4096, 1, 1);

    this.chunks = [];
    this.processor.onaudioprocess = (event) => {
      const channel = event.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(channel));
    };

    this.source.connect(this.processor);
    this.processor.connect(this.context.destination);
    this.startedAt = performance.now();
  }

  async stop(): Promise<Recording> {
    if (!this.stream || !this.context || !this.processor || !this.source) {
      throw new Error("Recorder is not running");
    }

    this.processor.disconnect();
    this.source.disconnect();
    this.stream.getTracks().forEach((t) => t.stop());

    const sampleRate = this.context.sampleRate;
    const samples = concat(this.chunks);
    const blob = encodeWav(samples, sampleRate);
    const url = URL.createObjectURL(blob);
    const duration = samples.length / sampleRate;

    await this.context.close();
    this.context = null;
    this.processor = null;
    this.source = null;
    this.stream = null;
    this.chunks = [];

    return { samples, sampleRate, blob, url, duration };
  }

  isRecording(): boolean {
    return this.stream !== null;
  }

  elapsedMs(): number {
    return this.startedAt ? performance.now() - this.startedAt : 0;
  }
}

function concat(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * Minimal 16-bit PCM WAV encoder. Produces a blob playable in <audio>
 * and accepted by virtually every server-side audio library.
 */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

export async function ensureMicPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}
