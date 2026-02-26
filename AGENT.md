# AGENT.md

This file defines working instructions for AI coding agents in this repository.

## Project Context

- Project: `msgai`
- Type: Node.js CLI (TypeScript, CommonJS build output)
- Main goal: automatically translate all untranslated strings in gettext (`.po`) files using AI (LLM); the tool finds empty `msgstr` entries, sends them to an LLM (OpenAI), and writes translations back to the file.
- Entry point: `src/cli.ts` (compiled to `dist/src/cli.js`)
- PO parsing logic: `src/po.ts`
- Tests: Jest (`test/**/*.test.ts`)

## Environment and Commands

- Requirements: Node.js 20+, npm 10+
- Install deps: `npm install`
- Build: `npm run build`
- Test: `npm test`
- Integration Test: `npm run test:integration` (Always ask wether to run this test because it uses $ for tokens and checks the whole flow)
- Format: `npm run format`
- Check formatting: `npm run lint:format`

## Code Conventions

- Keep changes focused and minimal; avoid broad refactors unless requested.
- Prefer explicit, readable TypeScript over clever one-liners.
- Preserve current CLI UX:
  - Usage line: `Usage: msgai <file.po> [--dry-run]`
  - Exit code `0` on success, non-zero on error paths.
- Avoid introducing new dependencies unless necessary.

## Testing Expectations

- **Unit tests** (`test/`): Must not trigger the real API. Use mocks (e.g. mock `translate` or the OpenAI client) so `npm test` runs without network or API keys.
- **Integration tests** (`test-integration/`): Must trigger the real API (no mocks). They run the full flow and may require `OPENAI_API_KEY`; see `npm run test:integration`.
- **Every exported function** must have at least one unit test (in `test/`). When adding or changing exports, add or update the corresponding tests.
- For functional changes, update or add tests in `test/`.
- At minimum, run `npm run format`, `npm run lint:format` and `npm test` after meaningful code edits.
- For CLI behavior updates, prefer integration-style tests similar to `test/cli.dry-run.test.ts`.

## Agent Workflow

1. Read relevant files before editing.
2. Implement the smallest change that solves the task.
3. Run build/tests relevant to the change.
4. If tests cannot be run, clearly state what was not verified and why.
5. Summarize changed files and user-visible behavior in the final response.

## Safety and Scope

- Do not modify unrelated files.
- Do not commit or push unless explicitly requested.
- Do not change project-wide tooling/config unless required by the task.
- Flag ambiguous requirements before making irreversible changes.

## Quick Task Checklist

- [ ] Does the change match the requested behavior?
- [ ] Are edge cases covered (especially empty/malformed `.po` content and CLI args)?
- [ ] Were tests updated/added when behavior changed?
- [ ] Did build/tests pass locally?
- [ ] Is the final explanation concise and actionable?
