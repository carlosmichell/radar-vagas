import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../data/seen.json', import.meta.url));

export async function loadSeenIds(): Promise<Set<string>> {
  try {
    return new Set(JSON.parse(await readFile(file, 'utf8')));
  } catch {
    return new Set();
  }
}

export async function saveSeenIds(ids: Set<string>): Promise<void> {
  await mkdir('data', { recursive: true });
  await writeFile(file, JSON.stringify([...ids], null, 2));
}
