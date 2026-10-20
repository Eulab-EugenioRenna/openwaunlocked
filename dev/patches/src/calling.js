// Native WhatsApp calling provider for the existing host CallingService protocol.
const calls = { generation: '', media: new Map(), activeMedia: null, bindings: false, receiveSequence: 0, audioStats: { writtenSamples: 0, receivedSamples: 0 } };
const callStack = () => dev.module('WAWebVoipStackInterface').getVoipStackInterface();
const callCollection = () => dev.module('WAWebCallCollection');
const snapshot = () => {
  const call = callCollection().activeCall;
  if (!call) return null;
  const nativeState = call.getState();
  const state = ({ 0: 'ended', 1: 'calling', 2: 'ringing', 3: 'ringing', 4: 'connecting', 5: 'connecting',
    6: 'active', 7: 'handled-remotely', 8: 'ringing', 9: 'connecting', 10: 'connecting', 11: 'active',
    12: 'calling', 13: 'ended', 14: 'calling' })[nativeState] ?? `native-${nativeState}`;
  return { id: String(call.id), peer: dev.serial(call.peerJid), state,
    direction: call.outgoing ? 'outgoing' : 'incoming', video: call.isVideo === true,
    terminal: ['ended', 'failed', 'rejected'].includes(state), observedAt: Date.now() };
};
const sendCallEvent = event => {
  if (!calls.generation || typeof window.__openwaCallsHost !== 'function') return;
  Promise.resolve(window.__openwaCallsHost(event, calls.generation)).catch(error => console.warn('Call bridge failed', error));
};
const info = () => {
  let control = false;
  try { control = !!callCollection() && dev.module('WAWebVoipGatingUtils').isVoipDownloadEnabled()
    && typeof dev.module('WAWebVoipStackInterface').getVoipStackInterface === 'function'
    && typeof dev.module('WAWebVoipStartCall').startWAWebVoipCall === 'function'; } catch {}
  return { protocolVersion: 1, artifactRevision: 'local-dev-v1', expiresAt: Number.MAX_SAFE_INTEGER,
    control, audio: control && !!navigator.mediaDevices?.getUserMedia && !!window.AudioContext,
    video: control && !!navigator.mediaDevices?.getUserMedia && !!window.RTCPeerConnection };
};
const releaseMedia = async attachmentId => {
  const target = calls.media.get(attachmentId);
  if (!target) return;
  if (calls.activeMedia === target) calls.activeMedia = null;
  for (const source of target.sources) { try { source.stop(); } catch {} }
  for (const node of target.nodes) { try { node.disconnect(); } catch {} }
  for (const track of [...target.stream.getTracks(), ...target.returnedTracks]) track.stop();
  await target.context?.close();
  calls.media.delete(attachmentId);
};
const hookMedia = () => {
  if (calls.mediaHooked || !navigator.mediaDevices?.getUserMedia) return;
  const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  calls.getUserMedia = original;
  navigator.mediaDevices.getUserMedia = async constraints => {
    const selected = calls.activeMedia;
    if (!selected || (!calls.acquiring && !snapshot())) return original(constraints);
    const tracks = [];
    if (constraints.audio) tracks.push(...selected.stream.getAudioTracks().map(track => track.clone()));
    if (constraints.video) tracks.push(...selected.stream.getVideoTracks().map(track => track.clone()));
    if (!tracks.length) throw new Error('No prepared tracks match the requested calling media.');
    selected.returnedTracks.push(...tracks);
    return new MediaStream(tracks);
  };
  calls.mediaHooked = true;
};
// WhatsApp's web VoIP stack feeds WASM through its own capture/playback drivers.
// It does not use RTCPeerConnection for the audio path.
const hookNativeAudio = () => {
  if (calls.nativeAudioHooked) return;
  const silent = dev.module('WAWebVoipSilentCapture');
  const acquire = dev.module('WAWebVoipAcquireMediaStream');
  const capture = dev.module('WAWebVoipAudioCaptureBase').WAWebVoipAudioCaptureBase.prototype;
  const playback = dev.module('WAWebVoipAudioPlaybackBase').WAWebVoipAudioPlaybackBase.prototype;
  if (typeof silent.findMicrophone !== 'function' || typeof acquire.acquireVoipMediaStream !== 'function'
    || typeof capture.initCaptureDriver !== 'function' || typeof capture.switchDevice !== 'function'
    || typeof playback.initPlaybackDriver !== 'function' || !window.AudioNode?.prototype?.connect) {
    throw new Error('The native VoIP audio driver contract is unavailable.');
  }
  calls.nativeRestores = [];
  calls.playbackContexts = new WeakSet();
  calls.playbackSources = new WeakSet();
  calls.playbackNodes = [];
  const replace = (target, key, wrap) => {
    const original = target[key];
    const replacement = wrap(original);
    target[key] = replacement;
    if (target[key] !== replacement) throw new Error(`Cannot attach native audio hook: ${key}`);
    calls.nativeRestores.push(() => { if (target[key] === replacement) target[key] = original; });
  };
  const ownedStream = selected => {
    const tracks = selected.stream.getAudioTracks().map(track => track.clone());
    selected.returnedTracks.push(...tracks);
    return new MediaStream(tracks);
  };
  calls.ownedStream = ownedStream;
  try {
    replace(silent, 'findMicrophone', original => async function(...args) {
      const selected = calls.activeMedia;
      if (selected && selected.options.microphone !== 'device') return { selectedDeviceId: 'default' };
      return original.apply(this, args);
    });
    replace(acquire, 'acquireVoipMediaStream', original => async function(options, ...args) {
      const selected = calls.activeMedia;
      if (selected && options?.type === 'microphone' && selected.options.microphone !== 'device') return ownedStream(selected);
      return original.call(this, options, ...args);
    });
    replace(capture, 'initCaptureDriver', original => async function(...args) {
      const result = await original.apply(this, args);
      if (calls.activeMedia) calls.captureDriver = this;
      return result;
    });
    replace(playback, 'initPlaybackDriver', original => async function(...args) {
      const result = await original.apply(this, args);
      if (calls.activeMedia && this.playbackAudioContext) calls.playbackContexts.add(this.playbackAudioContext);
      return result;
    });
    replace(window.AudioNode.prototype, 'connect', original => function(target, ...args) {
      const result = original.call(this, target, ...args);
      const context = this.context;
      const isOutput = target === context?.destination ||
        (window.MediaStreamAudioDestinationNode && target instanceof window.MediaStreamAudioDestinationNode);
      if (!calls.playbackContexts.has(context) || !isOutput || calls.playbackSources.has(this)) return result;
      calls.playbackSources.add(this);
      const processor = context.createScriptProcessor(2048, 1, 1);
      const sink = context.createGain(); sink.gain.value = 0;
      original.call(this, processor); original.call(processor, sink); original.call(sink, context.destination);
      processor.onaudioprocess = audio => {
        const active = snapshot(), selected = calls.activeMedia;
        if (!active || !selected) return;
        const samples = Array.from(audio.inputBuffer.getChannelData(0));
        calls.audioStats.receivedSamples += samples.length;
        // Native playback may run at 16 kHz: one 2048-sample callback is 128 ms,
        // exceeding the host's 120 ms admission limit. Preserve every sample
        // while emitting bounded frames with their original timeline.
        const size = Math.min(3840, Math.floor(context.sampleRate * 0.08));
        const startedAt = Date.now() - samples.length * 1000 / context.sampleRate;
        for (let offset = 0; offset < samples.length; offset += size) {
          sendCallEvent({ type: 'audio', callId: active.id, attachmentId: selected.id,
            frame: { samples: samples.slice(offset, offset + size), sampleRate: context.sampleRate,
              sequence: calls.receiveSequence++, timestampMs: startedAt + offset * 1000 / context.sampleRate } });
        }
      };
      calls.playbackNodes.push(processor, sink);
      return result;
    });
    calls.nativeAudioHooked = true;
  } catch (error) {
    for (const restore of calls.nativeRestores.reverse()) restore();
    calls.nativeRestores = [];
    throw error;
  }
};
window.__OPENWA_CALLS__ = {
  describe: info,
  diagnostics: () => ({ nativeAudioHooked: !!calls.nativeAudioHooked, captureDriverAttached: !!calls.captureDriver, ...calls.audioStats }),
  install: ({ generation }) => {
    calls.generation = generation;
    hookMedia();
    if (!calls.bindings) {
      let previous = null;
      let previousKey;
      const changed = () => {
        const current = snapshot();
        const key = current ? `${current.id}:${current.state}:${current.video}` : 'none';
        if (key === previousKey) return;
        previousKey = key;
        sendCallEvent({ type: 'state', snapshot: current,
          ...(!current && previous ? { terminal: { ...previous, state: 'ended', terminal: true, observedAt: Date.now() } } : {}) });
        previous = current;
      };
      // Native CallCollection.activeCall is assigned without adding a model.
      calls.stateTimer = setInterval(changed, 250);
      calls.bindings = true;
      changed();
    }
    return info();
  },
  get: snapshot,
  async command(input) {
    const current = snapshot();
    if (input.action !== 'start' && (!current || current.id !== input.id)) throw new Error('This call is no longer active.');
    const stack = await callStack();
    if (!stack) throw new Error('The native VoIP stack is unavailable.');
    calls.acquiring = true;
    try {
    switch (input.action) {
      case 'start': {
        const wid = dev.wid(input.to);
        if (!wid.isUser()) throw new Error('Calling requires a user recipient.');
        await dev.module('WAWebVoipStartCall').startWAWebVoipCall(wid, input.video === true, 8, 5, null, { entryTrust: 'user_gesture' });
        break;
      }
      case 'accept': await stack.acceptCall(input.microphone !== false, input.video === true); break;
      case 'reject': await stack.rejectCall(); break;
      case 'end': await stack.endCall(2, true); break;
      case 'mute': {
        const media = calls.activeMedia;
        if (!media) throw new Error('No media is attached to this call.');
        for (const track of [...media.stream.getAudioTracks(), ...media.returnedTracks.filter(track => track.kind === 'audio')]) track.enabled = input.value !== true;
        break;
      }
      case 'clear': {
        const media = calls.activeMedia;
        if (media) {
          for (const source of media.sources.splice(0)) { try { source.stop(); } catch {} }
          media.nextTime = media.context.currentTime;
        }
        break;
      }
      default: throw new Error(`Unknown call action ${input.action}`);
    }
    } finally { calls.acquiring = false; }
    const active = snapshot();
    sendCallEvent({ type: 'state', snapshot: active });
    return { ok: true, status: 'requested', ...(active ? { callId: active.id } : {}) };
  },
  async prepareMedia(options) {
    if (calls.media.has(options.attachmentId)) return { ready: false, message: 'This media attachment already exists.' };
    if (!info().audio) return { ready: false, message: 'Native calling media is unavailable in this browser.' };
    try { hookNativeAudio(); } catch (error) { return { ready: false, message: error.message }; }
    if (options.camera === 'injected') return { ready: false, message: 'The current host does not supply injected video frames.' };
    const stream = new MediaStream();
    let context;
    let destination;
    try {
      const constraints = {
        audio: options.microphone === 'device' ? (options.deviceIds?.microphone ? { deviceId: { exact: options.deviceIds.microphone } } : true) : false,
        video: options.camera === 'device' ? (options.deviceIds?.camera ? { deviceId: { exact: options.deviceIds.camera } } : true) : false,
      };
      if (constraints.audio || constraints.video) {
        const device = await calls.getUserMedia(constraints);
        for (const track of device.getTracks()) stream.addTrack(track);
      }
      context = new AudioContext({ sampleRate: 48000 });
      await context.resume();
      if (options.microphone === 'injected' || options.microphone === 'disabled') {
        destination = context.createMediaStreamDestination();
        for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);
      }
      calls.media.set(options.attachmentId, { id: options.attachmentId, options, stream, context, destination, sources: [], nodes: [], returnedTracks: [], nextTime: 0 });
      return { ready: true };
    } catch (error) {
      for (const track of stream.getTracks()) track.stop();
      await context?.close();
      return { ready: false, message: error.message };
    }
  },
  async commitMedia({ attachmentId }) {
    const selected = calls.media.get(attachmentId);
    if (!selected) return { ready: false, message: 'Prepared media is unavailable.' };
    const previous = calls.activeMedia;
    // Retain ownership of the working source until the native switch succeeds.
    if (snapshot() && previous && previous !== selected) {
      try {
        if (!calls.captureDriver) return { ready: false, message: 'The native capture driver is not attached.' };
        const replacementStream = calls.ownedStream(selected);
        const switched = await calls.captureDriver.switchDevice('default', undefined, undefined, true, replacementStream);
        if (!switched) {
          for (const track of replacementStream.getTracks()) track.stop();
          return { ready: false, message: 'The native capture driver rejected the replacement stream.' };
        }
      } catch (error) {
        return { ready: false, message: `Native media replacement failed: ${error.message}` };
      }
    }
    calls.activeMedia = selected;
    return { ready: true };
  },
  async writeAudio({ attachmentId, frame }) {
    const selected = calls.media.get(attachmentId);
    if (!selected?.destination || selected !== calls.activeMedia) throw new Error('Injected calling audio has no active owner.');
    if (!Array.isArray(frame.samples) || frame.samples.length > 3840 || !frame.samples.every(Number.isFinite)
      || !Number.isFinite(frame.sampleRate) || frame.sampleRate < 8000 || frame.sampleRate > 192000) throw new Error('Invalid calling audio frame.');
    calls.audioStats.writtenSamples += frame.samples.length;
    const now = selected.context.currentTime;
    // Drop stale queued audio instead of growing latency without a bound.
    if (selected.nextTime - now > 0.5) {
      for (const source of selected.sources.splice(0)) { try { source.stop(); } catch {} }
      selected.nextTime = now;
    }
    const buffer = selected.context.createBuffer(1, frame.samples.length, frame.sampleRate);
    buffer.copyToChannel(new Float32Array(frame.samples), 0);
    const source = selected.context.createBufferSource(); source.buffer = buffer;
    source.connect(selected.destination);
    source.onended = () => { selected.sources = selected.sources.filter(item => item !== source); source.disconnect(); };
    const start = Math.max(now, selected.nextTime);
    source.start(start); selected.nextTime = start + buffer.duration; selected.sources.push(source);
    return true;
  },
  async closeMedia({ attachmentId }) { await releaseMedia(attachmentId); return true; },
  async dispose() {
    clearInterval(calls.stateTimer);
    if (calls.getUserMedia) navigator.mediaDevices.getUserMedia = calls.getUserMedia;
    for (const node of calls.playbackNodes ?? []) { node.onaudioprocess = null; try { node.disconnect(); } catch {} }
    for (const restore of (calls.nativeRestores ?? []).reverse()) restore();
    calls.nativeRestores = []; calls.playbackNodes = []; calls.nativeAudioHooked = false; calls.captureDriver = null;
    calls.mediaHooked = false;
    calls.bindings = false; calls.generation = '';
    for (const id of [...calls.media.keys()]) await releaseMedia(id);
    return true;
  },
};
