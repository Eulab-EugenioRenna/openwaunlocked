import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const artifacts = resolve(process.env.EULAB_NPM_ARTIFACTS || '.release/npm');
const packages = JSON.parse(await readFile(join(artifacts, 'manifest.json'), 'utf8'));
const directory = await mkdtemp(join(tmpdir(), 'eulab-npm-consumer space '));
function run(args) {
  const result = spawnSync(args[0], args.slice(1), { cwd: directory, encoding: 'utf8', timeout: 240_000, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: 'true' } });
  if (result.error || result.status !== 0) throw new Error(`${args[0]} failed: ${result.error || result.stderr || result.stdout}`);
  return result.stdout;
}
try {
  await writeFile(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  run(['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund', ...packages.map(pkg => join(artifacts, pkg.filename))]);
  const script = `
    import assert from 'node:assert/strict';
    import { readFile } from 'node:fs/promises';
    import { createRequire } from 'node:module';
    import { dirname, join } from 'node:path';
    import * as sdk from '@eulab/openwaunlocked';
    import { Transport } from '@eulab/openwaunlocked-core';
    import { createVoiceCallAudio } from '@eulab/openwaunlocked-runtime-node';
    assert.equal(typeof sdk.create, 'function');
    assert.equal(typeof sdk.createClient, 'function');
    const require = createRequire(import.meta.url);
    assert.equal(typeof require('@eulab/openwaunlocked').create, 'function');
    const audio = createVoiceCallAudio(); audio.close(); assert.equal(audio.stats().closed, true);
    const wapi = Transport.resolveWapiScriptPath();
    assert.ok((await readFile(wapi, 'utf8')).length > 100);
    assert.ok((await readFile(join(dirname(wapi), 'dev-premium.js'), 'utf8')).includes('__OPENWA_DEV_PATCH__'));
    const patches = JSON.parse(await readFile(join(dirname(wapi), 'patches.json'), 'utf8'));
    assert.ok((Array.isArray(patches) ? patches : patches.data).length > 0);
    const transport = Object.create(Transport.prototype);
    transport.logger = { info(){}, warn(){}, error(){} }; transport.events = { emit(){} };
    const loaded = await transport.preloadLivePatchArtifacts();
    assert.equal(loaded.blockingFailure, false);
    assert.ok(loaded.artifacts.some(artifact => artifact.patchId === 'remote-patch-0'));
    assert.ok(loaded.artifacts.some(artifact => artifact.patchId === 'dev-premium'));
    console.log('ESM/CJS exports, voice API and complete packaged patches: OK');
  `;
  await writeFile(join(directory, 'smoke.mjs'), script);
  console.log(run(['node', 'smoke.mjs']).trim());
  const help = run(['node', join(directory, 'node_modules/@eulab/openwaunlocked/dist/cli.cjs'), '--help']);
  assert.match(help, /Usage|usage|help/);
  console.log(`Installed ${packages.length} tarballs in a clean consumer; CLI help: OK. No WhatsApp session started.`);
} finally { await rm(directory, { recursive: true, force: true }); }
