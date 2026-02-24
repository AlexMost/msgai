import { test, expect } from '@jest/globals';
import {
  getUntranslatedMsgids,
  getUntranslatedMsgidsFromFile,
  getLanguageFromPoContent,
  getLanguageFromFile,
  getPluralFormsFromPoContent,
} from '../src/po';
import { getTmpPo } from './test-utils/getTmpPo';

test('getUntranslatedMsgids returns only untranslated entries', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""

msgid "World"
msgstr "Світ"
`);
  const result = getUntranslatedMsgids(tempPo.poContent);

  tempPo.cleanup();

  expect(result).toEqual(['Hello']);
});

test('getUntranslatedMsgidsFromFile reads and parses po file', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  const result = getUntranslatedMsgidsFromFile(tempPo.poFilePath);
  tempPo.cleanup();

  expect(result).toEqual(['Hello']);
});

test('getLanguageFromPoContent returns language from PO header', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);
  const result = getLanguageFromPoContent(tempPo.poContent);
  tempPo.cleanup();
  expect(result).toBe('uk');
});

test('getLanguageFromFile returns language from PO file', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);
  const result = getLanguageFromFile(tempPo.poFilePath);
  tempPo.cleanup();
  expect(result).toBe('uk');
});

test('getPluralFormsFromPoContent returns Plural-Forms from PO header', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);
  const result = getPluralFormsFromPoContent(tempPo.poContent);
  tempPo.cleanup();
  expect(result).toMatch(/nplurals=3/);
  expect(result).toMatch(/plural=/);
});
