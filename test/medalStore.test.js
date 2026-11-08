import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadMedals, saveMedals } from '../server/store/medalStore.js';
import { emptyTable, addMedals } from '../server/sea/medals.js';

test('all-time medals survive a save/load round trip and bad files load as empty', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'medals-'));
  try {
    const file = join(dir, 'medals.json');
    assert.deepEqual(await loadMedals(file), emptyTable());
    const table = addMedals(emptyTable(), { gold: 'vn', bronze: 'my' });
    await saveMedals(file, table);
    assert.deepEqual(await loadMedals(file), table);
    await writeFile(file, '{not json', 'utf8');
    assert.deepEqual(await loadMedals(file), emptyTable());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
