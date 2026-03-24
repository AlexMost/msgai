import fs from 'node:fs';
import { getExamples } from 'plural-forms';
import { getDebugLogger, initDebugLogger } from '../debug';
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

type ApiErrorLike = { status: number; code?: string; message?: string };

function isApiError(err: unknown): err is ApiErrorLike {
  return (
    err != null &&
    typeof err === 'object' &&
    'status' in err &&
    typeof (err as ApiErrorLike).status === 'number'
  );
}

function getApiErrorMessage(err: unknown): string | null {
  if (!isApiError(err)) return null;
  const status = err.status;
  const code = err.code;
  const message = (err.message ?? '') as string;

  switch (status) {
    case 401:
      return `Invalid or missing API key. Set OPENAI_API_KEY or use --api-key. Check key at https://platform.openai.com/settings/organization/api-keys`;
    case 403:
      return `API not available in your country/region. See https://developers.openai.com/api/docs/supported-countries`;
    case 429:
      if (code === 'insufficient_quota' || /quota/i.test(message)) {
        return `Quota exceeded (out of credits or usage limit). Check plan and billing: https://platform.openai.com/settings/organization/billing`;
      }
      return `Rate limit reached. Request was retried; if this persists, slow down or check https://developers.openai.com/api/docs/guides/rate-limits`;
    case 400:
      if (/response_format|json_schema|structured/i.test(message)) {
        return `The specified model may not support json_schema structured outputs required by msgai. Try a compatible model like gpt-5.4. API error: ${message}`;
      }
      return `Invalid request: ${message}`;
    case 500:
      return `OpenAI server error. Retry later; see https://status.openai.com/`;
    case 503:
      return `OpenAI overloaded. Retry after a short wait.`;
    default:
      return null;
  }
}

export type TranslateCommandArgs = {
  poFilePath?: string;
  dryRun: boolean;
  apiKey?: string;
  sourceLang?: string;
  model?: string;
  includeFuzzy?: boolean;
  foldLength?: number;
  debug?: boolean;
  context?: string;
};

export async function runTranslate(
  poFilePath: string,
  apiKey: string,
  sourceLang?: string,
  model?: string,
  includeFuzzy?: boolean,
  foldLength?: number,
  debug?: boolean,
  context?: string,
): Promise<number> {
  initDebugLogger(debug);
  const debugLogger = getDebugLogger();
  try {
    debugLogger.log('cli.runTranslate', 'Starting translation run', {
      poFilePath,
      sourceLang,
      model: model ?? 'gpt-5.4',
      includeFuzzy: includeFuzzy === true,
    });
    const poContent = fs.readFileSync(poFilePath, 'utf8');
    debugLogger.log('cli.runTranslate', 'Read PO file', {
      poFilePath,
      bytes: Buffer.byteLength(poContent, 'utf8'),
    });
    const parsedPo = parsePoContent(poContent);
    const { entries } = getEntriesToTranslate(parsedPo, { includeFuzzy });

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
    const options = {
      apiKey,
      sourceLanguage: sourceLang,
      formula,
      pluralSamples,
      model,
      debug,
      context,
    };

    debugLogger.log('cli.runTranslate', 'Computed translation run inputs', {
      targetLanguage,
      formula,
      pluralSamples,
      entryCount: entries.length,
      entries,
    });

    for (let i = 0; i < entries.length; i += TRANSLATE_BATCH_SIZE) {
      const batch = entries.slice(i, i + TRANSLATE_BATCH_SIZE);
      const batchNum = Math.floor(i / TRANSLATE_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(entries.length / TRANSLATE_BATCH_SIZE);
      debugLogger.log('cli.runTranslate', 'Preparing translation batch', {
        batch: batchNum,
        totalBatches,
        batchSize: batch.length,
        entries: batch,
      });
      console.log(
        `Translating batch ${batchNum}/${totalBatches} (${batch.length} phrase${batch.length === 1 ? '' : 's'})...`,
      );
      const batchResults = await translateStrings(batch, targetLanguage, options);
      debugLogger.log('cli.runTranslate', 'Received translation batch results', {
        batch: batchNum,
        results: batchResults,
      });
      for (const r of batchResults) {
        if (typeof r.msgstr === 'string') {
          console.log(`  ${r.msgid} => ${r.msgstr}`);
        } else {
          console.log(`  ${r.msgid_plural} (plural) => ${r.msgstr.join(' | ')}`);
        }
      }
      applyTranslations(parsedPo, batchResults);
      if (includeFuzzy) {
        clearFuzzyFromEntries(parsedPo, batchResults);
      }
      fs.writeFileSync(poFilePath, compilePo(parsedPo, { foldLength }));
      debugLogger.log('cli.runTranslate', 'Wrote translated batch back to PO file', {
        batch: batchNum,
        poFilePath,
      });
    }

    return 0;
  } catch (error) {
    debugLogger.log('cli.runTranslate', 'Translation run failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    const apiMessage = getApiErrorMessage(error);
    if (apiMessage != null) {
      console.warn(apiMessage);
      return 1;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to process PO file: ${message}`);
    return 1;
  }
}

export const USAGE =
  'Usage: msgai <file.po> [--dry-run] [--api-key KEY] [--source-lang LANG] [--model MODEL] [--include-fuzzy] [--fold-length N] [--context TEXT] [--config PATH] [--debug]';

export function runTranslateCommand(args: TranslateCommandArgs): number | Promise<number> {
  initDebugLogger(args.debug);
  const debugLogger = getDebugLogger();
  debugLogger.log('cli.runTranslateCommand', 'Received command args', args);
  if (!args.poFilePath) {
    console.warn(USAGE);
    return 1;
  }

  if (args.sourceLang != null) {
    try {
      validateSourceLang(args.sourceLang);
    } catch (error) {
      debugLogger.log('cli.runTranslateCommand', 'Source language validation failed', {
        sourceLang: args.sourceLang,
        error: error instanceof Error ? error.message : String(error),
      });
      const message = error instanceof Error ? error.message : String(error);
      console.warn(message);
      return 1;
    }
  }

  if (!args.dryRun) {
    let resultApiKey: string;
    try {
      resultApiKey = resolveApiKey(args.apiKey);
      debugLogger.log('cli.runTranslateCommand', 'Resolved API key for translation run', {
        source: args.apiKey != null && args.apiKey.trim() !== '' ? 'cli-arg' : 'env',
      });
    } catch (error) {
      debugLogger.log('cli.runTranslateCommand', 'API key resolution failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      const message = error instanceof Error ? error.message : String(error);
      console.warn(message.replace('pass apiKey in options', 'pass --api-key'));
      return 1;
    }
    return runTranslate(
      args.poFilePath,
      resultApiKey,
      args.sourceLang,
      args.model,
      args.includeFuzzy,
      args.foldLength,
      args.debug,
      args.context,
    );
  }

  try {
    const poContent = fs.readFileSync(args.poFilePath, 'utf8');
    debugLogger.log('cli.runTranslateCommand', 'Dry-run read PO file', {
      poFilePath: args.poFilePath,
      bytes: Buffer.byteLength(poContent, 'utf8'),
    });
    const parsedPo = parsePoContent(poContent);
    const { entries } = getEntriesToTranslate(parsedPo, {
      includeFuzzy: args.includeFuzzy,
    });
    debugLogger.log('cli.runTranslateCommand', 'Dry-run extracted entries', {
      entryCount: entries.length,
      entries,
    });
    const msgidsToShow = entries.map((e) => e.msgid);

    for (const msgid of msgidsToShow) {
      console.log(msgid);
    }
    return 0;
  } catch (error) {
    debugLogger.log('cli.runTranslateCommand', 'Dry-run failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to process PO file: ${message}`);
    return 1;
  }
}
