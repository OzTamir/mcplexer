# MCPlexer CLI reference

Two invocation shapes, depending on whether the upstream is local or remote:

```text
mcplexer --prefix <name> [--label <label>] -- <command> [args...]
mcplexer --prefix <name> [--label <label>] --url <mcp-url> [--transport auto|http|sse]
```

MCPlexer itself always speaks stdio to the downstream client. The `--url` form
changes only how MCPlexer reaches its *upstream*, not how the client reaches
MCPlexer.

## Options

| Option | Required | Meaning |
|---|---|---|
| `--prefix <name>` | yes | Tool-name prefix. Letters, numbers, `_`, or `-` only. Prepended to every exposed tool name. |
| `--label <label>` | no | Human label used in the description note. Defaults to the prefix. |
| `--separator <text>` | no | Separator between prefix and tool name. Defaults to `:`. |
| `--note <text>` | no | Custom note appended to every tool description, replacing the default `Note: this is one of multiple instances…` text. |
| `--url <url>` | no | Remote upstream MCP endpoint. Mutually exclusive with the `-- <command>` form. |
| `--transport <mode>` | no | `stdio`, `auto`, `http`, or `sse`. For remote, `auto` (default) tries Streamable HTTP first, then legacy SSE. |
| `--header <name: value>` | no | Literal remote header. Repeatable. Use for non-secret values. |
| `--header-env <name=ENV>` | no | Remote header whose value is read from the named environment variable. Repeatable. Preferred for secrets. |

## Local vs remote

- **Local (stdio):** everything after `--` is the upstream command and its args.
  MCPlexer launches it as a child process and inherits/passes through the
  wrapper's environment (so `env` in the client config reaches the upstream).
- **Remote:** pass `--url`. Force a transport when auto-detection misbehaves:
  ```bash
  mcplexer --prefix work --url https://mcp.example.com/mcp --transport http
  mcplexer --prefix legacy --url https://mcp.example.com/sse --transport sse
  ```

## Headers for remote auth

Repeatable. Prefer `--header-env` so the secret lives in the client config's
`env` block rather than in plaintext args:

```text
--header-env "Authorization=WORK_MCP_AUTH"     # value from $WORK_MCP_AUTH
--header "X-Api-Version: 2024-01-01"           # literal, non-secret
```

## Behavior guarantees

- Listed tools preserve all upstream metadata except `name` and `description`.
- `tools/call` rejects any name that does not start with `<prefix><separator>`.
- `tools/call` strips only the configured prefix before calling upstream — the
  upstream sees its original tool name.

## Run without a global install

```bash
npx -y @oztamir/mcplexer --help
```

In `.mcp.json`, set `command` to `npx` and place MCPlexer's args after the
package name; the upstream command still follows `--`:

```json
{
  "command": "npx",
  "args": ["-y", "@oztamir/mcplexer", "--prefix", "personal", "--", "npx", "-y", "@example/some-mcp"]
}
```
