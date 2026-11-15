# lstok

Count file tokens with [tiktoken](https://www.npmjs.com/package/tiktoken), or measure a project query using OpenCode, Codex, Claude Code, or Pi.

```sh
npm install -g lstok
lstok ./AGENTS.md
# 1234

lstok ./AGENTS.md --encoding cl100k_base
lstok --opencode
lstok --codex --prompt "Describe the project architecture"
lstok --claude
lstok --pi --prompt "Describe the project architecture"
```

Requires Node.js 22.18 or newer. File mode prints only the token count.
The default encoding is `o200k_base`, used by modern OpenAI models such as GPT-4o and GPT-4.1. It is a practical modern default, not a guarantee of exact tokenization for every newer or non-OpenAI model. Use `--encoding <name>` to select another tiktoken encoding; `--econding` is also accepted.

## Harness statistics

Install and authenticate the selected CLI (`opencode`, `codex`, `claude`, or `pi`) first. `lstok` invokes its noninteractive JSON output in the current directory, using its existing configuration and default model. Each invocation starts a new session with the question `What is the project name?`, unless `--prompt` overrides it.

```sh
lstok --codex
# {
#   "input_tokens": 1234,
#   "cached_input_tokens": 1000,
#   "output_tokens": 12
# }
```

Statistics are the harness-reported usage for the entire query, including project exploration and tool calls. They measure more than just the prompt or an instructions file. OpenCode step statistics are summed; Codex turn usage is collected from `turn.completed`. Cached input is included in Codex's input count; OpenCode reports cache separately. Reasoning, cache writes, total tokens, and USD cost are included only when reported. No synthetic total is calculated across these differing accounting conventions.

Harness diagnostics go to stderr; statistics go to stdout as JSON. Missing usage or a failed run exits nonzero. Codex's normal Git-repository requirement applies. Prompts execute with the harness's configured permissions.

Claude Code runs with `--print --output-format stream-json --verbose`. Its final `result.usage` supplies token counts, and `total_cost_usd` supplies estimated cost. Intermediate assistant messages are ignored; later cumulative results replace earlier ones.

Pi runs with `--print --mode json`. Its [JSON event stream](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/json.md) reports usage on completed assistant messages: input, output, cache read/write, total tokens, and estimated cost. `lstok` sums `message_end` usage and reported compaction usage, ignoring repeated streaming/turn/agent snapshots. Availability and accuracy depend on the provider. The prompt is piped to Pi's stdin so an `@` prefix is not interpreted as a file attachment. Claude and Pi report cached input separately from ordinary input.

Choose one mode: a single file, `--opencode`, `--codex`, `--claude`, or `--pi`. `--prompt` requires a harness; encoding options apply only to files. Use `lstok --help` for usage.

## Development

```sh
pnpm install
mise test       # Vitest
mise types
mise build     # @js-fns/dev / jsd build
node dist/bin.js ./README.md
```

The publishable package is generated in `dist/`, with its `lstok` executable mapped to `bin.js`. Publish from that directory with `pnpm publish ./dist`. The build keeps tiktoken external so its packaged WASM can load normally.
