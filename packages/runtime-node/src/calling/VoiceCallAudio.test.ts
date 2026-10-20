import { describe, expect, it } from 'vitest';
import { createVoiceCallAudio } from './VoiceCallAudio';

const response = (...chunks: Uint8Array[]) => new ReadableStream<Uint8Array>({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); } });
const ok = async () => ({ ok: true as const, status: 'requested' as const });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe('voice call audio', () => {
  it('primes acceptance without a greeting and exposes the caller audio independently', async () => {
    const audio = createVoiceCallAudio();
    const microphone = (audio.media.microphone as ReadableStream<Uint8Array>).getReader();
    const speaker = (audio.media.speaker as WritableStream<Uint8Array>).getWriter();
    const incoming = audio.incoming.getReader();
    const first = await microphone.read();
    expect(first.value?.length).toBe(640);
    expect(first.value?.every(byte => byte === 0)).toBe(true);
    const waiting = incoming.read();
    await speaker.write(Uint8Array.of(1, 0, 2, 0));
    expect((await waiting).value).toEqual(Uint8Array.of(1, 0, 2, 0));
    audio.close();
    expect((await incoming.read()).done).toBe(true);
  });

  it('preserves complete samples across odd TTS chunk boundaries', async () => {
    const audio = createVoiceCallAudio();
    const microphone = (audio.media.microphone as ReadableStream<Uint8Array>).getReader();
    await microphone.read();
    const result = await audio.speak(response(Uint8Array.of(1), Uint8Array.of(0, 2), Uint8Array.of(0)));
    expect(result).toEqual({ status: 'completed', bytesQueued: 4 });
    const chunks: number[] = [];
    while (chunks.length < 4) chunks.push(...(await microphone.read()).value!);
    expect(chunks).toEqual([1, 0, 2, 0]);
    audio.close();
  });

  it('bounds a slow STT consumer and reports real discarded incoming samples', async () => {
    const audio = createVoiceCallAudio();
    const speaker = (audio.media.speaker as WritableStream<Uint8Array>).getWriter();
    await speaker.write(new Uint8Array(32_000));
    expect(audio.stats().incomingQueuedBytes).toBeLessThanOrEqual(16_000);
    expect(audio.stats().incomingDroppedBytes).toBe(16_000);
    audio.close();
  });

  it('interrupts a blocked response, clears native output, and keeps reception open', async () => {
    const audio = createVoiceCallAudio();
    let cancelled = false, clears = 0;
    const speech = audio.speak(new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(32_000)); }, cancel() { cancelled = true; } }));
    await tick();
    expect(audio.stats().outgoingQueuedBytes).toBeLessThanOrEqual(6_400);
    expect(await audio.interrupt({ clearAudio: async () => { clears++; return ok(); } })).toEqual({ ok: true, status: 'requested' });
    expect((await speech).status).toBe('interrupted');
    expect(cancelled).toBe(true);
    expect(clears).toBe(1);
    expect(audio.stats().outgoingQueuedBytes).toBe(0);
    const speaker = (audio.media.speaker as WritableStream<Uint8Array>).getWriter();
    await speaker.write(Uint8Array.of(3, 0));
    const incoming = audio.incoming.getReader();
    expect((await incoming.read()).value).toEqual(Uint8Array.of(3, 0));
    await audio.write(Uint8Array.of(9, 0));
    const microphone = (audio.media.microphone as ReadableStream<Uint8Array>).getReader();
    expect((await microphone.read()).value).toEqual(Uint8Array.of(9, 0));
    audio.close();
  });

  it('waits for native clearing before accepting a new turn', async () => {
    const audio = createVoiceCallAudio();
    let resolve!: () => void;
    const pending = new Promise<void>(done => { resolve = done; });
    const clear = audio.interrupt({ clearAudio: async () => { await pending; return ok(); } });
    let written = false;
    const write = audio.write(Uint8Array.of(1, 0)).then(() => { written = true; });
    await tick(); expect(written).toBe(false); expect(audio.stats().outgoingQueuedBytes).toBe(0);
    resolve(); await clear; await write;
    expect(written).toBe(true);
    audio.close();
  });

  it('rejects concurrent writers and incomplete PCM without closing incoming audio', async () => {
    const audio = createVoiceCallAudio();
    await expect(audio.write(Uint8Array.of(1))).rejects.toThrow(/complete PCM16/);
    await expect(audio.speak(response(Uint8Array.of(1)))).rejects.toThrow(/incomplete PCM16/);
    const writing = audio.write(new Uint8Array(32_000));
    const settled = writing.catch(error => error.name);
    await expect(audio.write(Uint8Array.of(1, 0))).rejects.toThrow(/already/);
    await audio.interrupt({ clearAudio: ok });
    expect(await settled).toBe('AbortError');
    expect(audio.stats().closed).toBe(false);
    audio.close();
  });

  it('blocks new audio after a failed native clear until explicitly cleared successfully', async () => {
    const audio = createVoiceCallAudio();
    await audio.interrupt({ clearAudio: async () => ({ ok: false, status: 'failed', reason: { code: 'fixture', message: 'fixture', status: 500 } }) });
    await expect(audio.write(Uint8Array.of(1, 0))).rejects.toThrow(/could not be cleared/);
    await audio.interrupt({ clearAudio: ok });
    await expect(audio.write(Uint8Array.of(2, 0))).resolves.toBeUndefined();
    audio.close();
  });

  it('aborts a waiting TTS reader and releases its lock', async () => {
    const audio = createVoiceCallAudio(), controller = new AbortController();
    let cancelled = false;
    const source = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
    const speaking = audio.speak(source, { signal: controller.signal });
    await tick(); controller.abort();
    expect((await speaking).status).toBe('interrupted');
    expect(cancelled).toBe(true); expect(source.locked).toBe(false);
    audio.close();
  });

  it('hangup closes streams, cancels the response and unblocks producers', async () => {
    const audio = createVoiceCallAudio();
    const writing = audio.write(new Uint8Array(32_000));
    const settled = writing.catch(error => error.name);
    const speaker = (audio.media.speaker as WritableStream<Uint8Array>).getWriter();
    await speaker.close();
    expect(await settled).toBe('AbortError');
    expect(audio.stats().closed).toBe(true);
    await expect(audio.write(Uint8Array.of(0, 0))).rejects.toThrow(/closed/);
  });
  it('converts a 24 kHz PCM response to the call format without changing its duration', async () => {
    const audio = createVoiceCallAudio({ responseSampleRate: 24_000 });
    const reader = (audio.media.microphone as ReadableStream<Uint8Array>).getReader();
    await reader.read();
    const pcm = new Uint8Array(960), view = new DataView(pcm.buffer);
    for (let index = 0; index < 480; index++) view.setInt16(index * 2, 1000, true);
    await audio.write(pcm);
    const converted = (await reader.read()).value!;
    expect(converted.length).toBe(640); // 20 ms at 16 kHz
    expect(new DataView(converted.buffer, converted.byteOffset).getInt16(0, true)).toBe(1000);
    expect(audio.responseFormat.sampleRate).toBe(24_000);
    expect(audio.format.sampleRate).toBe(16_000);
    audio.close();
  });

});
