import { test, expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { getTmpPo } from '../test-utils/getTmpPo';

test('CLI accepts --context flag with dry-run', () => {
  const cliPath = path.resolve(process.cwd(), 'dist/src/cli/index.js');
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  const runResult = spawnSync(
    process.execPath,
    [cliPath, '--dry-run', '--context', 'use formal tone', tempPo.poFilePath],
    { encoding: 'utf8' },
  );

  tempPo.cleanup();

  expect(runResult.stderr).toBe('');
  expect(runResult.status).toBe(0);
  expect(runResult.stdout.trim()).toBe('Hello');
});

test('CLI rejects unknown options but accepts --context', () => {
  const cliPath = path.resolve(process.cwd(), 'dist/src/cli/index.js');
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  const runResult = spawnSync(
    process.execPath,
    [cliPath, '--dry-run', '--context', 'test instructions', '--bogus', tempPo.poFilePath],
    { encoding: 'utf8' },
  );

  tempPo.cleanup();

  expect(runResult.status).toBe(1);
});
