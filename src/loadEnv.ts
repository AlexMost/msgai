/**
 * Single place for loading .env. Used by the CLI and scripts so env is loaded once.
 */
import dotenv from 'dotenv';
import path from 'node:path';

let loaded = false;

export function loadEnv(): void {
  if (loaded) return;
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  loaded = true;
}
