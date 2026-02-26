#!/usr/bin/env node

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { getUntranslatedMsgidsFromFile } from './po';
import { resolveApiKey } from './translate';

type CliArgs = {
  poFilePath?: string;
  dryRun: boolean;
  help: boolean;
  apiKey?: string;
  error?: string;
};

function parseArgs(argv: string[]): CliArgs {
  try {
    const parsedArgs = yargs(argv)
      .scriptName('msgai')
      .usage('Usage: msgai <file.po> [--dry-run] [--api-key KEY]')
      .option('dry-run', {
        type: 'boolean',
        default: false,
      })
      .option('api-key', {
        type: 'string',
        description: 'OpenAI API key (otherwise read from OPENAI_API_KEY env)',
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
    if (positionalArgs.length > 1) {
      return {
        dryRun: Boolean(parsedArgs['dry-run']),
        help: Boolean(parsedArgs.help),
        apiKey: parsedArgs['api-key'],
        error: `Unexpected argument: ${positionalArgs[1]}`,
      };
    }

    return {
      poFilePath: positionalArgs[0],
      dryRun: Boolean(parsedArgs['dry-run']),
      help: Boolean(parsedArgs.help),
      apiKey: parsedArgs['api-key'],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { dryRun: false, help: false, error: message };
  }
}

function main(argv: string[]): number {
  const args = parseArgs(argv);

  if (args.error) {
    console.error(args.error);
    console.error('Usage: msgai <file.po> [--dry-run] [--api-key KEY]');
    return 1;
  }

  if (args.help) {
    console.log('Usage: msgai <file.po> [--dry-run] [--api-key KEY]');
    return 0;
  }

  if (!args.poFilePath) {
    console.error('Usage: msgai <file.po> [--dry-run] [--api-key KEY]');
    return 1;
  }

  if (!args.dryRun) {
    try {
      resolveApiKey(args.apiKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message.replace('pass apiKey in options', 'pass --api-key'));
      return 1;
    }
    console.log(`[MVP] msgai received file: ${args.poFilePath}`);
    return 0;
  }

  try {
    const untranslatedMsgids = getUntranslatedMsgidsFromFile(args.poFilePath);

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
process.exit(exitCode);
