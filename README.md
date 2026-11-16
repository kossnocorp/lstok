# lstok

A simple CLI to count file and prompt tokens with [tiktoken], Hugging Face tokenizers, or provider APIs, and measure AI coding agents' token usage in your project.

Supports OpenCode, Codex, Claude Code, and Pi.

## Installation

Run directly with npx:

```sh
npx lstok --help
```

The package is also available as a globally installable npm package:

```sh
npm install -g lstok
```

## Usage

### Measuring File

Use either a positional path or `--file <path>`:

```sh
npx lstok --file ./AGENTS.md
```

These forms support the same options and cannot be combined.

Count tokens in a file:

```sh
npx lstok ./AGENTS.md
#=> 1234
```

The default encoding is `o200k_base`. Use `--encoding` to select another:

```sh
npx lstok ./AGENTS.md --encoding cl100k_base
```

### Measuring a Prompt

Without an agent flag or file, `--prompt` counts tokens in the supplied text:

```sh
npx lstok --prompt "hello world"
#=> 2
npx lstok --prompt "hello world" --encoding cl100k_base --json
```

### Choosing a Tokenizer

`--tokenizer` defaults to `tiktoken`; `--encoding` selects its encoding (default: `o200k_base`).
To use [Hugging Face tokenizers](https://github.com/huggingface/tokenizers.js), specify a Hub repository or a local directory containing `tokenizer.json` and `tokenizer_config.json`:

```sh
npx lstok AGENTS.md --tokenizer tiktoken --encoding cl100k_base
npx lstok AGENTS.md --tokenizer hf:Qwen/Qwen3-8B
npx lstok --prompt "hello world" --tokenizer ./my-tokenizer/
```

Hub selectors support `hf:owner/repo@revision`; use a commit hash for reproducible counts. Tokenizer files are downloaded on first use and cached in `$XDG_CACHE_HOME/lstok/tokenizers` (default: `~/.cache/lstok/tokenizers`). Cached files are reused without network requests, including for mutable revisions such as `main`; remove the corresponding cache file to refresh. Set `HF_TOKEN` for gated/private repositories you can access.

Compatibility depends on the model's tokenizer components. No chat template or automatic beginning/end tokens are added. Literal special-token strings are handled according to the selected Hugging Face tokenizer's configuration; tiktoken treats them as ordinary text. `--encoding` applies only to tiktoken.

### Counting Through Provider APIs

Use `--api claude|gemini|openai` with an explicit API model ID:

```sh
npx lstok AGENTS.md --api claude --model claude-sonnet-4-6
npx lstok --prompt "hello world" --api gemini --model gemini-2.5-flash
npx lstok AGENTS.md --api openai --model gpt-5.4 --json
```

| API      | Environment variable                                           | Counting endpoint                    |
| -------- | -------------------------------------------------------------- | ------------------------------------ |
| `claude` | `ANTHROPIC_API_KEY`                                            | `/v1/messages/count_tokens`          |
| `gemini` | `GOOGLE_API_KEY` or `GEMINI_API_KEY` (Google takes precedence) | `/v1beta/models/{model}:countTokens` |
| `openai` | `OPENAI_API_KEY`                                               | `/v1/responses/input_tokens`         |

The UTF-8 file contents or prompt are sent as one user message to the provider's counting endpoint. Counts can include message overhead and may differ from raw local token counts; Claude documents its counts as estimates. No generation request is made. Model availability is determined by the provider. `--api` cannot be combined with agent flags, `--tokenizer`, or `--encoding`.

API mode supports the same plain count, `--json`, `--jq`, and `--jq-raw` output as local counting. `provider` is `anthropic`, `google`, or `openai`; `model` contains the requested model ID; `encoding` and `cost` are `null`. Input totals contain the returned count, and cache/output/reasoning counts are `0`. `time` measures the counting request through response parsing, excluding file reading.

### Measuring Agent Setup

Run an agent with a basic prompt "What is the project name?" to check the project's base context and token usage.

```sh
npx lstok --opencode
npx lstok --codex
npx lstok --claude
npx lstok --pi
```

The selected CLI must be installed and authenticated.

Use `--agent <claude|opencode|codex|pi>` as an explicit alternative to the agent flags:

```sh
npx lstok --agent claude
npx lstok --agent pi --provider anthropic --model claude-sonnet-4-6
```

Choose either `--agent` or one agent flag, not both. Both forms support the same options.

Use `--model` to select a model. Values are passed unchanged to the agent CLI's `--model` flag, so use that CLI's model syntax:

```sh
npx lstok --opencode --model openai/gpt-5.4
npx lstok --codex --model gpt-5.4
npx lstok --claude --model sonnet
npx lstok --pi --provider anthropic --model claude-sonnet-4-6
```

`--provider` is supported only with `--pi` or `--agent pi` and is passed unchanged to Pi's `--provider` flag (use it with `--model`). OpenCode includes the provider in `--model` (`provider/model#variant`, with an optional variant). Codex and Claude Code do not have a general `--provider` flag. When omitted, the agent's configured defaults apply.

The default question can be overridden via `--prompt`:

```sh
npx lstok --codex --prompt "Describe the project architecture"
```

### Agent Arguments and Output

Pass agent-specific arguments after `--`:

```sh
npx lstok --claude -- --permission-mode acceptEdits
npx lstok --codex -- --sandbox read-only
```

Arguments are forwarded literally, after lstok's model/provider options and before the prompt. Keep the agent's required JSON output mode intact. Use lstok's `--model` and `--provider` options when you need metadata fallbacks; selections passed after `--` are only reflected in statistics if the agent reports them.

Use `--tee` to stream raw agent stdout while collecting usage. Agent stderr is always forwarded to stderr. The final statistics are printed after the agent exits:

```sh
npx lstok --claude --tee --json
npx lstok --codex --tee --jq '.total_input' -- --sandbox read-only
```

The streamed output contains the agent's JSON events, not its interactive terminal presentation. `--json`, `--jq`, and `--jq-raw` still apply only to the final statistics; with `--tee`, stdout is mixed output rather than a single parsable report.

### Statistics

File, prompt, and agent modes print only the total token count by default. Use `--json` for the same full statistics schema in all modes:

```sh
npx lstok AGENTS.md --json
npx lstok --opencode --json
```

Agent statistics cover the whole run, summed across model calls (or taken from the agent's cumulative result).

| Field          | Meaning                                                      |
| -------------- | ------------------------------------------------------------ |
| `input`        | Input tokens excluding cache reads and writes                |
| `cache_read`   | Input tokens read from cache                                 |
| `cache_write`  | Input tokens written to cache                                |
| `output`       | Output tokens excluding reasoning, when separately available |
| `reasoning`    | Reasoning tokens, when separately available                  |
| `cost`         | Agent-reported or estimated cost in USD                      |
| `time`         | Elapsed time in milliseconds                                 |
| `total_input`  | All input tokens, including cache reads and writes           |
| `total_output` | All output tokens, including reasoning                       |
| `total`        | `total_input + total_output`                                 |
| `provider`     | Reported provider, explicit selection, or `null`             |
| `model`        | Reported model, explicit selection, or `null`                |
| `encoding`     | Local encoding/tokenizer selector; `null` for APIs/agents    |

All fields are always present in JSON. Missing counts, or breakdowns included in another count that cannot be separated, are `null`. Totals are calculated only when the required counts are available; otherwise they are `null` too.

For local file and prompt estimates, `input`, `total_input`, and `total` contain the token count. Cache, output, and reasoning counts are `0`; `cost`, `provider`, and `model` are `null`. `encoding` contains the selected tiktoken encoding (default: `o200k_base`) or Hugging Face tokenizer selector.

`time` measures the full agent process run through exit. For local files and prompts, it measures only token encoding, excluding file reading, downloads, and encoder setup.

Agent-reported metadata takes precedence over explicit CLI selections. Multiple reported models or providers produce `null` for the corresponding field. OpenCode's explicit `provider/model` selection also supplies the provider; configured defaults that aren't reported remain `null`. Model selections are preserved verbatim when used as a fallback.

- **OpenCode:** provides the full breakdown; input and output totals include cache and reasoning tokens respectively.
- **Codex:** its input count already includes cache reads; its output count includes reasoning. Cache writes and cost are unavailable. `input` is derived when cache reads are reported; `output` and `reasoning` are available only when a separate reasoning count is reported.
- **Claude Code:** provides input, cache reads/writes, combined output, and cost. Separate visible output and reasoning counts are unavailable.
- **Pi:** provides input, cache reads/writes, combined output, and cost. Separate visible output and reasoning counts are unavailable.

#### Querying with `jq`

Use `--jq` to filter the result through your installed `jq`, or `--jq-raw` for raw string output (`jq -r`):

```sh
npx lstok --opencode --jq '.total_input'
npx lstok --codex --jq '{input: .total_input, output: .total_output}'
npx lstok --pi --jq-raw '"Input: \(.total_input), output: \(.total_output)"'
```

These flags always filter the full JSON schema, even without `--json`, and also work in file mode. They are mutually exclusive, require `jq` on `PATH`, and preserve jq's stdout, stderr, and exit status.

## Changelog

See [the changelog](./CHANGELOG.md).

## License

[MIT © Sasha Koss](https://koss.nocorp.me/mit/)

[tiktoken]: https://github.com/openai/tiktoken
