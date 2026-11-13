import { test, expect, beforeAll, afterAll } from '@jest/globals';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { getTmpPo } from '../test-utils/getTmpPo';

const cliPath = path.resolve(process.cwd(), 'dist/src/cli/index.js');

// Minimal OpenAI-compatible server: echoes every requested entry back with msgstr "Переклад".
let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const request = JSON.parse(body) as { messages: Array<{ content: string }> };
      const payload = JSON.parse(request.messages[1]!.content) as {
        translations: Array<Record<string, string>>;
      };
      const translations = payload.translations.map((t) =>
        'msgid_plural' in t ? { ...t, msgstr: ['Переклад'] } : { ...t, msgstr: 'Переклад' },
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          id: 'test',
          object: 'chat.completion',
          created: 0,
          model: 'fake',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: JSON.stringify({ translations }) },
              finish_reason: 'stop',
            },
          ],
        }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function runCli(args: string[]): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      env: { ...process.env, OPENAI_API_KEY: 'test' },
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (code) => resolve({ code, stderr }));
  });
}

test('CLI --add-fuzzy marks translated entries as fuzzy', async () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  try {
    const result = await runCli(['--base-url', baseUrl, '--add-fuzzy', tempPo.poFilePath]);

    expect(result.stderr).toBe('');
    expect(result.code).toBe(0);
    const content = fs.readFileSync(tempPo.poFilePath, 'utf8');
    expect(content).toContain('msgstr "Переклад"');
    expect(content).toMatch(/#,\s*fuzzy/);
  } finally {
    tempPo.cleanup();
  }
});

test('CLI without --add-fuzzy does not mark translated entries as fuzzy', async () => {
  const tempPo = getTmpPo(`
msgid "Hello"
msgstr ""
`);

  try {
    const result = await runCli(['--base-url', baseUrl, tempPo.poFilePath]);

    expect(result.code).toBe(0);
    const content = fs.readFileSync(tempPo.poFilePath, 'utf8');
    expect(content).toContain('msgstr "Переклад"');
    expect(content).not.toMatch(/#,\s*fuzzy/);
  } finally {
    tempPo.cleanup();
  }
});
