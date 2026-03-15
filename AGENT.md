# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**msgai** — a Node.js CLI tool (TypeScript, CommonJS output) that translates untranslated strings in gettext `.po` files using OpenAI models. It finds empty `msgstr` entries, sends them to an LLM, and writes translations back.

## Commands

```bash
npm install          # Install dependencies (Node.js 20+, npm 10+)
npm run build        # TypeScript → dist/
npm test             # Build + run unit tests (Jest)
npm run test:integration  # Real API tests (requires OPENAI_API_KEY, costs money — ask before running)
npm run format       # Prettier auto-fix
npm run lint         # ESLint check
npm run lint:format  # Prettier check (no writes)
```

Run a single test file: `npx jest test/po.test.ts`

Before committing: `npm run format && npm run lint && npm test`

## Architecture

- **`src/cli/`** — The only place side effects (file I/O, env vars, network) are allowed. `index.ts` handles argument parsing via yargs; `runTranslate.ts` coordinates the translate command and validates arguments.
- **`src/po.ts`** — Pure functions for PO file parsing/compilation (`parsePoContent`, `getEntriesToTranslate`, `applyTranslations`, `compilePo`). Uses `gettext-parser`.
- **`src/translate.ts`** — OpenAI API integration: batching, retries (exponential backoff on 429/500/503), structured JSON output schema. Pure except for the API call itself.
- **`src/validate-source-lang.ts`** — ISO 639-1 language code validation.
- **`src/loadEnv.ts`** / **`src/debug.ts`** — Dotenv loading and debug logging.

Core modules outside `cli/` must remain pure: accept inputs as arguments, return results, no `process.env` reads or file I/O.

- **`cli/index.ts`** is strictly for argument parsing and help/error handling — no business logic or validation.
- **Argument validation** belongs in command files (e.g. `runTranslate.ts` validates `poFilePath`, `sourceLang`, `apiKey`), not in `index.ts`.
- **Preserve CLI UX**: usage line format (`Usage: msgai <file.po> [--dry-run] [--api-key KEY] [--source-lang LANG]`), exit code 0 on success, non-zero on errors.

## Testing

- **Unit tests** (`test/`): Must not call real APIs. Mock `translate` or the OpenAI client.
- **Integration tests** (`test-integration/`): Hit real OpenAI API, require `OPENAI_API_KEY`.
- Every exported function needs at least one unit test.
- CLI behavior tests go in `test/cli/` following the pattern in `dry-run.test.ts` (spawn process, assert stdout/stderr/exit code).

## Code Conventions

- Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `test:` etc. Use `BREAKING CHANGE:` or `!` for majors.
- Keep changes focused and minimal; avoid broad refactors unless requested.
- Prefer explicit, readable TypeScript over clever one-liners.
- Avoid introducing new dependencies unless necessary.
- Formatting: Prettier (semicolons, single quotes, trailing commas, 100-char width).
