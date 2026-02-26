import { test, expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { getTmpPo } from '../test-utils/getTmpPo';

test('CLI exits with error when --source-lang is invalid', () => {
  const cliPath = path.resolve(process.cwd(), 'dist/src/cli/index.js');
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  const runResult = spawnSync(
    process.execPath,
    [cliPath, tempPo.poFilePath, '--dry-run', '--source-lang=notacode'],
    { encoding: 'utf8' },
  );

  tempPo.cleanup();

  expect(runResult.status).toBe(1);
  expect(runResult.stderr).toContain('Invalid --source-lang "notacode"');
  expect(runResult.stderr).toMatch(/not a known ISO language code/i);
});
