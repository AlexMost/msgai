import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_PO_HEADER = `
msgid ""
msgstr ""
"Language: uk\\n"
"Plural-Forms: nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);\\n"
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
