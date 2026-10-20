import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { transformSync } = createRequire(require.resolve('tsx'))('esbuild');
// Execute the actual TypeScript methods without installing the monorepo.
// External orchestration dependencies are stubbed; filesystem and URL policy are real.
function loadSource(relative, overrides = {}) {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
  const result = transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2022' });
  assert.equal(result.warnings.length, 0);
  const module = { exports: {} };
  vm.runInNewContext(result.code, {
    module, exports: module.exports, require: id => id.startsWith('node:') ? require(id) : overrides[id] ?? {},
    URL, process, console, setTimeout, clearTimeout,
  });
  return module.exports;
}
const offline = loadSource('../../packages/core/src/transport/offlineDevelopment.ts');
const { Transport } = loadSource('../../packages/core/src/transport/Transport.ts', {
  './offlineDevelopment': offline,
});

async function withDirectory(fn) {
  const directory = await mkdtemp(join(tmpdir(), 'openwa-offline-'));
  try { await fn(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

test('blocks OpenWA services while allowing WhatsApp and unrelated domains', () => {
  for (const url of ['https://funcs.openwa.dev/license-check', 'https://cdn.openwa.dev/patches.json', 'https://openwa.cloud/']) {
    assert.equal(offline.isOpenWaServiceUrl(url), true);
  }
  for (const url of ['https://web.whatsapp.com/', 'https://openwa.dev.example.org/', 'data:text/plain,hello']) {
    assert.equal(offline.isOpenWaServiceUrl(url), false);
  }
});

test('loads local patches with a stable content tag', async () => withDirectory(async directory => {
  await writeFile(join(directory, 'patches.json'), JSON.stringify(['localPatch();']));
  const first = await offline.loadOfflinePatches(directory);
  assert.equal(first.data[0], 'localPatch();');
  assert.equal(first.tag, (await offline.loadOfflinePatches(directory)).tag);
}));

test('accepts the local cache when patches.json is absent', async () => withDirectory(async directory => {
  await writeFile(join(directory, 'patches.cache.json'), JSON.stringify({ data: ['cached();'], tag: 'old' }));
  assert.equal((await offline.loadOfflinePatches(directory)).data[0], 'cached();');
}));

test('rejects missing, malformed and empty bundles without network fallback', async () => withDirectory(async directory => {
  await assert.rejects(offline.loadOfflinePatches(directory));
  for (const content of ['{broken', '[]', '[123]', '[" "]']) {
    await writeFile(join(directory, 'patches.json'), content);
    await assert.rejects(offline.loadOfflinePatches(directory));
  }
}));

test('preload and check ignore keys, strict validation and supplied payloads', async () => {
  const transport = Object.create(Transport.prototype);
  const preload = await transport.preloadLicenseArtifact({ sessionId: 'dev', strict: true,
    licenseKey: () => { throw new Error('Key resolver must not run'); } });
  const checked = await transport.checkLicenseArtifact({ ...preload,
    artifact: { payload: 'throw new Error("must not execute")' } });
  assert.equal(checked.blockingFailure, false);
  assert.equal(checked.artifact, null);
  assert.equal(checked.status, 'valid');
  transport.page = { evaluateScript() { throw new Error('No license code should be evaluated'); } };
  let installed = false;
  transport.calling = { async install() { installed = true; }, featureFlags: () => ({ patch_calls_control: false, patch_calls_audio: false, patch_calls_video: false }) };
  assert.equal((await transport.applyLicenseArtifact(checked)).applied, true);
  assert.equal(installed, true);
  assert.equal(transport.getLicenseFeatures().expiresAt, null);
  assert.equal(transport.getLicenseFeatures().keyType, 'development');
  assert.equal(transport.getLicenseFeatures().features.patch_calls_control, false);
});

test('browser interception aborts license traffic and continues WhatsApp traffic', async () => {
  const transport = Object.create(Transport.prototype);
  transport.blockAssets = false;
  transport.blockCrashLogs = false;
  for (const [url, expected] of [['https://funcs.openwa.dev/license-check', 'abort'], ['https://web.whatsapp.com/', 'continue']]) {
    let action;
    await transport.handleInterceptedRequest({ url: () => url, resourceType: () => 'fetch',
      abort: async () => { action = 'abort'; }, continue: async () => { action = 'continue'; } });
    assert.equal(action, expected);
  }
});

test('offline enforcement fails if browser interception is unavailable', async () => {
  const transport = Object.create(Transport.prototype);
  transport.events = { emit() {} };
  transport.logger = { warn() {} };
  await assert.rejects(transport.configureRequestInterception({
    async setRequestInterception() { throw new Error('unsupported driver'); },
  }), /requires browser request interception/);
});

test('both ordinary and fresh patch loads use the module asset directory', async () => withDirectory(async directory => {
  await writeFile(join(directory, 'patches.json'), readFileSync(new URL('../../patches.json', import.meta.url)));
  const original = Transport.resolveWapiScriptPath;
  Transport.resolveWapiScriptPath = () => join(directory, 'wapi.js');
  try {
  const transport = Object.create(Transport.prototype);
  const normal = await transport.fetchLivePatchesWithCache();
  const fresh = await transport.fetchFreshLivePatches(undefined, true);
  assert.equal(normal.source, 'cached');
  assert.equal(normal.tag, fresh.tag);
  assert.ok(normal.data.length > 0);
  } finally { Transport.resolveWapiScriptPath = original; }
}));

test('calling accepts an installed provider regardless of license expiry', () => {
  const { CallingService } = loadSource('../../packages/core/src/calling/CallingService.ts', {
    effect: { Data: { TaggedError: () => class extends Error { constructor(fields) { super(fields.message); Object.assign(this, fields); } } } },
  });
  const calling = Object.create(CallingService.prototype);
  const provider = { protocolVersion: 1, artifactRevision: 'local', expiresAt: 0,
    control: true, audio: true, video: false };
  assert.equal(calling.isProviderInfo(provider), true);
  calling.provider = provider;
  calling.generation = 'dev';
  calling.options = { generation: () => 'dev' };
  assert.equal(calling.availability('calls.control'), undefined);
  calling.provider = undefined;
  assert.equal(calling.availability('calls.control').code, 'CALLING_SESSION_NOT_READY');
});
