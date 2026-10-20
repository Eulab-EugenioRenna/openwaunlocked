// Isolated native driver fixture; never starts or answers a WhatsApp call.
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const requireApp = createRequire(import.meta.url);
const puppeteer = createRequire(requireApp.resolve('@open-wa/driver-puppeteer'))('puppeteer-core');
let browser, page;
for (const entry of fs.readdirSync('/tmp', { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const port = fs.readFileSync(`/tmp/${entry.name}/DevToolsActivePort`, 'utf8').split('\n')[0];
    const candidate = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, protocolTimeout: 10000 });
    const target = (await candidate.pages()).find(tab => tab.url().startsWith('https://web.whatsapp.com'));
    if (target) { browser = candidate; page = target; break; }
    candidate.disconnect();
  } catch {}
}
if (!page) throw new Error('No active development WhatsApp browser found.');
try {
  const callingSource=fs.readFileSync(path.join(process.env.DEV_PATCH_SOURCE_PATH ?? './patches', 'calling.js'),'utf8');
  const evaluateFixture = async source=>{
    const nativeRequire=window.require;
    if(nativeRequire('WAWebCallCollection').activeCall)throw Error('Termina la chiamata attiva prima della fixture isolata.');
    const before=await nativeRequire('WAWebVoipSilentCapture').findMicrophone();
    const testWindow={AudioContext:window.AudioContext,AudioNode:window.AudioNode,MediaStreamAudioDestinationNode:window.MediaStreamAudioDestinationNode};
    const received=[];
    testWindow.__openwaCallsHost=event=>received.push(event);
    const testCall={id:'audio-fixture',peerJid:{toString:()=> 'fixture@c.us'},outgoing:true,getState:()=>6};
    const dev={module:name=>name==='WAWebCallCollection'?{activeCall:testCall}:name==='WAWebVoipGatingUtils'?{isVoipDownloadEnabled:()=>true}:nativeRequire(name),serial:String};
    const provider=new Function('window','dev',source+';return window.__OPENWA_CALLS__;')(testWindow,dev);
    let capture,playback,oscillator;
    provider.install({generation:'native-audio-fixture'});
    try {
      const prepared=await provider.prepareMedia({attachmentId:'fixture',microphone:'injected',speaker:'captured'});
      if(!prepared.ready)throw Error(prepared.message);
      await provider.commitMedia({attachmentId:'fixture'});
      const selected=await nativeRequire('WAWebVoipSilentCapture').findMicrophone();
      const acquired=await nativeRequire('WAWebVoipAcquireMediaStream').acquireVoipMediaStream({type:'microphone'});
      capture=new (nativeRequire('WAWebVoipAudioCaptureBase').WAWebVoipAudioCaptureBase)();
      await capture.initCaptureDriver({bits_per_sample:16,channels:1,frames_per_chunk:320,sample_rate:16000,device_type:0});
      playback=new (nativeRequire('WAWebVoipAudioPlaybackBase').WAWebVoipAudioPlaybackBase)();
      await playback.initPlaybackDriver({bits_per_sample:16,channels:1,frames_per_chunk:320,sample_rate:16000});
      await playback.playbackAudioContext.resume();
      await capture.audioContext.resume();
      const analyzer=capture.audioContext.createAnalyser();analyzer.fftSize=2048;
      const silent=capture.audioContext.createGain();silent.gain.value=0;
      capture.mediaStreamSource.connect(analyzer);analyzer.connect(silent);silent.connect(capture.audioContext.destination);
      for(let packet=0;packet<6;packet++)await provider.writeAudio({attachmentId:'fixture',frame:{samples:Array.from({length:3840},(_,n)=>.4*Math.sin(2*Math.PI*440*(packet*3840+n)/48000)),sampleRate:48000}});
      oscillator=playback.playbackAudioContext.createOscillator();oscillator.frequency.value=440;
      oscillator.connect(playback.playbackAudioContext.destination);oscillator.start();
      await new Promise(resolve=>setTimeout(resolve,300));
      const captured=new Float32Array(2048);analyzer.getFloatTimeDomainData(captured);
      const frames=received.filter(e=>e.type==='audio');
      return {availabilityGateStubbed:true,physicalDeviceMissing:before.missingReason,virtualSelected:!!selected.selectedDeviceId,acquiredTracks:acquired.getAudioTracks().length,nativeCaptureState:String(capture.audioCaptureInitState),nativeCaptureHasSource:!!capture.mediaStreamSource,nativeCaptureSignal:captured.some(n=>Math.abs(n)>.01),playbackFrames:frames.length,hostAdmissible:frames.every(e=>e.frame.samples.length<=3840&&e.frame.samples.length<=e.frame.sampleRate*.12),playbackSignal:frames.some(e=>e.frame.samples.some(n=>Math.abs(n)>.01)),diagnostics:provider.diagnostics()};
    } finally {
      try{oscillator?.stop()}catch{}
      await capture?.cleanup();await playback?.cleanup();await provider.dispose();
    }
  };
  const expression='('+evaluateFixture.toString().replace("new Function('window','dev',source+';return window.__OPENWA_CALLS__;')(testWindow,dev)", '(()=>{const window=testWindow;'+callingSource+';return window.__OPENWA_CALLS__;})()')+')()';
  const result = await page.evaluate(expression);
  assert.equal(result.nativeCaptureState, 'Ready');
  assert.equal(result.nativeCaptureSignal, true);
  assert.equal(result.playbackSignal, true);
  assert.equal(result.hostAdmissible, true);
  assert.ok(result.playbackFrames > 0);
  console.log(JSON.stringify(result));

} catch(error) { console.error(error.stack); process.exitCode=1; } finally { browser.disconnect(); await new Promise(resolve=>process.stdout.write('',resolve)); process.exit(process.exitCode ?? 0); }
