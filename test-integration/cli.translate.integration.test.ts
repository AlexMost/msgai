import { test, expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { getTmpPo } from '../test/test-utils/getTmpPo';

test('CLI without --dry-run calls OpenAI and updates .po file with translated strings', () => {
  const cliPath = path.resolve(process.cwd(), 'dist/src/cli.js');
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  try {
    const runResult = spawnSync(process.execPath, [cliPath, tempPo.poFilePath], {
      encoding: 'utf8',
    });

    expect(runResult.status).toBe(0);
    if (runResult.stderr) {
      console.error(runResult.stderr);
    }

    const content = fs.readFileSync(tempPo.poFilePath, 'utf8');
    // Real API: we only assert the previously empty msgstr was filled (exact text may vary)
    expect(content).not.toMatch(/msgid "Hello"\s*\nmsgstr ""\s*$/m);
    const msgstrMatch = content.match(/msgid "Hello"\s*\nmsgstr "([^"]*)"/);
    expect(msgstrMatch).not.toBeNull();
    expect(msgstrMatch![1].trim()).not.toBe('');
  } finally {
    tempPo.cleanup();
  }
});

test('CLI without --dry-run exits with error when OPENAI_API_KEY is not set', () => {
  const cliPath = path.resolve(process.cwd(), 'dist/src/cli.js');
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
