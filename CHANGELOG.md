# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [1.1.1](https://github.com/AlexMost/msgai/compare/v1.1.0...v1.1.1) (2026-03-01)

### Bug Fixes

- normalize msgctxt validation and add debug mode ([7488a78](https://github.com/AlexMost/msgai/commit/7488a782594253c4cfc46b56500ca7fa7b102766))

## [1.1.0](https://github.com/AlexMost/msgai/compare/v1.0.2...v1.1.0) (2026-03-01)

### Features

- **cli:** add --model option for translation ([61a2ed8](https://github.com/AlexMost/msgai/commit/61a2ed8502a0f90bbb09a1715bbb58d0ddabe01e))
- use structured outputs for translations ([c57e75b](https://github.com/AlexMost/msgai/commit/c57e75bda4229923dfca1daf1b8146a50f1d9b7f))

## 1.0.2 (2026-02-27)

### Bug Fixes

- **po:** preserve PO file order in `getEntriesToTranslate` ([55ba8d8](https://github.com/AlexMost/msgai/commit/55ba8d8c4c43d26adf4d1e23fa5dac2bebbf2052))

## 1.0.1 (2026-02-27)

### Documentation

- run formatter after each change and verify formatting in agent workflow ([1a1d909](https://github.com/AlexMost/msgai/commit/1a1d9097f9a88f6b260f5564fc6c800b52ea95a3))

### Chores

- clean `dist` folder before each build ([0e65234](https://github.com/AlexMost/msgai/commit/0e652342d076867d1795b69ca1cb07d7988b92d2))
- fix formatting ([0cb5742](https://github.com/AlexMost/msgai/commit/0cb5742452f37f03a292f70ff6acc433f6f3666f))

## 1.0.0 (2026-02-27)

### Features

- handle fuzzy translations with --include-fuzzy ([c4c8784](https://github.com/AlexMost/msgai/commit/c4c8784c361e6d00618b234a3cb5983a40e120b9))
- handle gettext msgctxt so same msgid in different contexts are not mixed ([9f7ad7a](https://github.com/AlexMost/msgai/commit/9f7ad7a838ef81968a3e235dfd9359e42ee5557a))
- pass plural samples from getExamples into LLM prompt for plural forms ([70dd125](https://github.com/AlexMost/msgai/commit/70dd125658539e6fbee8417ebfe601bf9ac00145))

### Bug Fixes

- **ci:** use github.event.workflow_run.conclusion in release-please ([0892b17](https://github.com/AlexMost/msgai/commit/0892b17aad1ec95a4e96a8208cb31d197264830f))
- **ci:** use RELEASE_PLEASE_TOKEN so release-please can create PRs ([204c6cd](https://github.com/AlexMost/msgai/commit/204c6cdf88d480decae841f91c9fae168c4c0ce9))
- use console.warn instead of console.error for pipeline compatibility ([8b30ebf](https://github.com/AlexMost/msgai/commit/8b30ebffba7c7447db3f51d931398938c39b6b85))
