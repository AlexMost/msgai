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

test('translatePayload sends and receives full payload format', async () => {
  const payload = {
    formula: 'nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);',
    target_language: 'uk',
    source_language: 'en',
    translations: [
      { msgid: 'Hello', msgstr: '' },
      { msgid: 'World', msgstr: '' },
    ],
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
  expect(params.messages).toHaveLength(2);
  expect((params.messages![0].content as string)).toContain('target_language');
  expect((params.messages![0].content as string)).toContain('msgstr');
  const userJson = JSON.parse(params.messages![1].content as string);
  expect(userJson.formula).toBe(payload.formula);
  expect(userJson.target_language).toBe('uk');
  expect(userJson.source_language).toBe('en');
  expect(userJson.translations).toHaveLength(2);
  expect(userJson.translations[0]).toEqual({ msgid: 'Hello', msgstr: '' });
  expect(userJson.translations[1]).toEqual({ msgid: 'World', msgstr: '' });
});

test('translateStrings sends payload shape and returns parsed strings', async () => {
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

  const result = await translateStrings(['Hello', 'World'], 'uk', {
    apiKey: 'test-key',
    client: mockClient,
  });

  expect(result).toEqual(['Привіт', 'Світ']);
  const userJson = JSON.parse((createMock.mock.calls[0]?.[0] as { messages: Array<{ content?: string }> }).messages![1].content as string);
  expect(userJson.translations).toEqual([{ msgid: 'Hello', msgstr: '' }, { msgid: 'World', msgstr: '' }]);
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
      { formula: '', target_language: 'uk', source_language: 'en', translations: [{ msgid: 'Hi', msgstr: '' }] },
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
      { formula: '', target_language: 'uk', source_language: 'en', translations: [{ msgid: 'Hi', msgstr: '' }] },
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
  expect(userJson.translations).toEqual([
    { msgid: 'Hello', msgstr: '' },
    { msgid: 'World', msgstr: '' },
  ]);
});
