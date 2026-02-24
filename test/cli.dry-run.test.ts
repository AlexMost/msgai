import { test, expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { getTmpPo } from './test-utils/getTmpPo';

test('CLI dry-run handles headers and returns untranslated strings', () => {
  const cliPath = path.resolve(process.cwd(), 'dist/src/cli.js');
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""

msgid "World"
msgstr "Світ"
`);

  const runResult = spawnSync(process.execPath, [cliPath, '--dry-run', tempPo.poFilePath], {
    encoding: 'utf8',
  });

  tempPo.cleanup();

  expect(runResult.stderr).toBe('');
  expect(runResult.status).toBe(0);
  expect(runResult.stdout.trim()).toBe('Hello');
});
