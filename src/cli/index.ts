#!/usr/bin/env node

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { getDebugLogger, initDebugLogger } from '../debug';
import { CliArgs, mergeConfigWithArgs } from '../config';
import { loadConfigFile } from './loadConfig';
import { runTranslateCommand, USAGE } from './runTranslate';

function normalizeFoldLength(value: unknown): number | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error('Invalid --fold-length. Expected a non-negative integer.');
  }

  if (value < 0) {
    throw new Error('Invalid --fold-length. Expected a non-negative integer.');
  }

  return value;
}

function parseArgs(argv: string[]): CliArgs {
  try {
    const parsedArgs = yargs(argv)
      .scriptName('msgai')
      .usage(USAGE)
      .option('dry-run', {
        type: 'boolean',
        default: false,
      })
      .option('include-fuzzy', {
        type: 'boolean',
        description: 'Include fuzzy entries for translation (re-translate and clear fuzzy flag)',
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
      .option('model', {
        type: 'string',
        description: 'OpenAI model to use for translation. Default: gpt-4o',
      })
      .option('fold-length', {
        type: 'number',
        description: 'PO line fold length when writing files. Use 0 to disable folding. Default: 0',
      })
      .option('context', {
        type: 'string',
        description:
          'Additional instructions for the translation model in English (e.g. "use formal tone")',
      })
      .option('help', {
        alias: 'h',
        type: 'boolean',
        default: false,
      })
      .option('debug', {
        type: 'boolean',
        description: 'Print debug logs for request/response validation and batch processing',
      })
      .option('config', {
        type: 'string',
        description: 'Path to config file (default: msgai.config.yml in current directory)',
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
    const modelRaw = parsedArgs.model;
    const model =
      modelRaw != null && String(modelRaw).trim() !== '' ? String(modelRaw).trim() : undefined;
    const foldLength = normalizeFoldLength(parsedArgs['fold-length']);
    const contextRaw = parsedArgs.context;
    const context =
      contextRaw != null && String(contextRaw).trim() !== ''
        ? String(contextRaw).trim()
        : undefined;

    const configRaw = parsedArgs.config;
    const config =
      configRaw != null && String(configRaw).trim() !== '' ? String(configRaw).trim() : undefined;

    if (positionalArgs.length > 1) {
      const result: CliArgs = {
        dryRun: Boolean(parsedArgs['dry-run']),
        help: Boolean(parsedArgs.help),
        apiKey: parsedArgs['api-key'],
        sourceLang,
        model,
        includeFuzzy: parsedArgs['include-fuzzy'],
        foldLength,
        context,
        debug: parsedArgs.debug,
        config,
        error: `Unexpected argument: ${positionalArgs[1]}`,
      };
      return result;
    }

    const result: CliArgs = {
      poFilePath: positionalArgs[0],
      dryRun: Boolean(parsedArgs['dry-run']),
      help: Boolean(parsedArgs.help),
      apiKey: parsedArgs['api-key'],
      sourceLang,
      model,
      includeFuzzy: parsedArgs['include-fuzzy'],
      foldLength,
      context,
      debug: parsedArgs.debug,
      config,
    };
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { dryRun: false, help: false, error: message };
  }
}

function main(argv: string[]): number | undefined {
  const rawArgs = parseArgs(argv);
  initDebugLogger(rawArgs.debug);
  const debugLogger = getDebugLogger();
  debugLogger.log('cli.main', 'Entering CLI main', { argv, args: rawArgs });

  if (rawArgs.error) {
    debugLogger.log('cli.main', 'Exiting because args contained an error', {
      error: rawArgs.error,
    });
    console.warn(rawArgs.error);
    console.warn(USAGE);
    return 1;
  }

  if (rawArgs.help) {
    debugLogger.log('cli.main', 'Printing help output');
    console.log(USAGE);
    return 0;
  }

  let args: Partial<CliArgs>;
  try {
    const config = loadConfigFile(rawArgs.config);
    debugLogger.log('cli.main', 'Loaded config file', { config });
    args = config ? mergeConfigWithArgs(config, rawArgs) : rawArgs;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Config file error: ${message}`);
    return 1;
  }

  // Default remaining undefined booleans after config merge
  const dryRun = args.dryRun ?? false;
  const includeFuzzy = args.includeFuzzy ?? false;
  const debug = args.debug ?? false;

  debugLogger.log('cli.main', 'Dispatching runTranslateCommand');
  const result = runTranslateCommand({
    poFilePath: args.poFilePath,
    dryRun,
    apiKey: args.apiKey,
    sourceLang: args.sourceLang,
    model: args.model,
    includeFuzzy,
    foldLength: args.foldLength,
    context: args.context,
    debug,
  });

  if (result instanceof Promise) {
    debugLogger.log('cli.main', 'runTranslateCommand returned a promise');
    result.then((code) => process.exit(code));
    return undefined as unknown as number;
  }

  debugLogger.log('cli.main', 'runTranslateCommand returned synchronously', { exitCode: result });
  return result;
}

const exitCode = main(hideBin(process.argv));
if (typeof exitCode === 'number') {
  process.exit(exitCode);
}
