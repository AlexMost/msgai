import dotenv from 'dotenv';
import OpenAI from 'openai';

let dotenvLoaded = false;

function loadEnv(): void {
  if (dotenvLoaded) return;
  dotenv.config();
  dotenvLoaded = true;
}

function resolveApiKey(apiKey?: string): string {
  loadEnv();
  if (apiKey != null && apiKey.trim() !== '') return apiKey;
  const env = process.env['OPENAI_API_KEY'];
  if (env != null && env.trim() !== '') return env;
  throw new Error('OpenAI API key not set. Set OPENAI_API_KEY in the environment or pass apiKey in options.');
}

export type TranslateOptions = {
  apiKey?: string;
  client?: OpenAI;
  model?: string;
};

const DEFAULT_MODEL = 'gpt-4o';

/** One translation entry: msgid (source), msgstr (translated string). Simple case only: no plurals. */
export type TranslateEntry = { msgid: string; msgstr: string };

/** Request and response payload: same JSON shape. */
export type TranslatePayload = {
  formula: string;
  target_language: string;
  source_language: string;
  translations: TranslateEntry[];
};

function buildSystemMessage(): string {
  return `You are a translator. You will receive a JSON object with:
- "target_language": language code to translate into (e.g. "uk").
- "source_language": language code of the source text (e.g. "en").
- "translations": array of { "msgid": string, "msgstr": string }. Each entry has source text in msgid. Translate each msgid into the target language and put the result in msgstr. Keep the same order of entries.
Return only valid JSON, no markdown or other text. Return the exact same structure: { "formula", "target_language", "source_language", "translations" } with each msgstr filled with the translated string.`;
}

function parsePayloadResponse(content: string | null): TranslatePayload {
  if (content == null || content.trim() === '') {
    throw new Error('Empty response from OpenAI');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.trim()) as unknown;
  } catch {
    throw new Error(`OpenAI response is not valid JSON: ${content.slice(0, 200)}`);
  }
  if (parsed == null || typeof parsed !== 'object' || !('translations' in parsed)) {
    throw new Error(`OpenAI response must be object with "translations" array: ${content.slice(0, 200)}`);
  }
  const payload = parsed as Record<string, unknown>;
  if (!Array.isArray(payload.translations)) {
    throw new Error(`OpenAI response "translations" must be an array: ${content.slice(0, 200)}`);
  }
  for (let i = 0; i < payload.translations.length; i++) {
    const t = payload.translations[i];
    if (t == null || typeof t !== 'object' || !('msgid' in t) || !('msgstr' in t)) {
      throw new Error(`OpenAI response translations[${i}] must have msgid and msgstr`);
    }
    const entry = t as Record<string, unknown>;
    if (typeof entry.msgid !== 'string') {
      throw new Error(`OpenAI response translations[${i}].msgid must be a string`);
    }
    if (typeof entry.msgstr !== 'string') {
      throw new Error(`OpenAI response translations[${i}].msgstr must be a string`);
    }
  }
  return payload as TranslatePayload;
}

export async function translatePayload(
  payload: TranslatePayload,
  options?: TranslateOptions
): Promise<TranslatePayload> {
  if (payload.translations.length === 0) return payload;

  const client =
    options?.client ??
    new OpenAI({
      apiKey: resolveApiKey(options?.apiKey),
    });
  const model = options?.model ?? DEFAULT_MODEL;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: buildSystemMessage() },
      { role: 'user', content: JSON.stringify(payload) },
    ],
  });

  const content = response.choices[0]?.message?.content ?? null;
  return parsePayloadResponse(content);
}

/** One item to translate (simple case: singular only). */
export type TranslateItem = { msgid: string };

export async function translateItems(
  items: TranslateItem[],
  targetLanguage: string,
  options?: TranslateOptions & { sourceLanguage?: string }
): Promise<string[]> {
  if (items.length === 0) return [];

  const sourceLanguage = options?.sourceLanguage ?? 'en';
  const translations: TranslateEntry[] = items.map((item) => ({ msgid: item.msgid, msgstr: '' }));

  const result = await translatePayload(
    { formula: '', target_language: targetLanguage, source_language: sourceLanguage, translations },
    options
  );

  return result.translations.map((t) => t.msgstr);
}

/** Convenience: translate a list of strings; returns translated strings in the same order. */
export async function translateStrings(
  strings: string[],
  targetLanguage: string,
  options?: TranslateOptions
): Promise<string[]> {
  const items: TranslateItem[] = strings.map((msgid) => ({ msgid }));
  return translateItems(items, targetLanguage, options);
}
