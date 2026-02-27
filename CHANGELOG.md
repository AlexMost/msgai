# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [1.0.0] - 2025-02-27

### Added

- CLI to translate untranslated strings in gettext (`.po`) files using AI (OpenAI LLM)
- `msgai <file.po>`: translate empty `msgstr` entries and write back to the file
- `--dry-run`: list untranslated `msgid` values without API calls or file changes
- `--source-lang LANG`: specify source language (ISO 639-1); optional, model can infer
- `--include-fuzzy`: include fuzzy entries for re-translation and clear fuzzy flag
- `--api-key KEY` and `OPENAI_API_KEY` environment variable for API authentication
