import { test, expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { getTmpPo } from '../test-utils/getTmpPo';

const PO_WITH_FUZZY = `
#, fuzzy
msgid "FuzzyHello"
msgstr "Старий переклад"

msgid "UntranslatedWorld"
msgstr ""
`;

test('CLI --dry-run without --include-fuzzy does not include fuzzy entries', () => {
  const cliPath = path.resolve(process.cwd(), 'dist/src/cli/index.js');
  const tempPo = getTmpPo(PO_WITH_FUZZY);

  const runResult = spawnSync(process.execPath, [cliPath, '--dry-run', tempPo.poFilePath], {
    encoding: 'utf8',
  });

  tempPo.cleanup();

  expect(runResult.stderr).toBe('');
  expect(runResult.status).toBe(0);
  expect(runResult.stdout).toContain('UntranslatedWorld');
  expect(runResult.stdout).not.toContain('FuzzyHello');
});

test('CLI --dry-run with --include-fuzzy includes fuzzy entries', () => {
  const cliPath = path.resolve(process.cwd(), 'dist/src/cli/index.js');
  const tempPo = getTmpPo(PO_WITH_FUZZY);

  const runResult = spawnSync(
    process.execPath,
    [cliPath, '--dry-run', '--include-fuzzy', tempPo.poFilePath],
    { encoding: 'utf8' },
  );

  tempPo.cleanup();

  expect(runResult.stderr).toBe('');
  expect(runResult.status).toBe(0);
  expect(runResult.stdout).toContain('UntranslatedWorld');
  expect(runResult.stdout).toContain('FuzzyHello');
});
