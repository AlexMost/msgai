import { po, type GetTextTranslations, type GetTextTranslationRecord } from 'gettext-parser';
import type { PoEntryInput, PoEntryOutput } from './translate';

export type PoEntryKey = { context: string; msgid: string };
export type CompilePoOptions = { foldLength?: number };

const DEFAULT_FOLD_LENGTH = 0;

export function getUntranslatedMsgids(parsedPo: GetTextTranslations): string[] {
  const untranslatedMsgids: string[] = [];
  const translations: GetTextTranslationRecord = parsedPo.translations;

  for (const contextEntries of Object.values(translations)) {
    for (const entry of Object.values(contextEntries)) {
      if (!entry.msgid) {
        continue;
      }

      const msgstr = Array.isArray(entry.msgstr) ? entry.msgstr : [];
      const isUntranslated =
        msgstr.length === 0 ||
        msgstr.every((translation) => typeof translation !== 'string' || translation.trim() === '');

      if (isUntranslated) {
        untranslatedMsgids.push(entry.msgid);
      }
    }
  }

  return untranslatedMsgids;
}

export function getLanguage(parsedPo: GetTextTranslations): string | undefined {
  return parsedPo.headers?.['Language'];
}

export function getPluralForms(parsedPo: GetTextTranslations): string | undefined {
  return parsedPo.headers?.['Plural-Forms'];
}

function isEntryUntranslated(entry: { msgstr: string[] }): boolean {
  const msgstr = Array.isArray(entry.msgstr) ? entry.msgstr : [];
  return msgstr.length === 0 || msgstr.every((s) => typeof s !== 'string' || s.trim() === '');
}

/** Returns true if the entry has the fuzzy flag (e.g. "#, fuzzy" in PO). */
export function isEntryFuzzy(entry: { comments?: { flag?: string } }): boolean {
  const flag = entry.comments?.flag;
  if (flag == null || typeof flag !== 'string') return false;
  return flag.split(',').some((s) => s.trim().toLowerCase() === 'fuzzy');
}

/**
 * Parses PO content and returns the gettext structure.
 */
export function parsePoContent(poContent: string): GetTextTranslations {
  return po.parse(Buffer.from(poContent, 'utf8'));
}

export type GetEntriesToTranslateOptions = {
  /** If true, include entries marked as fuzzy (pass them with empty msgstr to LLM). Default false = skip fuzzy. */
  includeFuzzy?: boolean;
};

/**
 * Returns untranslated entries and their keys in the order they appear in the original PO file (parser order).
 * Skips the header (msgid "").
 * By default skips fuzzy entries; set includeFuzzy to include them (with empty msgstr for the request).
 */
export function getEntriesToTranslate(
  parsedPo: GetTextTranslations,
  options?: GetEntriesToTranslateOptions,
): {
  entries: PoEntryInput[];
  keys: PoEntryKey[];
} {
  const includeFuzzy = options?.includeFuzzy === true;
  const entries: PoEntryInput[] = [];
  const keys: PoEntryKey[] = [];
  const translations: GetTextTranslationRecord = parsedPo.translations;
  const contextNames = Object.keys(translations);

  for (const context of contextNames) {
    const contextEntries = translations[context];
    if (contextEntries == null) continue;
    const msgids = Object.keys(contextEntries);
    for (const msgid of msgids) {
      if (msgid === '') continue;
      const entry = contextEntries[msgid];
      if (entry == null || !entry.msgid) continue;

      const untranslated = isEntryUntranslated(entry);
      const fuzzy = isEntryFuzzy(entry);
      const include = untranslated || (includeFuzzy && fuzzy);
      if (!include) continue;

      if (entry.msgid_plural != null) {
        entries.push({
          msgid: entry.msgid,
          msgid_plural: entry.msgid_plural,
          msgstr: fuzzy && !untranslated ? [] : entry.msgstr.slice(),
          msgctxt: context,
        });
      } else {
        entries.push({
          msgid: entry.msgid,
          msgctxt: context,
          ...(fuzzy && !untranslated ? { msgstr: [] } : {}),
        });
      }
      keys.push({ context, msgid });
    }
  }

  return { entries, keys };
}

/**
 * Applies translation results into the parsed PO (mutates parsedPo.translations).
 * Singular results become one-element msgstr; plural results stay as string[].
 * Lookup is by result.msgctxt (default '') and result.msgid.
 */
export function applyTranslations(parsedPo: GetTextTranslations, results: PoEntryOutput[]): void {
  for (const result of results) {
    if (result == null) continue;
    const context = result.msgctxt ?? '';
    const contextEntries = parsedPo.translations[context];
    if (contextEntries == null) continue;
    const entry = contextEntries[result.msgid];
    if (entry == null) continue;

    if (typeof result.msgstr === 'string') {
      entry.msgstr = [result.msgstr];
    } else {
      entry.msgstr = result.msgstr.slice();
    }
  }
}

const AI_TRANSLATED_MARKER = 'ai-translated';

/**
 * Adds an "ai-translated" translator comment to entries corresponding to the given results.
 * Idempotent: skips entries that already contain the marker. Preserves existing translator
 * comments by appending the marker on a new line.
 */
export function markEntriesAsAiTranslated(
  parsedPo: GetTextTranslations,
  results: Array<{ msgid: string; msgctxt?: string }>,
): void {
  for (const result of results) {
    const context = result.msgctxt ?? '';
    const contextEntries = parsedPo.translations[context];
    if (contextEntries == null) continue;
    const entry = contextEntries[result.msgid];
    if (entry == null) continue;

    if (entry.comments == null) {
      entry.comments = {};
    }
    const existing = entry.comments.translator;
    if (typeof existing === 'string' && existing.length > 0) {
      const lines = existing.split(/\r?\n|\r/).map((s) => s.trim());
      if (lines.includes(AI_TRANSLATED_MARKER)) continue;
      entry.comments.translator = `${existing}\n${AI_TRANSLATED_MARKER}`;
    } else {
      entry.comments.translator = AI_TRANSLATED_MARKER;
    }
  }
}

/**
 * Adds the "fuzzy" flag to entries corresponding to the given results (mutates parsedPo.translations).
 * Idempotent: does not duplicate the flag. Preserves other flags (e.g. "c-format").
 * Lookup is by result.msgctxt (default '') and result.msgid.
 */
export function addFuzzyToEntries(
  parsedPo: GetTextTranslations,
  results: Array<{ msgid: string; msgctxt?: string }>,
): void {
  for (const result of results) {
    const context = result.msgctxt ?? '';
    const contextEntries = parsedPo.translations[context];
    if (contextEntries == null) continue;
    const entry = contextEntries[result.msgid];
    if (entry == null) continue;

    if (entry.comments == null) {
      entry.comments = {};
    }
    const existing = entry.comments.flag;
    if (typeof existing === 'string' && existing.length > 0) {
      const flags = existing
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '');
      if (flags.some((f) => f.toLowerCase() === 'fuzzy')) continue;
      flags.push('fuzzy');
      entry.comments.flag = flags.join(', ');
    } else {
      entry.comments.flag = 'fuzzy';
    }
  }
}

/**
 * Removes the "fuzzy" flag from entries corresponding to the given results (mutates parsedPo.translations).
 * Lookup is by result.msgctxt (default '') and result.msgid.
 */
export function clearFuzzyFromEntries(
  parsedPo: GetTextTranslations,
  results: Array<{ msgid: string; msgctxt?: string }>,
): void {
  for (const result of results) {
    const context = result.msgctxt ?? '';
    const contextEntries = parsedPo.translations[context];
    if (contextEntries == null) continue;
    const entry = contextEntries[result.msgid];
    if (entry == null || !entry.comments?.flag) continue;

    const newFlag = entry.comments.flag
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.toLowerCase() !== 'fuzzy')
      .join(', ');
    if (newFlag === '') {
      delete entry.comments!.flag;
      if (Object.keys(entry.comments!).length === 0) {
        delete entry.comments;
      }
    } else {
      entry.comments!.flag = newFlag;
    }
  }
}

/**
 * Compiles the parsed PO to a buffer (no file I/O).
 */
export function compilePo(parsedPo: GetTextTranslations, options?: CompilePoOptions): Buffer {
  return po.compile(parsedPo, {
    foldLength: options?.foldLength ?? DEFAULT_FOLD_LENGTH,
    sort: false,
  });
}
