import test from 'node:test';
import assert from 'node:assert/strict';
import { createConversation } from './conversation.mjs';
test('duplex bridge preserves PCM, reports signal and rejects repeated call requests',async()=>{
  const bridge=createConversation();const {id}=bridge.create();
  try {
    bridge.input(id,[0,100,-200,32767]);
    let attempts=0;
    const result=await bridge.action(id,'start',{async startCall(to,media){attempts++;assert.equal(to,'test@c.us');const reader=media.microphone.getReader();const packet=await reader.read();assert.deepEqual([...packet.value],[0,0,100,0,56,255,255,127]);reader.releaseLock();const writer=media.speaker.getWriter();await writer.write(Uint8Array.of(0,0,0,64));writer.releaseLock();return {ok:true,status:'requested'}}},{to:'test@c.us'});
    assert.equal(result.ok,true);const output=bridge.output(id,0);assert.equal(output.metrics.outputSamples,2);assert.equal(output.metrics.outputPeak,.5);assert.equal(output.metrics.inputSamples,4);assert.equal(output.frames.length,1);assert.equal(bridge.output(id,output.cursor).frames.length,0);
    await assert.rejects(bridge.action(id,'start',{startCall(){attempts++}},{to:'test@c.us'}),/già/);assert.equal(attempts,1);
  }finally{bridge.close()}
  assert.throws(()=>bridge.output(id,0),/scaduta/);
});
test('bounded microphone queue drops excess input and rejects invalid PCM',()=>{
  const bridge=createConversation();const{id}=bridge.create();try{bridge.input(id,[1]);bridge.input(id,[2]);const stats=bridge.input(id,[3,4]);assert.equal(stats.inputDroppedSamples,2);assert.throws(()=>bridge.input(id,[NaN]),/non valido/);assert.throws(()=>bridge.input(id,[32768]),/non valido/);assert.throws(()=>bridge.input('unrelated',[0]),/scaduta/);assert.throws(()=>bridge.create(),/già aperto/)}finally{bridge.close()}
});
test('bounded received queue never retains more than half a second',async()=>{
  const bridge=createConversation();const{id}=bridge.create();try{bridge.input(id,[0,0,0,0,0,0,0,0]);await bridge.action(id,'accept',{async acceptCall(call,media){assert.equal(call.id,'call');const writer=media.speaker.getWriter();for(let n=0;n<12;n++)await writer.write(new Uint8Array(2048));writer.releaseLock();return {ok:true,status:'requested'}}},{call:{id:'call'}});const result=bridge.output(id,0);assert.ok(result.metrics.outputDroppedSamples>0);assert.ok(result.frames.reduce((sum,frame)=>sum+Buffer.from(frame.pcm,'base64').length/2,0)<=8000)}finally{bridge.close()}
});
test('acknowledged playback frames are not reported as dropped audio',async()=>{
  const bridge=createConversation();const{id}=bridge.create();let output;
  try{await bridge.action(id,'start',{async startCall(_to,media){output=media.speaker;return {ok:true,status:'requested'}}},{to:'fixture@c.us'});const writer=output.getWriter();await writer.write(new Uint8Array(4));const first=bridge.output(id,0);bridge.output(id,first.cursor);await writer.write(new Uint8Array(16000));assert.equal(bridge.output(id,first.cursor).metrics.outputDroppedSamples,0,'already acknowledged audio must be removed before bounding the playback queue');writer.releaseLock()}finally{bridge.close()}
});
