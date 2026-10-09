import assert from 'node:assert/strict';
import test from 'node:test';
import { formatJobsMessage } from './notify.js';
import type { Job } from './sources/types.js';

const job: Job = {
  id: 'gupy:1',
  title: 'Dev <Frontend>',
  company: 'A & B',
  location: 'São Paulo',
  url: 'https://example.com/jobs?a=1&b=2',
  source: 'gupy',
};

test('Telegram message escapes HTML and links only to web URLs', () => {
  const safeMessage = formatJobsMessage([job]);
  assert.match(safeMessage, /Dev &lt;Frontend&gt;/);
  assert.match(safeMessage, /A &amp; B/);
  assert.match(safeMessage, /href="https:\/\/example\.com\/jobs\?a=1&amp;b=2"/);

  const unsafeMessage = formatJobsMessage([{ ...job, url: 'javascript:alert(1)' }]);
  assert.doesNotMatch(unsafeMessage, /href=/);
  assert.match(unsafeMessage, /Link indisponível/);
});
