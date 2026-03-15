import { test, expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { getTmpPo } from '../test-utils/getTmpPo';
import { USAGE } from '../../src/cli/runTranslate';

test('CLI dry-run accepts --fold-length 0', () => {
  const cliPath = path.resolve(process.cwd(), 'dist/src/cli/index.js');
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  const runResult = spawnSync(
    process.execPath,
    [cliPath, '--dry-run', '--fold-length', '0', tempPo.poFilePath],
    {
      encoding: 'utf8',
    },
  );

  tempPo.cleanup();

  expect(runResult.stderr).toBe('');
  expect(runResult.status).toBe(0);
  expect(runResult.stdout.trim()).toBe('Hello');
});

test('CLI exits with error when --fold-length is negative', () => {
  const cliPath = path.resolve(process.cwd(), 'dist/src/cli/index.js');
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  const runResult = spawnSync(
    process.execPath,
    [cliPath, '--dry-run', '--fold-length', '-1', tempPo.poFilePath],
    {
      encoding: 'utf8',
    },
  );

  tempPo.cleanup();

  expect(runResult.status).toBe(1);
  expect(runResult.stderr).toContain('Invalid --fold-length. Expected a non-negative integer.');
  expect(runResult.stderr).toContain(USAGE);
});

test('CLI exits with error when --fold-length is not an integer', () => {
  const cliPath = path.resolve(process.cwd(), 'dist/src/cli/index.js');
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  const runResult = spawnSync(
    process.execPath,
    [cliPath, '--dry-run', '--fold-length', '10.5', tempPo.poFilePath],
    {
      encoding: 'utf8',
    },
  );

  tempPo.cleanup();

  expect(runResult.status).toBe(1);
  expect(runResult.stderr).toContain('Invalid --fold-length. Expected a non-negative integer.');
});
