# MCPlexer Agent Guide

## Project purpose

MCPlexer is a lightweight stdio MCP proxy. It lets users run multiple labeled instances of the same upstream MCP server by rewriting exposed tool names and descriptions while forwarding calls to the original upstream tool.

Example behavior:

- upstream tool: `get-calendar-events`
- exposed tool: `personal:get-calendar-events`
- forwarded call: `personal:get-calendar-events` -> upstream `get-calendar-events`

## Commands

Use `pnpm` for package management.

- Install: `pnpm install`
- Lint/format check: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Test: `pnpm test`
- Build: `pnpm build`

Do not run a dev server; this is a CLI/MCP stdio utility.

## Architecture map

- `src/cli.ts`: executable boundary, error-to-exit handling.
- `src/config.ts`: public CLI parse orchestration.
- `src/raw-cli.ts`: raw argv tokenization and option parsing.
- `src/upstream-config.ts`: stdio/remote upstream and header config shaping.
- `src/config-types.ts`: shared config types and usage errors.
- `src/prefix.ts`: pure tool-name and description rewrite helpers.
- `src/upstream.ts`: upstream MCP client connection logic for stdio, Streamable HTTP, and SSE.
- `src/transport-adapter.ts`: compatibility adapter for MCP SDK transport typing under `exactOptionalPropertyTypes`.
- `src/proxy.ts`: downstream stdio MCP server handlers for `tools/list` and `tools/call`.
- `tests/fixtures/echo-mcp.mjs`: real upstream MCP fixture for smoke/manual protocol checks.

## Invariants

- MCPlexer itself always speaks stdio to the downstream client.
- Local upstream MCPs are launched with `-- <command> [args...]` and inherit the wrapper environment.
- Remote upstream MCPs use `--url`; `auto` tries Streamable HTTP first, then SSE.
- Remote OAuth auth must use the MCP SDK `authProvider` path, not hand-built `Authorization` headers.
- Listed tools must preserve upstream metadata except `name` and `description`.
- `tools/call` must reject names that do not start with the configured prefix plus separator.
- `tools/call` must strip only the configured prefix before calling upstream.
- Keep prefixing behavior pure and testable in `src/prefix.ts`.
- Validate untrusted CLI input at the boundary; do not pass raw argv deeper than `src/raw-cli.ts`.

## Style constraints

- TypeScript is strict: no `any`, no `@ts-ignore`, no `@ts-expect-error`, no non-null assertions.
- Keep source files under 250 pure LOC. Split by responsibility before expanding an oversized file.
- Prefer small modules over speculative abstractions.
- The only acceptable broad catch is the top-level CLI boundary in `src/cli.ts`, where errors become exit codes.

## Verification expectations

Before claiming a behavior change works, run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For MCP proxy changes, also drive the built CLI through a real stdio JSON-RPC session against `tests/fixtures/echo-mcp.mjs`: initialize, list tools, confirm the prefixed tool name and description note, then call the prefixed tool and confirm the upstream result.
