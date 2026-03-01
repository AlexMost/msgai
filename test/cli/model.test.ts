import { test, expect, jest, beforeEach } from '@jest/globals';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getTmpPo } from '../test-utils/getTmpPo';
import { runTranslate } from '../../src/cli/runTranslate';
import { translateStrings } from '../../src/translate';

jest.mock('../../src/translate', () => {
  const actual = jest.requireActual<typeof import('../../src/translate')>('../../src/translate');
  return {
    ...actual,
    translateStrings: jest.fn(),
  };
});

const translateStringsMock = jest.mocked(translateStrings);

beforeEach(() => {
  translateStringsMock.mockReset();
});

test('CLI exits with error when --model is invalid', () => {
  const cliPath = path.resolve(process.cwd(), 'dist/src/cli/index.js');
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  const runResult = spawnSync(
    process.execPath,
    [cliPath, tempPo.poFilePath, '--dry-run', '--model=not-a-real-model'],
    { encoding: 'utf8' },
  );

  tempPo.cleanup();

  expect(runResult.status).toBe(1);
  expect(runResult.stderr).toContain('Invalid --model "not-a-real-model"');
  expect(runResult.stderr).toMatch(/Supported model families/i);
});

test('runTranslate forwards model to translateStrings', async () => {
  translateStringsMock.mockResolvedValue([{ msgid: 'Hello', msgstr: 'Привіт' }]);
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  try {
    const code = await runTranslate(tempPo.poFilePath, 'fake-key', 'en', 'gpt-4.1-mini');

    expect(code).toBe(0);
    expect(translateStringsMock).toHaveBeenCalledWith(
      [{ msgid: 'Hello', msgctxt: '' }],
      'uk',
      expect.objectContaining({
        apiKey: 'fake-key',
        sourceLanguage: 'en',
        model: 'gpt-4.1-mini',
      }),
    );
  } finally {
    tempPo.cleanup();
  }
});
