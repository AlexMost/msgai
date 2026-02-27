import { test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { getTmpPo } from '../test-utils/getTmpPo';
import { runTranslate } from '../../src/cli/runTranslate';

function apiError(
  status: number,
  code?: string,
  message?: string,
): Error & { status: number; code?: string } {
  const err = new Error(message ?? `API error ${status}`) as Error & {
    status: number;
    code?: string;
  };
  err.status = status;
  if (code !== undefined) err.code = code;
  return err;
}

const mockState: { errorToThrow: unknown } = { errorToThrow: null };

jest.mock('../../src/translate', () => {
  const actual = jest.requireActual<typeof import('../../src/translate')>('../../src/translate');
  return {
    ...actual,
    translateStrings: async (...args: unknown[]) => {
      if (mockState.errorToThrow) throw mockState.errorToThrow;
      return (actual.translateStrings as (...a: unknown[]) => Promise<unknown>).apply(actual, args);
    },
  };
});

let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

beforeEach(() => {
  mockState.errorToThrow = null;
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

test('runTranslate shows 401 message when API returns 401', async () => {
  mockState.errorToThrow = apiError(401);
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  try {
    const code = await runTranslate(tempPo.poFilePath, 'fake-key');
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or missing API key'),
    );
    expect(consoleErrorSpy.mock.calls[0][0]).toContain('OPENAI_API_KEY');
  } finally {
    tempPo.cleanup();
  }
});

test('runTranslate shows 403 message when API returns 403', async () => {
  mockState.errorToThrow = apiError(403);
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  try {
    const code = await runTranslate(tempPo.poFilePath, 'fake-key');
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('country/region'));
  } finally {
    tempPo.cleanup();
  }
});

test('runTranslate shows quota message when API returns 429 with insufficient_quota', async () => {
  mockState.errorToThrow = apiError(429, 'insufficient_quota');
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  try {
    const code = await runTranslate(tempPo.poFilePath, 'fake-key');
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Quota exceeded'));
    expect(consoleErrorSpy.mock.calls[0][0]).toContain('billing');
  } finally {
    tempPo.cleanup();
  }
});

test('runTranslate shows quota message when 429 response message contains quota', async () => {
  mockState.errorToThrow = apiError(429, undefined, 'You exceeded your current quota');
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  try {
    const code = await runTranslate(tempPo.poFilePath, 'fake-key');
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Quota exceeded'));
  } finally {
    tempPo.cleanup();
  }
});

test('runTranslate shows rate limit message when API returns 429 without quota', async () => {
  mockState.errorToThrow = apiError(429, undefined, 'Rate limit reached for requests');
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  try {
    const code = await runTranslate(tempPo.poFilePath, 'fake-key');
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Rate limit reached'));
  } finally {
    tempPo.cleanup();
  }
});

test('runTranslate shows 500 message when API returns 500', async () => {
  mockState.errorToThrow = apiError(500);
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  try {
    const code = await runTranslate(tempPo.poFilePath, 'fake-key');
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('OpenAI server error'));
  } finally {
    tempPo.cleanup();
  }
});

test('runTranslate shows 503 message when API returns 503', async () => {
  mockState.errorToThrow = apiError(503);
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  try {
    const code = await runTranslate(tempPo.poFilePath, 'fake-key');
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('OpenAI overloaded'));
  } finally {
    tempPo.cleanup();
  }
});

test('runTranslate shows generic message for non-API error', async () => {
  mockState.errorToThrow = new Error('Network connection failed');
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  try {
    const code = await runTranslate(tempPo.poFilePath, 'fake-key');
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to process PO file'),
    );
    expect(consoleErrorSpy.mock.calls[0][0]).toContain('Network connection failed');
  } finally {
    tempPo.cleanup();
  }
});
