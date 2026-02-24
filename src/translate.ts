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

/** Request entry: either singular (msgid) or plural (msgid_plural). */
export type TranslateRequestEntry = { msgid: string } | { msgid_plural: string };

/** Response entry: same keys as request plus msgstr. For msgid → msgstr is string; for msgid_plural → msgstr is string[]. */
export type TranslateResponseEntry = { msgid: string; msgstr: string } | { msgid_plural: string; msgstr: string[] }

/** Request payload: translations have only msgid or msgid_plural, no msgstr. */
export type TranslatePayloadRequest = {
  formula: string;
  target_language: string;
  source_language: string;
  translations: TranslateRequestEntry[];
};

/** Response payload: translations have msgstr filled. */
export type TranslatePayloadResponse = {
  formula: string;
  target_language: string;
  source_language: string;
  translations: TranslateResponseEntry[];
};

function buildSystemMessage(): string {
  return `You are a translator. The entries are parsed from gettext PO (Portable Object) files and follow the gettext format.
Important: Keep all placeholders and variables in their exact places—do not translate or move them. 
Preserve format specifiers (e.g. %s, %d, %(name)s, %1$s), variable names in braces (e.g. {name}, {0}), and any other placeholders exactly as in the source; 
only translate the surrounding natural language.

You will receive a JSON object with:
- "formula": plural formula for the target language (e.g. "nplurals=3; plural=..."). Use it when the entry has msgid_plural to know how many forms to return.
- "target_language": language code to translate into (e.g. "uk").
- "source_language": language code of the source text (e.g. "en").
- "translations": array where each entry is either { "msgid": string } or { "msgid_plural": string }.
  - For { "msgid" }: translate the singular string and set "msgstr" to a single string. Echo "msgid" in the response entry.
  - For { "msgid_plural" }: translate the plural form and set "msgstr" to an array of strings, one per plural form required by the target language (use "formula" to determine the number and order). Echo "msgid_plural" in the response entry.
Return the same structure with the same order of entries. Return only valid JSON, no markdown or other text. Return: { "formula", "target_language", "source_language", "translations" } with each entry having "msgstr" filled (string for msgid, array of strings for msgid_plural).`;
}

function parsePayloadResponse(content: string | null): TranslatePayloadResponse {
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
    if (t == null || typeof t !== 'object' || !('msgstr' in t)) {
      throw new Error(`OpenAI response translations[${i}] must have msgstr`);
    }
    const entry = t as Record<string, unknown>;
    const msgstr = entry.msgstr;
    if (typeof msgstr === 'string') continue;
    if (Array.isArray(msgstr) && msgstr.every((s): s is string => typeof s === 'string')) continue;
    throw new Error(`OpenAI response translations[${i}].msgstr must be a string or array of strings`);
  }
  return payload as TranslatePayloadResponse;
}

export async function translatePayload(
  payload: TranslatePayloadRequest,
  options?: TranslateOptions
): Promise<TranslatePayloadResponse> {
  if (payload.translations.length === 0) {
    return { ...payload, translations: [] };
  }

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

/** One item to translate: singular (msgid) or plural (msgid_plural). */
export type TranslateItem = TranslateRequestEntry;

/** Result per item: string for singular, string[] for plural. */
export type TranslationResult = string | string[];

export async function translateItems(
  items: TranslateItem[],
  targetLanguage: string,
  options?: TranslateOptions & { sourceLanguage?: string; formula?: string }
): Promise<TranslationResult[]> {
  if (items.length === 0) return [];

  const sourceLanguage = options?.sourceLanguage ?? 'en';
  const formula = options?.formula ?? '';
  const result = await translatePayload(
    { formula, target_language: targetLanguage, source_language: sourceLanguage, translations: items },
    options
  );

  return result.translations.map((t) => t.msgstr);
}

/** Convenience: translate one string (as msgid) or several (as msgid_plural entries). Returns string for single input, string[] for array. */
export async function translateStrings(
  strings: string | string[],
  targetLanguage: string,
  options?: TranslateOptions & { sourceLanguage?: string; formula?: string }
): Promise<string | string[]> {
  if (typeof strings === 'string') {
    const results = await translateItems([{ msgid: strings }], targetLanguage, options);
    const r = results[0];
    return typeof r === 'string' ? r : r[0] ?? '';
  }
  if (strings.length === 0) return [];
  const items: TranslateItem[] = strings.map((s) => ({ msgid_plural: s }));
  const results = await translateItems(items, targetLanguage, options);
  return results.map((r) => (typeof r === 'string' ? r : r[0] ?? ''));
}
