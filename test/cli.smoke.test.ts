import { test, expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

test('CLI prints expected output for file argument', () => {
  const cliPath = path.resolve(process.cwd(), 'dist/src/cli.js');
  const runResult = spawnSync(process.execPath, [cliPath, 'file.po'], {
    encoding: 'utf8',
  });

  expect(runResult.status).toBe(0);
  expect(runResult.stdout).toMatch(/\[MVP\] msgai received file: file\.po/);
});
