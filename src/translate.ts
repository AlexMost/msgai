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
  return `You are a translation engine for gettext PO entries.

Critical rules:
	•	Preserve ALL placeholders exactly as in the source text.
	•	NEVER translate, modify, reorder, or remove placeholders.

Placeholders include (but are not limited to):
	•	printf-style specifiers: %s, %d, %f, %1$s, %(name)s
	•	variables in braces: {name}, {0}, {count}
  •	template strings interpolation (like \${name})
	•	template/ICU tokens
	•	HTML/XML tags
	•	any non-linguistic tokens

Only translate natural language text surrounding them.

Input:

You will receive a JSON object containing:
	•	“formula”: plural formula of the target language
	•	“target_language”: language code to translate into
	•	“source_language”: language code of the source text
	•	“translations”: ordered array of entries

Each entry is either:
	1.	{ "msgid": string }
→ Translate into a SINGLE string msgstr
	2.	{ "msgid_plural": string }
→ Translate into an ARRAY msgstr, with one element per plural form required by the target language.
→ The number and order of forms MUST follow the plural “formula”.

Output:

Return ONLY valid JSON.

Return EXACTLY this structure:

{
“formula”: “…”,
“target_language”: “…”,
“source_language”: “…”,
“translations”: [
{ “msgid”: “…”, “msgstr”: “…” },
{ “msgid_plural”: “…”, “msgstr”: [”…”, “…”] }
]
}

Additional constraints:
	•	Preserve input order.
	•	Do not add explanations or extra fields.
	•	Do not use markdown.`
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
