import fs from 'node:fs';
import path from 'node:path';
import { ConfigFile, parseConfigFile } from '../config';

const DEFAULT_CONFIG_FILENAME = 'msgai.config.yml';

export function loadConfigFile(configPath?: string): ConfigFile | null {
  if (configPath !== undefined) {
    const content = fs.readFileSync(configPath, 'utf8');
    return parseConfigFile(content);
  }

  const defaultPath = path.join(process.cwd(), DEFAULT_CONFIG_FILENAME);
  if (!fs.existsSync(defaultPath)) {
    return null;
  }

  const content = fs.readFileSync(defaultPath, 'utf8');
  return parseConfigFile(content);
}
