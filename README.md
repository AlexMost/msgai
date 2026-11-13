# msgai

`msgai` is an AI-powered CLI for translating gettext `.po` files. It finds untranslated entries, sends them to an LLM, and writes the translated strings back into the same file.

## 🤖 Project Purpose

`msgai` is built for teams that already use gettext and want a simple way to translate missing strings without building a separate localization workflow.

Main features:

- `📝` Works directly with gettext `.po` files
- `🤖` Translates only untranslated entries using AI
- `🧠` Uses OpenAI `gpt-6.1-terra` by default for translation
- `🔌` Works with any OpenAI-compatible API (e.g. a LiteLLM proxy) via `--base-url`
- `🏷️` Respects gettext context (`msgctxt`) when translating entries
- `🔁` Supports singular and plural translations
- `⚠️` Skips fuzzy entries by default
- `🪪` Marks every AI translation with a `# ai-translated` translator comment
- `🧭` Can infer source language or use `--source-lang`
- `💻` Runs as a small CLI that updates files in place

## ⚙️ How It Works

1. Read the `.po` file and parse its entries.
2. Find entries with empty or missing translations.
3. Send those strings to OpenAI `gpt-6.1-terra` for translation while preserving gettext context such as `msgctxt`.
4. Write the translated values back into the same `.po` file.

The translation API uses OpenAI `json_schema` structured outputs. Only models that support `json_schema` structured outputs are valid for `msgai`.

Any OpenAI model that supports `json_schema` structured outputs can be used via the `--model` flag.

For the default model, `msgai` requests `reasoning_effort: "none"` with `temperature: 0` for fast, stable translations. When you choose a different model with `--model` (or `model` in the config file), `msgai` sends neither parameter, so the model's own defaults apply. This keeps any structured-outputs model working, including ones that reject `temperature` or `reasoning_effort`.

By default, entries marked as `fuzzy` are skipped. If you use `--include-fuzzy`, `msgai` will translate those entries too and remove the fuzzy flag after applying the result.

Every entry that `msgai` translates gets a `# ai-translated` translator comment so you can tell AI translations apart from human ones. Existing translator comments are preserved. Use `--add-fuzzy` to additionally mark fresh translations with the gettext `fuzzy` flag — useful when you want a human to review every AI translation before it ships.

## 📦 Install

Install the CLI globally:

```bash
npm install -g msgai-cli
```

Set your OpenAI API key before running translations:

```bash
export OPENAI_API_KEY=your_api_key_here
```

You can also pass the key directly:

```bash
msgai messages.po --api-key sk-...
```

`OPENAI_API_KEY` can be loaded from your environment or from a `.env` file in the current directory.

### OpenAI-compatible APIs (LiteLLM and other proxies)

By default `msgai` talks to the OpenAI API. To use an OpenAI-compatible endpoint, such as a [LiteLLM](https://docs.litellm.ai/) proxy, set its base URL. `msgai` takes the first value it finds, in this order:

1. `--base-url URL` CLI flag
2. `base-url` in `msgai.config.yml`
3. `OPENAI_BASE_URL` environment variable (or `.env` file in the current directory)
4. the OpenAI API (`https://api.openai.com/v1`)

The base URL must be an `http(s)` URL, usually ending in `/v1`. The API key is still read from `--api-key` or `OPENAI_API_KEY`; use the key issued by your proxy.

Example with a LiteLLM proxy:

```bash
export OPENAI_BASE_URL=https://litellm.example.com/v1
export OPENAI_API_KEY=sk-litellm-...   # LiteLLM virtual key
msgai messages.po --model gpt-6.1-terra
```

Or in a `.env` file:

```dotenv
OPENAI_BASE_URL=https://litellm.example.com/v1
OPENAI_API_KEY=sk-litellm-...
```

`--model` must be a model name your proxy exposes, and that model must support `json_schema` structured outputs.

## 💻 CLI Usage

Usage:

```bash
msgai <file.po> [--dry-run] [--api-key KEY] [--source-lang LANG] [--base-url URL] [--model MODEL] [--include-fuzzy] [--add-fuzzy] [--fold-length N] [--context TEXT] [--config PATH] [--debug]
```

Options:

- `--dry-run`: list untranslated `msgid` values only, with no API calls and no file changes
- `--include-fuzzy`: include fuzzy entries for translation and clear their fuzzy flag after translation
- `--add-fuzzy`: mark every newly translated entry with the gettext `fuzzy` flag (so a human reviews it before it ships). Independent of `--include-fuzzy`
- `--source-lang LANG`: set the source language of `msgid` strings as an ISO 639-1 code such as `en` or `uk`
- `--model MODEL`: set the OpenAI model used for translation; default is `gpt-6.1-terra`. Only models with `json_schema` structured outputs are supported.
- `--api-key KEY`: pass the OpenAI API key directly instead of using `OPENAI_API_KEY`
- `--base-url URL`: use an OpenAI-compatible API (e.g. a LiteLLM proxy) instead of the OpenAI API; otherwise read from `OPENAI_BASE_URL`. See [OpenAI-compatible APIs](#openai-compatible-apis-litellm-and-other-proxies)
- `--fold-length N`: set PO line fold length when writing files. Use `0` to disable folding and minimize formatting-only diffs. Default: `0`
- `--context TEXT`: additional instructions for the translation model in English, appended to the system prompt (e.g. "use formal tone", "don't translate currency names")
- `--config PATH`: path to a YAML config file (default: `msgai.config.yml` in current directory)
- `--debug`: print debug logs for batch preparation, OpenAI request retries, request payloads, and raw response validation
- `--help`: print command usage

You can also enable the same debug logging with the environment variable `DEBUG=1`:

```bash
DEBUG=1 msgai messages.po
```

## Configuration File

`msgai` supports an optional `msgai.config.yml` config file in the project directory. If found, its values are used as defaults. CLI arguments always override config file values.

Use `--config PATH` to specify a custom config file location. If `--config` is not provided, `msgai` looks for `msgai.config.yml` in the current working directory.

Example `msgai.config.yml`:

```yaml
source-lang: en
model: gpt-6.1-terra
base-url: https://litellm.example.com/v1
include-fuzzy: false
add-fuzzy: false
fold-length: 80
context: "use formal tone"
debug: false
```

Both kebab-case and camelCase keys are accepted.

`api-key` and `dry-run` are not allowed in the config file. API keys should be set via `--api-key` flag or `OPENAI_API_KEY` environment variable for security reasons. `dry-run` is a runtime-only option that must be passed as a CLI flag.

If no API key is provided for a non-dry run, the CLI exits with code `1` and prints an error message.

On API failures such as rate limits, quota issues, or server errors, the CLI exits with code `1` and shows a status-specific message. Validation errors for protected fields such as `msgid`, `msgid_plural`, or `msgctxt` now tell you whether a retry is reasonable and when to rerun with `--debug` or `DEBUG=1` to inspect the request/response flow. For API error details, see [OpenAI API error codes](https://developers.openai.com/api/docs/guides/error-codes#api-errors).

## 🧪 Development

Requirements:

- Node.js `22+`
- npm `10+`

Install dependencies:

```bash
npm install
```

Useful scripts:

- `npm run build`: compile TypeScript to `dist/`
- `npm test`: build the project and run Jest tests
- `npm run test:integration`: run integration tests
- `npm run test:watch`: run tests in watch mode
- `npm run lint`: run ESLint
- `npm run lint:format`: check formatting with Prettier
- `npm run format`: format the repository with Prettier
- `npm run release:dry-run`: preview the `commit-and-tag-version` release without writing files
- `npm run release`: run release checks, update `CHANGELOG.md`, bump the npm version, create a release commit, and create a local tag

This repo follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for commit messages.

### Release Flow

Maintainer releases are local-first and use `commit-and-tag-version`. The release command does not publish to npm or push tags for you.

Preview the next release:

```bash
npm run release:dry-run
```

Create the release locally:

```bash
npm run release
```

This command:

- runs `build`, unit tests, integration tests, lint, and formatting checks through the `prerelease` lifecycle hook
- lets `commit-and-tag-version` infer `major`, `minor`, or `patch` from Conventional Commits since the latest `v*` tag
- updates `CHANGELOG.md`
- creates `chore(release): X.Y.Z`
- creates a local annotated tag `vX.Y.Z`

For reliable version bumps and changelog entries, keep commits in Conventional Commit format.

If you need to override the inferred bump manually:

```bash
npm run release -- --release-as minor
```

After the local release is created:

```bash
git push --follow-tags
npm publish
```
