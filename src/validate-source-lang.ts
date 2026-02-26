import { hasLang } from 'plural-forms';

export const ISO_LANG_CODES_URL = 'https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes';

export function validateSourceLang(code: string): void {
  const normalized = code.trim().toLowerCase();
  if (!hasLang(normalized)) {
    throw new Error(
      `Invalid --source-lang "${code}": not a known ISO language code. See ${ISO_LANG_CODES_URL} for a list of valid codes.`,
    );
  }
}
