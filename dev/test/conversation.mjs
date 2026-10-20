// Local demo bridge: raw PCM16LE, 16 kHz mono, bounded queues in both directions.
// It deliberately stays outside the SDK and never answers a call automatically.
import { randomBytes } from 'node:crypto';
export function createConversation() {
  let current;
  const close = (reason = 'bridge-stopped') => {
    if (!current) return;
    try { current.controller.close(); } catch {}
    current.closed = true;
    current.closedReason ??= reason;
    clearTimeout(current.timer);
    current = undefined;
  };
  const touch = session => {
    clearTimeout(session.timer);
    session.timer = setTimeout(() => close('browser-disconnected'), 15000);
    session.timer.unref();
  };
  function session(id) {
    if (!current || current.id !== id) throw Error('Sessione audio assente o scaduta. Prepara nuovamente il microfono.');
    touch(current);
    return current;
  }
  return {
    close,
    create() {
      if (current) throw Error('Un ponte audio è già aperto. Arrestalo prima di crearne un altro.');
      const value = { id: randomBytes(24).toString('hex'), received: [], sequence: 0, actionUsed: false, closed: false, phase: 'prepared',
        metrics: { inputPackets: 0, inputSamples: 0, inputPeak: 0, inputDroppedSamples: 0, outputPackets: 0, outputSamples: 0, outputPeak: 0, outputDroppedSamples: 0 } };
      value.input = new ReadableStream({ start(controller) { value.controller = controller; }, cancel() { value.closed = true; value.closedReason ??= 'microphone-stream-closed-by-host'; } }, { highWaterMark: 2 });
      value.output = new WritableStream({ write(bytes) {
        const chunk = Buffer.from(bytes);
        if (!chunk.length) return;
        if (chunk.length % 2) throw Error('PCM ricevuto con campione incompleto.');
        value.metrics.outputPackets++; value.metrics.outputSamples += chunk.length/2;
        for(let n=0;n<chunk.length;n+=2)value.metrics.outputPeak=Math.max(value.metrics.outputPeak,Math.abs(chunk.readInt16LE(n))/32768);
        value.received.push({ sequence: ++value.sequence, pcm: chunk.toString('base64') });
        // Keep no more than 500 ms of audio, even if a peer sends large chunks.
        let buffered = value.received.reduce((sum, frame) => sum + Buffer.from(frame.pcm, 'base64').length/2, 0);
        while(buffered > 8000 && value.received.length){const discarded=value.received.shift();const samples=Buffer.from(discarded.pcm,'base64').length/2;buffered-=samples;value.metrics.outputDroppedSamples+=samples;}
      }, close(){value.closed=true;value.closedReason ??= 'received-stream-closed-by-host'}, abort(){value.closed=true;value.closedReason ??= 'received-stream-aborted-by-host'} });
      current=value;touch(value);
      return { id: value.id, format: { encoding:'pcm16le',sampleRate:16000,channels:1 } };
    },
    input(id, samples) {
      const value=session(id);
      if(value.closed)throw Error('Stream audio chiuso.');
      if(!Array.isArray(samples)||samples.length<1||samples.length>3200||!samples.every(n=>Number.isInteger(n)&&n>=-32768&&n<=32767))throw Error('Pacchetto PCM16 non valido.');
      value.metrics.inputPackets++;value.metrics.inputSamples+=samples.length;
      for(const n of samples)value.metrics.inputPeak=Math.max(value.metrics.inputPeak,Math.abs(n)/32768);
      if(value.controller.desiredSize<=0){value.metrics.inputDroppedSamples+=samples.length;return value.metrics}
      const bytes=Buffer.alloc(samples.length*2);samples.forEach((n,index)=>bytes.writeInt16LE(n,index*2));value.controller.enqueue(bytes);
      return value.metrics;
    },
    output(id, after) { const value=session(id);value.received=value.received.filter(frame=>frame.sequence>after);return { closed:value.closed, closedReason:value.closedReason, phase:value.phase, actionResult:value.actionResult, cursor:value.sequence, frames:value.received.filter(frame=>frame.sequence>after), metrics:value.metrics }; },
    async action(id, action, client, { to, call }) {
      const value=session(id);
      if(value.actionUsed)throw Error('Questo ponte ha già avviato una richiesta. Nessun retry: arrestalo e controlla lo stato della chiamata.');
      if(!['start','accept'].includes(action))throw Error('Azione audio non supportata.');
      value.actionUsed=true;
      value.phase = 'requesting';
      const media={microphone:value.input,speaker:value.output};
      try {
        value.actionResult = action==='start'?await client.startCall(to,media):await client.acceptCall(call,media);
        value.phase = value.actionResult?.ok ? 'requested' : 'rejected';
        return value.actionResult;
      } catch(error) {
        value.phase = 'unknown';
        value.actionResult = { ok:false, status:'unknown', reason:{message:error instanceof Error?error.message:String(error)} };
        throw error;
      }
    },
    stop(id) { session(id);close();return {ok:true,note:'Ponte chiuso. La chiusura del ponte non termina automaticamente la chiamata.'}; },
  };
}
