import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { root, releasePackages } from './prepare-eulab-npm.mjs';

const dryRun = process.argv.includes('--dry-run');
if (!dryRun && !process.argv.includes('--publish')) throw new Error('Use --dry-run or --publish.');
if (!process.env.NPM_TOKEN) process.loadEnvFile(process.env.EULAB_NPM_ENV || join(root, '.env.npm.local'));
const token = process.env.NPM_TOKEN;
if (!token?.trim()) throw new Error('Set NPM_TOKEN in the ignored .env.npm.local file.');

// Check the real worktree before preparing temporary authentication. Never
// modify tracked Bumpy configuration: its public API accepts an in-memory config.
if (!process.argv.includes('--worker')) {
  const git = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  if (git.error || git.status !== 0) throw new Error('Unable to verify the Git worktree.');
  if (!dryRun && git.stdout.trim()) throw new Error('Commit the working tree changes before publishing.');
  const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), dryRun ? '--dry-run' : '--publish', '--worker'], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, npm_config_verify_deps_before_run: 'false' },
  });
  process.stdout.write((result.stdout || '').replaceAll(token, '[REDACTED]'));
  process.stderr.write((result.stderr || '').replaceAll(token, '[REDACTED]'));
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} else {
  const { loadConfig, discoverPackages, DependencyGraph, publishPackages } = await import('@varlock/bumpy');
  const config = await loadConfig(root);
  config.publish.provenance = false; // Local token release has no CI OIDC identity.
  const packages = await discoverPackages(root, config);
  const releases = [];
  for (const { manifest } of await releasePackages()) {
    if (!packages.has(manifest.name)) throw new Error(`Package missing from Bumpy workspace: ${manifest.name}`);
    if (!dryRun) {
      const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(manifest.name)}/${manifest.version}`, { signal: AbortSignal.timeout(30_000) });
      if (response.ok) {
        console.log(`Already published; skip ${manifest.name}@${manifest.version}`);
        continue;
      }
      if (response.status !== 404) throw new Error(`Registry check failed for ${manifest.name}: HTTP ${response.status}`);
    }
    releases.push({ name: manifest.name, type: 'patch', oldVersion: manifest.version,
      newVersion: manifest.version, bumpFiles: [], isDependencyBump: false,
      isCascadeBump: false, isGroupBump: false, bumpSources: [] });
  }
  const npmrcPath = join(root, '.npmrc');
  const npmrcOriginal = await readFile(npmrcPath, 'utf8');
  try {
    await writeFile(npmrcPath, npmrcOriginal.trimEnd() + '\n@eulab:registry=https://registry.npmjs.org/\n//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n');
    const result = await publishPackages({ bumpFiles: [], releases, warnings: [] }, packages,
      new DependencyGraph(packages), config, root, { dryRun, tag: 'latest' }, new Map(), 'pnpm');
    console.log(`${dryRun ? 'Dry run completed' : 'Published'}: ${result.published.length}; failed: ${result.failed.length}. No Git tags pushed.`);
    process.exitCode = result.failed.length ? 1 : 0;
  } finally {
    await writeFile(npmrcPath, npmrcOriginal);
  }
}
