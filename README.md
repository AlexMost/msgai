# msgai

`msgai` is a Node.js CLI utility for working with gettext (`.po`) files.
Current MVP behavior focuses on reading `.po` files and listing untranslated entries.

## Usage

### Commands

- `msgai <file.po>`: base CLI flow (MVP placeholder behavior).
- `msgai <file.po> --dry-run`: prints all untranslated `msgid` values from the `.po` file.
- `msgai --help`: prints command usage.

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
