import { test, expect, jest, beforeEach } from '@jest/globals';
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

test('runTranslate forwards debug flag to translateStrings', async () => {
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
      undefined,
      true,
    );

    expect(code).toBe(0);
    expect(translateStringsMock).toHaveBeenCalledWith(
      [{ msgid: 'Hello', msgctxt: '' }],
      'uk',
      expect.objectContaining({
        apiKey: 'fake-key',
        sourceLanguage: 'en',
        debug: true,
      }),
    );
  } finally {
    tempPo.cleanup();
  }
});
