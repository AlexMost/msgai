import { test, expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { getTmpPo } from '../test/test-utils/getTmpPo';

test('CLI without --dry-run calls OpenAI and updates .po file with translated strings', () => {
  const cliPath = path.resolve(process.cwd(), 'dist/src/cli/index.js');
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  try {
    const runResult = spawnSync(
      process.execPath,
      [cliPath, tempPo.poFilePath, '--source-lang=en'],
      {
        encoding: 'utf8',
      },
    );

    expect(runResult.status).toBe(0);
    if (runResult.stderr) {
      console.error(runResult.stderr);
    }

    const content = fs.readFileSync(tempPo.poFilePath, 'utf8');
    expect(content).toContain('msgstr "Привіт"');
    expect(content).toMatchSnapshot();
  } finally {
    tempPo.cleanup();
  }
});

test('CLI without --dry-run exits with error when OPENAI_API_KEY is not set', () => {
  const cliPath = path.resolve(process.cwd(), 'dist/src/cli/index.js');
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  const envWithoutKey = { ...process.env };
  delete envWithoutKey.OPENAI_API_KEY;
  // Run from temp dir so dotenv does not load project .env (which might set OPENAI_API_KEY)
  const cwd = path.dirname(tempPo.poFilePath);

  try {
    const runResult = spawnSync(process.execPath, [cliPath, tempPo.poFilePath], {
      encoding: 'utf8',
      env: envWithoutKey,
      cwd,
    });

    expect(runResult.status).not.toBe(0);
    expect(runResult.stderr).toMatch(/API key|OPENAI_API_KEY/i);
  } finally {
    tempPo.cleanup();
  }
});
