import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
export async function releasePackages() {
  const packages = [];
  for (const directory of ['packages', 'integrations']) {
    for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'legacy-documented') continue;
      const dir = join(root, directory, entry.name);
      let manifest;
      try { manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      if (manifest.private) continue;
      if (!manifest.name.startsWith('@eulab/openwaunlocked')) throw new Error(`Unexpected publication target: ${manifest.name}`);
      packages.push({ dir, manifest });
    }
  }
  return packages.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}
export function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${executable} failed (${result.status}): ${(result.stderr || result.stdout || '').slice(-5000)}`);
  return result.stdout;
}

async function prepare(mode) {
  const packages = await releasePackages();
  if (mode === 'build') {
    command('pnpm', ['exec', 'turbo', 'run', 'build', ...packages.map(({ manifest }) => `--filter=${manifest.name}...`)], { stdio: 'inherit' });
    return;
  }
  if (mode !== 'pack') throw new Error('Use build or pack.');
  const target = resolve(process.env.EULAB_NPM_ARTIFACTS || join(root, '.release/npm'));
  await mkdir(target, { recursive: true });
  const records = [];
  for (const { dir, manifest } of packages) {
    command('pnpm', ['--config.verify-deps-before-run=false', 'pack', '--pack-destination', target], { cwd: dir });
    const filename = `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`;
    const tarball = join(target, filename);
    const files = command('tar', ['-tzf', tarball]).trim().split('\n');
    if (files.some(file => /(?:^|\/)(?:\.env(?:\.[^/]*)?|\.npmrc|node_modules|\.git)(?:\/|$)|\.data\.json(?:\.|$)|(?:^|\/)\.\.(?:\/|$)/.test(file))) {
      throw new Error(`Private or runtime file in ${filename}`);
    }
    const packed = JSON.parse(command('tar', ['-xOf', tarball, 'package/package.json']));
    if (packed.name !== manifest.name || packed.version !== manifest.version || packed.author !== 'EULAB') throw new Error(`Incorrect package metadata: ${filename}`);
    for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [name, version] of Object.entries(packed[field] || {})) {
        if (name.startsWith('@open-wa/') || /^(workspace|catalog|file|link):/.test(version)) throw new Error(`Unresolved dependency ${name} in ${filename}`);
      }
    }
    const paths = [];
    const collect = value => {
      if (typeof value === 'string' && value.startsWith('./')) paths.push(value);
      else if (value && typeof value === 'object') Object.values(value).forEach(collect);
    };
    collect(packed.exports);
    for (const key of ['main', 'module', 'types']) if (packed[key]) paths.push(packed[key]);
    if (typeof packed.bin === 'string') paths.push(packed.bin); else Object.values(packed.bin || {}).forEach(path => paths.push(path));
    for (const path of paths) {
      if (!path.includes('*') && !files.includes(`package/${path.replace(/^\.\//, '')}`)) throw new Error(`Missing entrypoint ${path} in ${filename}`);
    }
    records.push({ name: packed.name, version: packed.version, filename, files: files.length });
    console.log(`Packed and checked ${packed.name}@${packed.version}`);
  }
  await writeFile(join(target, 'manifest.json'), JSON.stringify(records, null, 2) + '\n');
  console.log(`${records.length} EULAB packages ready in ${target}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepare(process.argv[2]);
