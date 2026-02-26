import { test, expect } from '@jest/globals';
import {
  getUntranslatedMsgids,
  getLanguage,
  getPluralForms,
  parsePoContent,
  getEntriesToTranslate,
  applyTranslations,
  compilePo,
} from '../src/po';
import fs from 'node:fs';
import { getTmpPo } from './test-utils/getTmpPo';
import { po } from 'gettext-parser';

test('getUntranslatedMsgids returns only untranslated entries', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""

msgid "World"
msgstr "Світ"
`);
  const parsed = parsePoContent(tempPo.poContent);
  const result = getUntranslatedMsgids(parsed);
  tempPo.cleanup();
  expect(result).toEqual(['Hello']);
});

test('getUntranslatedMsgids with parsed from file returns untranslated msgids', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);
  const content = fs.readFileSync(tempPo.poFilePath, 'utf8');
  const parsed = parsePoContent(content);
  const result = getUntranslatedMsgids(parsed);
  tempPo.cleanup();
  expect(result).toEqual(['Hello']);
});

test('getLanguage returns language from parsed PO headers', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);
  const parsed = parsePoContent(tempPo.poContent);
  const result = getLanguage(parsed);
  tempPo.cleanup();
  expect(result).toBe('uk');
});

test('getPluralForms returns Plural-Forms from parsed PO headers', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);
  const parsed = parsePoContent(tempPo.poContent);
  const result = getPluralForms(parsed);
  tempPo.cleanup();
  expect(result).toMatch(/nplurals=3/);
  expect(result).toMatch(/plural=/);
});

test('getEntriesToTranslate returns empty when no untranslated strings', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr "Привіт"

msgid "World"
msgstr "Світ"
`);
  const parsed = parsePoContent(tempPo.poContent);
  const { entries, keys } = getEntriesToTranslate(parsed);
  tempPo.cleanup();
  expect(entries).toHaveLength(0);
  expect(keys).toHaveLength(0);
});

test('getEntriesToTranslate returns one entry and key for single untranslated singular', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);
  const parsed = parsePoContent(tempPo.poContent);
  const { entries, keys } = getEntriesToTranslate(parsed);
  tempPo.cleanup();
  expect(entries).toHaveLength(1);
  expect(entries[0]).toEqual({ msgid: 'Hello' });
  expect(keys).toHaveLength(1);
  expect(keys[0]).toEqual({ context: '', msgid: 'Hello' });
});

test('getEntriesToTranslate returns entries and keys in stable order, skips header', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""

msgid "World"
msgstr ""

msgid "Bye"
msgstr "Бувай"
`);
  const parsed = parsePoContent(tempPo.poContent);
  const { entries, keys } = getEntriesToTranslate(parsed);
  tempPo.cleanup();
  expect(entries).toHaveLength(2);
  expect(entries[0].msgid).toBe('Hello');
  expect(entries[1].msgid).toBe('World');
  expect(keys[0].msgid).toBe('Hello');
  expect(keys[1].msgid).toBe('World');
});

test('getEntriesToTranslate includes msgid_plural and msgstr for plural entries', () => {
  const tempPo = getTmpPo(`
msgid "%d item"
msgid_plural "%d items"
msgstr[0] ""
msgstr[1] ""
msgstr[2] ""
`);
  const parsed = parsePoContent(tempPo.poContent);
  const { entries, keys } = getEntriesToTranslate(parsed);
  tempPo.cleanup();
  expect(entries).toHaveLength(1);
  expect(entries[0].msgid).toBe('%d item');
  expect(entries[0].msgid_plural).toBe('%d items');
  expect(Array.isArray(entries[0].msgstr)).toBe(true);
  expect((entries[0].msgstr as string[]).length).toBe(3);
  expect(keys).toHaveLength(1);
});

test('applyTranslations updates parsed po with singular and plural results', () => {
  const parsed = po.parse(
    Buffer.from(
      `
msgid ""
msgstr ""
"Language: uk\\n"

msgid "Hello"
msgstr ""

msgid "Count"
msgid_plural "Counts"
msgstr[0] ""
msgstr[1] ""
msgstr[2] ""
`,
      'utf8',
    ),
  );
  const keys = [
    { context: '', msgid: 'Hello' },
    { context: '', msgid: 'Count' },
  ];
  const results = [
    { msgid: 'Hello', msgstr: 'Привіт' },
    { msgid: 'Count', msgid_plural: 'Counts', msgstr: ['один', 'два', 'багато'] },
  ];
  applyTranslations(parsed, keys, results);
  expect(parsed.translations['']['Hello'].msgstr).toEqual(['Привіт']);
  expect(parsed.translations['']['Count'].msgstr).toEqual(['один', 'два', 'багато']);
});

test('applyTranslations is no-op when results empty', () => {
  const parsed = po.parse(
    Buffer.from(
      `
msgid ""
msgstr ""

msgid "Hello"
msgstr ""
`,
      'utf8',
    ),
  );
  const before = parsed.translations['']['Hello'].msgstr.slice();
  applyTranslations(parsed, [{ context: '', msgid: 'Hello' }], []);
  expect(parsed.translations['']['Hello'].msgstr).toEqual(before);
});

test('compilePo round-trips and preserves translated entry', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr "Привіт"
`);
  const parsed = parsePoContent(tempPo.poContent);
  const outPath = tempPo.poFilePath.replace('.po', '-out.po');
  fs.writeFileSync(outPath, compilePo(parsed), undefined);
  const reparsed = po.parse(fs.readFileSync(outPath));
  expect(reparsed.translations['']['Hello'].msgstr).toEqual(['Привіт']);
  tempPo.cleanup();
});
