# msgai

`msgai` is a Node.js CLI that **automatically translates all untranslated strings in gettext (`.po`) files using AI (LLM)**. It reads your `.po` file, detects entries with empty or missing translations, sends them to an LLM (OpenAI), and writes the translations back into the file.

## Usage

### Commands

- `msgai <file.po>`: translates all untranslated `msgid` / `msgid_plural` entries in the file using AI and updates the `.po` file in place.
- `msgai <file.po> --dry-run`: only lists untranslated `msgid` values (no API calls, no file changes).
- `msgai --help`: prints command usage.

### API key (for translation)

When running without `--dry-run`, the CLI needs an OpenAI API key. You can pass it in either of these ways:

- **Environment variable**: set `OPENAI_API_KEY` (e.g. in your shell or a `.env` file in the current directory).
- **CLI option**: pass `--api-key KEY` (e.g. `msgai messages.po --api-key sk-...`).

If neither is set, the CLI exits with code 1 and a message asking you to set the key.

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
