import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto, createHash } from 'node:crypto';
import { File } from 'node:buffer';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildDevelopmentPatch, root } from './build.mjs';

const { bundle, revision } = await buildDevelopmentPatch();
const toJson = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setImmediate(resolve));
function runtime() {
  const sent = [], events = new Map(), modules = {}, messages = [];
  const wid = value => ({ _serialized: value, toString: () => value, isLid: () => value.endsWith('@lid'),
    isGroup: () => value.endsWith('@g.us'), isUser: () => /@(c\.us|lid)$/.test(value) });
  const chat = { id: wid('123@c.us') };
  const collection = items => ({ getModelsArray: () => items, get: id => items.find(item => String(item.id) === String(id)),
    on(event, fn) {
      if (!events.has(event)) {
        const listeners = new Set();
        const emit = (...args) => { for (const callback of [...listeners]) callback(...args); };
        emit.listeners = listeners; events.set(event, emit);
      }
      events.get(event).listeners.add(fn);
    },
    off(event, fn) {
      const emit = events.get(event);
      emit?.listeners.delete(fn);
      if (emit?.listeners.size === 0) events.delete(event);
    } });
  const encoder = { generateProtobuf: input => ({ conversation: input.json.body }) };
  const native = {
    getEphemeralFields: () => ({}),
    addAndSendMsgToChat: (_chat, message) => {
      sent.push({ message, proto: encoder.generateProtobuf({ json: message }) });
      messages.push(message);
      return [Promise.resolve(message), Promise.resolve({ messageSendResult: 'OK' })];
    },
    revokeStatus: async () => undefined,
  };
  let nextKey = 0;
  class MsgKey {
    static async newId() { return `DEV${++nextKey}`; }
    constructor(input) {
      assert.equal(input.selfDir, 'out');
      assert.ok(input.from); assert.ok(input.to);
      Object.assign(this, input, { fromMe: true, remote: input.to });
      this._serialized = `true_${input.to}_${input.id}`;
    }
    toString() { return this._serialized; }
  }
  modules.WAWebWidFactory = { createWid: wid };
  modules.WAWebMsgKey = MsgKey;
  modules.WAWebVoipGatingUtils = { isVoipDownloadEnabled: () => true };
  modules.WAWebInteractiveMessageType = { NATIVE_FLOW: 'native_flow', CAROUSEL: 'carousel' };
  modules.WAWebInteractiveMessageHeaderMediaType = { InteractiveMessageHeaderMediaType: { IMAGE: 'image', VIDEO: 'video', DOCUMENT: 'document' } };
  modules.WAWebUserPrefsMeUser = { getMaybeMePnUser: () => wid('456@c.us'), getMaybeMeLidUser: () => wid('789@lid') };
  modules.WAWebFindChatAction = { findOrCreateLatestChat: async id => ({ chat: { id } }) };
  modules.WAWebChatModel = { Chat: class { constructor(input) { Object.assign(this, input); } } };
  modules.WAWebMessagePluginGenerateProtobuf = encoder;
  modules.WAWebParseInteractiveMessageProto = ({ messageProtobuf }) => {
    const msg = messageProtobuf.interactiveMessage;
    const payload = msg.nativeFlowMessage ?? msg.carouselMessage;
    if (payload?.messageVersion !== 1 || msg.carouselMessage?.cards.some(card => card.nativeFlowMessage?.messageVersion !== 1)) return { msgData: { type: 'unknown' } };
    return { msgData: { type: 'interactive', kind: 'interactive', caption: msg.body?.text ?? '',
      interactiveType: msg.nativeFlowMessage ? 'native_flow' : 'carousel', interactivePayload: payload,
      nativeFlowName: msg.nativeFlowMessage?.buttons[0]?.name, interactiveHeader: msg.header, footer: msg.footer?.text } };
  };
  modules.WAWebParseListMessageProto = ({ messageProtobuf }) => ({ msgData: { type: messageProtobuf.listMessage.listType === 1 ? 'list' : 'unknown', kind: 'list', list: messageProtobuf.listMessage } });
  modules.WAWebActions = { revokeStatus: native.revokeStatus };
  modules.WAWebGetEphemeralFieldsMsgActionsUtils = native;
  modules.WAWebSendMsgChatAction = native;
  const api = { _serializeMessageObj: message => ({ ...message, id: String(message.id) }), _serializeContactObj: contact => contact };
  const store = { Chat: { get: () => chat }, Contact: { find: async id => ({ id: String(id), name: 'Contact' }) },
    Msg: collection(messages), Call: { activeCall: null, on() {} }, MyStatus: { getStatus: async () => 'Available' } };
  modules.WAWebCallCollection = store.Call;
  modules.WAWebCollections = { Status: collection([]) };
  const debug = { modulesMap: Object.fromEntries(Object.entries(modules).map(([id, exports]) => [id, { exports: id === 'WAWebGetEphemeralFieldsMsgActionsUtils' || id === 'WAWebSendMsgChatAction' ? null : exports }])) };
  const window = { WAPI: api, Store: store, require: name => {
    if (name === '__debug') return debug;
    if (!(name in modules)) throw new Error(`Unavailable module ${name}`);
    return modules[name];
  } };
  const context = { setInterval, clearInterval, window, navigator: {}, crypto: webcrypto, console, URL, Uint8Array, Float32Array, File, atob, fetch: async () => { throw new Error('Unexpected network access'); } };
  vm.runInNewContext(bundle, context);
  return { api, store, modules, window, sent, events, messages, native, debug, context, wid };
}

test('build is deterministic and never changes immutable wapi.js', async () => {
  assert.equal((await buildDevelopmentPatch()).revision, revision);
  const asset = await readFile(resolve(root, 'packages/core/src/transport/assets/wapi.js'));
  const expected = (await readFile(resolve(root, 'dev/patches/immutable-wapi.sha256'), 'utf8')).trim();
  assert.equal(createHash('sha256').update(asset).digest('hex'), expected);
});
test('all 19 formerly premium WAPI methods are installed as local functions', () => {
  const { api, window } = runtime();
  for (const name of ['checkNumberStatus', 'getNumberProfile', 'getOrder', 'postTextStatus', 'postImageStatus', 'postVideoStatus',
    'getStories', 'getStatus', 'deleteStatus', 'deleteAllStatus', 'sendInteractive', 'sendRawMessage', 'sendButtons',
    'sendAdvancedButtons', 'sendListMessage', 'getStarredMessages', 'setProfilePic', 'createGroup', 'joinGroupViaLink']) {
    assert.equal(typeof api[name], 'function', name);
  }
  assert.equal(window.__OPENWA_DEV_PATCH__.licenseRequired, false);
});
test('all method and listener registry definitions are free in this branch', async () => {
  for (const directory of ['packages/schema/src/methods', 'packages/schema/src/events']) {
    for (const file of await readdir(resolve(root, directory))) {
      if (!file.endsWith('.ts')) continue;
      assert.doesNotMatch(await readFile(resolve(root, directory, file), 'utf8'), /license:\s*'(insiders|restricted)'/, file);
    }
  }
});
test('quick replies send exactly one message with stable IDs and no license fetch', async () => {
  const { api, sent } = runtime();
  const id = await api.sendInteractive('123@c.us', { type: 'buttons', body: 'Choose', actions: [{ type: 'reply', id: 'yes', label: 'Yes' }] });
  assert.equal(sent.length, 1);
  assert.equal(id, String(sent[0].message.id));
  assert.equal(sent[0].message.type, 'interactive');
  assert.equal(sent[0].message.kind, 'interactive');
  assert.equal(sent[0].message.nativeFlowName, 'quick_reply');
  assert.equal(sent[0].message.nativeFlowInteractiveMsg, true);
  assert.equal(sent[0].proto.interactiveMessage.nativeFlowMessage.messageVersion, 1);
  assert.equal(sent[0].message.caption, 'Choose');
  assert.equal(sent[0].message.interactiveType, 'native_flow');
  assert.deepEqual(toJson(sent[0].message.interactivePayload), toJson(sent[0].proto.interactiveMessage.nativeFlowMessage));
  const button = sent[0].proto.interactiveMessage.nativeFlowMessage.buttons[0];
  assert.equal(button.name, 'quick_reply');
  assert.deepEqual(JSON.parse(button.buttonParamsJson), { display_text: 'Yes', id: 'yes' });
});
test('group messages use the group addressing mode and include the sender participant', async () => {
  const { api, store, sent, wid } = runtime();
  for (const lid of [false, true]) {
    store.Chat.get = () => ({ id: wid('group@g.us'), groupMetadata: { isLidAddressingMode: lid } });
    await api.sendInteractive('group@g.us', { type: 'buttons', body: 'Choose', actions: [{ type: 'reply', id: 'yes', label: 'Yes' }] });
    const message = sent.at(-1).message;
    assert.equal(String(message.from), lid ? '789@lid' : '456@c.us');
    assert.equal(String(message.id.participant), String(message.from));
    assert.equal(String(message.id.to), 'group@g.us');
  }
});
test('native actions encode URL, phone and copy fields', async () => {
  const { api, sent } = runtime();
  for (const item of [{ type: 'url', label: 'Site', url: 'https://example.org' },
    { type: 'call', label: 'Call', phoneNumber: '+390000000' }, { type: 'copy', label: 'Copy', code: 'ABC' }]) {
    await api.sendInteractive('123@c.us', { type: 'buttons', body: 'Actions', actions: [item] });
  }
  assert.deepEqual(sent.map(item => item.proto.interactiveMessage.nativeFlowMessage.buttons[0].name), ['cta_url', 'cta_call', 'cta_copy']);
});
test('list compilation preserves all section and row IDs', async () => {
  const { api, sent } = runtime();
  await api.sendListMessage('123@c.us', [{ title: 'Options', rows: [{ rowId: 'a', title: 'A' }] }], 'Title', 'Choose', 'Open');
  const params = sent[0].proto.listMessage;
  assert.equal(sent[0].message.type, 'list');
  assert.equal(params.listType, 1);
  assert.equal(params.sections[0].rows[0].rowId, 'a');
  assert.equal(params.buttonText, 'Open');
});
test('raw protocol payloads retain context and decode byte fields', async () => {
  const { api, sent } = runtime();
  await api.sendRawMessage('123@c.us', { imageMessage: { mediaKey: 'AQID', contextInfo: { stanzaId: 'quoted' } } });
  assert.deepEqual([...sent[0].proto.imageMessage.mediaKey], [1, 2, 3]);
  assert.equal(sent[0].proto.imageMessage.contextInfo.stanzaId, 'quoted');
});
test('invalid wrappers and missing runtime functions fail without an outgoing send', async () => {
  const { api, sent, modules } = runtime();
  await assert.rejects(api.sendRawMessage('123@c.us', { viewOnceMessage: {} }), /Wrapped/);
  delete modules.WAWebMessagePluginGenerateProtobuf;
  await assert.rejects(api.sendRawMessage('123@c.us', { conversation: 'Test' }), /WAWebMessagePluginGenerateProtobuf/);
  assert.equal(sent.length, 0);
});
test('an uncertain send is never retried', async () => {
  const { api, native } = runtime(); let attempts = 0;
  native.addAndSendMsgToChat = () => { attempts++; throw new Error('Uncertain outcome'); };
  await assert.rejects(api.sendRawMessage('123@c.us', { conversation: 'Test' }), /Uncertain outcome/);
  assert.equal(attempts, 1);
});
test('resolved native send failures are rejected without an automatic second send', async () => {
  const { api, native } = runtime(); let attempts = 0;
  native.addAndSendMsgToChat = (_chat, message) => {
    attempts++;
    return [Promise.resolve(message), Promise.resolve({ messageSendResult: 'ERROR_UNKNOWN' })];
  };
  await assert.rejects(api.sendRawMessage('123@c.us', { conversation: 'Test' }), /ERROR_UNKNOWN/);
  assert.equal(attempts, 1);
});
test('reinjecting after a raw send restores the native encoder before installing a new one', async () => {
  const { api, modules, context } = runtime();
  const original = modules.WAWebMessagePluginGenerateProtobuf.generateProtobuf;
  await api.sendRawMessage('123@c.us', { conversation: 'First' });
  assert.notEqual(modules.WAWebMessagePluginGenerateProtobuf.generateProtobuf, original);
  await vm.runInNewContext(bundle, context);
  assert.equal(modules.WAWebMessagePluginGenerateProtobuf.generateProtobuf, original);
  await api.sendRawMessage('123@c.us', { conversation: 'Second' });
  assert.notEqual(modules.WAWebMessagePluginGenerateProtobuf.generateProtobuf, original);
});
test('text statuses use the dedicated native sender and confirm its result', async () => {
  const { api, sent, modules } = runtime(); let input, count=0;
  modules.WAWebSendStatusMsgAction = { sendStatusTextMsgAction: async params => { input=params; count++;return { messageSendResult: 'OK', msg: { id: 'true_status@broadcast_TEST' } }; } };
  assert.equal(await api.postTextStatus('Status', '#FFFFFF', '#3051D3', 3), 'true_status@broadcast_TEST');
  assert.deepEqual(toJson(input), { text: 'Status', color: 0xFF3051D3, font: 3 });
  assert.equal(sent.length, 0, 'statuses must not use the normal chat sender');
  modules.WAWebSendStatusMsgAction.sendStatusTextMsgAction = async () => { count++;return { messageSendResult: 'ERROR_UNKNOWN' }; };
  await assert.rejects(api.postTextStatus('Status'), /do not retry/);
  assert.equal(count, 2);
});
test('starred reads filter by chat, and status deletion protects other accounts', async () => {
  const { api, messages, wid } = runtime();
  messages.push({ id: { fromMe: false, remote: wid('status@broadcast'), toString: () => 'other' }, star: true });
  assert.equal((await api.getStarredMessages()).length, 1);
  assert.equal((await api.getStarredMessages('123@c.us')).length, 0);
  await assert.rejects(api.deleteStatus('other'), /owned/);
});
test('native and malformed responses retain IDs and expose parse errors', async () => {
  const { api, events, wid } = runtime(); const responses = [];
  api.onInteractiveResponse(response => responses.push(response));
  events.get('add')({ id: { remote: wid('123@c.us'), toString: () => 'response' }, from: wid('123@c.us'), t: 1,
    nativeFlowResponseMessage: { name: 'quick_reply', paramsJson: '{"id":"yes"}' } });
  events.get('add')({ id: { remote: wid('123@c.us'), toString: () => 'broken' }, from: wid('123@c.us'),
    nativeFlowResponseMessage: { name: 'unknown', paramsJson: '{broken' } });
  await flush();
  assert.equal(responses[0].id, 'yes');
  assert.equal(responses[1].type, 'native');
  assert.ok(responses[1].parseError);
});
test('native calling provider is present and does not advertise absent native capabilities', () => {
  const { window } = runtime();
  const provider = window.__OPENWA_CALLS__;
  for (const method of ['describe', 'install', 'get', 'command', 'prepareMedia', 'commitMedia', 'writeAudio', 'closeMedia']) assert.equal(typeof provider[method], 'function');
  assert.deepEqual(toJson(provider.describe()), { protocolVersion: 1, artifactRevision: 'local-dev-v1', expiresAt: Number.MAX_SAFE_INTEGER,
    control: false, audio: false, video: false });
});

test('forms collect native list answers and emit only the aggregate response', async () => {
  const { api, sent, events, wid } = runtime(); const responses = [];
  api.onInteractiveResponse(response => responses.push(response));
  const firstId = await api.sendInteractive('123@c.us', { type: 'form', title: 'Preferences', body: 'Choose', questions: [
    { id: '__proto__', type: 'singleSelect', label: 'First', options: [{ id: 'one', label: 'One' }] },
    { id: 'multiple', type: 'multiSelect', label: 'Second', options: [{ id: 'two', label: 'Two' }] },
  ] });
  const rows = () => sent.at(-1).proto.listMessage.sections[0].rows.map(row => ({ ...row, id: row.rowId }));
  const reply = async (id, responseId) => {
    events.get('add')({ id: { remote: wid('123@c.us'), toString: () => responseId }, from: wid('123@c.us'),
      listResponse: { singleSelectReply: { selectedRowId: id } } });
    await flush();
  };
  await assert.rejects(api.sendInteractive('123@c.us', { type: 'form', questions: [{}] }), /already has/);
  await reply(rows()[0].id, 'r1');
  const optionId = rows()[0].id;
  await reply(optionId, 'r2');
  const count = sent.length;
  await reply(optionId, 'r2');
  assert.equal(sent.length, count, 'duplicate response must not toggle or send again');
  await reply(rows().find(row => row.id.endsWith(':submit')).id, 'r3');
  assert.equal(responses.length, 1);
  assert.equal(responses[0].type, 'form');
  assert.equal(responses[0].originalMessageId, firstId);
  assert.deepEqual(toJson(responses[0].answers), JSON.parse('{"__proto__":"one","multiple":["two"]}'));
});
test('form custom answers remain owned by the first respondent and release the chat on completion', async () => {
  const { api, sent, events, wid } = runtime(); const responses = [];
  api.onInteractiveResponse(response => responses.push(response));
  api.sendMessage = async () => 'true_123@c.us_PROMPT';
  const content = { type: 'form', body: 'Tell us', questions: [
    { id: 'answer', type: 'singleSelect', label: 'Other?', allowCustomAnswer: true, options: [{ id: 'one', label: 'One' }] },
  ] };
  await api.sendInteractive('123@c.us', content);
  const rows = sent[0].proto.listMessage.sections[0].rows.map(row => ({ ...row, id: row.rowId }));
  const message = (id, author, fields) => ({ id: { remote: wid('123@c.us'), toString: () => id }, from: wid(author), ...fields });
  events.get('add')(message('custom', '123@c.us', { selectedButtonId: rows.find(row => row.id.endsWith(':custom')).id }));
  await flush();
  events.get('add')(message('intruder', '999@c.us', { type: 'chat', body: 'Wrong person' }));
  await flush();
  assert.equal(responses.length, 0);
  events.get('add')(message('answer', '123@c.us', { type: 'chat', body: 'My custom answer' }));
  await flush();
  assert.equal(responses.length, 1);
  assert.deepEqual(toJson(responses[0].answers), { answer: 'My custom answer' });
  await api.sendInteractive('123@c.us', content);
});
test('bookings delegate to native events and reject uncertain send results without retry', async () => {
  const { api } = runtime(); const calls = [];
  api.sendEvent = async (...args) => { calls.push(args); return 'true_123@c.us_EVENT'; };
  const booking = { type: 'booking', title: 'Appointment', body: 'Details', booking: {
    startAt: '2026-10-20T12:00:00Z', endAt: '2026-10-20T13:00:00Z', location: 'Office', managementUrl: 'https://example.org/manage' } };
  assert.equal(await api.sendInteractive('123@c.us', booking), 'true_123@c.us_EVENT');
  assert.equal(calls[0][1].startTime, 1792497600);
  assert.equal(calls[0][1].location, 'Office');
  assert.match(calls[0][1].description, /https:\/\/example.org\/manage/);
  api.sendEvent = async () => { calls.push([]); return false; };
  await assert.rejects(api.sendInteractive('123@c.us', booking), /uncertain/);
  assert.equal(calls.length, 2);
});
test('native call commands preserve the active call identity and do not need a license', async () => {
  const { window, modules, store, wid } = runtime();
  const commands = [];
  modules.WAWebVoipStackInterface = { getVoipStackInterface: async () => ({
    acceptCall: async (...args) => commands.push(['accept', ...args]),
    endCall: async (...args) => commands.push(['end', ...args]),
    rejectCall: async () => commands.push(['reject']),
  }) };
  modules.WAWebVoipStartCall = { startWAWebVoipCall: async (...args) => {
    commands.push(['start', ...args]);
    store.Call.activeCall = { id: 'call-1', peerJid: wid('123@c.us'), outgoing: true, isVideo: false, getState: () => 6 };
  } };
  const provider = window.__OPENWA_CALLS__;
  provider.install({ generation: 'test-document' });
  try {
    assert.equal(provider.describe().control, true);
    assert.equal((await provider.command({ action: 'start', to: '123@c.us' })).callId, 'call-1');
    assert.equal(provider.get().direction, 'outgoing');
    assert.equal(provider.get().state, 'active');
    await assert.rejects(provider.command({ action: 'end', id: 'old-call' }), /no longer active/);
    await provider.command({ action: 'end', id: 'call-1' });
    assert.deepEqual(toJson(commands[1]), ['end', 2, true]);
  } finally { await provider.dispose(); }
});
test('failed live media replacement keeps ownership and resources of the working source', async () => {
  const { window, context, modules, store, wid } = runtime();
  const tracks = [], contexts = [];
  class MediaStream {
    constructor(items = []) { this.items = items; }
    addTrack(track) { this.items.push(track); }
    getTracks() { return this.items; }
    getAudioTracks() { return this.items.filter(track => track.kind === 'audio'); }
    getVideoTracks() { return []; }
  }
  class AudioContext {
    constructor() { this.currentTime = 0; this.closed = false; contexts.push(this); }
    async resume() {}
    async close() { this.closed = true; }
    createMediaStreamDestination() {
      const track = { kind: 'audio', enabled: true, stopped: false, clone() { return { ...this }; }, stop() { this.stopped = true; } };
      tracks.push(track);
      return { stream: new MediaStream([track]) };
    }
  }
  context.MediaStream = MediaStream;
  context.AudioContext = window.AudioContext = AudioContext;
  context.navigator.mediaDevices = { getUserMedia: async () => new MediaStream() };
  modules.WAWebVoipStartCall = { startWAWebVoipCall() {} };
  modules.WAWebVoipStackInterface = { getVoipStackInterface: async () => ({}) };
  class Capture { async initCaptureDriver() {} async switchDevice() { throw new Error('switch rejected'); } }
  modules.WAWebVoipSilentCapture = { findMicrophone: async () => ({ selectedDeviceId: 'default' }) };
  modules.WAWebVoipAcquireMediaStream = { acquireVoipMediaStream: async () => new MediaStream() };
  modules.WAWebVoipAudioCaptureBase = { WAWebVoipAudioCaptureBase: Capture };
  modules.WAWebVoipAudioPlaybackBase = { WAWebVoipAudioPlaybackBase: class { async initPlaybackDriver() {} } };
  window.AudioNode = class { connect() {} };
  const provider = window.__OPENWA_CALLS__;
  provider.install({ generation: 'media-document' });
  try {
    assert.equal((await provider.prepareMedia({ attachmentId: 'working', microphone: 'injected' })).ready, true);
    assert.equal((await provider.commitMedia({ attachmentId: 'working' })).ready, true);
    assert.equal((await provider.prepareMedia({ attachmentId: 'working', microphone: 'injected' })).ready, false);
    assert.equal(tracks.length, 1, 'duplicate preparation must not allocate or replace resources');
    await new Capture().initCaptureDriver();
    store.Call.activeCall = { id: 'call-1', peerJid: wid('123@c.us'), getState: () => 6 };
    assert.equal((await provider.prepareMedia({ attachmentId: 'replacement', microphone: 'injected' })).ready, true);
    const result = await provider.commitMedia({ attachmentId: 'replacement' });
    assert.equal(result.ready, false);
    assert.match(result.message, /switch rejected/);
    await provider.closeMedia({ attachmentId: 'replacement' });
    await provider.command({ action: 'mute', id: 'call-1', value: true });
    assert.equal(tracks[0].enabled, false, 'the working source must remain owned after a failed switch');
    assert.equal(tracks[0].stopped, false);
    assert.equal(tracks[1].stopped, true);
  } finally { await provider.dispose(); }
  assert.ok(tracks.every(track => track.stopped));
  assert.ok(contexts.every(context => context.closed));
});
test('reinstalling the generated patch cleans up prior document listeners', async () => {
  const { api, context, events, wid } = runtime();
  let oldCalls = 0, newCalls = 0;
  api.onInteractiveResponse(() => oldCalls++);
  assert.equal(events.has('add'), true);
  await vm.runInNewContext(bundle, context);
  assert.equal(events.get('add').listeners.size, 1, 'one internal form listener remains');
  api.onInteractiveResponse(() => newCalls++);
  events.get('add')({ id: { remote: wid('123@c.us'), toString: () => 'reply' }, selectedButtonId: 'yes' });
  await flush();
  assert.equal(oldCalls, 0);
  assert.equal(newCalls, 1);
});

test('raw interactive messages rejected by the native parser never reach the sender', async () => {
  const { api, sent } = runtime();
  const flow = { buttons: [{ name: 'quick_reply', buttonParamsJson: '{"id":"yes","display_text":"Yes"}' }] };
  await assert.rejects(api.sendRawMessage('123@c.us', { interactiveMessage: { body: { text: 'Choose' }, nativeFlowMessage: flow } }), /messageVersion/);
  assert.equal(sent.length, 0);
});
test('native parser supplies the local interactive model rather than reconstructing a partial model', async () => {
  const { api, sent, modules } = runtime();
  modules.WAWebParseInteractiveMessageProto = () => ({ msgData: { type: 'interactive', kind: 'interactive',
    caption: 'Prepared', nativeFlowName: 'mixed', carouselCardsParsed: [{ prepared: true }], filehash: 'native-media-hash' } });
  await api.sendInteractive('123@c.us', { type: 'buttons', body: 'Choose', actions: [{ type: 'reply', id: 'yes', label: 'Yes' }] });
  assert.equal(sent[0].message.caption, 'Prepared');
  assert.equal(sent[0].message.filehash, 'native-media-hash');
  assert.equal(sent[0].message.nativeFlowName, 'mixed');
  assert.deepEqual(toJson(sent[0].message.carouselCardsParsed), [{ prepared: true }]);
});

test('contact status passes the current bridge parameter object with the chat token', async () => {
  const { api, modules, store } = runtime();
  let input;
  store.Chat.get = () => ({ tcToken: 'dev-token' });
  modules.WAWebContactStatusBridge = { getStatus: async params => { input=params; return { status: 'Available' }; } };
  assert.deepEqual(toJson(await api.getStatus('123@c.us')), { id: '123@c.us', status: 'Available' });
  assert.equal(String(input.wid), '123@c.us'); assert.equal(input.tcToken, 'dev-token');
});
test('group APIs load native jobs and use the confirmed gid field for joins', async () => {
  const { api, modules, wid } = runtime(); let loaded=0, joined=0;
  modules.WAWebNewGroupFlowLoadable = { requireBundle: async () => {
    loaded++;
    modules.WAWebGroupCreateJob = { createGroup: async () => ({ wid: wid('created@g.us'), participants: [] }) };
    modules.WAWebGroupInviteJob = { joinGroupViaInvite: async () => { joined++;return { gid: wid('joined@g.us') }; } };
  } };
  assert.equal((await api.createGroup('Test', ['123@c.us'])).gid, 'created@g.us');
  assert.equal(await api.joinGroupViaLink('https://chat.whatsapp.com/TestCode'), 'joined@g.us');
  assert.equal(loaded, 2); assert.equal(joined, 1);
  await assert.rejects(api.joinGroupViaLink('https://example.org/TestCode'), /invite/);
  assert.equal(joined, 1);
});

function mockMedia(modules) {
  let released=0,uploads=0;
  class Opaque {
    static async createFromData(value) { return value instanceof Opaque ? value : new Opaque(); }
    url() { return 'blob:fixture'; }
    autorelease() { released++; }
  }
  const data={filehash:'hash',type:'image',mimetype:'image/png',size:32,fullWidth:64,fullHeight:64,mediaBlob:new Blob(['fixture']),
    toJSON(){return {...this};},set(fields){Object.assign(this,fields);}};
  modules.WAWebMediaOpaqueData=Opaque;
  modules.WAWebPrepRawMedia={prepRawMedia:()=>({waitForPrep:async()=>data})};
  modules.WAWebMediaStorage={getOrCreateMediaObject:()=>({size:32,filehash:'hash',consolidate: fields=>assert.ok(fields.mediaBlob instanceof Opaque)})};
  modules.WAWebMmsMediaTypes={msgToMediaType:()=> 'image'};
  modules.WAWebMediaMmsV4Upload={uploadMedia:async()=>{uploads++;return {mediaEntry:{mmsUrl:'https://example.invalid/fixture',directPath:'/fixture',mediaKey:'AQID',encFilehash:'AQID'}};}};
  return {data,get released(){return released;},get uploads(){return uploads;}};
}
test('media converts a plain blob to OpaqueData before consolidation and preserves upload metadata', async () => {
  const { api, modules, sent }=runtime();const media=mockMedia(modules);
  await api.sendInteractive('123@c.us',{type:'buttons',body:'Image',header:{type:'image',source:'data:image/png;base64,AQID'},actions:[{type:'reply',id:'yes',label:'Yes'}]});
  assert.equal(media.uploads,1);assert.equal(media.released,1);
  assert.equal(media.data.directPath,'/fixture');
  assert.equal(sent[0].proto.interactiveMessage.header.imageMessage.directPath,'/fixture');
  assert.equal(sent[0].proto.interactiveMessage.header.imageMessage.width,64);
  assert.equal(sent[0].proto.interactiveMessage.header.imageMessage.height,64);
});
test('media statuses pass the current object signature and an LID device sender', async () => {
  const {api,modules,wid,sent}=runtime();mockMedia(modules);let input;
  Object.assign(modules.WAWebUserPrefsMeUser,{getMeUserOrThrow:()=>wid('789@lid'),getMeDeviceLidOrThrow:()=>wid('789:1@lid')});
  modules.WAWebLidStatusMigrationUtils={matWidConvert:value=>value};
  modules.WAWebSendStatusMsgAction={sendStatusMediaMsgAction:async options=>{input=options;return {messageSendResult:'OK',msg:{id:options.mediaMsgData.id}};}};
  const result=await api.postImageStatus('data:image/png;base64,AQID','Caption');
  assert.match(result,/^true_status@broadcast_/);assert.equal(String(input.mediaMsgData.from),'789:1@lid');
  assert.equal(String(input.mediaMsgData.author),'789@lid');assert.equal(input.mediaMsgData.caption,'Caption');
  assert.equal(typeof input.beforeSend,'function');assert.equal(sent.length,0);
});
test('status deletion validates the entire batch before sending and never removes local data on network failure', async () => {
  const {api,modules,wid}=runtime();let removed=0,requests=0;
  const message={id:{fromMe:true,remote:wid('status@broadcast'),toString:()=> 'owned'},author:wid('789@lid')};
  const own={msgs:{getModelsArray:()=>[message]},revokeMsgs:()=>removed++};
  modules.WAWebCollections.Status={getModelsArray:()=>[own],get:()=>own};
  modules.WAWebStatusDrawerFlowLoadable={StatusDrawerFlowLoadable:{preload:async()=>undefined}};
  modules.WAWebRevokeStatusAction={createRevokeStatusMsgData:async()=>({})};
  modules.WAWebMsgModel={Msg:class{constructor(data){Object.assign(this,data);}}};
  modules.WAWebSendMsgMetricReporter={createMsgModelMetricReporter:()=>({createSendReporter:()=>({})})};
  modules.WAWebMessageSendReporterFrontendDeps={MAIN_WEB_MESSAGE_SEND_REPORTER_FRONTEND_DEPS:{}};
  modules.WAWebSendMsgTypes={SendMessageRecordType:{Message:'message'}};
  modules.WAWebOutgoingMessage={OutgoingMessageOriginType:{Status:'status'},createOutgoingMessageProtobuf:()=>({})};
  modules.WAWebEncryptAndSendStatusMsg={encryptAndSendStatusMsg:async()=>{requests++;throw Error('network failure');}};
  modules.WAWebDBMessageDelete={removeStatusMessage:async()=>removed++};
  await assert.rejects(api.deleteStatus(['owned','not-owned']),/owned/);assert.equal(requests,0);
  await assert.rejects(api.deleteStatus('owned'),/network failure/);assert.equal(requests,1);assert.equal(removed,0);
  modules.WAWebEncryptAndSendStatusMsg.encryptAndSendStatusMsg=async()=>{requests++;};
  assert.equal(await api.deleteStatus('owned'),true);assert.equal(requests,2);assert.equal(removed,2);
});

test('a locked WAPI rejects patch replacement before any cleanup runs', async () => {
  const {api,window,context}=runtime();let cleanups=0;
  window.__OPENWA_DEV_CLEANUP__=()=>{cleanups++;};
  Object.freeze(api);
  await assert.rejects(vm.runInNewContext(bundle,context),/before WAPI is locked/);
  assert.equal(cleanups,0);
});

test('orders pass the current native object signature and resolve a loaded order ID', async () => {
  const {api,modules,messages,wid}=runtime();let params;
  messages.push({id:{remote:wid('seller@c.us'),toString:()=> 'order-message'},type:'order',orderId:'order-id',sellerJid:'seller@s.whatsapp.net',token:'fixture-token'});
  modules.WAWebBizOrderBridge={queryOrder:async input=>{params=input;return {createdAt:123,currency:'EUR',subtotal:100,total:100,products:[{id:'product',name:'Item',quantity:2}]};}};
  const order=await api.getOrder('order-id');
  assert.equal(order.id,'order-id');assert.equal(order.total,'100');assert.equal(order.products[0].qty,2);assert.equal(order.products[0].thumbnailUrl,'');
  assert.deepEqual(toJson(params),{sellerJid:'seller@s.whatsapp.net',orderId:'order-id',height:80,width:80,token:'fixture-token'});
});
test('native calling capabilities respect the account VoIP gate',()=>{
  const {window,modules}=runtime();
  modules.WAWebVoipStackInterface={getVoipStackInterface:()=>({})};
  modules.WAWebVoipStartCall={startWAWebVoipCall:async()=>undefined};
  modules.WAWebVoipGatingUtils.isVoipDownloadEnabled=()=>false;
  assert.equal(window.__OPENWA_CALLS__.describe().control,false);
});

test('starred messages await async serializers and resolve PN chat IDs to native LIDs', async () => {
  const {api,messages,store,wid}=runtime();
  store.Chat.get=()=>({id:wid('789@lid')});
  messages.push({id:{remote:wid('789@lid')},star:true});
  api._serializeMessageObj=async()=>({id:'starred-message'});
  assert.deepEqual(toJson(await api.getStarredMessages('123@c.us')),[{id:'starred-message'}]);
});
test('story serialization is a complete plain DTO independent of the chat serializer',()=>{
  const {api,modules,wid}=runtime();api._serializeMessageObj=()=>{throw Error('Chat serializer must not be used for statuses');};
  modules.WAWebCollections.Status={getModelsArray:()=>[{msgs:{getModelsArray:()=>[{id:{fromMe:false,remote:wid('status@broadcast'),toString:()=> 'status-message'},from:wid('123@c.us'),author:wid('123@c.us'),type:'image',caption:'Caption',t:123,ack:3}]}}]};
  const result=toJson(api.getStories())[0];
  assert.equal(result.id,'status-message');assert.equal(result.chatId,'status@broadcast');assert.equal(result.body,'Caption');
  assert.equal(result.isMedia,true);assert.equal(result.fromMe,false);assert.equal(result.timestamp,123);assert.equal(result.chat,null);
});

test('calling reads the native collection even when the Store.Call alias is absent', () => {
  const {window,store,modules,wid}=runtime();
  delete store.Call;
  modules.WAWebCallCollection.activeCall={id:'native-call',peerJid:wid('123@c.us'),getState:()=>6,outgoing:true,isVideo:false};
  const call=window.__OPENWA_CALLS__.get();
  assert.equal(call.id,'native-call');assert.equal(call.state,'active');assert.equal(call.direction,'outgoing');
});

for (const playbackRate of [48000, 16000]) test(`injected calling audio uses native drivers with valid ${playbackRate} Hz frames`, async () => {
  const { window, context, modules, store, wid } = runtime();
  class AudioNode {
    constructor(context) { this.context = context; this.connections = []; }
    connect(target) { this.connections.push(target); return target; }
    disconnect() {}
  }
  class MediaStream {
    constructor(tracks = []) { this.tracks = tracks; }
    getTracks() { return this.tracks; }
    getAudioTracks() { return this.tracks; }
    getVideoTracks() { return []; }
    addTrack(track) { this.tracks.push(track); }
  }
  const track = () => ({kind:'audio',enabled:true,clone(){return track()},stop(){}});
  const processors = [];
  class AudioContext {
    constructor() { this.sampleRate = playbackRate; this.currentTime = 0; this.destination = new AudioNode(this); }
    async resume() {}
    async close() {}
    createMediaStreamDestination() { return { stream: new MediaStream([track()]) }; }
    createScriptProcessor() { const node=new AudioNode(this); processors.push(node); return node; }
    createGain() { const node=new AudioNode(this); node.gain={value:1}; return node; }
  }
  class Capture { async initCaptureDriver() {} async switchDevice() { return true; } }
  class Playback { async initPlaybackDriver() { this.playbackAudioContext = new AudioContext(); } }
  modules.WAWebVoipSilentCapture = { findMicrophone:async()=>({missingReason:'no-device',selectedDeviceId:null}) };
  modules.WAWebVoipAcquireMediaStream = { acquireVoipMediaStream:async()=>{throw Error('No physical device')} };
  modules.WAWebVoipAudioCaptureBase = { WAWebVoipAudioCaptureBase:Capture };
  modules.WAWebVoipAudioPlaybackBase = { WAWebVoipAudioPlaybackBase:Playback };
  modules.WAWebVoipStartCall={startWAWebVoipCall(){}};
  modules.WAWebVoipStackInterface={getVoipStackInterface:async()=>({})};
  context.MediaStream=MediaStream;context.AudioContext=window.AudioContext=AudioContext;window.AudioNode=AudioNode;
  context.navigator.mediaDevices={getUserMedia:async()=>new MediaStream()};
  const events=[];window.__openwaCallsHost=event=>events.push(event);
  const provider=window.__OPENWA_CALLS__;provider.install({generation:'audio-test'});
  try {
    assert.equal((await provider.prepareMedia({attachmentId:'audio',microphone:'injected',speaker:'captured'})).ready,true);
    await provider.commitMedia({attachmentId:'audio'});
    const selection=await modules.WAWebVoipSilentCapture.findMicrophone();
    assert.equal(selection.missingReason,undefined,'headless host must not choose the silent physical-device fallback');
    const acquired=await modules.WAWebVoipAcquireMediaStream.acquireVoipMediaStream({type:'microphone'});
    assert.equal(acquired.getAudioTracks().length,1);
    store.Call.activeCall={id:'test-call',peerJid:wid('123@c.us'),getState:()=>6};
    const playback=new Playback();await playback.initPlaybackDriver({});
    const source=new AudioNode(playback.playbackAudioContext);source.connect(playback.playbackAudioContext.destination);
    assert.equal(processors.length,1,'native playback must be observed without a peer connection');
    processors[0].onaudioprocess({inputBuffer:{getChannelData:()=>new Float32Array(2048).fill(.25)}});
    const audioFrames = events.filter(event=>event.type==='audio').map(event=>event.frame);
    assert.equal(audioFrames.reduce((sum,frame)=>sum+frame.samples.length,0),2048);
    assert.ok(audioFrames.every(frame=>frame.samples.length<=3840 && frame.samples.length<=frame.sampleRate*.12), 'all emitted PCM frames must pass CallingService admission');
    assert.ok(audioFrames.every(frame=>frame.samples.every(sample=>sample===.25)));
    assert.ok(audioFrames.every((frame,index)=>index===0||frame.timestampMs>audioFrames[index-1].timestampMs));
  }finally{await provider.dispose()}
});

test('native response parameters preserve valid JSON values without breaking subsequent replies', async()=>{
  const {api,events,wid}=runtime();const responses=[];
  api.onInteractiveResponse(response=>responses.push(response));
  for(const parameters of [null,false,42,'value',['a']]) {
    events.get('add')({id:{remote:wid('123@c.us'),toString:()=> 'native-response'},from:wid('123@c.us'),nativeFlowResponseMessage:{name:'extension',paramsJson:JSON.stringify(parameters)}});
  }
  events.get('add')({id:{remote:wid('123@c.us'),toString:()=> 'next-reply'},from:wid('123@c.us'),nativeFlowResponseMessage:{name:'quick_reply',paramsJson:'{"id":"next"}'}});
  await flush();
  assert.deepEqual(toJson(responses.slice(0,5).map(response=>response.parameters)),[null,false,42,'value',['a']]);
  assert.equal(responses[5].type,'reply');assert.equal(responses[5].id,'next');
});
