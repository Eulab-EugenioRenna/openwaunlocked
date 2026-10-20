// Real SDK, CallingService, Node media host and browser bridge; only the native
// calling provider is simulated. No WhatsApp recipient is contacted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@open-wa/client';
import { CallingService } from '@open-wa/core';
import { makeNodeCallMediaHost, createVoiceCallAudio } from '@open-wa/runtime-node';
import { createConversation } from './conversation.mjs';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const pcm=(value,samples=320)=>{const bytes=new Uint8Array(samples*2),view=new DataView(bytes.buffer);for(let n=0;n<samples;n++)view.setInt16(n*2,value,true);return bytes};
async function eventually(predicate) { const deadline=Date.now()+1500;while(!predicate()){if(Date.now()>deadline)assert.fail('Timed out waiting for media');await sleep(10)} }
for (const initiallyEmpty of [false,true]) test(`outgoing PCM survives native startup (initial null snapshot: ${initiallyEmpty})`, async()=>{
  const bridge=createConversation(),{id}=bridge.create();let host;
  const generation='fixture',writes=[],states=[],warnings=[];
  const info={protocolVersion:1,artifactRevision:'fixture',control:true,audio:true,video:false};
  const base={id:'fixture-call',peer:'fixture@c.us',direction:'outgoing',state:'calling',video:false,terminal:false,observedAt:Date.now()};
  globalThis.__OPENWA_CALLS__={describe:()=>info,install:()=>info,prepareMedia:()=>({ready:true}),commitMedia:()=>({ready:true}),closeMedia(){},dispose(){},writeAudio:({frame})=>{writes.push(frame);return true},async command(input){if(input.action==='start')await host({type:'state',snapshot:initiallyEmpty?null:{...base}},generation);return {ok:true,status:'requested'}}};
  const page={isClosed:()=>false,url:()=> 'https://web.whatsapp.com/',exposeFunction:async(_name,fn)=>{host=fn},grantMediaPermissions:async()=>{},evaluate:async(fn,arg)=>fn(arg)};
  const service=new CallingService({sessionId:'fixture-session',logger:{info(){},warn:(...args)=>warnings.push(args)},mediaHost:makeNodeCallMediaHost(),page:()=>page,generation:()=>generation,emit:(_type,value)=>states.push(value)});
  // Invoke the actual SDK call binding without starting a WhatsApp transport.
  const client={startCall:(...args)=>Client.prototype.startCall.apply({_transport:{calling:service}},args)};
  let feeder;
  try {
    await service.install();
    bridge.input(id,new Array(2048).fill(1000));
    feeder=setInterval(()=>{try{bridge.input(id,new Array(2048).fill(1000))}catch{}},128);
    const result=await bridge.action(id,'start',client,{to:'fixture@c.us'});assert.equal(result.ok,true);
    assert.equal(bridge.output(id,0).closed,false,'empty startup snapshot must not cancel the application streams');
    await host({type:'state',snapshot:{...base}},generation);
    await host({type:'state',snapshot:{...base,state:'active'}},generation);
    await eventually(()=>writes.length>0&&states.some(state=>state.media?.state==='attached'));
    assert.ok(writes.some(frame=>frame.samples.some(n=>n!==0)),'microphone signal must reach the injected provider');
    const mediaId=service.attachment.id;
    await host({type:'audio',callId:base.id,attachmentId:mediaId,frame:{samples:new Array(960).fill(.2),sampleRate:48000,sequence:0,timestampMs:Date.now()}},generation);
    await eventually(()=>bridge.output(id,0).metrics.outputSamples>0);
    assert.ok(bridge.output(id,0).metrics.outputPeak>.1,'received signal must reach the browser bridge');
    const writesBefore=writes.length;
    await Client.prototype.clearCallAudio.call({_transport:{calling:service}}, {id:base.id,sessionId:'fixture-session',generation});
    await eventually(()=>writes.length>writesBefore);
    await host({type:'state',snapshot:null,terminal:{...base,state:'ended',terminal:true}},generation);
    assert.equal(bridge.output(id,0).closed,true,'real hangup must release the streams');
    assert.deepEqual(warnings,[]);
  }finally{clearInterval(feeder);await service.close();bridge.close();delete globalThis.__OPENWA_CALLS__}
});

test('incoming conversation supports accept, mute, observer, media replacement and end', async()=>{
  const bridge=createConversation(),{id}=bridge.create();let host,feeder,replacementController;
  const generation='incoming-fixture',writes=[],states=[],commands=[];let observedSamples=0,observerClosed=false,replacementClosed=false;
  const info={protocolVersion:1,artifactRevision:'fixture',control:true,audio:true,video:false};
  const base={id:'incoming-call',peer:'fixture@c.us',direction:'incoming',state:'ringing',video:false,terminal:false,observedAt:Date.now()};
  globalThis.__OPENWA_CALLS__={describe:()=>info,install:()=>info,prepareMedia:()=>({ready:true}),commitMedia:()=>({ready:true}),closeMedia(){},dispose(){},writeAudio:({frame})=>{writes.push(frame);return true},async command(input){commands.push(input.action);if(input.action==='accept')await host({type:'state',snapshot:{...base,state:'active'}},generation);if(input.action==='end')await host({type:'state',snapshot:null,terminal:{...base,state:'ended',terminal:true}},generation);return {ok:true,status:'requested'}}};
  const page={isClosed:()=>false,url:()=> 'https://web.whatsapp.com/',exposeFunction:async(_name,fn)=>{host=fn},grantMediaPermissions:async()=>{},evaluate:async(fn,arg)=>fn(arg)};
  const warnings=[];
  const service=new CallingService({sessionId:'fixture-session',logger:{info(){},warn:(...args)=>warnings.push(args)},mediaHost:makeNodeCallMediaHost(),page:()=>page,generation:()=>generation,emit:(type,value)=>states.push({type,value})});
  const facade={_transport:{calling:service}},call={id:base.id,sessionId:'fixture-session',generation};
  const client={acceptCall:(...args)=>Client.prototype.acceptCall.apply(facade,args)};
  const invoke=(method,...args)=>Client.prototype[method].apply(facade,args);
  try{
    await service.install();await host({type:'state',snapshot:{...base}},generation);
    assert.ok(states.some(event=>event.type==='incoming'));
    bridge.input(id,new Array(2048).fill(1000));feeder=setInterval(()=>{try{bridge.input(id,new Array(2048).fill(1000))}catch{}},128);
    assert.equal((await bridge.action(id,'accept',client,{call})).ok,true);
    await eventually(()=>writes.some(frame=>frame.samples.some(n=>n!==0)));
    const observer=await invoke('observeCallAudio',call,new WritableStream({write(bytes){observedSamples+=bytes.length/2},close(){observerClosed=true}}));
    assert.equal(observer.ok,true);
    const sendAudio=()=>host({type:'audio',callId:base.id,attachmentId:service.attachment.id,frame:{samples:new Array(1280).fill(.3),sampleRate:16000,sequence:0,timestampMs:Date.now()}},generation);
    await sendAudio();await eventually(()=>observedSamples>0&&bridge.output(id,0).metrics.outputSamples>0);
    await invoke('stopCallAudioObserver',call,observer.observerId);assert.equal(observerClosed,true);
    const beforeMute=writes.length;await invoke('muteCall',call,true);await eventually(()=>writes.length>beforeMute+2);assert.ok(writes.at(-1).samples.every(n=>n===0));
    const beforeUnmute=writes.length;await invoke('muteCall',call,false);await eventually(()=>writes.length>beforeUnmute&&writes.at(-1).samples.some(n=>n!==0));
    const beforeReplacement=writes.length;
    const bytes=new Uint8Array(4096),view=new DataView(bytes.buffer);for(let n=0;n<2048;n++)view.setInt16(n*2,2000,true);
    const microphone=new ReadableStream({start(controller){replacementController=controller;controller.enqueue(bytes)}});
    const speaker=new WritableStream({close(){replacementClosed=true}});
    assert.equal((await invoke('setCallMedia',call,{microphone,speaker})).ok,true);
    await eventually(()=>writes.length>beforeReplacement&&writes.at(-1).samples.some(n=>n>.05));
    assert.equal(bridge.output(id,0).closed,true,'old browser stream must be released after replacement');
    assert.equal((await invoke('endCall',call)).ok,true);assert.equal(replacementClosed,true);
    assert.equal(await invoke('getActiveCall'),null);
    assert.ok(commands.includes('accept')&&commands.includes('mute')&&commands.includes('end'));
    assert.deepEqual(warnings,[]);
  }finally{clearInterval(feeder);await service.close();bridge.close();delete globalThis.__OPENWA_CALLS__}
});

test('incoming rejection releases call state without allocating media',async()=>{
  let host,prepared=0;const generation='reject-fixture';
  const info={protocolVersion:1,artifactRevision:'fixture',control:true,audio:true,video:false};
  const base={id:'reject-call',peer:'fixture@c.us',direction:'incoming',state:'ringing',video:false,terminal:false,observedAt:Date.now()};
  globalThis.__OPENWA_CALLS__={describe:()=>info,install:()=>info,dispose(){},prepareMedia(){prepared++;return {ready:true}},async command(input){assert.equal(input.action,'reject');await host({type:'state',snapshot:null,terminal:{...base,state:'ended',terminal:true}},generation);return {ok:true,status:'requested'}}};
  const page={isClosed:()=>false,url:()=> 'https://web.whatsapp.com/',exposeFunction:async(_name,fn)=>{host=fn},grantMediaPermissions:async()=>{},evaluate:async(fn,arg)=>fn(arg)};
  const service=new CallingService({sessionId:'fixture-session',logger:{info(){},warn(){}},mediaHost:makeNodeCallMediaHost(),page:()=>page,generation:()=>generation,emit(){}});
  try{await service.install();await host({type:'state',snapshot:{...base}},generation);assert.equal((await Client.prototype.rejectCall.call({_transport:{calling:service}},{id:base.id,sessionId:'fixture-session',generation})).ok,true);assert.equal(prepared,0);assert.equal(await service.getActive(),null)}finally{await service.close();delete globalThis.__OPENWA_CALLS__}
});

test('external voice API accepts before TTS, receives while speaking, interrupts and closes on hangup',async()=>{
  let host;const generation='voice-fixture',writes=[],commands=[],warnings=[];
  const info={protocolVersion:1,artifactRevision:'fixture',control:true,audio:true,video:false};
  const base={id:'voice-call',peer:'fixture@c.us',direction:'incoming',state:'ringing',video:false,terminal:false,observedAt:Date.now()};
  globalThis.__OPENWA_CALLS__={describe:()=>info,install:()=>info,prepareMedia:()=>({ready:true}),commitMedia:()=>({ready:true}),closeMedia(){},dispose(){},writeAudio:({frame})=>{writes.push(frame);return true},async command(input){commands.push(input.action);if(input.action==='accept')await host({type:'state',snapshot:{...base,state:'active'}},generation);if(input.action==='end')await host({type:'state',snapshot:null,terminal:{...base,state:'ended',terminal:true}},generation);return {ok:true,status:'requested'}}};
  const page={isClosed:()=>false,url:()=> 'https://web.whatsapp.com/',exposeFunction:async(_name,fn)=>{host=fn},grantMediaPermissions:async()=>{},evaluate:async(fn,arg)=>fn(arg)};
  const service=new CallingService({sessionId:'fixture-session',logger:{info(){},warn:(...args)=>warnings.push(args)},mediaHost:makeNodeCallMediaHost(),page:()=>page,generation:()=>generation,emit(){}});
  const facade={_transport:{calling:service}},identity={id:base.id,sessionId:'fixture-session',generation};
  const invoke=(method,...args)=>Client.prototype[method].apply(facade,args);
  const audio=createVoiceCallAudio({responseSampleRate:24000}),incoming=audio.incoming.getReader();let cancelled=false;
  try{
    await service.install();await host({type:'state',snapshot:base},generation);
    assert.equal((await invoke('acceptCall',identity,audio.media)).ok,true,'silence prefix must permit listen-first acceptance');
    await eventually(()=>service.attachment?.started);
    const sendAudio=()=>host({type:'audio',callId:base.id,attachmentId:service.attachment.id,frame:{samples:new Array(320).fill(.25),sampleRate:16000,sequence:0}},generation);
    const first=incoming.read();await sendAudio();assert.ok((await first).value.some(n=>n!==0));
    const response=audio.speak(new ReadableStream({start(controller){controller.enqueue(pcm(4000,24000))},cancel(){cancelled=true}}));
    await eventually(()=>writes.some(frame=>frame.samples.some(n=>n>.1)));
    const during=incoming.read();await sendAudio();assert.equal((await during).done,false,'receive must continue during response');
    assert.equal((await audio.interrupt({clearAudio:()=>invoke('clearCallAudio',identity)})).ok,true);
    assert.equal((await response).status,'interrupted');assert.equal(cancelled,true);assert.ok(commands.includes('clear'));
    const after=incoming.read();await sendAudio();assert.equal((await after).done,false,'interrupt must keep receive open');
    const count=writes.length;await audio.write(pcm(-4000,480));
    await eventually(()=>writes.slice(count).some(frame=>frame.samples.some(n=>n<-.1)));
    assert.equal((await invoke('endCall',identity)).ok,true);assert.equal(audio.stats().closed,true);
    while(!(await incoming.read()).done){};
    assert.deepEqual(warnings,[]);
  }finally{audio.close();incoming.releaseLock();await service.close();delete globalThis.__OPENWA_CALLS__}
});

test('clear discards the rest of a large host chunk even when it arrives during write',async()=>{
  let host,controller,service,cleared=false;const generation='clear-chunk-fixture',writes=[];
  const info={protocolVersion:1,artifactRevision:'fixture',control:true,audio:true,video:false};
  const base={id:'clear-chunk-call',peer:'fixture@c.us',direction:'incoming',state:'ringing',video:false,terminal:false,observedAt:Date.now()};
  globalThis.__OPENWA_CALLS__={describe:()=>info,install:()=>info,prepareMedia:()=>({ready:true}),commitMedia:()=>({ready:true}),closeMedia(){},dispose(){},async writeAudio({frame}){writes.push(frame);if(!cleared&&frame.samples.some(n=>n>.1)){cleared=true;await service.attachment.media.clear()}return true},async command(input){if(input.action==='accept')await host({type:'state',snapshot:{...base,state:'active'}},generation);return {ok:true,status:'requested'}}};
  const page={isClosed:()=>false,url:()=> 'https://web.whatsapp.com/',exposeFunction:async(_name,fn)=>{host=fn},grantMediaPermissions:async()=>{},evaluate:async(fn,arg)=>fn(arg)};
  service=new CallingService({sessionId:'fixture-session',logger:{info(){},warn(){}},mediaHost:makeNodeCallMediaHost(),page:()=>page,generation:()=>generation,emit(){}});
  const microphone=new ReadableStream({start(c){controller=c;c.enqueue(pcm(4000,16000))}});
  try{
    await service.install();await host({type:'state',snapshot:base},generation);
    assert.equal((await Client.prototype.acceptCall.call({_transport:{calling:service}},{id:base.id,sessionId:'fixture-session',generation},{microphone,speaker:null})).ok,true);
    await eventually(()=>cleared);await sleep(80);
    assert.equal(writes.filter(frame=>frame.samples.some(n=>n>.1)).length,1,'remaining old frames must not refill the native queue');
    controller.enqueue(pcm(-4000,640));await eventually(()=>writes.some(frame=>frame.samples.some(n=>n<-.1)));
  }finally{await service.close();delete globalThis.__OPENWA_CALLS__}
});
