/**
 * Development script to verify OpenAI translate integration.
 * Run: npm run script:test-openai
 * Requires OPENAI_API_KEY in environment or .env.
 */

import { translateStrings } from '../src/translate';
import dotenv from 'dotenv';

dotenv.config();

async function main(): Promise<void> {
  const targetLanguage = 'uk';
  const sourceLanguage = 'en';
  const entries = [{ msgid: 'Hello' }, { msgid: 'World' }];

  console.log('Calling OpenAI translate with hardcoded values...');
  console.log('  entries:', entries);
  console.log('  target_language:', targetLanguage);
  console.log('  source_language:', sourceLanguage);

  const result = await translateStrings(entries, targetLanguage, { sourceLanguage });

  console.log('Result:', result);
  console.log('Success: OpenAI translate call completed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
