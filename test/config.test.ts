import { describe, test, expect } from '@jest/globals';
import { parseConfigFile, mergeConfigWithArgs } from '../src/config';

describe('parseConfigFile', () => {
  test('parses valid YAML with all options', () => {
    const yaml = `
sourceLang: en
model: gpt-4o
includeFuzzy: true
addFuzzy: true
foldLength: 80
context: "use formal tone"
debug: true
`;
    const result = parseConfigFile(yaml);
    expect(result).toEqual({
      sourceLang: 'en',
      model: 'gpt-4o',
      includeFuzzy: true,
      addFuzzy: true,
      foldLength: 80,
      context: 'use formal tone',
      debug: true,
    });
  });

  test('normalizes kebab-case keys to camelCase', () => {
    const yaml = `
source-lang: uk
include-fuzzy: false
add-fuzzy: true
fold-length: 0
`;
    const result = parseConfigFile(yaml);
    expect(result).toEqual({
      sourceLang: 'uk',
      includeFuzzy: false,
      addFuzzy: true,
      foldLength: 0,
    });
  });

  test('returns empty object for empty content', () => {
    expect(parseConfigFile('')).toEqual({});
  });

  test('returns empty object for content with only comments', () => {
    expect(parseConfigFile('# just a comment')).toEqual({});
  });

  test('rejects apiKey with security message', () => {
    const yaml = 'apiKey: sk-test123';
    expect(() => parseConfigFile(yaml)).toThrow(
      'apiKey must not be set in config file for security reasons',
    );
  });

  test('rejects api-key (kebab-case) with security message', () => {
    const yaml = 'api-key: sk-test123';
    expect(() => parseConfigFile(yaml)).toThrow(
      'apiKey must not be set in config file for security reasons',
    );
  });

  test('rejects dryRun with not-allowed message', () => {
    const yaml = 'dryRun: true';
    expect(() => parseConfigFile(yaml)).toThrow(
      'dryRun is not allowed in config file. Use --dry-run flag instead.',
    );
  });

  test('rejects dry-run (kebab-case) with not-allowed message', () => {
    const yaml = 'dry-run: true';
    expect(() => parseConfigFile(yaml)).toThrow(
      'dryRun is not allowed in config file. Use --dry-run flag instead.',
    );
  });

  test('rejects unknown keys (strict mode)', () => {
    const yaml = 'unknownOption: value';
    expect(() => parseConfigFile(yaml)).toThrow();
  });

  test('rejects negative foldLength', () => {
    const yaml = 'foldLength: -1';
    expect(() => parseConfigFile(yaml)).toThrow();
  });

  test('rejects float foldLength', () => {
    const yaml = 'foldLength: 1.5';
    expect(() => parseConfigFile(yaml)).toThrow();
  });

  test('rejects invalid type for model', () => {
    const yaml = 'model: 123';
    expect(() => parseConfigFile(yaml)).toThrow();
  });

  test('throws on malformed YAML', () => {
    const yaml = '{ invalid yaml: [';
    expect(() => parseConfigFile(yaml)).toThrow();
  });
});

describe('mergeConfigWithArgs', () => {
  test('CLI arg overrides config value', () => {
    const config = { sourceLang: 'en', model: 'gpt-4o' };
    const cliArgs = { sourceLang: 'uk' };
    const result = mergeConfigWithArgs(config, cliArgs);
    expect(result.sourceLang).toBe('uk');
    expect(result.model).toBe('gpt-4o');
  });

  test('config value used when CLI arg is undefined', () => {
    const config = { sourceLang: 'en', foldLength: 80, context: 'formal' };
    const cliArgs = {};
    const result = mergeConfigWithArgs(config, cliArgs);
    expect(result.sourceLang).toBe('en');
    expect(result.foldLength).toBe(80);
    expect(result.context).toBe('formal');
  });

  test('CLI boolean overrides config boolean', () => {
    const config = { includeFuzzy: true, debug: true };
    const cliArgs = { includeFuzzy: false };
    const result = mergeConfigWithArgs(config, cliArgs);
    expect(result.includeFuzzy).toBe(false);
    expect(result.debug).toBe(true);
  });

  test('preserves CLI-only args like poFilePath and dryRun', () => {
    const config = { model: 'gpt-4o' };
    const cliArgs = { poFilePath: 'test.po', dryRun: true, help: false };
    const result = mergeConfigWithArgs(config, cliArgs);
    expect(result.poFilePath).toBe('test.po');
    expect(result.dryRun).toBe(true);
    expect(result.model).toBe('gpt-4o');
  });
});
