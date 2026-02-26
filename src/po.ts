import fs from 'node:fs';
import { po, type GetTextTranslations, type GetTextTranslationRecord } from 'gettext-parser';
import type { PoEntryInput, PoEntryOutput } from './translate';

export type PoEntryKey = { context: string; msgid: string };

export function getUntranslatedMsgids(poContent: string): string[] {
  const parsedPo = po.parse(Buffer.from(poContent, 'utf8'));
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

export function getUntranslatedMsgidsFromFile(poFilePath: string): string[] {
  const poContent = fs.readFileSync(poFilePath, 'utf8');
  return getUntranslatedMsgids(poContent);
}

export function getLanguageFromPoContent(poContent: string): string | undefined {
  const parsedPo = po.parse(Buffer.from(poContent, 'utf8'));
  return parsedPo.headers?.['Language'];
}

export function getLanguageFromFile(poFilePath: string): string | undefined {
  const poContent = fs.readFileSync(poFilePath, 'utf8');
  return getLanguageFromPoContent(poContent);
}

export function getPluralFormsFromPoContent(poContent: string): string | undefined {
  const parsedPo = po.parse(Buffer.from(poContent, 'utf8'));
  return parsedPo.headers?.['Plural-Forms'];
}

export function getPluralFormsFromFile(poFilePath: string): string | undefined {
  const poContent = fs.readFileSync(poFilePath, 'utf8');
  return getPluralFormsFromPoContent(poContent);
}

function isEntryUntranslated(entry: { msgstr: string[] }): boolean {
  const msgstr = Array.isArray(entry.msgstr) ? entry.msgstr : [];
  return (
    msgstr.length === 0 ||
    msgstr.every((s) => typeof s !== 'string' || s.trim() === '')
  );
}

/**
 * Parses a .po file and returns the gettext structure.
 */
export function parsePoFromFile(poFilePath: string): GetTextTranslations {
  const poContent = fs.readFileSync(poFilePath, 'utf8');
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
        });
      } else {
        entries.push({ msgid: entry.msgid });
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
  results: PoEntryOutput[]
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
 * Compiles the parsed PO to a buffer and writes it to the file.
 */
export function writePoFile(poFilePath: string, parsedPo: GetTextTranslations): void {
  const buffer = po.compile(parsedPo);
  fs.writeFileSync(poFilePath, buffer, undefined);
}
