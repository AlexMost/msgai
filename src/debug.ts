export type DebugLogger = {
  enabled: boolean;
  log: (scope: string, message: string, details?: unknown) => void;
};

const debugState = {
  enabled: false,
};

const debugLogger: DebugLogger = {
  get enabled(): boolean {
    return debugState.enabled;
  },
  log(scope: string, message: string, details?: unknown): void {
    if (!debugState.enabled) return;
    const prefix = `[debug] [${scope}] ${message}`;
    if (details === undefined) {
      console.warn(prefix);
      return;
    }
    console.warn(prefix, details);
  },
};

export function hasDebugFlag(argv: string[]): boolean {
  return argv.includes('--debug');
}

function isDebugEnvEnabled(): boolean {
  return process.env['DEBUG'] === '1';
}

export function initDebugLogger(enabled?: boolean): DebugLogger {
  debugState.enabled = enabled === true || isDebugEnvEnabled();
  return debugLogger;
}

export function getDebugLogger(): DebugLogger {
  return debugLogger;
}
