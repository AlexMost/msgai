import { test, expect } from '@jest/globals';
import {
  getUntranslatedMsgids,
  getLanguage,
  getPluralForms,
  parsePoContent,
  getEntriesToTranslate,
  applyTranslations,
  clearFuzzyFromEntries,
  addFuzzyToEntries,
  markEntriesAsAiTranslated,
  compilePo,
  isEntryFuzzy,
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
  expect(entries[0]).toEqual({ msgid: 'Hello', msgctxt: '' });
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
  const results = [
    { msgid: 'Hello', msgstr: 'Привіт' },
    { msgid: 'Count', msgid_plural: 'Counts', msgstr: ['один', 'два', 'багато'] },
  ];
  applyTranslations(parsed, results);
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
  applyTranslations(parsed, []);
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

test('compilePo does not fold long strings by default', () => {
  const tempPo = getTmpPo(`
msgid "A long string that would previously be folded into continuation lines by gettext-parser when the default fold length was used."
msgstr ""
`);
  const parsed = parsePoContent(tempPo.poContent);

  const compiled = compilePo(parsed).toString('utf8');

  expect(compiled).toContain(
    'msgid "A long string that would previously be folded into continuation lines by gettext-parser when the default fold length was used."',
  );
  expect(compiled).not.toContain(
    'msgid ""\n"A long string that would previously be folded into continuation lines by gettext-parser when the default fold length was used."',
  );
  tempPo.cleanup();
});

test('compilePo supports explicit fold length override', () => {
  const tempPo = getTmpPo(`
msgid "A long string that should be wrapped when compilePo receives an explicit fold length override for compatibility."
msgstr ""
`);
  const parsed = parsePoContent(tempPo.poContent);

  const compiled = compilePo(parsed, { foldLength: 76 }).toString('utf8');

  expect(compiled).toContain('msgid ""');
  expect(compiled).toContain(
    '"A long string that should be wrapped when compilePo receives an explicit "',
  );
  tempPo.cleanup();
});

test('same msgid with different contexts: only untranslated entry is updated by applyTranslations', () => {
  const parsed = po.parse(
    Buffer.from(
      `
msgid ""
msgstr ""
"Language: uk\\n"
"Content-Type: text/plain; charset=UTF-8\\n"

msgctxt "auth"
msgid "Hello"
msgstr "Вітаємо"

msgid "Hello"
msgstr ""
`,
      'utf8',
    ),
  );
  const { entries, keys } = getEntriesToTranslate(parsed);
  expect(entries).toHaveLength(1);
  expect(entries[0]).toEqual({ msgid: 'Hello', msgctxt: '' });
  expect(keys).toHaveLength(1);
  expect(keys[0]).toEqual({ context: '', msgid: 'Hello' });

  applyTranslations(parsed, [{ msgid: 'Hello', msgstr: 'Привіт', msgctxt: '' }]);

  expect(parsed.translations['auth']['Hello'].msgstr).toEqual(['Вітаємо']);
  expect(parsed.translations['']['Hello'].msgstr).toEqual(['Привіт']);
});

test('getEntriesToTranslate skips fuzzy entries by default (sends only untranslated)', () => {
  const tempPo = getTmpPo(`
#, fuzzy
msgid "Hello"
msgstr "Старий переклад"

msgid "World"
msgstr ""
`);
  const parsed = parsePoContent(tempPo.poContent);
  const { entries, keys } = getEntriesToTranslate(parsed);
  tempPo.cleanup();
  expect(entries).toHaveLength(1);
  expect(entries[0].msgid).toBe('World');
  expect(keys).toHaveLength(1);
  expect(keys[0].msgid).toBe('World');
});

test('getEntriesToTranslate with includeFuzzy sends fuzzy entry for translation (with empty msgstr)', () => {
  const tempPo = getTmpPo(`
#, fuzzy
msgid "Hello"
msgstr "Старий переклад"

msgid "World"
msgstr ""
`);
  const parsed = parsePoContent(tempPo.poContent);
  const { entries, keys } = getEntriesToTranslate(parsed, { includeFuzzy: true });
  tempPo.cleanup();
  expect(entries).toHaveLength(2);
  const helloEntry = entries.find((e) => e.msgid === 'Hello');
  const worldEntry = entries.find((e) => e.msgid === 'World');
  expect(helloEntry).toBeDefined();
  expect(worldEntry).toBeDefined();
  expect(helloEntry!.msgstr).toEqual([]);
  expect(worldEntry!.msgid).toBe('World');
  expect(keys.map((k) => k.msgid)).toEqual(['Hello', 'World']);
});

test('markEntriesAsAiTranslated adds translator comment to entry without comments', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);
  const parsed = parsePoContent(tempPo.poContent);
  applyTranslations(parsed, [{ msgid: 'Hello', msgstr: 'Привіт' }]);
  markEntriesAsAiTranslated(parsed, [{ msgid: 'Hello' }]);
  expect(parsed.translations['']['Hello'].comments?.translator).toBe('ai-translated');

  const compiled = compilePo(parsed).toString('utf8');
  expect(compiled).toContain('# ai-translated');
  tempPo.cleanup();
});

test('markEntriesAsAiTranslated preserves existing translator comment, appends marker on new line', () => {
  const tempPo = getTmpPo(`
# TODO: review wording
msgid "Hello"
msgstr ""
`);
  const parsed = parsePoContent(tempPo.poContent);
  markEntriesAsAiTranslated(parsed, [{ msgid: 'Hello' }]);
  expect(parsed.translations['']['Hello'].comments?.translator).toBe(
    'TODO: review wording\nai-translated',
  );

  const compiled = compilePo(parsed).toString('utf8');
  expect(compiled).toContain('# TODO: review wording');
  expect(compiled).toContain('# ai-translated');
  tempPo.cleanup();
});

test('markEntriesAsAiTranslated is idempotent (running twice does not duplicate marker)', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);
  const parsed = parsePoContent(tempPo.poContent);
  markEntriesAsAiTranslated(parsed, [{ msgid: 'Hello' }]);
  markEntriesAsAiTranslated(parsed, [{ msgid: 'Hello' }]);
  expect(parsed.translations['']['Hello'].comments?.translator).toBe('ai-translated');
  tempPo.cleanup();
});

test('markEntriesAsAiTranslated respects msgctxt when looking up entry', () => {
  const parsed = po.parse(
    Buffer.from(
      `
msgid ""
msgstr ""
"Language: uk\\n"
"Content-Type: text/plain; charset=UTF-8\\n"

msgctxt "auth"
msgid "Hello"
msgstr "Вітаємо"

msgid "Hello"
msgstr "Привіт"
`,
      'utf8',
    ),
  );
  markEntriesAsAiTranslated(parsed, [{ msgid: 'Hello', msgctxt: '' }]);
  expect(parsed.translations['']['Hello'].comments?.translator).toBe('ai-translated');
  expect(parsed.translations['auth']['Hello'].comments?.translator).toBeUndefined();
});

test('addFuzzyToEntries adds fuzzy flag to entry without flags', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);
  const parsed = parsePoContent(tempPo.poContent);
  applyTranslations(parsed, [{ msgid: 'Hello', msgstr: 'Привіт' }]);
  addFuzzyToEntries(parsed, [{ msgid: 'Hello' }]);
  expect(isEntryFuzzy(parsed.translations['']['Hello'])).toBe(true);

  const compiled = compilePo(parsed).toString('utf8');
  expect(compiled).toMatch(/#,\s*fuzzy/);
  tempPo.cleanup();
});

test('addFuzzyToEntries preserves other flags (e.g. c-format)', () => {
  const tempPo = getTmpPo(`
#, c-format
msgid "Hello %s"
msgstr ""
`);
  const parsed = parsePoContent(tempPo.poContent);
  addFuzzyToEntries(parsed, [{ msgid: 'Hello %s' }]);
  const flag = parsed.translations['']['Hello %s'].comments?.flag ?? '';
  expect(flag).toMatch(/c-format/);
  expect(flag).toMatch(/fuzzy/);
});

test('addFuzzyToEntries is idempotent (does not duplicate fuzzy flag)', () => {
  const tempPo = getTmpPo(`
#, fuzzy
msgid "Hello"
msgstr "Старий"
`);
  const parsed = parsePoContent(tempPo.poContent);
  addFuzzyToEntries(parsed, [{ msgid: 'Hello' }]);
  const flag = parsed.translations['']['Hello'].comments?.flag ?? '';
  const fuzzyCount = flag.split(',').filter((s) => s.trim() === 'fuzzy').length;
  expect(fuzzyCount).toBe(1);
  tempPo.cleanup();
});

test('clearFuzzyFromEntries removes fuzzy flag from .po after translation', () => {
  const tempPo = getTmpPo(`
#, fuzzy
msgid "Hello"
msgstr "Старий переклад"
`);
  const parsed = parsePoContent(tempPo.poContent);
  expect(isEntryFuzzy(parsed.translations['']['Hello'])).toBe(true);

  const results = [{ msgid: 'Hello', msgstr: 'Новий переклад' }];
  applyTranslations(parsed, results);
  clearFuzzyFromEntries(parsed, results);

  expect(parsed.translations['']['Hello'].msgstr).toEqual(['Новий переклад']);
  expect(isEntryFuzzy(parsed.translations['']['Hello'])).toBe(false);

  const compiled = compilePo(parsed).toString('utf8');
  expect(compiled).not.toMatch(/#,\s*fuzzy/);
  tempPo.cleanup();
});
