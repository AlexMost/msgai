import dotenv from 'dotenv';
import OpenAI from 'openai';

let dotenvLoaded = false;

function loadEnv(): void {
  if (dotenvLoaded) return;
  dotenv.config();
  dotenvLoaded = true;
}

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
};

const DEFAULT_MODEL = 'gpt-4o';

/** Request entry: either singular (msgid) or plural (msgid_plural). */
export type TranslateRequestEntry = { msgid: string } | { msgid_plural: string };

/** Response entry: same keys as request plus msgstr. For msgid → msgstr is string; for msgid_plural → msgstr is string[]. */
export type TranslateResponseEntry =
  | { msgid: string; msgstr: string }
  | { msgid_plural: string; msgstr: string[] };

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
  formula: string;
  target_language: string;
  source_language: string;
  translations: TranslateResponseEntry[];
};

function buildSystemMessage(): string {
  return `You are a deterministic translation engine for gettext PO entries.

Your task:
For each input entry, produce a translation in the corresponding "msgstr" field.
Each output entry MUST correspond exactly to the matching input entry.
Do not change, remove, or reorder any "msgid" or "msgid_plural" values.
Only fill the "msgstr" field.

Critical rules:

- Preserve ALL placeholders exactly as in the source text.
- NEVER translate, modify, reorder, or remove placeholders.

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

Return ONLY valid JSON.

Return EXACTLY this structure:

{
  "formula": "...",
  "target_language": "...",
  "source_language": "...",
  "translations": [
    { "msgid": "...", "msgstr": "..." },
    { "msgid_plural": "...", "msgstr": ["...", "..."] }
  ]
}

Additional constraints:

- Preserve the exact input order of entries.
- Do not modify "formula", "target_language", or "source_language".
- Do not add, remove, or rename fields.
- Do not add explanations or markdown.`;
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
    throw new Error(
      `OpenAI response must be object with "translations" array: ${content.slice(0, 200)}`,
    );
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
    throw new Error(
      `OpenAI response translations[${i}].msgstr must be a string or array of strings`,
    );
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

  const client =
    options?.client ??
    new OpenAI({
      apiKey: options.apiKey,
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

/** .po-style entry input: msgid required, msgid_plural optional (for plural forms). */
export type PoEntryInput = { msgid: string; msgid_plural?: string; msgstr?: string[] };

/** .po-style entry output: same shape as input with msgstr filled (string for singular, string[] for plural). */
export type PoEntryOutput =
  | { msgid: string; msgstr: string; msgid_plural?: undefined }
  | { msgid: string; msgid_plural: string; msgstr: string[] };

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

  const items: TranslateItem[] = entries.map((e) =>
    e.msgid_plural != null ? { msgid_plural: e.msgid_plural } : { msgid: e.msgid },
  );
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
