import { AudioResampler, decodePcm, encodePcm } from './audio';
import type { Call, CallActionResult, CallMediaOptions } from '@eulab/openwaunlocked-schema';

/** Application audio is always raw signed PCM16 little-endian, 16 kHz, mono. */
export const VOICE_CALL_AUDIO_FORMAT = Object.freeze({ encoding: 'pcm16le', sampleRate: 16_000, channels: 1 } as const);
const FRAME_BYTES = 640; // 20 ms
const interruption = () => new DOMException('The voice response was interrupted.', 'AbortError');

class PcmQueue {
  private chunks: Uint8Array[] = [];
  bytes = 0;
  droppedBytes = 0;
  private ended = false;
  private pendingPull?: () => void;
  private controller!: ReadableStreamDefaultController<Uint8Array>;
  private space = new Set<() => void>();
  readonly stream: ReadableStream<Uint8Array>;

  constructor(readonly capacity: number, onCancel?: () => void) {
    this.stream = new ReadableStream<Uint8Array>({
      start: controller => { this.controller = controller; },
      pull: () => {
        if (this.deliver()) return;
        return new Promise<void>(resolve => { this.pendingPull = resolve; });
      },
      cancel: () => { this.ended = true; this.clear(); this.resolvePull(); onCancel?.(); },
    }, { highWaterMark: 0 });
  }

  private resolvePull() { const resolve = this.pendingPull; this.pendingPull = undefined; resolve?.(); }
  private wake() { for (const resolve of this.space) resolve(); this.space.clear(); }
  private deliver(): boolean {
    const chunk = this.chunks.shift();
    if (chunk) { this.bytes -= chunk.length; this.controller.enqueue(chunk); this.wake(); return true; }
    if (this.ended) { this.controller.close(); return true; }
    return false;
  }
  clear() { const bytes = this.bytes; this.chunks = []; this.bytes = 0; this.wake(); return bytes; }
  end(discard = false) {
    if (this.ended) return;
    this.ended = true;
    if (discard) this.clear();
    if (this.pendingPull) { this.deliver(); this.resolvePull(); }
    this.wake();
  }
  offer(chunk: Uint8Array) {
    if (this.ended) { this.droppedBytes += chunk.length; return; }
    while (this.bytes + chunk.length > this.capacity) {
      const discarded = this.chunks.shift();
      if (!discarded) break;
      this.bytes -= discarded.length; this.droppedBytes += discarded.length;
    }
    this.chunks.push(chunk.slice()); this.bytes += chunk.length;
    if (this.pendingPull) { this.deliver(); this.resolvePull(); }
  }
  async write(chunk: Uint8Array, current: () => boolean) {
    while (!this.ended && current() && this.bytes + chunk.length > this.capacity) {
      await new Promise<void>(resolve => this.space.add(resolve));
    }
    if (this.ended || !current()) throw interruption();
    this.offer(chunk);
  }
}

export interface VoiceCallAudio {
  readonly format: typeof VOICE_CALL_AUDIO_FORMAT;
  readonly responseFormat: { readonly encoding: 'pcm16le'; readonly sampleRate: number; readonly channels: 1 };
  /** Pass this to call.accept(), call.setMedia() or client.startCall(). */
  readonly media: CallMediaOptions;
  /** Continuous caller audio for STT/VAD. A slow reader drops oldest buffered audio. */
  readonly incoming: ReadableStream<Uint8Array>;
  /** Queue one complete PCM buffer, respecting backpressure. Do not run writers concurrently. */
  write(pcm: Uint8Array, options?: { signal?: AbortSignal }): Promise<void>;
  /** Consume one streaming TTS response. Handles sample bytes split across provider chunks. */
  speak(pcm: ReadableStream<Uint8Array>, options?: { signal?: AbortSignal }): Promise<{ status: 'completed' | 'interrupted'; bytesQueued: number }>;
  /** Cancel the current response and clear native output. Incoming audio stays open. */
  interrupt(call: Pick<Call, 'clearAudio'>): Promise<CallActionResult>;
  /** Release streams and TTS readers. Does not hang up; use call.end() separately. */
  close(): void;
  stats(): { closed: boolean; outgoingQueuedBytes: number; incomingQueuedBytes: number; incomingDroppedBytes: number; interruptedOutgoingBytes: number };
}

/** Transport adapter for an external IVR/voice agent; it contains no STT, TTS or LLM. */
export function createVoiceCallAudio(options: { responseSampleRate?: number } = {}): VoiceCallAudio {
  const responseRate = options.responseSampleRate ?? 16_000;
  if (!Number.isInteger(responseRate) || responseRate < 8_000 || responseRate > 192_000) throw new Error('Response sample rate must be between 8000 and 192000 Hz.');
  const responseFormat = Object.freeze({ encoding: 'pcm16le' as const, sampleRate: responseRate, channels: 1 as const });
  let resampler = new AudioResampler(16_000);
  let closed = false, epoch = 0, interruptedOutgoingBytes = 0;
  let owner: { epoch: number; reader?: ReadableStreamDefaultReader<Uint8Array> } | undefined;
  let clearing: Promise<CallActionResult> | undefined;
  let clearError: Error | undefined;
  const received = new PcmQueue(16_000); // 500 ms, independent of outgoing speech
  const outgoing = new PcmQueue(6_400, () => close()); // 200 ms
  // The Node decoder needs a prefix before accepting the call. Silence lets an
  // IVR listen first, without waiting for the LLM/TTS to produce a greeting.
  outgoing.offer(new Uint8Array(FRAME_BYTES));
  const close = () => {
    if (closed) return;
    closed = true; epoch++;
    const reader = owner?.reader; owner = undefined;
    outgoing.end(true); received.end();
    void reader?.cancel().catch(() => undefined);
  };
  const acquire = () => {
    if (closed) throw new Error('Voice call audio is closed.');
    if (owner) throw new Error('A voice response is already being written. Interrupt it before starting another.');
    const token = { epoch, bytesQueued: 0 };
    owner = token;
    return token;
  };
  const send = async (bytes: Uint8Array, token: { epoch: number; bytesQueued: number }, signal?: AbortSignal) => {
    if (!(bytes instanceof Uint8Array) || bytes.length % 2) throw new Error('Audio must contain complete PCM16 samples.');
    if (clearing) await clearing;
    if (clearError) throw clearError;
    const current = () => !closed && token.epoch === epoch && !signal?.aborted;
    if (!current()) throw interruption();
    if (responseRate !== 16_000) bytes = encodePcm(resampler.process(decodePcm(bytes, responseFormat), responseRate));
    for (let offset = 0; offset < bytes.length; offset += FRAME_BYTES) {
      const frame = bytes.subarray(offset, offset + FRAME_BYTES);
      await outgoing.write(frame, current); token.bytesQueued += frame.length;
    }
    if (!current()) throw interruption();
  };
  const abortTurn = (token: { epoch: number }) => {
    if (token.epoch !== epoch) return;
    epoch++; resampler = new AudioResampler(16_000); interruptedOutgoingBytes += outgoing.clear();
    if (owner?.epoch === token.epoch) { void owner.reader?.cancel().catch(() => undefined); owner = undefined; }
  };
  return {
    format: VOICE_CALL_AUDIO_FORMAT,
    responseFormat,
    media: {
      microphone: outgoing.stream,
      speaker: new WritableStream<Uint8Array>({
        write(bytes) {
          if (!(bytes instanceof Uint8Array) || bytes.length % 2) throw new Error('Received audio contains an incomplete PCM16 sample.');
          for (let offset = 0; offset < bytes.length; offset += FRAME_BYTES) received.offer(bytes.subarray(offset, offset + FRAME_BYTES));
        },
        close, abort: close,
      }),
    },
    incoming: received.stream,
    async write(bytes, { signal } = {}) {
      const token = acquire();
      const abort = () => abortTurn(token);
      signal?.addEventListener('abort', abort, { once: true });
      try { await send(bytes, token, signal); }
      finally { signal?.removeEventListener('abort', abort); if (owner === token) owner = undefined; }
    },
    async speak(source, { signal } = {}) {
      const token = acquire();
      resampler = new AudioResampler(16_000);
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined, trailing: number | undefined, completed = false;
      const abort = () => abortTurn(token);
      signal?.addEventListener('abort', abort, { once: true });
      try {
        if (signal?.aborted) throw interruption();
        reader = source.getReader(); owner!.reader = reader;
        while (true) {
          const next = await reader.read();
          if (closed || token.epoch !== epoch || signal?.aborted) throw interruption();
          if (next.done) break;
          if (!(next.value instanceof Uint8Array)) throw new Error('TTS must emit PCM byte chunks.');
          let bytes = next.value;
          if (trailing !== undefined) { const joined = new Uint8Array(bytes.length + 1); joined[0] = trailing; joined.set(bytes, 1); bytes = joined; trailing = undefined; }
          if (bytes.length % 2) { trailing = bytes[bytes.length - 1]; bytes = bytes.subarray(0, bytes.length - 1); }
          await send(bytes, token, signal);
        }
        if (trailing !== undefined) throw new Error('TTS ended with an incomplete PCM16 sample.');
        completed = true;
        return { status: 'completed', bytesQueued: token.bytesQueued };
      } catch (error) {
        if (closed || token.epoch !== epoch || signal?.aborted) return { status: 'interrupted', bytesQueued: token.bytesQueued };
        throw error;
      } finally {
        signal?.removeEventListener('abort', abort);
        if (!completed) void reader?.cancel().catch(() => undefined);
        reader?.releaseLock();
        if (owner === token) owner = undefined;
      }
    },
    interrupt(call) {
      if (closed) return Promise.reject(new Error('Voice call audio is closed.'));
      if (owner) abortTurn(owner);
      else { epoch++; resampler = new AudioResampler(16_000); interruptedOutgoingBytes += outgoing.clear(); }
      if (!clearing) {
        clearing = Promise.resolve().then(() => call.clearAudio()).then(result => {
          clearError = result.ok ? undefined : new Error('Native output could not be cleared. Check the call before sending another response.');
          return result;
        }, error => { clearError = error instanceof Error ? error : new Error(String(error)); throw error; }).finally(() => { clearing = undefined; });
      }
      return clearing;
    },
    close,
    stats: () => ({ closed, outgoingQueuedBytes: outgoing.bytes, incomingQueuedBytes: received.bytes, incomingDroppedBytes: received.droppedBytes, interruptedOutgoingBytes }),
  };
}
