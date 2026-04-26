# GitAura CLI

Thin `gitaura` OAuth CLI for generating raw GitAura-compatible credentials.

## Install dependencies

```bash
bun install
```

## Run locally

```bash
bun run apps/cli/src/index.ts login
bun run apps/cli/src/index.ts login -p codex
bun run apps/cli/src/index.ts login -p anthropic --print-json
```

## Build

```bash
cd apps/cli
bun run build
node dist/index.js --help
```

## Command

```bash
gitaura login
gitaura login -p <provider>
gitaura login --print-json
```

Provider aliases:

- `codex` -> `openai-codex`
- `claude` -> `anthropic`
- `gemini` -> `google-gemini-cli`
- `copilot` -> `github-copilot`

Examples:

```bash
gitaura login -p codex
gitaura login -p anthropic
gitaura login -p gemini
gitaura login -p copilot
gitaura login -p gemini --print-json
```

## Output

Default output is a base64url-encoded raw `OAuthCredentials` JSON payload.

```bash
gitaura login -p codex
```

The CLI copies the sign-in URL to your clipboard when auth starts, then waits for you to press Enter before opening the browser. After success it copies the final login code to your clipboard and tells you to paste the code back inside GitAura. For callback-server providers, the manual redirect/code prompt only appears after a short wait if the browser callback does not finish automatically.

`--print-json` prints the raw `OAuthCredentials` object directly.

```bash
gitaura login -p gemini --print-json
```

## Scope

v1 is output-only:

- no credential persistence
- no hidden writes
- no logout or providers command

GitAura app import is supported separately by pasting the generated login code into the app.

## Packaging

The published npm package is self-contained and does not depend on unpublished workspace packages at runtime. It builds to normal Node-compatible JavaScript in `dist/` and exposes the `gitaura` binary from the scoped package `@gitaura/cli`.

Example:

```bash
npx @gitaura/cli login
bunx @gitaura/cli login
```

## Implementation

The CLI is a thin wrapper over `@mariozechner/pi-ai/oauth` provider login flows.
