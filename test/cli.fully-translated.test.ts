import { test, expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { getTmpPo } from './test-utils/getTmpPo';

test('CLI without --dry-run and fully translated file exits 0 (no API needed)', () => {
  const cliPath = path.resolve(process.cwd(), 'dist/src/cli.js');
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr "Привіт"

msgid "World"
msgstr "Світ"
`);

  const runResult = spawnSync(process.execPath, [cliPath, tempPo.poFilePath], {
    encoding: 'utf8',
  });

  tempPo.cleanup();

  expect(runResult.stderr).toBe('');
  expect(runResult.status).toBe(0);
  expect(runResult.stdout).toContain('Nothing to translate in');
  expect(runResult.stdout).toContain(tempPo.poFilePath);
});
