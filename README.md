# msgai

`msgai` is an AI-powered CLI for translating gettext `.po` files. It finds untranslated entries, sends them to an LLM, and writes the translated strings back into the same file.

## 🤖 Project Purpose

`msgai` is built for teams that already use gettext and want a simple way to translate missing strings without building a separate localization workflow.

Main features:

- `📝` Works directly with gettext `.po` files
- `🤖` Translates only untranslated entries using AI
- `🧠` Uses OpenAI `gpt-4o` by default for translation
- `🏷️` Respects gettext context (`msgctxt`) when translating entries
- `🔁` Supports singular and plural translations
- `⚠️` Skips fuzzy entries by default
- `🧭` Can infer source language or use `--source-lang`
- `💻` Runs as a small CLI that updates files in place

## ⚙️ How It Works

1. Read the `.po` file and parse its entries.
2. Find entries with empty or missing translations.
3. Send those strings to OpenAI `gpt-4o` for translation while preserving gettext context such as `msgctxt`.
4. Write the translated values back into the same `.po` file.

The translation API uses OpenAI `json_schema` structured outputs. Only models that support `json_schema` structured outputs are valid for `msgai`.

<details>
<summary>Supported model families</summary>

- `gpt-4o`
- `gpt-4o-mini`
- `gpt-4.1`
- `gpt-4.1-mini`
- `gpt-4.1-nano`
- `gpt-5`
- `gpt-5-mini`
- `gpt-5-nano`
- `gpt-5-pro`
- `gpt-5.1`
- `gpt-5.2`
- `gpt-5-codex`
- `gpt-5.1-codex`
- `gpt-5.1-codex-mini`
- `gpt-5.1-codex-max`
- `gpt-5.2-codex`

Dated snapshots are accepted where the model family supports them.
</details>

By default, entries marked as `fuzzy` are skipped. If you use `--include-fuzzy`, `msgai` will translate those entries too and remove the fuzzy flag after applying the result.

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

## 💻 CLI Usage

Usage:

```bash
msgai <file.po> [--dry-run] [--api-key KEY] [--source-lang LANG] [--model MODEL] [--include-fuzzy]
```

Options:

- `--dry-run`: list untranslated `msgid` values only, with no API calls and no file changes
- `--include-fuzzy`: include fuzzy entries for translation and clear their fuzzy flag after translation
- `--source-lang LANG`: set the source language of `msgid` strings as an ISO 639-1 code such as `en` or `uk`
- `--model MODEL`: set the OpenAI model used for translation; default is `gpt-4o`. Only models with `json_schema` structured outputs are supported.
- `--api-key KEY`: pass the OpenAI API key directly instead of using `OPENAI_API_KEY`
- `--help`: print command usage

If no API key is provided for a non-dry run, the CLI exits with code `1` and prints an error message.

On API failures such as rate limits, quota issues, or server errors, the CLI exits with code `1` and shows a status-specific message. For API error details, see [OpenAI API error codes](https://developers.openai.com/api/docs/guides/error-codes#api-errors).

## 🧪 Development

Requirements:

- Node.js `20+`
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

This repo follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for commit messages.
