import { test, expect, jest } from '@jest/globals';
import type OpenAI from 'openai';
import { translateStrings, translateItems, translatePayload } from '../src/translate';

const mockCompletion = (content: string) => ({
  id: 'test',
  object: 'chat.completion',
  created: 0,
  model: 'gpt-4o-mini',
  choices: [{ index: 0, message: { role: 'assistant' as const, content }, finish_reason: 'stop' as const }],
});

test('translatePayload sends request with msgid only and receives response with msgstr', async () => {
  const payload = {
    formula: 'nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);',
    target_language: 'uk',
    source_language: 'en',
    translations: [{ msgid: 'Hello' }, { msgid: 'World' }],
  };
  const responsePayload = {
    ...payload,
    translations: [
      { msgid: 'Hello', msgstr: 'Привіт' },
      { msgid: 'World', msgstr: 'Світ' },
    ],
  };
  const createMock = jest.fn<(params: unknown) => Promise<unknown>>().mockResolvedValue(
    mockCompletion(JSON.stringify(responsePayload))
  );
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  const result = await translatePayload(payload, { apiKey: 'test-key', client: mockClient });

  expect(result).toEqual(responsePayload);
  expect(createMock).toHaveBeenCalledTimes(1);
  type CreateParams = { model: string; messages: Array<{ role: string; content?: string }> };
  const params = createMock.mock.calls[0]?.[0] as CreateParams;
  expect((params.messages![0].content as string)).toContain('target_language');
  expect((params.messages![0].content as string)).toMatch(/msgid|msgid_plural/);
  const userJson = JSON.parse(params.messages![1].content as string);
  expect(userJson.translations).toHaveLength(2);
  expect(userJson.translations[0]).toEqual({ msgid: 'Hello' });
  expect(userJson.translations[1]).toEqual({ msgid: 'World' });
});

test('translateStrings with string uses msgid and returns string', async () => {
  const responsePayload = {
    formula: '',
    target_language: 'uk',
    source_language: 'en',
    translations: [{ msgid: 'Hello', msgstr: 'Привіт' }],
  };
  const createMock = jest.fn<(params: unknown) => Promise<unknown>>().mockResolvedValue(
    mockCompletion(JSON.stringify(responsePayload))
  );
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  const result = await translateStrings('Hello', 'uk', { apiKey: 'test-key', client: mockClient });

  expect(result).toBe('Привіт');
  const userJson = JSON.parse((createMock.mock.calls[0]?.[0] as { messages: Array<{ content?: string }> }).messages![1].content as string);
  expect(userJson.translations).toEqual([{ msgid: 'Hello' }]);
});

test('translateStrings with string[] uses msgid_plural and returns string[]', async () => {
  const responsePayload = {
    formula: '',
    target_language: 'uk',
    source_language: 'en',
    translations: [
      { msgid_plural: 'Hello', msgstr: 'Привіт' },
      { msgid_plural: 'World', msgstr: 'Світ' },
    ],
  };
  const createMock = jest.fn<(params: unknown) => Promise<unknown>>().mockResolvedValue(
    mockCompletion(JSON.stringify(responsePayload))
  );
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  const result = await translateStrings(['Hello', 'World'], 'uk', {
    apiKey: 'test-key',
    client: mockClient,
  });

  expect(result).toEqual(['Привіт', 'Світ']);
  const userJson = JSON.parse((createMock.mock.calls[0]?.[0] as { messages: Array<{ content?: string }> }).messages![1].content as string);
  expect(userJson.translations).toEqual([{ msgid_plural: 'Hello' }, { msgid_plural: 'World' }]);
  expect(userJson.target_language).toBe('uk');
});

test('translateStrings returns empty array for empty input', async () => {
  const createMock = jest.fn();
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  const result = await translateStrings([], 'uk', { apiKey: 'test-key', client: mockClient });

  expect(result).toEqual([]);
  expect(createMock).not.toHaveBeenCalled();
});

test('translateStrings throws when response is not valid JSON', async () => {
  const createMock = jest.fn<(params: unknown) => Promise<unknown>>().mockResolvedValue(
    mockCompletion('Not JSON at all')
  );
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  await expect(
    translatePayload(
      { formula: '', target_language: 'uk', source_language: 'en', translations: [{ msgid: 'Hi' }] },
      { apiKey: 'test-key', client: mockClient }
    )
  ).rejects.toThrow(/not valid JSON/i);
});

test('translatePayload throws when response missing translations', async () => {
  const createMock = jest.fn<(params: unknown) => Promise<unknown>>().mockResolvedValue(
    mockCompletion(JSON.stringify({ wrong: 'key' }))
  );
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  await expect(
    translatePayload(
      { formula: '', target_language: 'uk', source_language: 'en', translations: [{ msgid: 'Hi' }] },
      { apiKey: 'test-key', client: mockClient }
    )
  ).rejects.toThrow(/translations/i);
});

test('translateItems sends items and returns translated strings in same order', async () => {
  const responsePayload = {
    formula: '',
    target_language: 'uk',
    source_language: 'en',
    translations: [
      { msgid: 'Hello', msgstr: 'Привіт' },
      { msgid: 'World', msgstr: 'Світ' },
    ],
  };
  const createMock = jest.fn<(params: unknown) => Promise<unknown>>().mockResolvedValue(
    mockCompletion(JSON.stringify(responsePayload))
  );
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  const result = await translateItems(
    [{ msgid: 'Hello' }, { msgid: 'World' }],
    'uk',
    { apiKey: 'test-key', client: mockClient }
  );

  expect(result).toEqual(['Привіт', 'Світ']);
  type CreateParams = { model: string; messages: Array<{ role: string; content?: string }> };
  const params = createMock.mock.calls[0]?.[0] as CreateParams;
  const userJson = JSON.parse(params.messages![1].content as string);
  expect(userJson.translations).toEqual([{ msgid: 'Hello' }, { msgid: 'World' }]);
});

test('translatePayload request with msgid_plural: response msgstr is array', async () => {
  const payload = {
    formula: 'nplurals=3; plural=...',
    target_language: 'uk',
    source_language: 'en',
    translations: [{ msgid: 'Hello' }, { msgid_plural: '%d items' }],
  };
  const responsePayload = {
    ...payload,
    translations: [
      { msgid: 'Hello', msgstr: 'Привіт' },
      { msgid_plural: '%d items', msgstr: ['%d елемент', '%d елементи', '%d елементів'] },
    ],
  };
  const createMock = jest.fn<(params: unknown) => Promise<unknown>>().mockResolvedValue(
    mockCompletion(JSON.stringify(responsePayload))
  );
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  const result = await translatePayload(payload, { apiKey: 'test-key', client: mockClient });

  expect(result.translations[0].msgstr).toBe('Привіт');
  expect(result.translations[1].msgstr).toEqual(['%d елемент', '%d елементи', '%d елементів']);
  const userJson = JSON.parse((createMock.mock.calls[0]?.[0] as { messages: Array<{ content?: string }> }).messages![1].content as string);
  expect(userJson.translations[1]).toEqual({ msgid_plural: '%d items' });
});
