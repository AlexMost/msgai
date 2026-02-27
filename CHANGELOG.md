# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## 1.0.0 (2026-02-27)

### Features

- handle fuzzy translations with --include-fuzzy ([c4c8784](https://github.com/AlexMost/msgai/commit/c4c8784c361e6d00618b234a3cb5983a40e120b9))
- handle gettext msgctxt so same msgid in different contexts are not mixed ([9f7ad7a](https://github.com/AlexMost/msgai/commit/9f7ad7a838ef81968a3e235dfd9359e42ee5557a))
- pass plural samples from getExamples into LLM prompt for plural forms ([70dd125](https://github.com/AlexMost/msgai/commit/70dd125658539e6fbee8417ebfe601bf9ac00145))

### Bug Fixes

- **ci:** use github.event.workflow_run.conclusion in release-please ([0892b17](https://github.com/AlexMost/msgai/commit/0892b17aad1ec95a4e96a8208cb31d197264830f))
- **ci:** use RELEASE_PLEASE_TOKEN so release-please can create PRs ([204c6cd](https://github.com/AlexMost/msgai/commit/204c6cdf88d480decae841f91c9fae168c4c0ce9))
- use console.warn instead of console.error for pipeline compatibility ([8b30ebf](https://github.com/AlexMost/msgai/commit/8b30ebffba7c7447db3f51d931398938c39b6b85))

## [Unreleased]

## [1.0.0] - 2025-02-27

### Added

- CLI to translate untranslated strings in gettext (`.po`) files using AI (OpenAI LLM)
- `msgai <file.po>`: translate empty `msgstr` entries and write back to the file
- `--dry-run`: list untranslated `msgid` values without API calls or file changes
- `--source-lang LANG`: specify source language (ISO 639-1); optional, model can infer
- `--include-fuzzy`: include fuzzy entries for re-translation and clear fuzzy flag
- `--api-key KEY` and `OPENAI_API_KEY` environment variable for API authentication
