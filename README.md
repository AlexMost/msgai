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

### Commit messages

This repo follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for commit messages: use `feat:` for new features, `fix:` for bug fixes, optional scope (e.g. `feat(cli):`), and `BREAKING CHANGE:` or `!` for major changes. This drives version bumps and CHANGELOG updates via release-please.

### Scripts

- `npm run build`: compile TypeScript to `dist/`.
- `npm test`: build project and run Jest tests.
- `npm run test:watch`: build project and run Jest in watch mode.
- `npm run format`: format code with Prettier.
- `npm run lint:format`: check formatting with Prettier.

## Publishing

Releases are driven by [release-please](https://github.com/googleapis/release-please): it opens a **Release PR** that bumps the version and updates `CHANGELOG.md` from conventional commits. After the Release PR is merged, release-please creates the release tag on `main`.

**Release-please setup:** In the repo go to **Settings → Actions → General → Workflow permissions** and set to **Read and write** and enable **Allow GitHub Actions to create and approve pull requests**. You can then use the default `GITHUB_TOKEN` (no secret). If you see "Error adding to tree" or PR creation blocked, add a Personal Access Token as secret `RELEASE_PLEASE_TOKEN` (classic: `repo` + `workflow` scope; fine-grained: Contents + Pull requests + Workflows write).

**Publishing to npm (local):**

1. Pull `main` with the new release tag.
2. Run `npm publish`.

Before publishing, `prepublishOnly` runs build, unit tests, integration tests, lint, and format checks. Set `OPENAI_API_KEY` so integration tests pass.
