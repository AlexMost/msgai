import { test, expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getTmpPo } from '../test-utils/getTmpPo';

const cliPath = path.resolve(process.cwd(), 'dist/src/cli/index.js');

function makeTempDir(): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msgai-config-test-'));
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('config file provides sourceLang when CLI does not', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);
  const { dir, cleanup } = makeTempDir();
  const configPath = path.join(dir, 'msgai.config.yml');
  fs.writeFileSync(configPath, 'source-lang: en\n');

  const result = spawnSync(
    process.execPath,
    [cliPath, '--dry-run', '--config', configPath, tempPo.poFilePath],
    { encoding: 'utf8' },
  );

  tempPo.cleanup();
  cleanup();

  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe('Hello');
});

test('CLI arg overrides config file value', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);
  const { dir, cleanup } = makeTempDir();
  const configPath = path.join(dir, 'msgai.config.yml');
  fs.writeFileSync(configPath, 'source-lang: fr\n');

  const result = spawnSync(
    process.execPath,
    [cliPath, '--dry-run', '--config', configPath, '--source-lang', 'en', tempPo.poFilePath],
    { encoding: 'utf8' },
  );

  tempPo.cleanup();
  cleanup();

  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
});

test('config file with apiKey exits with error', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);
  const { dir, cleanup } = makeTempDir();
  const configPath = path.join(dir, 'msgai.config.yml');
  fs.writeFileSync(configPath, 'api-key: sk-test123\n');

  const result = spawnSync(
    process.execPath,
    [cliPath, '--dry-run', '--config', configPath, tempPo.poFilePath],
    { encoding: 'utf8' },
  );

  tempPo.cleanup();
  cleanup();

  expect(result.status).toBe(1);
  expect(result.stderr).toContain('apiKey must not be set in config file for security reasons');
});

test('--config with custom path uses specified config', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);
  const { dir, cleanup } = makeTempDir();
  const configPath = path.join(dir, 'custom-config.yml');
  fs.writeFileSync(configPath, 'model: gpt-4.1\n');

  const result = spawnSync(
    process.execPath,
    [cliPath, '--dry-run', '--config', configPath, tempPo.poFilePath],
    { encoding: 'utf8' },
  );

  tempPo.cleanup();
  cleanup();

  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
});

test('--config with nonexistent path exits with error', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  const result = spawnSync(
    process.execPath,
    [cliPath, '--dry-run', '--config', '/tmp/nonexistent-msgai-config.yml', tempPo.poFilePath],
    { encoding: 'utf8' },
  );

  tempPo.cleanup();

  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Config file error');
});

test('missing default config file works normally', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  const result = spawnSync(process.execPath, [cliPath, '--dry-run', tempPo.poFilePath], {
    encoding: 'utf8',
    cwd: os.tmpdir(),
  });

  tempPo.cleanup();

  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe('Hello');
});

test('invalid config file exits with error', () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);
  const { dir, cleanup } = makeTempDir();
  const configPath = path.join(dir, 'bad-config.yml');
  fs.writeFileSync(configPath, 'unknownKey: value\n');

  const result = spawnSync(
    process.execPath,
    [cliPath, '--dry-run', '--config', configPath, tempPo.poFilePath],
    { encoding: 'utf8' },
  );

  tempPo.cleanup();
  cleanup();

  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Config file error');
});
