import { test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getTmpPo } from '../test-utils/getTmpPo';
import { runTranslate, runTranslateCommand } from '../../src/cli/runTranslate';
import { translateStrings } from '../../src/translate';

jest.mock('../../src/translate', () => {
  const actual = jest.requireActual<typeof import('../../src/translate')>('../../src/translate');
  return {
    ...actual,
    translateStrings: jest.fn(),
  };
});

const translateStringsMock = jest.mocked(translateStrings);
const cliPath = path.resolve(process.cwd(), 'dist/src/cli/index.js');

let savedBaseUrl: string | undefined;
let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;

beforeEach(() => {
  translateStringsMock.mockReset();
  savedBaseUrl = process.env['OPENAI_BASE_URL'];
  delete process.env['OPENAI_BASE_URL'];
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  if (savedBaseUrl === undefined) delete process.env['OPENAI_BASE_URL'];
  else process.env['OPENAI_BASE_URL'] = savedBaseUrl;
  consoleWarnSpy.mockRestore();
});

function apiError(status: number): Error & { status: number } {
  const err = new Error(`API error ${status}`) as Error & { status: number };
  err.status = status;
  return err;
}

const UNTRANSLATED_PO = `
msgid "Hello"
msgstr ""
`;

test('runTranslate forwards baseURL to translateStrings', async () => {
  translateStringsMock.mockResolvedValue([{ msgid: 'Hello', msgstr: 'Привіт' }]);
  const tempPo = getTmpPo(UNTRANSLATED_PO);

  try {
    const code = await runTranslate(
      tempPo.poFilePath,
      'fake-key',
      'en',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'https://litellm.example.com/v1',
    );

    expect(code).toBe(0);
    expect(translateStringsMock).toHaveBeenCalledWith(
      expect.anything(),
      'uk',
      expect.objectContaining({ baseURL: 'https://litellm.example.com/v1' }),
    );
  } finally {
    tempPo.cleanup();
  }
});

test('runTranslateCommand prefers --base-url over OPENAI_BASE_URL', async () => {
  translateStringsMock.mockResolvedValue([{ msgid: 'Hello', msgstr: 'Привіт' }]);
  process.env['OPENAI_BASE_URL'] = 'https://env.example.com/v1';
  const tempPo = getTmpPo(UNTRANSLATED_PO);

  try {
    const code = await runTranslateCommand({
      poFilePath: tempPo.poFilePath,
      dryRun: false,
      apiKey: 'fake-key',
      baseUrl: 'https://cli.example.com/v1',
    });

    expect(code).toBe(0);
    expect(translateStringsMock).toHaveBeenCalledWith(
      expect.anything(),
      'uk',
      expect.objectContaining({ baseURL: 'https://cli.example.com/v1' }),
    );
  } finally {
    tempPo.cleanup();
  }
});

test('runTranslateCommand falls back to OPENAI_BASE_URL', async () => {
  translateStringsMock.mockResolvedValue([{ msgid: 'Hello', msgstr: 'Привіт' }]);
  process.env['OPENAI_BASE_URL'] = 'https://env.example.com/v1';
  const tempPo = getTmpPo(UNTRANSLATED_PO);

  try {
    const code = await runTranslateCommand({
      poFilePath: tempPo.poFilePath,
      dryRun: false,
      apiKey: 'fake-key',
    });

    expect(code).toBe(0);
    expect(translateStringsMock).toHaveBeenCalledWith(
      expect.anything(),
      'uk',
      expect.objectContaining({ baseURL: 'https://env.example.com/v1' }),
    );
  } finally {
    tempPo.cleanup();
  }
});

test('runTranslateCommand leaves baseURL undefined when nothing is set', async () => {
  translateStringsMock.mockResolvedValue([{ msgid: 'Hello', msgstr: 'Привіт' }]);
  const tempPo = getTmpPo(UNTRANSLATED_PO);

  try {
    const code = await runTranslateCommand({
      poFilePath: tempPo.poFilePath,
      dryRun: false,
      apiKey: 'fake-key',
    });

    expect(code).toBe(0);
    const options = translateStringsMock.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(options['baseURL']).toBeUndefined();
  } finally {
    tempPo.cleanup();
  }
});

test('runTranslateCommand rejects a base URL that is not http(s)', async () => {
  const tempPo = getTmpPo(UNTRANSLATED_PO);

  try {
    const code = await runTranslateCommand({
      poFilePath: tempPo.poFilePath,
      dryRun: false,
      apiKey: 'fake-key',
      baseUrl: 'not a url',
    });

    expect(code).toBe(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid base URL'));
    expect(translateStringsMock).not.toHaveBeenCalled();
  } finally {
    tempPo.cleanup();
  }
});

test('401 message mentions the custom base URL instead of the OpenAI platform', async () => {
  translateStringsMock.mockRejectedValue(apiError(401));
  const tempPo = getTmpPo(UNTRANSLATED_PO);

  try {
    const code = await runTranslate(
      tempPo.poFilePath,
      'fake-key',
      'en',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'https://litellm.example.com/v1',
    );

    expect(code).toBe(1);
    const message = consoleWarnSpy.mock.calls[0]?.[0] as string;
    expect(message).toContain('Invalid or missing API key');
    expect(message).toContain('https://litellm.example.com/v1');
    expect(message).not.toContain('platform.openai.com');
  } finally {
    tempPo.cleanup();
  }
});

test('401 message without a custom base URL points to the OpenAI platform', async () => {
  translateStringsMock.mockRejectedValue(apiError(401));
  const tempPo = getTmpPo(UNTRANSLATED_PO);

  try {
    const code = await runTranslate(tempPo.poFilePath, 'fake-key', 'en');

    expect(code).toBe(1);
    expect(consoleWarnSpy.mock.calls[0]?.[0]).toContain('platform.openai.com');
  } finally {
    tempPo.cleanup();
  }
});

test('CLI --help lists --base-url', () => {
  const result = spawnSync(process.execPath, [cliPath, '--help'], { encoding: 'utf8' });

  expect(result.status).toBe(0);
  expect(result.stdout).toContain('[--base-url URL]');
});

test('CLI exits 1 on an invalid --base-url', () => {
  const tempPo = getTmpPo(UNTRANSLATED_PO);
  const result = spawnSync(
    process.execPath,
    [cliPath, '--base-url', 'ftp://example.com', tempPo.poFilePath],
    { encoding: 'utf8', env: { ...process.env, OPENAI_API_KEY: 'test' } },
  );
  tempPo.cleanup();

  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Invalid base URL');
});

test('CLI reads base-url from the config file', () => {
  const tempPo = getTmpPo(UNTRANSLATED_PO);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msgai-base-url-test-'));
  const configPath = path.join(dir, 'msgai.config.yml');
  fs.writeFileSync(configPath, 'base-url: not-a-url\n');

  const result = spawnSync(process.execPath, [cliPath, '--config', configPath, tempPo.poFilePath], {
    encoding: 'utf8',
    env: { ...process.env, OPENAI_API_KEY: 'test' },
  });
  tempPo.cleanup();
  fs.rmSync(dir, { recursive: true, force: true });

  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Invalid base URL: not-a-url');
});
