import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { root, releasePackages } from './prepare-eulab-npm.mjs';

const dryRun = process.argv.includes('--dry-run');
if (!dryRun && !process.argv.includes('--publish')) throw new Error('Use --dry-run or --publish.');
const useLogin = process.argv.includes('--auth=login');
if (!useLogin && !process.env.NPM_TOKEN) process.loadEnvFile(process.env.EULAB_NPM_ENV || join(root, '.env.npm.local'));
const token = useLogin ? undefined : process.env.NPM_TOKEN;
if (!useLogin && !token?.trim()) throw new Error('Set NPM_TOKEN in the ignored .env.npm.local file, or use --auth=login.');

// Check the real worktree before preparing temporary authentication. Never
// modify tracked Bumpy configuration: its public API accepts an in-memory config.
if (!process.argv.includes('--worker')) {
  const git = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  if (git.error || git.status !== 0) throw new Error('Unable to verify the Git worktree.');
  if (!dryRun && git.stdout.trim()) throw new Error('Commit the working tree changes before publishing.');
  // A user's npmrc may contain unrelated credentials. Do not read or log it.
  let temporary;
  const env = { ...process.env, PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN: 'false' };
  if (useLogin) {
    // Keep npm's user configuration so npm login credentials remain available.
    delete env.NPM_TOKEN;
    delete env.NODE_AUTH_TOKEN;
    const identity = spawnSync('npm', ['whoami', '--registry=https://registry.npmjs.org/'], { cwd: root, encoding: 'utf8', env });
    if (identity.error || identity.status !== 0) throw new Error('npm authentication check failed. Run npm login --registry=https://registry.npmjs.org/ and verify connectivity.');
    console.log(`npm account: ${identity.stdout.trim()}`);
  } else {
    temporary = await mkdtemp(join(tmpdir(), 'eulab-npm-auth-'));
    const userConfig = join(temporary, 'npmrc');
    await writeFile(userConfig, '//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n', { mode: 0o600 });
    env.NPM_CONFIG_USERCONFIG = userConfig;
    env.PNPM_CONFIG_NPMRC_AUTH_FILE = userConfig;
    delete env.npm_config_userconfig;
  }
  delete env.npm_config_verify_deps_before_run;
  delete env.NPM_CONFIG_VERIFY_DEPS_BEFORE_RUN;
  try {
    const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), dryRun ? '--dry-run' : '--publish', ...(useLogin ? ['--auth=login'] : []), '--worker'], {
      cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
      env,
    });
    const redact = output => token ? (output || '').replaceAll(token, '[REDACTED]') : (output || '');
    process.stdout.write(redact(result.stdout));
    process.stderr.write(redact(result.stderr));
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } finally { if (temporary) await rm(temporary, { recursive: true, force: true }); }
} else {
  const { loadConfig, discoverPackages, DependencyGraph, publishPackages } = await import('@varlock/bumpy');
  const config = await loadConfig(root);
  config.publish.provenance = false; // Local release has no CI OIDC identity.
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
    await writeFile(npmrcPath, '@eulab:registry=https://registry.npmjs.org/\n' + (useLogin ? '' : '//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n'));
    const graph = new DependencyGraph(packages);
    const releaseMap = new Map(releases.map(release => [release.name, release]));
    let published = 0;
    for (const name of graph.topologicalSort(packages)) {
      const release = releaseMap.get(name);
      if (!release) continue;
      const result = await publishPackages({ bumpFiles: [], releases: [release], warnings: [] }, packages,
        graph, config, root, { dryRun, tag: 'latest' }, new Map(), 'pnpm');
      published += result.published.length;
      if (result.failed.length) {
        process.exitCode = 1;
        console.error('Publication stopped at the first failure. Check npm authentication, 2FA and package/scope permissions before retrying.');
        break;
      }
    }
    console.log(`${dryRun ? 'Dry run completed' : 'Published'}: ${published}; failed: ${process.exitCode ? 1 : 0}. No Git tags pushed.`);
  } finally {
    await writeFile(npmrcPath, npmrcOriginal);
  }
}
