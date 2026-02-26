import { test, expect } from '@jest/globals';
import { validateSourceLang } from '../src/validate-source-lang';

test('validateSourceLang throws for invalid ISO code with doc link in message', () => {
  expect(() => validateSourceLang('zzz')).toThrow(/not a known ISO language code/i);
  expect(() => validateSourceLang('zzz')).toThrow(
    /https:\/\/en\.wikipedia\.org\/wiki\/List_of_ISO_639_language_codes/
  );
});

test('validateSourceLang accepts valid codes en and uk', () => {
  expect(() => validateSourceLang('en')).not.toThrow();
  expect(() => validateSourceLang('uk')).not.toThrow();
});

test('validateSourceLang accepts normalized value EN', () => {
  expect(() => validateSourceLang('EN')).not.toThrow();
});
