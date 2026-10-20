import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { root } from './prepare-eulab-npm.mjs';

const dryRun = process.argv.includes('--dry-run');
if (!dryRun && !process.argv.includes('--publish')) throw new Error('Use --dry-run or --publish.');
if (!process.env.NPM_TOKEN) process.loadEnvFile(resolve(process.env.EULAB_NPM_ENV || join(root, '.env.npm.local')));
const token = process.env.NPM_TOKEN;
if (!token?.trim()) throw new Error('Set NPM_TOKEN in the ignored .env.npm.local file.');
const configPath = join(root, '.bumpy/_config.json');
const npmrcPath = join(root, '.npmrc');
const configOriginal = await readFile(configPath, 'utf8');
const npmrcOriginal = await readFile(npmrcPath, 'utf8');
const config = JSON.parse(configOriginal);
// A local token release has no CI OIDC identity to attach to a provenance statement.
// Keep the repository's trusted-publishing configuration unchanged after this run.
config.publish.provenance = false;
const bumpy = join(root, 'node_modules/@varlock/bumpy/package.json');
const bumpyManifest = JSON.parse(await readFile(bumpy, 'utf8'));
const executable = resolve(bumpy, '..', typeof bumpyManifest.bin === 'string' ? bumpyManifest.bin : bumpyManifest.bin.bumpy);
let status = 1;
try {
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
  await writeFile(npmrcPath, npmrcOriginal.trimEnd() + '\n@eulab:registry=https://registry.npmjs.org/\n//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n');
  const result = spawnSync(process.execPath, [executable, 'publish', '--filter', '@eulab/openwaunlocked*', '--tag', 'latest', '--no-push', ...(dryRun ? ['--dry-run'] : [])], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, npm_config_verify_deps_before_run: 'false' },
  });
  process.stdout.write((result.stdout || '').replaceAll(token, '[REDACTED]'));
  process.stderr.write((result.stderr || '').replaceAll(token, '[REDACTED]'));
  if (result.error) throw result.error;
  status = result.status ?? 1;
} finally {
  await writeFile(configPath, configOriginal);
  await writeFile(npmrcPath, npmrcOriginal);
}
process.exitCode = status;
