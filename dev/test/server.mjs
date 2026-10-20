import { createConversation } from './conversation.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile, access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { createClient } from '@open-wa/core';
import { Client } from '@open-wa/client';
import { PuppeteerDriver } from '@open-wa/driver-puppeteer';
import { clientRegistry } from '@open-wa/schema';
const require = createRequire(import.meta.url);
const port = Number(process.env.DEV_PORT ?? 8099);
const statePath = process.env.DEV_STATE_PATH ?? '/state';
await mkdir(statePath, { recursive: true, mode: 0o700 });
const keyFile = join(statePath, 'session-key');
try { await access(keyFile); } catch { await writeFile(keyFile, randomBytes(32).toString('base64'), { mode: 0o600, flag: 'wx' }); }
let state = 'starting', qr = null, failure = null, client, core;
let connecting;
const conversation = createConversation();
let eventSequence = 0;
const events = [];
function recordEvent(type, value) {
  const data = JSON.parse(JSON.stringify(value));
  events.push({ sequence: ++eventSequence, at: new Date().toISOString(), type, data });
  if (events.length > 200) events.shift();
}
// A deterministic tone verifies transmission without an AI service or microphone.
const tone = Buffer.alloc(44 + 32000);
tone.write('RIFF'); tone.writeUInt32LE(tone.length - 8, 4); tone.write('WAVEfmt ', 8);
tone.writeUInt32LE(16, 16); tone.writeUInt16LE(1, 20); tone.writeUInt16LE(1, 22);
tone.writeUInt32LE(16000, 24); tone.writeUInt32LE(32000, 28); tone.writeUInt16LE(2, 32);
tone.writeUInt16LE(16, 34); tone.write('data', 36); tone.writeUInt32LE(32000, 40);
for (let n = 0; n < 16000; n++) tone.writeInt16LE(Math.round(2500 * Math.sin(2*Math.PI*440*n/16000)), 44+n*2);
await writeFile(join(statePath, 'demo-tone.wav'), tone);

class DevelopmentDriver extends PuppeteerDriver {
  async init(context) {
    await super.init(context);
    // The dev console waits for a person to scan: its pending browser promise
    // must not inherit Puppeteer's separate 180-second CDP protocol timeout.
    const puppeteer = this.unwrap();
    const launch = puppeteer.launch.bind(puppeteer);
    puppeteer.launch = options => launch({ ...options, protocolTimeout: 0 });
  }
}
async function connect() {
  if (connecting || state === 'ready') return connecting;
  state = 'starting'; failure = null; qr = null;
  connecting = (async () => {
    core = await createClient({ sessionId: 'free-dev-test', driver: new DevelopmentDriver(), headless: true,
      sessionDataPath: join(statePath, 'checkpoint'), sessionDataEncryptionKeyFile: keyFile,
      executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
      browserArgs: ['--no-sandbox', '--disable-dev-shm-usage', '--use-fake-ui-for-media-stream'], allowDangerousBrowserArgs: true,
      qrTimeoutMs: 0, authTimeoutMs: 0,
      callMediaHost: { async prepare(...args) {
        const { makeNodeCallMediaHost } = await import('@open-wa/runtime-node');
        return makeNodeCallMediaHost().prepare(...args);
      } },
      logConsole: false, logConsoleErrors: false,
    });
    core.events.on('launch.auth.qr.generated', event => { qr = event.details?.qr ?? null; state = 'pairing'; });
    client = new Client({ client: core, transport: core.getTransport() });
    for (const [method, type] of [['onInteractiveResponse','interactiveResponse'], ['onFormResponse','formResponse'], ['onIncomingCall','incomingCall'], ['onCallState','callState']]) {
      client[method](value => recordEvent(type, value));
    }
    await client.start();
    state = 'ready'; qr = null;
    console.log('Development WhatsApp session ready. No test message has been sent.');
  })().catch(async error => {
    state = 'failed'; failure = error.message; qr = null;
    await client?.stop('dev-test-start-failed').catch(() => undefined);
    console.error('Development session failed:', error.message);
  }).finally(() => { connecting = undefined; });
  return connecting;
}
const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
async function body(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 25_000_000) throw new Error('Request too large.'); }
  return raw ? JSON.parse(raw) : {};
}
const premium = ['checkNumberStatus','getNumberProfile','getOrder','postTextStatus','postImageStatus','postVideoStatus','getStories','getStatus','deleteStatus','deleteAllStatus','sendInteractive','sendRawMessage','sendButtons','sendAdvancedButtons','sendListMessage','getStarredMessages','setProfilePicture','createGroup','joinGroupViaLink','getActiveCall','startCall','acceptCall','rejectCall','endCall','muteCall','clearCallAudio','setCallMedia','observeCallAudio','stopCallAudioObserver'];
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (req.method === 'GET' && ['/demo.mjs', '/cases.mjs', '/conversation-ui.mjs'].includes(url.pathname)) {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(await readFile(new URL('.' + url.pathname, import.meta.url)));
    }
    if (req.method === 'GET' && url.pathname === '/conversation/audio') {
      return json(res, 200, conversation.output(url.searchParams.get('id'), Number(url.searchParams.get('after') || 0)));
    }
    if (req.method === 'GET' && url.pathname === '/events') {
      const after = Number(url.searchParams.get('after') || 0);
      return json(res, 200, { cursor: eventSequence, truncated: !!events.length && after < events[0].sequence-1, events: events.filter(event => event.sequence > after) });
    }
    if (req.method === 'GET' && url.pathname === '/recordings') {
      return json(res, 200, (await readdir(statePath)).filter(name => /^demo-received-\d+\.wav$/.test(name)));
    }
    if (req.method === 'GET' && /^\/recording-info\/demo-received-\d+\.wav$/.test(url.pathname)) {
      const path = join(statePath, url.pathname.split('/').pop());
      const { stdout } = await promisify(execFile)('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels,duration:format=duration,size', '-of', 'json', path], { timeout: 10000 });
      const probe = JSON.parse(stdout);
      const { stderr } = await promisify(execFile)('ffmpeg', ['-hide_banner', '-i', path, '-t', '60', '-vn', '-af', 'volumedetect', '-f', 'null', '-'], { timeout: 15000 });
      probe.signal = { analyzedSecondsMax: 60, meanVolumeDb: /mean_volume: ([^ ]+) dB/.exec(stderr)?.[1] ?? null, maxVolumeDb: /max_volume: ([^ ]+) dB/.exec(stderr)?.[1] ?? null };
      return json(res, 200, { ...probe, note: 'Formato e durata non dimostrano voce intelligibile o assenza di perdite. Ascolta il file e confronta la durata della chiamata.' });
    }
    if (req.method === 'GET' && /^\/recordings\/demo-received-\d+\.wav$/.test(url.pathname)) {
      const data = await readFile(join(statePath, url.pathname.split('/').pop()));
      res.writeHead(200, { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' });
      return res.end(data);
    }
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { service: 'openwa-free-dev-test', state, qrAvailable: !!qr, failure, licenseRequired: false });
    if (req.method === 'GET' && url.pathname === '/methods') return json(res, 200, premium.map(name => ({ name,
      license: clientRegistry.get(name)?.meta.license ?? null, sdkBound: typeof Client.prototype[name] === 'function' || typeof client?.[name] === 'function',
      liveVerified: false })));
    if (req.method === 'GET' && url.pathname === '/qr.svg') {
      if (!qr) return json(res, 409, { state, message: 'No pairing QR is currently available.' });
      const qrcode = require('qrcode');
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' });
      return res.end(await qrcode.toString(qr, { type: 'svg', width: 320 }));
    }
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(await readFile(new URL('./index.html', import.meta.url), 'utf8'));
    }
    if (req.method === 'POST') {
      const origin = req.headers.origin;
      if (origin && ![`http://localhost:${port}`, `http://127.0.0.1:${port}`].includes(origin)) return json(res, 403, { error: 'Origin not allowed.' });
      if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Use application/json.' });
      if (url.pathname.startsWith('/conversation/')) {
        if (state !== 'ready') return json(res, 409, { error: 'Collega prima WhatsApp.' });
        const input = await body(req);
        if (url.pathname === '/conversation/prepare') return json(res, 200, conversation.create());
        if (url.pathname === '/conversation/input') return json(res, 200, conversation.input(input.id, input.samples));
        if (url.pathname === '/conversation/stop') return json(res, 200, conversation.stop(input.id));
        if (['/conversation/start', '/conversation/accept'].includes(url.pathname)) {
          const action = url.pathname.split('/').pop();
          const definition = clientRegistry.resolve(action === 'start' ? 'startCall' : 'acceptCall');
          const params = await definition.meta.inputSchema.parseAsync(action === 'start' ? { to: input.to } : { call: input.call });
          return json(res, 200, { ok: true, result: await conversation.action(input.id, action, client, params) });
        }
        return json(res, 404, { error: 'Azione conversazione inesistente.' });
      }
      if (url.pathname === '/session/start') { void connect(); return json(res, 202, { state }); }
      if (url.pathname.startsWith('/api/')) {
        if (state !== 'ready') return json(res, 409, { state, error: 'Connect the development WhatsApp session first.' });
        const definition = clientRegistry.resolve(decodeURIComponent(url.pathname.slice(5)));
        const method = definition?.meta.functionName;
        if (!method || typeof client[method] !== 'function') return json(res, 404, { error: 'API method not implemented.' });
        const params = await definition.meta.inputSchema.parseAsync(await body(req));
        const result = await client[method](...definition.meta.parameterOrder.map(name => params[name]));
        return json(res, 200, { ok: true, method, result });
      }
    }
    if (req.method === 'GET' && url.pathname === '/diagnostics/runtime') {
      if (state !== 'ready') return json(res, 409, { state });
      const result = await client.evaluate(() => {
        const runtime = globalThis;
        return { version: runtime.Debug?.VERSION, patch: runtime.__OPENWA_DEV_PATCH__,
          calling: runtime.__OPENWA_CALLS__?.describe(), callingAudio: runtime.__OPENWA_CALLS__?.diagnostics(),
          methods: Object.keys(runtime.WAPI).filter(name => /Interactive|RawMessage|Status|Stories|Profile|Order|Buttons|List/.test(name)) };
      }, undefined);
      return json(res, 200, result);
    }
    return json(res, 404, { error: 'Not found.' });
  } catch (error) { return json(res, 422, { ok: false, error: error.message }); }
});
server.listen(port, '0.0.0.0', () => { console.log(`Development test API listening on ${port}`); void connect(); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { conversation.close(); await client?.stop('dev-test-shutdown').catch(() => undefined); server.close(() => process.exit(0)); });
