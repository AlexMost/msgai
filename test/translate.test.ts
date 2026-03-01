import { test, expect, jest } from '@jest/globals';
import type OpenAI from 'openai';
import { translateStrings, translateItems, translatePayload } from '../src/translate';

const mockCompletion = (content: string) => ({
  id: 'test',
  object: 'chat.completion',
  created: 0,
  model: 'gpt-4o-mini',
  choices: [
    { index: 0, message: { role: 'assistant' as const, content }, finish_reason: 'stop' as const },
  ],
});

test('translatePayload sends request with msgid only and receives response with msgstr', async () => {
  const payload = {
    formula:
      'nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);',
    target_language: 'uk',
    source_language: 'en',
    translations: [{ msgid: 'Hello' }, { msgid: 'World' }],
  };
  const responsePayload = {
    translations: [
      { msgid: 'Hello', msgstr: 'Привіт' },
      { msgid: 'World', msgstr: 'Світ' },
    ],
  };
  const createMock = jest
    .fn<(params: unknown) => Promise<unknown>>()
    .mockResolvedValue(mockCompletion(JSON.stringify(responsePayload)));
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  const result = await translatePayload(payload, { apiKey: 'test-key', client: mockClient });

  expect(result).toEqual(responsePayload);
  expect(createMock).toHaveBeenCalledTimes(1);
  type CreateParams = {
    model: string;
    temperature?: number;
    response_format?: {
      type: string;
      json_schema?: { name?: string; strict?: boolean; schema?: { type?: string } };
    };
    messages: Array<{ role: string; content?: string }>;
  };
  const params = createMock.mock.calls[0]?.[0] as CreateParams;
  expect(params.temperature).toBe(0);
  expect(params.response_format).toMatchObject({
    type: 'json_schema',
    json_schema: {
      name: 'translation_payload',
      strict: true,
      schema: { type: 'object' },
    },
  });
  expect(params.messages![0].content as string).toContain('target_language');
  expect(params.messages![0].content as string).toMatch(/msgid|msgid_plural/);
  const userJson = JSON.parse(params.messages![1].content as string);
  expect(userJson.translations).toHaveLength(2);
  expect(userJson.translations[0]).toEqual({ msgid: 'Hello' });
  expect(userJson.translations[1]).toEqual({ msgid: 'World' });
});

test('translateStrings with singular entries uses msgid and returns entries with msgstr', async () => {
  const responsePayload = {
    translations: [{ msgid: 'Hello', msgstr: 'Привіт' }],
  };
  const createMock = jest
    .fn<(params: unknown) => Promise<unknown>>()
    .mockResolvedValue(mockCompletion(JSON.stringify(responsePayload)));
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  const result = await translateStrings([{ msgid: 'Hello' }], 'uk', {
    apiKey: 'test-key',
    client: mockClient,
  });

  expect(result).toEqual([{ msgid: 'Hello', msgstr: 'Привіт' }]);
  const userJson = JSON.parse(
    (createMock.mock.calls[0]?.[0] as { messages: Array<{ content?: string }> }).messages![1]
      .content as string,
  );
  expect(userJson.translations).toEqual([{ msgid: 'Hello' }]);
});

test('translateStrings with plural entries uses msgid_plural and returns entries with msgstr array', async () => {
  const responsePayload = {
    translations: [
      { msgid_plural: 'Hello', msgstr: ['Привіт'] },
      { msgid_plural: 'World', msgstr: ['Світ'] },
    ],
  };
  const createMock = jest
    .fn<(params: unknown) => Promise<unknown>>()
    .mockResolvedValue(mockCompletion(JSON.stringify(responsePayload)));
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  const result = await translateStrings(
    [
      { msgid: 'Hello', msgid_plural: 'Hello' },
      { msgid: 'World', msgid_plural: 'World' },
    ],
    'uk',
    { apiKey: 'test-key', client: mockClient },
  );

  expect(result).toEqual([
    { msgid: 'Hello', msgid_plural: 'Hello', msgstr: ['Привіт'] },
    { msgid: 'World', msgid_plural: 'World', msgstr: ['Світ'] },
  ]);
  const userJson = JSON.parse(
    (createMock.mock.calls[0]?.[0] as { messages: Array<{ content?: string }> }).messages![1]
      .content as string,
  );
  expect(userJson.translations).toEqual([{ msgid_plural: 'Hello' }, { msgid_plural: 'World' }]);
  expect(userJson.target_language).toBe('uk');
});

test('translateStrings returns empty array for empty entries', async () => {
  const createMock = jest.fn();
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  const result = await translateStrings([], 'uk', { apiKey: 'test-key', client: mockClient });

  expect(result).toEqual([]);
  expect(createMock).not.toHaveBeenCalled();
});

test('translatePayload accepts omitted msgctxt in response when request context is empty string', async () => {
  const createMock = jest
    .fn<(params: unknown) => Promise<unknown>>()
    .mockResolvedValue(
      mockCompletion(JSON.stringify({ translations: [{ msgid: 'Hello', msgstr: 'Привіт' }] })),
    );
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  const result = await translatePayload(
    {
      formula: '',
      target_language: 'uk',
      source_language: 'en',
      translations: [{ msgid: 'Hello', msgctxt: '' }],
    },
    { apiKey: 'test-key', client: mockClient },
  );

  expect(result.translations).toEqual([{ msgid: 'Hello', msgstr: 'Привіт' }]);
});

test('translatePayload accepts empty-string msgctxt in response when request context is omitted', async () => {
  const createMock = jest.fn<(params: unknown) => Promise<unknown>>().mockResolvedValue(
    mockCompletion(
      JSON.stringify({
        translations: [{ msgid: 'Hello', msgctxt: '', msgstr: 'Привіт' }],
      }),
    ),
  );
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  const result = await translatePayload(
    {
      formula: '',
      target_language: 'uk',
      source_language: 'en',
      translations: [{ msgid: 'Hello' }],
    },
    { apiKey: 'test-key', client: mockClient },
  );

  expect(result.translations).toEqual([{ msgid: 'Hello', msgctxt: '', msgstr: 'Привіт' }]);
});

test('translatePayload mismatch error tells user to retry and rerun with debug', async () => {
  const createMock = jest.fn<(params: unknown) => Promise<unknown>>().mockResolvedValue(
    mockCompletion(
      JSON.stringify({
        translations: [{ msgid: 'Hello', msgctxt: 'auth', msgstr: 'Привіт' }],
      }),
    ),
  );
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  await expect(
    translatePayload(
      {
        formula: '',
        target_language: 'uk',
        source_language: 'en',
        translations: [{ msgid: 'Hello' }],
      },
      { apiKey: 'test-key', client: mockClient },
    ),
  ).rejects.toThrow(/Retry the command once/i);

  await expect(
    translatePayload(
      {
        formula: '',
        target_language: 'uk',
        source_language: 'en',
        translations: [{ msgid: 'Hello' }],
      },
      { apiKey: 'test-key', client: mockClient },
    ),
  ).rejects.toThrow(/--debug/i);
});

test('translateStrings throws when response is not valid JSON', async () => {
  const createMock = jest
    .fn<(params: unknown) => Promise<unknown>>()
    .mockResolvedValue(mockCompletion('Not JSON at all'));
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  await expect(
    translatePayload(
      {
        formula: '',
        target_language: 'uk',
        source_language: 'en',
        translations: [{ msgid: 'Hi' }],
      },
      { apiKey: 'test-key', client: mockClient },
    ),
  ).rejects.toThrow(/not valid JSON/i);
});

test('translatePayload throws when response missing translations', async () => {
  const createMock = jest
    .fn<(params: unknown) => Promise<unknown>>()
    .mockResolvedValue(mockCompletion(JSON.stringify({ wrong: 'key' })));
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  await expect(
    translatePayload(
      {
        formula: '',
        target_language: 'uk',
        source_language: 'en',
        translations: [{ msgid: 'Hi' }],
      },
      { apiKey: 'test-key', client: mockClient },
    ),
  ).rejects.toThrow(/translations/i);
});

test('translatePayload rejects unsupported models before calling OpenAI', async () => {
  const createMock = jest.fn<(params: unknown) => Promise<unknown>>();
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  await expect(
    translatePayload(
      {
        formula: '',
        target_language: 'uk',
        source_language: 'en',
        translations: [{ msgid: 'Hi' }],
      },
      { apiKey: 'test-key', client: mockClient, model: 'gpt-4-turbo' },
    ),
  ).rejects.toThrow(/json_schema structured outputs|supported models/i);

  expect(createMock).not.toHaveBeenCalled();
});

test('translatePayload allows supported GPT-5 structured-output models', async () => {
  const createMock = jest
    .fn<(params: unknown) => Promise<unknown>>()
    .mockResolvedValue(
      mockCompletion(JSON.stringify({ translations: [{ msgid: 'Hi', msgstr: 'Привіт' }] })),
    );
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  const result = await translatePayload(
    {
      formula: '',
      target_language: 'uk',
      source_language: 'en',
      translations: [{ msgid: 'Hi' }],
    },
    { apiKey: 'test-key', client: mockClient, model: 'gpt-5.2' },
  );

  expect(result.translations[0]?.msgstr).toBe('Привіт');
  expect(createMock).toHaveBeenCalledTimes(1);
});

test('translatePayload rejects GPT-5.2 models without structured outputs support', async () => {
  const createMock = jest.fn<(params: unknown) => Promise<unknown>>();
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  await expect(
    translatePayload(
      {
        formula: '',
        target_language: 'uk',
        source_language: 'en',
        translations: [{ msgid: 'Hi' }],
      },
      { apiKey: 'test-key', client: mockClient, model: 'gpt-5.2-pro' },
    ),
  ).rejects.toThrow(/not supported/i);

  expect(createMock).not.toHaveBeenCalled();
});

test('translateItems sends items and returns translated strings in same order', async () => {
  const responsePayload = {
    translations: [
      { msgid: 'Hello', msgstr: 'Привіт' },
      { msgid: 'World', msgstr: 'Світ' },
    ],
  };
  const createMock = jest
    .fn<(params: unknown) => Promise<unknown>>()
    .mockResolvedValue(mockCompletion(JSON.stringify(responsePayload)));
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  const result = await translateItems([{ msgid: 'Hello' }, { msgid: 'World' }], 'uk', {
    apiKey: 'test-key',
    client: mockClient,
  });

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
    translations: [
      { msgid: 'Hello', msgstr: 'Привіт' },
      { msgid_plural: '%d items', msgstr: ['%d елемент', '%d елементи', '%d елементів'] },
    ],
  };
  const createMock = jest
    .fn<(params: unknown) => Promise<unknown>>()
    .mockResolvedValue(mockCompletion(JSON.stringify(responsePayload)));
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  const result = await translatePayload(payload, { apiKey: 'test-key', client: mockClient });

  expect(result.translations[0].msgstr).toBe('Привіт');
  expect(result.translations[1].msgstr).toEqual(['%d елемент', '%d елементи', '%d елементів']);
  const userJson = JSON.parse(
    (createMock.mock.calls[0]?.[0] as { messages: Array<{ content?: string }> }).messages![1]
      .content as string,
  );
  expect(userJson.translations[1]).toEqual({ msgid_plural: '%d items' });
});

test('translatePayload with plural_samples includes them in user message and system message describes sample counts', async () => {
  const pluralSamples = [
    { plural: 0, sample: 1 },
    { plural: 1, sample: 2 },
    { plural: 2, sample: 5 },
  ];
  const payload = {
    formula: 'nplurals=3; plural=...',
    target_language: 'uk',
    source_language: 'en',
    translations: [{ msgid_plural: '%d items' }],
    plural_samples: pluralSamples,
  };
  const responsePayload = {
    translations: [
      { msgid_plural: '%d items', msgstr: ['%d елемент', '%d елементи', '%d елементів'] },
    ],
  };
  const createMock = jest
    .fn<(params: unknown) => Promise<unknown>>()
    .mockResolvedValue(mockCompletion(JSON.stringify(responsePayload)));
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  await translatePayload(payload, { apiKey: 'test-key', client: mockClient });

  type CreateParams = {
    response_format?: { type: string; json_schema?: { name?: string } };
    messages: Array<{ role: string; content?: string }>;
  };
  const params = createMock.mock.calls[0]?.[0] as CreateParams;
  const userJson = JSON.parse(params.messages![1].content as string);
  expect(userJson.plural_samples).toEqual(pluralSamples);
  expect(params.response_format).toMatchObject({
    type: 'json_schema',
    json_schema: { name: 'translation_payload' },
  });
  expect(params.messages![0].content as string).toMatch(/plural_samples|sample/);
});

test('translateStrings with pluralSamples option passes plural_samples in payload to LLM', async () => {
  const pluralSamples = [
    { plural: 0, sample: 1 },
    { plural: 1, sample: 2 },
    { plural: 2, sample: 5 },
  ];
  const responsePayload = {
    translations: [{ msgid_plural: '%d banana', msgstr: ['%d банан', '%d банана', '%d бананів'] }],
  };
  const createMock = jest
    .fn<(params: unknown) => Promise<unknown>>()
    .mockResolvedValue(mockCompletion(JSON.stringify(responsePayload)));
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  await translateStrings([{ msgid: '1 banana', msgid_plural: '%d banana' }], 'uk', {
    apiKey: 'test-key',
    client: mockClient,
    pluralSamples,
  });

  type CreateParams = { messages: Array<{ content?: string }> };
  const params = createMock.mock.calls[0]?.[0] as CreateParams;
  const userJson = JSON.parse(params.messages![1].content as string);
  expect(userJson.plural_samples).toEqual(pluralSamples);
});

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

test('translatePayload retries on 429 then succeeds', async () => {
  const responsePayload = {
    translations: [{ msgid: 'Hi', msgstr: 'Привіт' }],
  };
  const createMock = jest
    .fn<(params: unknown) => Promise<unknown>>()
    .mockRejectedValueOnce(apiError(429))
    .mockResolvedValueOnce(mockCompletion(JSON.stringify(responsePayload)));
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  const result = await translatePayload(
    { formula: '', target_language: 'uk', source_language: 'en', translations: [{ msgid: 'Hi' }] },
    { apiKey: 'test-key', client: mockClient },
  );

  expect(result.translations[0].msgstr).toBe('Привіт');
  expect(createMock).toHaveBeenCalledTimes(2);
});

test('translatePayload retries up to 4 times on 429 then rethrows', async () => {
  const createMock = jest
    .fn<(params: unknown) => Promise<unknown>>()
    .mockRejectedValue(apiError(429));
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  await expect(
    translatePayload(
      {
        formula: '',
        target_language: 'uk',
        source_language: 'en',
        translations: [{ msgid: 'Hi' }],
      },
      { apiKey: 'test-key', client: mockClient },
    ),
  ).rejects.toMatchObject({ status: 429 });

  expect(createMock).toHaveBeenCalledTimes(4);
}, 15000);

test('translatePayload does not retry on 401', async () => {
  const createMock = jest
    .fn<(params: unknown) => Promise<unknown>>()
    .mockRejectedValue(apiError(401));
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  await expect(
    translatePayload(
      {
        formula: '',
        target_language: 'uk',
        source_language: 'en',
        translations: [{ msgid: 'Hi' }],
      },
      { apiKey: 'test-key', client: mockClient },
    ),
  ).rejects.toMatchObject({ status: 401 });

  expect(createMock).toHaveBeenCalledTimes(1);
});

test('translatePayload does not retry on 403', async () => {
  const createMock = jest
    .fn<(params: unknown) => Promise<unknown>>()
    .mockRejectedValue(apiError(403));
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  await expect(
    translatePayload(
      {
        formula: '',
        target_language: 'uk',
        source_language: 'en',
        translations: [{ msgid: 'Hi' }],
      },
      { apiKey: 'test-key', client: mockClient },
    ),
  ).rejects.toMatchObject({ status: 403 });

  expect(createMock).toHaveBeenCalledTimes(1);
});

test('translatePayload throws when plural msgstr length does not match plural_samples length', async () => {
  const payload = {
    formula: 'nplurals=3; plural=...',
    target_language: 'uk',
    source_language: 'en',
    translations: [{ msgid_plural: '%d items' }],
    plural_samples: [
      { plural: 0, sample: 1 },
      { plural: 1, sample: 2 },
      { plural: 2, sample: 5 },
    ],
  };
  const createMock = jest.fn<(params: unknown) => Promise<unknown>>().mockResolvedValue(
    mockCompletion(
      JSON.stringify({
        translations: [{ msgid_plural: '%d items', msgstr: ['%d елемент', '%d елементи'] }],
      }),
    ),
  );
  const mockClient = { chat: { completions: { create: createMock } } } as unknown as OpenAI;

  await expect(
    translatePayload(payload, { apiKey: 'test-key', client: mockClient }),
  ).rejects.toThrow(/length 3/i);
});
