import { test, expect, jest, beforeEach } from '@jest/globals';
import fs from 'node:fs';
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

test('runTranslate always writes "# ai-translated" comment for translated entries', async () => {
  translateStringsMock.mockResolvedValue([{ msgid: 'Hello', msgstr: 'Привіт' }]);
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  try {
    const code = await runTranslate(tempPo.poFilePath, 'fake-key', 'en');
    expect(code).toBe(0);

    const content = fs.readFileSync(tempPo.poFilePath, 'utf8');
    expect(content).toContain('# ai-translated');
    expect(content).toContain('msgstr "Привіт"');
    expect(content).not.toMatch(/#,\s*fuzzy/);
  } finally {
    tempPo.cleanup();
  }
});

test('runTranslate with addFuzzy=true marks translated entries as fuzzy', async () => {
  translateStringsMock.mockResolvedValue([{ msgid: 'Hello', msgstr: 'Привіт' }]);
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  try {
    const code = await runTranslate(
      tempPo.poFilePath,
      'fake-key',
      'en',
      undefined,
      undefined,
      true,
    );
    expect(code).toBe(0);

    const content = fs.readFileSync(tempPo.poFilePath, 'utf8');
    expect(content).toContain('# ai-translated');
    expect(content).toMatch(/#,\s*fuzzy/);
  } finally {
    tempPo.cleanup();
  }
});
