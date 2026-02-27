import fs from 'node:fs';
import { getExamples } from 'plural-forms';
import {
  parsePoContent,
  getEntriesToTranslate,
  applyTranslations,
  clearFuzzyFromEntries,
  compilePo,
  getLanguage,
  getPluralForms,
} from '../po';
import { resolveApiKey, translateStrings } from '../translate';
import { validateSourceLang } from '../validate-source-lang';

const TRANSLATE_BATCH_SIZE = 15;

export type TranslateCommandArgs = {
  poFilePath?: string;
  dryRun: boolean;
  apiKey?: string;
  sourceLang?: string;
  includeFuzzy?: boolean;
};

export async function runTranslate(
  poFilePath: string,
  apiKey: string,
  sourceLang?: string,
  includeFuzzy?: boolean,
): Promise<number> {
  try {
    const poContent = fs.readFileSync(poFilePath, 'utf8');
    const parsedPo = parsePoContent(poContent);
    const { entries, keys } = getEntriesToTranslate(parsedPo, { includeFuzzy });

    if (entries.length === 0) {
      console.log(`Nothing to translate in ${poFilePath}.`);
      return 0;
    }

    const targetLanguage = getLanguage(parsedPo) ?? 'en';
    const formula = getPluralForms(parsedPo) ?? '';
    const normalizedTarget = (targetLanguage ?? '').trim().split(/\s/)[0] ?? '';
    let pluralSamples: { plural: number; sample: number }[] | undefined;
    if (normalizedTarget) {
      try {
        pluralSamples = getExamples(normalizedTarget);
      } catch {
        // locale not in plural-forms; rely on formula only
      }
    }
    const options = { apiKey, sourceLanguage: sourceLang, formula, pluralSamples };

    const allResults: Awaited<ReturnType<typeof translateStrings>> = [];
    for (let i = 0; i < entries.length; i += TRANSLATE_BATCH_SIZE) {
      const batch = entries.slice(i, i + TRANSLATE_BATCH_SIZE);
      const batchNum = Math.floor(i / TRANSLATE_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(entries.length / TRANSLATE_BATCH_SIZE);
      console.log(
        `Translating batch ${batchNum}/${totalBatches} (${batch.length} phrase${batch.length === 1 ? '' : 's'})...`,
      );
      const batchResults = await translateStrings(batch, targetLanguage, options);
      for (const r of batchResults) {
        if (typeof r.msgstr === 'string') {
          console.log(`  ${r.msgid} => ${r.msgstr}`);
        } else {
          console.log(`  ${r.msgid_plural} (plural) => ${r.msgstr.join(' | ')}`);
        }
      }
      allResults.push(...batchResults);
    }

    applyTranslations(parsedPo, keys, allResults);
    if (includeFuzzy) {
      clearFuzzyFromEntries(parsedPo, keys);
    }
    fs.writeFileSync(poFilePath, compilePo(parsedPo), undefined);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to process PO file: ${message}`);
    return 1;
  }
}

const USAGE =
  'Usage: msgai <file.po> [--dry-run] [--api-key KEY] [--source-lang LANG] [--include-fuzzy]';

export function runTranslateCommand(args: TranslateCommandArgs): number | Promise<number> {
  if (!args.poFilePath) {
    console.error(USAGE);
    return 1;
  }

  if (args.sourceLang != null) {
    try {
      validateSourceLang(args.sourceLang);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      return 1;
    }
  }

  if (!args.dryRun) {
    let resultApiKey: string;
    try {
      resultApiKey = resolveApiKey(args.apiKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message.replace('pass apiKey in options', 'pass --api-key'));
      return 1;
    }
    return runTranslate(args.poFilePath, resultApiKey, args.sourceLang, args.includeFuzzy);
  }

  try {
    const poContent = fs.readFileSync(args.poFilePath, 'utf8');
    const parsedPo = parsePoContent(poContent);
    const { entries } = getEntriesToTranslate(parsedPo, {
      includeFuzzy: args.includeFuzzy,
    });
    const msgidsToShow = entries.map((e) => e.msgid);

    for (const msgid of msgidsToShow) {
      console.log(msgid);
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to process PO file: ${message}`);
    return 1;
  }
}
