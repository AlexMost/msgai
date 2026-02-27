# AGENT.md

This file defines working instructions for AI coding agents in this repository.

## Project Context

- Project: `msgai`
- Type: Node.js CLI (TypeScript, CommonJS build output)
- Main goal: automatically translate all untranslated strings in gettext (`.po`) files using AI (LLM); the tool finds empty `msgstr` entries, sends them to an LLM (OpenAI), and writes translations back to the file.
- Entry point: `src/cli/index.ts` (compiled to `dist/src/cli/index.js`)
- PO parsing logic: `src/po.ts`
- Tests: Jest (`test/**/*.test.ts`). CLI tests live under `test/cli/` (e.g. `test/cli/*.test.ts`).

## Environment and Commands

- Requirements: Node.js 20+, npm 10+
- Install deps: `npm install`
- Build: `npm run build`
- Test: `npm test`
- Integration Test: `npm run test:integration` (Always ask wether to run this test because it uses $ for tokens and checks the whole flow)
- Format: `npm run format`
- Lint: `npm run lint` (ESLint, TypeScript recommended)
- Check formatting: `npm run lint:format`

## Architecture

- **Side effects in the CLI folder**: Side effects (reading environment variables, reading or writing files, network calls triggered by the CLI) are welcome inside the `cli` folder (e.g. `cli/index.ts`, `cli/runTranslate.ts`). The rest of the codebase (`po.ts`, `translate.ts`, etc.) should stay pure: accept inputs as arguments and return results, without reading `process.env` or performing file I/O themselves. This keeps core logic testable and predictable.
- **`cli/index.ts`** is responsible for argument parsing and calling the appropriate command. It should not contain business logic or validation beyond parsing and help/error handling.
- **Argument validation** is done inside the appropriate command in the `cli` folder (e.g. the translate command in `cli/runTranslate.ts` validates `poFilePath`, `sourceLang`, `apiKey`), not in `index.ts`.

## Code Conventions

- Keep changes focused and minimal; avoid broad refactors unless requested.
- Prefer explicit, readable TypeScript over clever one-liners.
- Preserve current CLI UX:
  - Usage line: `Usage: msgai <file.po> [--dry-run] [--api-key KEY] [--source-lang LANG]`
  - Exit code `0` on success, non-zero on error paths.
- Avoid introducing new dependencies unless necessary.

## Commit conventions

- Commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) spec.
- Use `feat:` for new features (minor version), `fix:` for bug fixes (patch), optional scope in parentheses (e.g. `feat(cli): add option`).
- Use `BREAKING CHANGE:` in the footer or `!` after type/scope (e.g. `feat!: change default`) for major changes.
- Other types (e.g. `docs:`, `chore:`, `test:`) are allowed but do not affect the version bump; see the spec for the full format.
- When suggesting or describing commits, use conventional commit messages.

## Testing Expectations

- **Unit tests** (`test/`): Must not trigger the real API. Use mocks (e.g. mock `translate` or the OpenAI client) so `npm test` runs without network or API keys.
- **Integration tests** (`test-integration/`): Must trigger the real API (no mocks). They run the full flow and may require `OPENAI_API_KEY`; see `npm run test:integration`.
- **Every exported function** must have at least one unit test (in `test/`). When adding or changing exports, add or update the corresponding tests.
- For functional changes, update or add tests in `test/`.
- At minimum, run `npm run format`, `npm run lint`, `npm run lint:format` and `npm test` after meaningful code edits.
- For CLI behavior updates, prefer integration-style tests similar to `test/cli/dry-run.test.ts`.

## Agent Workflow

1. Read relevant files before editing.
2. Implement the smallest change that solves the task.
3. **After each change**: run `npm run format`, then `npm run lint:format` to ensure formatting is correct. Fix any formatting issues before continuing.
4. Run build/tests relevant to the change.
5. If tests cannot be run, clearly state what was not verified and why.
6. Summarize changed files and user-visible behavior in the final response.

## Safety and Scope

- Do not modify unrelated files.
- Do not commit or push unless explicitly requested.
- Do not change project-wide tooling/config unless required by the task.
- Flag ambiguous requirements before making irreversible changes.

## Quick Task Checklist

- [ ] Does the change match the requested behavior?
- [ ] Are edge cases covered (especially empty/malformed `.po` content and CLI args)?
- [ ] Were tests updated/added when behavior changed?
- [ ] Did format, lint:format, build, lint, and tests pass locally?
- [ ] Is the final explanation concise and actionable?
