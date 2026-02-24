import fs from 'node:fs';
import { po, type GetTextTranslationRecord } from 'gettext-parser';

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
