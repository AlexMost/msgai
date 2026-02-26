#!/usr/bin/env node

import fs from 'node:fs';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import {
  getUntranslatedMsgids,
  parsePoContent,
  getEntriesToTranslate,
  applyTranslations,
  compilePo,
  getLanguage,
  getPluralForms,
} from './po';
import { resolveApiKey, translateStrings } from './translate';
import { validateSourceLang } from './validate-source-lang';

const TRANSLATE_BATCH_SIZE = 15;

type CliArgs = {
  poFilePath?: string;
  dryRun: boolean;
  help: boolean;
  apiKey?: string;
  sourceLang?: string;
  error?: string;
};

function parseArgs(argv: string[]): CliArgs {
  try {
    const parsedArgs = yargs(argv)
      .scriptName('msgai')
      .usage('Usage: msgai <file.po> [--dry-run] [--api-key KEY] [--source-lang LANG]')
      .option('dry-run', {
        type: 'boolean',
        default: false,
      })
      .option('api-key', {
        type: 'string',
        description: 'OpenAI API key (otherwise read from OPENAI_API_KEY env)',
      })
      .option('source-lang', {
        type: 'string',
        description:
          'Source language of msgid strings (ISO 639-1 code, e.g. en, uk). If omitted, the model will detect it.',
      })
      .option('help', {
        alias: 'h',
        type: 'boolean',
        default: false,
      })
      .strictOptions()
      .version(false)
      .exitProcess(false)
      .fail((message, error) => {
        if (error) {
          throw error;
        }

        throw new Error(message);
      })
      .parseSync();

    const positionalArgs = parsedArgs._.map(String);
    const sourceLangRaw = parsedArgs['source-lang'];
    const sourceLang =
      sourceLangRaw != null && String(sourceLangRaw).trim() !== ''
        ? String(sourceLangRaw).trim().toLowerCase()
        : undefined;

    if (positionalArgs.length > 1) {
      return {
        dryRun: Boolean(parsedArgs['dry-run']),
        help: Boolean(parsedArgs.help),
        apiKey: parsedArgs['api-key'],
        sourceLang,
        error: `Unexpected argument: ${positionalArgs[1]}`,
      };
    }

    return {
      poFilePath: positionalArgs[0],
      dryRun: Boolean(parsedArgs['dry-run']),
      help: Boolean(parsedArgs.help),
      apiKey: parsedArgs['api-key'],
      sourceLang,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { dryRun: false, help: false, error: message };
  }
}

export async function runTranslate(
  poFilePath: string,
  apiKey: string,
  sourceLang?: string
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
      console.log(`Translating batch ${batchNum}/${totalBatches} (${batch.length} phrase${batch.length === 1 ? '' : 's'})...`);
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

function main(argv: string[]): number | undefined {
  const args = parseArgs(argv);

  if (args.error) {
    console.error(args.error);
    console.error('Usage: msgai <file.po> [--dry-run] [--api-key KEY] [--source-lang LANG]');
    return 1;
  }

  if (args.help) {
    console.log('Usage: msgai <file.po> [--dry-run] [--api-key KEY] [--source-lang LANG]');
    return 0;
  }

  if (!args.poFilePath) {
    console.error('Usage: msgai <file.po> [--dry-run] [--api-key KEY] [--source-lang LANG]');
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
    let resultApiKey;
    try {
      resultApiKey = resolveApiKey(args.apiKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message.replace('pass apiKey in options', 'pass --api-key'));
      return 1;
    }
    runTranslate(args.poFilePath, resultApiKey, args.sourceLang).then((code) =>
      process.exit(code)
    );
    return undefined as unknown as number;
  }

  try {
    const poContent = fs.readFileSync(args.poFilePath, 'utf8');
    const parsedPo = parsePoContent(poContent);
    const untranslatedMsgids = getUntranslatedMsgids(parsedPo);

    for (const msgid of untranslatedMsgids) {
      console.log(msgid);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to process PO file: ${message}`);
    return 1;
  }

  return 0;
}

const exitCode = main(hideBin(process.argv));
if (typeof exitCode === 'number') {
  process.exit(exitCode);
}
