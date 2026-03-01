import { test, expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

test('CLI prints help output for --help', () => {
  const cliPath = path.resolve(process.cwd(), 'dist/src/cli/index.js');
  const runResult = spawnSync(process.execPath, [cliPath, '--help'], {
    encoding: 'utf8',
  });

  expect(runResult.stderr).toBe('');
  expect(runResult.status).toBe(0);
  expect(runResult.stdout).toContain(
    'Usage: msgai <file.po> [--dry-run] [--api-key KEY] [--source-lang LANG] [--model MODEL] [--include-fuzzy] [--debug]',
  );
});
