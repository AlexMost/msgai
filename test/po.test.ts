import { test, expect } from '@jest/globals';
import { getUntranslatedMsgids, getUntranslatedMsgidsFromFile } from '../src/po';
import { getTmpPo } from './test-utils/getTmpPo';

test('getUntranslatedMsgids returns only untranslated entries', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""

msgid "World"
msgstr "World"
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
