import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const file = path.join('data', 'seen.json');

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
