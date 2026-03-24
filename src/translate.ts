import OpenAI from 'openai';
import { getDebugLogger, initDebugLogger } from './debug';
import { loadEnv } from './loadEnv';

export function resolveApiKey(apiKey?: string): string {
  loadEnv();
  if (apiKey != null && apiKey.trim() !== '') return apiKey;
  const env = process.env['OPENAI_API_KEY'];
  if (env != null && env.trim() !== '') return env;
  throw new Error(
    'OpenAI API key not set. Set OPENAI_API_KEY in the environment or pass apiKey in options.',
  );
}

export type TranslateOptions = {
  apiKey: string;
  client?: OpenAI;
  model?: string;
  debug?: boolean;
  context?: string;
};

const DEFAULT_MODEL = 'gpt-5.4';
/** Error codes: https://developers.openai.com/api/docs/guides/error-codes#api-errors */

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isApiError(err: unknown): err is { status: number; code?: string; message?: string } {
  return (
    err != null &&
    typeof err === 'object' &&
    'status' in err &&
    typeof (err as { status: unknown }).status === 'number'
  );
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 503;
}

/** Request entry: either singular (msgid) or plural (msgid_plural). Optional msgctxt for gettext context. */
export type TranslateRequestEntry =
  | { msgid: string; msgctxt?: string }
  | { msgid_plural: string; msgctxt?: string };

/** Response entry: same keys as request plus msgstr. For msgid → msgstr is string; for msgid_plural → msgstr is string[]. */
export type TranslateResponseEntry =
  | { msgid: string; msgstr: string; msgctxt?: string }
  | { msgid_plural: string; msgstr: string[]; msgctxt?: string };

/** Request payload: translations have only msgid or msgid_plural, no msgstr. */
export type TranslatePayloadRequest = {
  formula: string;
  target_language: string;
  source_language: string;
  translations: TranslateRequestEntry[];
  /** Optional: sample counts per plural form (e.g. [{plural:0,sample:1},{plural:1,sample:2},{plural:2,sample:5}] for Ukrainian). */
  plural_samples?: { plural: number; sample: number }[];
};

/** Response payload: translations have msgstr filled. */
export type TranslatePayloadResponse = {
  translations: TranslateResponseEntry[];
};

const TRANSLATION_RESPONSE_SCHEMA = {
  name: 'translation_payload',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['translations'],
    properties: {
      translations: {
        type: 'array',
        items: {
          anyOf: [
            {
              type: 'object',
              additionalProperties: false,
              required: ['msgid', 'msgstr'],
              properties: {
                msgid: { type: 'string' },
                msgstr: { type: 'string' },
              },
            },
            {
              type: 'object',
              additionalProperties: false,
              required: ['msgid', 'msgctxt', 'msgstr'],
              properties: {
                msgid: { type: 'string' },
                msgctxt: { type: 'string' },
                msgstr: { type: 'string' },
              },
            },
            {
              type: 'object',
              additionalProperties: false,
              required: ['msgid_plural', 'msgstr'],
              properties: {
                msgid_plural: { type: 'string' },
                msgstr: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
            {
              type: 'object',
              additionalProperties: false,
              required: ['msgid_plural', 'msgctxt', 'msgstr'],
              properties: {
                msgid_plural: { type: 'string' },
                msgctxt: { type: 'string' },
                msgstr: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
          ],
        },
      },
    },
  },
} as const;

export function buildSystemMessage(context?: string): string {
  let message = `You are a deterministic translation engine for gettext PO entries.

Return exactly one JSON object that matches the provided response schema.

Your task:
For each input entry, produce a translation in the corresponding "msgstr" field.
Each output entry MUST correspond exactly to the matching input entry.
Do not change, remove, or reorder any "msgid", "msgid_plural", or "msgctxt" values.
Only fill the "msgstr" field.

Critical rules:

- Copy ALL placeholders and non-linguistic tokens exactly, byte-for-byte.
- NEVER translate, modify, reorder, remove, escape, or unescape placeholders.

Placeholders include (but are not limited to):
- printf-style specifiers: %s, %d, %f, %1$s, %(name)s
- variables in braces: {name}, {0}, {count}
- template string interpolation: \${name}
- template/ICU tokens
- HTML/XML tags
- any non-linguistic tokens

Only translate natural language text surrounding them.

Input:

You will receive a JSON object containing:
- "formula": plural formula of the target language
- "target_language": language code to translate into
- "source_language": language code of the source text
- "translations": ordered array of entries
- "plural_samples" (optional): array of { "plural": number, "sample": number } — one per plural form, giving the example count for that form (e.g. 1, 2, 5 for Ukrainian)

Each entry is either:

1) { "msgid": string }
   → Translate the value of "msgid"
   → Set "msgstr" to a SINGLE translated string
   → Copy "msgid" unchanged into the output entry

2) { "msgid_plural": string }
   → Translate the plural form
   → Set "msgstr" to an ARRAY of translated strings
   → The number and order of elements MUST follow the plural "formula"
   → If "plural_samples" is present: "msgstr" must have length equal to plural_samples.length; the i-th string is the translation for the count plural_samples[i].sample (e.g. form for 1 item, form for 2 items, form for 5 items)
   → If "plural_samples" is absent: the number and order of elements MUST follow the plural "formula"
   → Copy "msgid_plural" unchanged into the output entry

Output:

You MUST respond with nothing but a single JSON object. No markdown, no code fences (no \`\`\`json or \`\`\`), no explanatory text before or after. The response must be parseable by JSON.parse() directly.

Additional constraints:

- Preserve the exact input order of entries.
- Do not add, remove, or rename fields.`;

  if (context != null && context.trim() !== '') {
    message += `\n\nProject-specific instructions (follow these while respecting all rules above):\n\n${context}`;
  }

  return message;
}

/** Strip markdown code fences if the model wrapped JSON in ```json ... ``` */
function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const jsonBlock = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/;
  const match = trimmed.match(jsonBlock);
  return match ? match[1].trim() : trimmed;
}

function normalizeMsgctxt(msgctxt: unknown): string {
  return typeof msgctxt === 'string' ? msgctxt : '';
}

function buildProtectedFieldMismatchMessage(
  index: number,
  field: 'msgctxt' | 'msgid' | 'msgid_plural',
): string {
  const entryRef = `OpenAI response translations[${index}].${field}`;
  const retryHint =
    'Retry the command once because this can be a transient structured-output formatting issue.';
  const debugHint =
    'If it keeps happening, rerun with --debug and double-check that the PO entry content matches the returned protected fields.';

  if (field === 'msgctxt') {
    return `${entryRef} must match the input exactly. ${retryHint} If it keeps happening, rerun with --debug and check whether empty gettext context is being returned as omitted vs empty string.`;
  }

  return `${entryRef} must match the input exactly. ${retryHint} ${debugHint}`;
}

function parsePayloadResponse(
  request: TranslatePayloadRequest,
  content: string | null,
  options?: { debug?: boolean },
): TranslatePayloadResponse {
  initDebugLogger(options?.debug);
  const debug = getDebugLogger();
  if (content == null || content.trim() === '') {
    throw new Error('Empty response from OpenAI');
  }
  const raw = content.trim();
  debug.log('translate', 'Raw OpenAI response content received', raw);
  const toParse = stripJsonFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(toParse) as unknown;
  } catch {
    console.warn('OpenAI model returned (raw):', raw);
    throw new Error(`OpenAI response is not valid JSON: ${raw.slice(0, 200)}`);
  }
  if (parsed == null || typeof parsed !== 'object' || !('translations' in parsed)) {
    console.warn('OpenAI model returned (raw):', raw);
    throw new Error(
      `OpenAI response must be object with "translations" array: ${raw.slice(0, 200)}`,
    );
  }
  const payload = parsed as Record<string, unknown>;
  if (!Array.isArray(payload.translations)) {
    console.warn('OpenAI model returned (raw):', raw);
    throw new Error(`OpenAI response "translations" must be an array: ${raw.slice(0, 200)}`);
  }
  if (payload.translations.length !== request.translations.length) {
    throw new Error('OpenAI response "translations" must have the same number of entries as input');
  }
  for (let i = 0; i < payload.translations.length; i++) {
    const t = payload.translations[i];
    if (t == null || typeof t !== 'object' || !('msgstr' in t)) {
      console.warn('OpenAI model returned (raw):', raw);
      throw new Error(`OpenAI response translations[${i}] must have msgstr`);
    }
    const entry = t as Record<string, unknown>;
    const msgstr = entry.msgstr;
    const requestEntry = request.translations[i];
    const requestContext = normalizeMsgctxt(requestEntry.msgctxt);
    const responseContext = normalizeMsgctxt(entry.msgctxt);
    if (responseContext !== requestContext) {
      throw new Error(buildProtectedFieldMismatchMessage(i, 'msgctxt'));
    }
    if ('msgid' in requestEntry) {
      if (entry.msgid !== requestEntry.msgid) {
        throw new Error(buildProtectedFieldMismatchMessage(i, 'msgid'));
      }
      if ('msgid_plural' in entry) {
        throw new Error(`OpenAI response translations[${i}] must not include msgid_plural`);
      }
      if (typeof msgstr === 'string') continue;
      console.warn('OpenAI model returned (raw):', raw);
      throw new Error(`OpenAI response translations[${i}].msgstr must be a string`);
    }
    if (entry.msgid_plural !== requestEntry.msgid_plural) {
      throw new Error(buildProtectedFieldMismatchMessage(i, 'msgid_plural'));
    }
    if ('msgid' in entry) {
      throw new Error(`OpenAI response translations[${i}] must not include msgid`);
    }
    if (Array.isArray(msgstr) && msgstr.every((s): s is string => typeof s === 'string')) {
      if (request.plural_samples != null && msgstr.length !== request.plural_samples.length) {
        throw new Error(
          `OpenAI response translations[${i}].msgstr must have length ${request.plural_samples.length}`,
        );
      }
      continue;
    }
    console.warn('OpenAI model returned (raw):', raw);
    throw new Error(`OpenAI response translations[${i}].msgstr must be an array of strings`);
  }
  return payload as TranslatePayloadResponse;
}

export async function translatePayload(
  payload: TranslatePayloadRequest,
  options: TranslateOptions,
): Promise<TranslatePayloadResponse> {
  if (payload.translations.length === 0) {
    return { ...payload, translations: [] };
  }
  initDebugLogger(options?.debug);
  const debug = getDebugLogger();

  const client =
    options?.client ??
    new OpenAI({
      apiKey: options.apiKey,
    });
  const model = options?.model ?? DEFAULT_MODEL;
  debug.log('translate', 'Prepared translatePayload request summary', {
    model,
    target_language: payload.target_language,
    source_language: payload.source_language,
    translation_count: payload.translations.length,
    plural_samples: payload.plural_samples?.length ?? 0,
  });
  debug.log('translate', 'translatePayload request payload', payload);
  const requestParams = {
    model,
    temperature: 0,
    response_format: {
      type: 'json_schema' as const,
      json_schema: TRANSLATION_RESPONSE_SCHEMA,
    },
    messages: [
      { role: 'system' as const, content: buildSystemMessage(options.context) },
      { role: 'user' as const, content: JSON.stringify(payload) },
    ],
  };
  debug.log('translate', 'OpenAI chat.completions.create request', requestParams);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      debug.log('translate', 'Sending request to OpenAI', {
        attempt: attempt + 1,
        max_attempts: MAX_RETRIES + 1,
      });
      const response = await client.chat.completions.create(requestParams);
      debug.log('translate', 'OpenAI chat.completions.create response metadata', {
        id: response.id,
        model: response.model,
        finish_reason: response.choices[0]?.finish_reason ?? null,
        choices: response.choices.length,
      });
      const content = response.choices[0]?.message?.content ?? null;
      return parsePayloadResponse(payload, content, { debug: options?.debug });
    } catch (err) {
      const shouldRetry = attempt < MAX_RETRIES && isApiError(err) && isRetryableStatus(err.status);
      debug.log('translate', 'translatePayload request failed', {
        attempt: attempt + 1,
        shouldRetry,
        error: err instanceof Error ? err.message : String(err),
      });
      if (shouldRetry) {
        const delayMs = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        debug.log('translate', 'Retrying after backoff', { delay_ms: delayMs });
        await sleep(delayMs);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Unreachable');
}

/** One item to translate: singular (msgid) or plural (msgid_plural). */
export type TranslateItem = TranslateRequestEntry;

/** Result per item: string for singular, string[] for plural. */
export type TranslationResult = string | string[];

/** .po-style entry input: msgid required, msgid_plural optional (for plural forms), msgctxt optional (gettext context). */
export type PoEntryInput = {
  msgid: string;
  msgid_plural?: string;
  msgstr?: string[];
  msgctxt?: string;
};

/** .po-style entry output: same shape as input with msgstr filled (string for singular, string[] for plural). */
export type PoEntryOutput =
  | { msgid: string; msgstr: string; msgid_plural?: undefined; msgctxt?: string }
  | { msgid: string; msgid_plural: string; msgstr: string[]; msgctxt?: string };

export async function translateItems(
  items: TranslateItem[],
  targetLanguage: string,
  options: TranslateOptions & {
    sourceLanguage?: string;
    formula?: string;
    pluralSamples?: { plural: number; sample: number }[];
  },
): Promise<TranslationResult[]> {
  if (items.length === 0) return [];

  const sourceLanguage = options?.sourceLanguage ?? 'en';
  const formula = options?.formula ?? '';
  const payload: TranslatePayloadRequest = {
    formula,
    target_language: targetLanguage,
    source_language: sourceLanguage,
    translations: items,
  };
  if (options.pluralSamples != null && options.pluralSamples.length > 0) {
    payload.plural_samples = options.pluralSamples;
  }
  const result = await translatePayload(payload, options);

  return result.translations.map((t) => t.msgstr);
}

/** Translate .po-style entries. Accepts entries with msgid or msgid_plural, passes them to translateItems, returns same array with msgstr filled. */
export async function translateStrings(
  entries: PoEntryInput[],
  targetLanguage: string,
  options: TranslateOptions & {
    sourceLanguage?: string;
    formula?: string;
    pluralSamples?: { plural: number; sample: number }[];
  },
): Promise<PoEntryOutput[]> {
  if (entries.length === 0) return [];

  const items: TranslateItem[] = entries.map((e) => {
    const base = e.msgid_plural != null ? { msgid_plural: e.msgid_plural } : { msgid: e.msgid };
    return e.msgctxt !== undefined ? { ...base, msgctxt: e.msgctxt } : base;
  });
  const results = await translateItems(items, targetLanguage, options);

  return entries.map((entry, i) => {
    const msgstr = results[i];
    if (entry.msgid_plural != null) {
      const arr = typeof msgstr === 'string' ? [msgstr] : (msgstr ?? []);
      return { ...entry, msgstr: arr };
    }
    const str =
      typeof msgstr === 'string' ? msgstr : Array.isArray(msgstr) ? (msgstr[0] ?? '') : '';
    return { ...entry, msgstr: str };
  }) as PoEntryOutput[];
}
