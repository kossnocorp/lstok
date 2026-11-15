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

### Measuring Agent Setup

Run an agent with a basic prompt "What is the project name?" to check the project's base context and token usage.

```sh
npx lstok --opencode
npx lstok --codex
npx lstok --claude
npx lstok --pi
```

The selected CLI must be installed and authenticated.

The default question can be overridden via `--prompt`:

```sh
npx lstok --codex --prompt "Describe the project architecture"
```

## Changelog

See [the changelog](./CHANGELOG.md).

## License

[MIT © Sasha Koss](https://koss.nocorp.me/mit/)

[tiktoken]: https://github.com/openai/tiktoken
