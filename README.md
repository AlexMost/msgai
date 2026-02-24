# msgai

`msgai` is a Node.js CLI utility for automating gettext (`.po`) translations using an LLM API token.

## Current status (MVP Step 1)

- Project bootstrap is done.
- Basic CLI command is available: `msgai <file.po>`.
- CLI currently validates input and prints a service output (no translation logic yet).

## Implemented CLI commands

- `msgai <file.po>`: accepts one `.po` file path and runs the current MVP CLI flow.

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
- `npm test`: build project and run Jest smoke tests.
- `npm run test:watch`: build project and run Jest in watch mode.
- `npm run format`: format code with Prettier.
- `npm run lint:format`: check formatting with Prettier.

## Next steps

- Add argument parsing with `yargs`.
- Add `.po` parsing with `gettext-parser`.
- Implement translation flow for entries with empty `msgstr`.
