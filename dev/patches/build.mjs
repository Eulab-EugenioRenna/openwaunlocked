import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const sources = ['runtime.js', 'interactive.js', 'forms-bookings.js', 'premium.js', 'calling.js'];
export async function buildDevelopmentPatch() {
  const contents = await Promise.all(sources.map(file => readFile(resolve(root, 'dev/patches/src', file), 'utf8')));
  const revision = createHash('sha256').update(contents.join('\n')).digest('hex').slice(0, 16);
  const bundle = `// Generated from dev/patches/src. Do not edit.\n(async () => {\n'use strict';\nif (window.WAPI && (!Object.isExtensible(window.WAPI) || Object.getOwnPropertyDescriptor(window.WAPI, 'sendRawMessage')?.writable === false)) throw new Error('Install the development patch before WAPI is locked.');\nif (typeof window.__OPENWA_DEV_CLEANUP__ === 'function') await window.__OPENWA_DEV_CLEANUP__();\n${contents.join('\n')}\nwindow.__OPENWA_DEV_CLEANUP__ = async () => { for (const close of dev.cleanup) await close(); await window.__OPENWA_CALLS__?.dispose(); };\nwindow.__OPENWA_DEV_PATCH__ = { revision: '${revision}', licenseRequired: false };\nreturn true;\n})();\n`;
  new vm.Script(bundle, { filename: 'dev-premium.js' });
  const target = resolve(root, 'packages/core/src/transport/assets/dev-premium.js');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bundle);
  return { target, revision, bundle };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { target, revision } = await buildDevelopmentPatch();
  console.log(`Development patch ${revision}: ${target}`);
}
