# lstok

A simple CLI to count file tokens with [tiktoken] and measure AI coding agents' token usage in your project.

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

### Measuring Agent Setup

Run an agent with a basic prompt "What is the project name?" to check the project's base context and token usage.

```sh
npx lstok --opencode
npx lstok --codex
npx lstok --claude
npx lstok --pi
```

The selected CLI must be installed and authenticated.

Use `--model` to select a model. Values are passed unchanged to the agent CLI's `--model` flag, so use that CLI's model syntax:

```sh
npx lstok --opencode --model openai/gpt-5.4
npx lstok --codex --model gpt-5.4
npx lstok --claude --model sonnet
npx lstok --pi --provider anthropic --model claude-sonnet-4-6
```

`--provider` is supported only with `--pi` and is passed unchanged to Pi's `--provider` flag (use it with `--model`). OpenCode includes the provider in `--model` (`provider/model#variant`, with an optional variant). Codex and Claude Code do not have a general `--provider` flag. When omitted, the agent's configured defaults apply.

The default question can be overridden via `--prompt`:

```sh
npx lstok --codex --prompt "Describe the project architecture"
```

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
| `encoding`     | Tiktoken encoding for files/prompts; `null` for agents       |

All fields are always present in JSON. Missing counts, or breakdowns included in another count that cannot be separated, are `null`. Totals are calculated only when the required counts are available; otherwise they are `null` too.

For file and prompt estimates, `input`, `total_input`, and `total` contain the token count. Cache, output, and reasoning counts are `0`; `cost`, `provider`, and `model` are `null`. `encoding` contains the selected encoding (default: `o200k_base`).

`time` measures the full agent process run through exit. For files and prompts, it measures only token encoding, excluding file reading and encoder setup.

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
