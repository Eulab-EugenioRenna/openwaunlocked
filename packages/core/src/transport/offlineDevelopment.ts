import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

/** OpenWA services are unnecessary in this local development fork. */
export function isOpenWaServiceUrl(value: string): boolean {
  const host = new URL(value).hostname.toLowerCase();
  return host === 'openwa.dev' || host.endsWith('.openwa.dev')
    || host === 'openwa.cloud' || host.endsWith('.openwa.cloud');
}

/** Read the existing local bundle without freshness checks or network fallback. */
export async function loadOfflinePatches(directory: string): Promise<{ data: string[]; tag: string }> {
  let raw: string;
  try {
    raw = await readFile(join(directory, 'patches.json'), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    raw = await readFile(join(directory, 'patches.cache.json'), 'utf8');
  }
  const parsed = JSON.parse(raw);
  const data: unknown = Array.isArray(parsed) ? parsed : parsed?.data;
  if (!Array.isArray(data) || data.length === 0 || data.some(script => typeof script !== 'string' || !script.trim())) {
    throw new Error('The local patch bundle must contain non-empty JavaScript strings.');
  }
  return { data, tag: createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 12) };
}
