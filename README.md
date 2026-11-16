# lstok

A simple CLI to count file and prompt tokens with [tiktoken], Hugging Face tokenizers, or provider APIs, and measure AI coding agents' token usage in your project.

Supports OpenCode, Codex, Claude Code, and Pi.

## Installation

Run directly with npx:

```sh
npx lstok --help
```

Or install globally with npm:

```sh
npm install -g lstok
```

## Usage

### Local Measurement

#### Measuring File

Pass a file path to measure its token count (also supports the explicit `--file <path>` option):

```sh
lstok ./AGENTS.md
#=> 1234
```

#### Measuring a Prompt

Without an agent flag or file, `--prompt` counts tokens in the supplied text:

```sh
lstok --prompt "hello world"
#=> 2
```

#### Choosing a Tokenizer

##### Tiktoken Tokenizer

By default, lstok uses the `tiktoken` tokenizer with the default encoding set to `o200k_base`. Use `--encoding` to select another:

```sh
lstok ./AGENTS.md --encoding cl100k_base
```

##### Hugging Face Tokenizers

To use [Hugging Face tokenizers](https://github.com/huggingface/tokenizers.js), specify a Hub repository or a local directory containing `tokenizer.json` and `tokenizer_config.json`:

```sh
lstok AGENTS.md --tokenizer hf:Qwen/Qwen3-8B
lstok --prompt "hello world" --tokenizer ./my-tokenizer/
```

Hub selectors support `hf:owner/repo@revision` so you can use a commit hash for reproducible counts.

Tokenizer files are downloaded on first use and cached in `$XDG_CACHE_HOME/lstok/tokenizers` (default: `~/.cache/lstok/tokenizers`). Cached files are reused without network requests, including for mutable revisions such as `main`; remove the corresponding cache file to refresh. Set `HF_TOKEN` for gated/private repositories you can access.

Hugging Face tokenizers ignore `--encoding`.

### Provider API Measurement

Use `--api <claude|gemini|openai>` with an explicit API model ID:

```sh
lstok AGENTS.md --api claude --model claude-sonnet-4-6
lstok --prompt "hello world" --api gemini --model gemini-2.5-flash
lstok AGENTS.md --api openai --model gpt-5.4 --json
```

| API      | API token env var                                              | Endpoint                                                                      |
| -------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `claude` | `ANTHROPIC_API_KEY`                                            | `https://api.anthropic.com/v1/messages/count_tokens`                          |
| `gemini` | `GOOGLE_API_KEY` or `GEMINI_API_KEY` (Google takes precedence) | `https://generativelanguage.googleapis.com/v1beta/models/{model}:countTokens` |
| `openai` | `OPENAI_API_KEY`                                               | `https://api.openai.com/v1/responses/input_tokens`                            |

The UTF-8 file contents or prompt are sent as one user message to the provider's counting endpoint. Counts can include message overhead and may differ from raw local token counts; Claude documents its counts as estimates. No generation request is made. The provider determines model availability.

`--api` cannot be combined with agent flags, `--tokenizer`, or `--encoding`.

### Agent Setup Measurement

Run an agent with a basic prompt "What is the project name?" to check the project's base context and token usage (also supports the explicit `--agent <claude|opencode|codex|pi>` option):

```sh
lstok --opencode
lstok --codex
lstok --claude
lstok --pi
```

The selected CLI must be installed and authenticated.

Use `--agent <claude|opencode|codex|pi>` as an explicit alternative to the agent flags:

Use `--model` to select a model. Values are passed unchanged to the agent CLI's `--model` flag, so use that CLI's model syntax:

```sh
lstok --opencode --model openai/gpt-5.4
lstok --codex --model gpt-5.4
lstok --claude --model sonnet
lstok --pi --provider anthropic --model claude-sonnet-4-6
```

`--provider` is supported only with Pi and is passed unchanged to Pi's `--provider` flag (use it with `--model`). OpenCode includes the provider in `--model` (`provider/model#variant`, with an optional variant).

The default prompt can be overridden via `--prompt`:

```sh
lstok --codex --prompt "Describe the project architecture"
```

#### Agent Arguments

Pass agent-specific arguments after `--`:

```sh
lstok --claude -- --permission-mode acceptEdits
lstok --codex -- --sandbox read-only
```

Arguments are forwarded literally, after lstok's model/provider options and before the prompt.

#### Streaming Agent Output

Use `--tee` to stream raw agent stdout while collecting usage. Agent stderr is always forwarded to stderr.

```sh
lstok --claude --tee --json
lstok --codex --tee -- --sandbox read-only
```

The streamed output contains the agent's JSON events, not its interactive terminal presentation.

### JSON Output

By default, lstok prints the total token count; in the case of agents, it combines all input and output tokens across the entire run. To get detailed statistics including timing, cost, and token breakdowns, use the `--json` flag.

```sh
lstok AGENTS.md --json
lstok --opencode --json
```

Agent statistics cover the whole run, summed across model calls (or taken from the agent's cumulative result).

The JSON output schema is consistent across all modes. When a value is available or can't be determined, it will be included as `null`.

| Field          | Meaning                                                               |
| -------------- | --------------------------------------------------------------------- |
| `mode`         | Measurement mode: `local`, `api`, or `agent`                          |
| `input`        | Input tokens excluding cache reads and writes                         |
| `cache_read`   | Input tokens read from cache                                          |
| `cache_write`  | Input tokens written to cache                                         |
| `output`       | Output tokens excluding reasoning, when separately available          |
| `reasoning`    | Reasoning tokens, when separately available                           |
| `cost`         | Agent-reported or estimated cost in USD                               |
| `time`         | Elapsed time in milliseconds                                          |
| `total_input`  | All input tokens, including cache reads and writes                    |
| `total_output` | All output tokens, including reasoning                                |
| `total`        | `total_input + total_output`                                          |
| `provider`     | Reported provider, explicit selection, or `null`                      |
| `model`        | Reported model, explicit selection, or `null`                         |
| `tokenizer`    | `tiktoken` or Hugging Face tokenizer selector; `null` for APIs/agents |
| `encoding`     | Tiktoken encoding; `null` for Hugging Face, APIs, and agents          |

All fields are always present in JSON. Missing counts, or breakdowns included in another count that cannot be separated, are `null`. Totals are calculated only when the required counts are available; otherwise they are `null` too.

For local file and prompt estimates, `input`, `total_input`, and `total` contain the token count. Cache, output, and reasoning counts are `0`; `cost`, `provider`, and `model` are `null`. For Tiktoken, `tokenizer` is `tiktoken` and `encoding` contains the selected encoding (default: `o200k_base`). For Hugging Face, `tokenizer` contains the Hub selector or local directory and `encoding` is `null`. Both `tokenizer` and `encoding` are `null` for API and agent requests.

`time` measures the full agent process run through exit. For local files and prompts, it measures only token encoding, excluding file reading, downloads, and encoder setup.

Agent-reported metadata takes precedence over explicit CLI selections. Multiple reported models or providers produce `null` for the corresponding field. OpenCode's explicit `provider/model` selection also supplies the provider; configured defaults that aren't reported remain `null`. Model selections are preserved verbatim when used as a fallback.

- **OpenCode:** provides the full breakdown; input and output totals include cache and reasoning tokens, respectively.
- **Codex:** Its input count already includes cache reads; its output count includes reasoning. Cache writes and cost are unavailable. `input` is derived when cache reads are reported; `output` and `reasoning` are available only when a separate reasoning count is reported.
- **Claude Code:** provides input, cache reads/writes, combined output, and cost. Separate visible output and reasoning counts are unavailable.
- **Pi:** provides input, cache reads/writes, combined output, and cost. Separate visible output and reasoning counts are unavailable.

#### Querying with `jq`

Use `--jq` to filter the result through your installed `jq`, or `--jq-raw` for raw string output (`jq -r`):

```sh
lstok --opencode --jq '.total_input'
lstok --codex --jq '{input: .total_input, output: .total_output}'
lstok --pi --jq-raw '"Input: \(.total_input), output: \(.total_output)"'
```

These flags always filter the full JSON schema, even without `--json`, and also work in file mode. They are mutually exclusive, require `jq` on `PATH`, and preserve jq's stdout, stderr, and exit status.

## Changelog

See [the changelog](./CHANGELOG.md).

## License

[MIT © Sasha Koss](https://koss.nocorp.me/mit/)

[tiktoken]: https://github.com/openai/tiktoken
