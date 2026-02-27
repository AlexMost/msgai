import { po, type GetTextTranslations, type GetTextTranslationRecord } from 'gettext-parser';
import type { PoEntryInput, PoEntryOutput } from './translate';

export type PoEntryKey = { context: string; msgid: string };

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

/**
 * Parses PO content and returns the gettext structure.
 */
export function parsePoContent(poContent: string): GetTextTranslations {
  return po.parse(Buffer.from(poContent, 'utf8'));
}

/**
 * Returns untranslated entries and their keys in stable order (contexts and msgids sorted).
 * Skips the header (msgid "").
 */
export function getEntriesToTranslate(parsedPo: GetTextTranslations): {
  entries: PoEntryInput[];
  keys: PoEntryKey[];
} {
  const entries: PoEntryInput[] = [];
  const keys: PoEntryKey[] = [];
  const translations: GetTextTranslationRecord = parsedPo.translations;
  const contextNames = Object.keys(translations).sort();

  for (const context of contextNames) {
    const contextEntries = translations[context];
    if (contextEntries == null) continue;
    const msgids = Object.keys(contextEntries).sort();
    for (const msgid of msgids) {
      if (msgid === '') continue;
      const entry = contextEntries[msgid];
      if (entry == null || !entry.msgid) continue;
      if (!isEntryUntranslated(entry)) continue;

      if (entry.msgid_plural != null) {
        entries.push({
          msgid: entry.msgid,
          msgid_plural: entry.msgid_plural,
          msgstr: entry.msgstr.slice(),
          msgctxt: context,
        });
      } else {
        entries.push({ msgid: entry.msgid, msgctxt: context });
      }
      keys.push({ context, msgid });
    }
  }

  return { entries, keys };
}

/**
 * Applies translation results into the parsed PO (mutates parsedPo.translations).
 * Singular results become one-element msgstr; plural results stay as string[].
 */
export function applyTranslations(
  parsedPo: GetTextTranslations,
  keys: PoEntryKey[],
  results: PoEntryOutput[],
): void {
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const result = results[i];
    if (result == null) continue;
    const contextEntries = parsedPo.translations[key.context];
    if (contextEntries == null) continue;
    const entry = contextEntries[key.msgid];
    if (entry == null) continue;

    if (typeof result.msgstr === 'string') {
      entry.msgstr = [result.msgstr];
    } else {
      entry.msgstr = result.msgstr.slice();
    }
  }
}

/**
 * Compiles the parsed PO to a buffer (no file I/O).
 */
export function compilePo(parsedPo: GetTextTranslations): Buffer {
  return po.compile(parsedPo);
}
