#!/usr/bin/env node

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { runTranslateCommand } from './runTranslate';

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

const USAGE = 'Usage: msgai <file.po> [--dry-run] [--api-key KEY] [--source-lang LANG]';

function main(argv: string[]): number | undefined {
  const args = parseArgs(argv);

  if (args.error) {
    console.error(args.error);
    console.error(USAGE);
    return 1;
  }

  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  const result = runTranslateCommand({
    poFilePath: args.poFilePath,
    dryRun: args.dryRun,
    apiKey: args.apiKey,
    sourceLang: args.sourceLang,
  });

  if (result instanceof Promise) {
    result.then((code) => process.exit(code));
    return undefined as unknown as number;
  }

  return result;
}

const exitCode = main(hideBin(process.argv));
if (typeof exitCode === 'number') {
  process.exit(exitCode);
}
