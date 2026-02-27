import { test, expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from '../src/loadEnv';
import { getTmpPo } from '../test/test-utils/getTmpPo';

loadEnv();

/** Log CLI stderr/stdout when exit code is non-zero so failures show the real error. */
function logCliOutputIfFailed(runResult: { status: number | null; stderr?: string; stdout?: string }): void {
  if (runResult.status !== 0) {
    if (runResult.stderr) console.warn('CLI stderr:', runResult.stderr);
    if (runResult.stdout) console.warn('CLI stdout:', runResult.stdout);
  }
}

/** API key for integration tests that call OpenAI. From OPENAI_API_KEY env or .env (loaded above). */
const apiKey = process.env['OPENAI_API_KEY'];

test('CLI without --dry-run calls OpenAI and updates .po file with translated strings', () => {
  if (!apiKey) {
    console.warn('Skipping: OPENAI_API_KEY not set');
    return;
  }
  const cliPath = path.resolve(process.cwd(), 'dist/src/cli/index.js');
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  try {
    const runResult = spawnSync(
      process.execPath,
      [cliPath, tempPo.poFilePath, '--api-key', apiKey, '--source-lang=en'],
      {
        encoding: 'utf8',
      },
    );

    logCliOutputIfFailed(runResult);
    expect(runResult.status).toBe(0);

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

test('CLI with Ukrainian plural entry translates to 3 forms (1 банан, 2 банана, 5 бананів)', () => {
  if (!apiKey) {
    console.warn('Skipping: OPENAI_API_KEY not set');
    return;
  }
  const cliPath = path.resolve(process.cwd(), 'dist/src/cli/index.js');
  const tempPo = getTmpPo(`
msgid "\${ n } banana"
msgid_plural "\${ n } banana"
msgstr[0] ""
msgstr[1] ""
msgstr[2] ""
`);

  try {
    const runResult = spawnSync(
      process.execPath,
      [cliPath, tempPo.poFilePath, '--api-key', apiKey, '--source-lang=en'],
      {
        encoding: 'utf8',
      },
    );

    logCliOutputIfFailed(runResult);
    expect(runResult.status).toBe(0);

    const content = fs.readFileSync(tempPo.poFilePath, 'utf8');

    // Ukrainian plural forms for banana (1 банан, 2 банана/банани, 5 бананів)
    expect(content).toContain('msgstr[0] "${ n } банан"');
    expect(content).toContain('msgstr[1] "${ n } банани"');
    expect(content).toContain('msgstr[2] "${ n } бананів"');
  } finally {
    tempPo.cleanup();
  }
});
