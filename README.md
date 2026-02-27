# msgai

`msgai` is a Node.js CLI that **automatically translates all untranslated strings in gettext (`.po`) files using AI (LLM)**. It reads your `.po` file, detects entries with empty or missing translations, sends them to an LLM (OpenAI), and writes the translations back into the file.

## Usage

### Commands

- `msgai <file.po>`: translates all untranslated `msgid` / `msgid_plural` entries in the file using AI and updates the `.po` file in place.
- `msgai <file.po> --dry-run`: only lists untranslated `msgid` values (no API calls, no file changes).
- `msgai --help`: prints command usage.

### Fuzzy entries

- By default, entries marked as **fuzzy** in the `.po` file (e.g. `#, fuzzy`) are **skipped** and not sent for translation.
- **`--include-fuzzy`**: include fuzzy entries. They are sent to the LLM with empty `msgstr` (like untranslated strings). After the translation is applied, the fuzzy flag is removed from those entries in the `.po` file.

### Source language

- **`--source-lang LANG`**: source language of `msgid` strings as an ISO 639-1 code (e.g. `en`, `uk`). If omitted, the model will infer the source language. Invalid codes cause the CLI to exit with an error.

### API key (for translation)

When running without `--dry-run`, the CLI needs an OpenAI API key. You can pass it in either of these ways:

- **Environment variable**: set `OPENAI_API_KEY` (e.g. in your shell or a `.env` file in the current directory).
- **CLI option**: pass `--api-key KEY` (e.g. `msgai messages.po --api-key sk-...`).

If neither is set, the CLI exits with code 1 and a message asking you to set the key.

On API errors (e.g. rate limit, quota, server errors), the CLI shows a status-specific message and exits with code 1. For error code reference, see [OpenAI API error codes](https://developers.openai.com/api/docs/guides/error-codes#api-errors).

## Development environment

### Requirements

- Node.js 20+ (recommended latest LTS)
- npm 10+

### Setup

```bash
npm install
```

### Scripts

- `npm run build`: compile TypeScript to `dist/`.
- `npm test`: build project and run Jest tests.
- `npm run test:watch`: build project and run Jest in watch mode.
- `npm run format`: format code with Prettier.
- `npm run lint:format`: check formatting with Prettier.
