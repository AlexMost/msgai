import fs from 'node:fs';
import {
  getUntranslatedMsgids,
  parsePoContent,
  getEntriesToTranslate,
  applyTranslations,
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
};

export async function runTranslate(
  poFilePath: string,
  apiKey: string,
  sourceLang?: string,
): Promise<number> {
  try {
    const poContent = fs.readFileSync(poFilePath, 'utf8');
    const parsedPo = parsePoContent(poContent);
    const { entries, keys } = getEntriesToTranslate(parsedPo);

    if (entries.length === 0) {
      console.log(`Nothing to translate in ${poFilePath}.`);
      return 0;
    }

    const targetLanguage = getLanguage(parsedPo) ?? 'en';
    const formula = getPluralForms(parsedPo) ?? '';
    const options = { apiKey, sourceLanguage: sourceLang, formula };

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
    fs.writeFileSync(poFilePath, compilePo(parsedPo), undefined);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to process PO file: ${message}`);
    return 1;
  }
}

const USAGE = 'Usage: msgai <file.po> [--dry-run] [--api-key KEY] [--source-lang LANG]';

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
    return runTranslate(args.poFilePath, resultApiKey, args.sourceLang);
  }

  try {
    const poContent = fs.readFileSync(args.poFilePath, 'utf8');
    const parsedPo = parsePoContent(poContent);
    const untranslatedMsgids = getUntranslatedMsgids(parsedPo);

    for (const msgid of untranslatedMsgids) {
      console.log(msgid);
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to process PO file: ${message}`);
    return 1;
  }
}
