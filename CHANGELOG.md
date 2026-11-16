# Change Log

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning].

This change log follows the format documented in [Keep a CHANGELOG].

[semantic versioning]: http://semver.org/
[keep a changelog]: http://keepachangelog.com/

## Unreleased

### Added

- Add `--tokenizer` for cached Hugging Face Hub and local tokenizers, with tiktoken as the default.
- Add `--api claude|gemini|openai` to count file and prompt tokens with provider APIs and environment-based authentication.
- Add `--tee` to stream raw agent output alongside final statistics.
- Forward arguments after `--` directly to the selected agent.

## v0.3.0 - 2026-10-16

### Added

- Add `--jq` and `--jq-raw` to filter output through installed jq.

- Add `--json` with a shared file/agent schema, nullable missing fields, and provider, model, and encoding metadata.

### Changed

- Print total tokens by default in both file and agent modes.

- Use short agent statistics names with consistent `cost`, `total`, `total_input`, and `total_output` semantics.

## v0.2.0 - 2026-10-16

### Added

- Support `--model` for all agents and `--provider` for Pi, passed unchanged to their CLIs.

## v0.1.0 - 2026-10-16

Initial version
