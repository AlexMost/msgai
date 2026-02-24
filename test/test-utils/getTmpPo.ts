import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_PO_HEADER = `
msgid ""
msgstr ""
"Language: en\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
`.trim();

function withDefaultHeader(poContent: string): string {
  const trimmedContent = poContent.trim();

  if (trimmedContent.startsWith('msgid ""')) {
    return trimmedContent;
  }

  return `${DEFAULT_PO_HEADER}\n\n${trimmedContent}`;
}

export function getTmpPo(poContent: string): { poFilePath: string; poContent: string; cleanup: () => void } {
  const tempDirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'msgai-po-test-'));
  const poFilePath = path.join(tempDirPath, 'messages.po');
  const normalizedPoContent = withDefaultHeader(poContent);

  fs.writeFileSync(poFilePath, normalizedPoContent, 'utf8');

  return {
    poFilePath,
    poContent: normalizedPoContent,
    cleanup: () => {
      fs.rmSync(tempDirPath, { recursive: true, force: true });
    },
  };
}
