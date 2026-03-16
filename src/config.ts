import { z } from 'zod';
import { parse as parseYaml } from 'yaml';

const KEBAB_TO_CAMEL: Record<string, string> = {
  'source-lang': 'sourceLang',
  'include-fuzzy': 'includeFuzzy',
  'fold-length': 'foldLength',
  'api-key': 'apiKey',
  'dry-run': 'dryRun',
};

function normalizeKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = KEBAB_TO_CAMEL[key] ?? key;
    result[camelKey] = value;
  }
  return result;
}

export const configFileSchema = z
  .object({
    sourceLang: z.string().optional(),
    model: z.string().optional(),
    includeFuzzy: z.boolean().optional(),
    foldLength: z
      .number()
      .int('foldLength must be an integer')
      .nonnegative('foldLength must be a non-negative integer')
      .optional(),
    context: z.string().optional(),
    debug: z.boolean().optional(),
    apiKey: z
      .any()
      .refine((val) => val === undefined, {
        message:
          'apiKey must not be set in config file for security reasons. Use --api-key flag or OPENAI_API_KEY env variable.',
      })
      .optional(),
    dryRun: z
      .any()
      .refine((val) => val === undefined, {
        message: 'dryRun is not allowed in config file. Use --dry-run flag instead.',
      })
      .optional(),
  })
  .strict()
  .transform((val) => {
    const { apiKey, dryRun, ...rest } = val;
    void apiKey;
    void dryRun;
    return rest;
  });

export type ConfigFile = {
  sourceLang?: string;
  model?: string;
  includeFuzzy?: boolean;
  foldLength?: number;
  context?: string;
  debug?: boolean;
};

export function parseConfigFile(content: string): ConfigFile {
  const parsed = parseYaml(content);

  if (parsed == null || typeof parsed !== 'object') {
    return {};
  }

  const normalized = normalizeKeys(parsed as Record<string, unknown>);
  return configFileSchema.parse(normalized);
}

export type CliArgs = {
  poFilePath?: string;
  dryRun: boolean;
  help: boolean;
  apiKey?: string;
  sourceLang?: string;
  model?: string;
  includeFuzzy?: boolean;
  foldLength?: number;
  context?: string;
  debug?: boolean;
  config?: string;
  error?: string;
};

export function mergeConfigWithArgs(
  config: ConfigFile,
  cliArgs: Partial<CliArgs>,
): Partial<CliArgs> {
  return {
    ...cliArgs,
    sourceLang: cliArgs.sourceLang !== undefined ? cliArgs.sourceLang : config.sourceLang,
    model: cliArgs.model !== undefined ? cliArgs.model : config.model,
    includeFuzzy: cliArgs.includeFuzzy !== undefined ? cliArgs.includeFuzzy : config.includeFuzzy,
    foldLength: cliArgs.foldLength !== undefined ? cliArgs.foldLength : config.foldLength,
    context: cliArgs.context !== undefined ? cliArgs.context : config.context,
    debug: cliArgs.debug !== undefined ? cliArgs.debug : config.debug,
  };
}
