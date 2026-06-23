# MCPlexer

MCPlexer is a tiny MCP proxy for running multiple labeled instances of the same MCP server without tool-name collisions.

If an upstream server exposes `get-calendar-events`, MCPlexer can expose it as:

- `personal:get-calendar-events`
- `work:get-calendar-events`

It also appends a label note to every tool description, for example:

```text
Note: this is one of multiple instances of this MCP, labeled "Personal".
```

## Install from npm

Install MCPlexer globally when you want to use it from `.mcp.json` files:

```bash
npm install --global @oztamir/mcplexer
```

The installed command is `mcplexer`:

```bash
mcplexer --help
```

If you prefer pnpm for global packages:

```bash
pnpm add --global @oztamir/mcplexer
```

## Configure your MCP client

Use `mcplexer` as the MCP server command. Put the upstream local MCP command after `--`.

```json
{
  "mcpServers": {
    "google-personal": {
      "command": "mcplexer",
      "args": [
        "--prefix",
        "personal",
        "--label",
        "Personal",
        "--",
        "npx",
        "-y",
        "@example/google-workspace-mcp"
      ],
      "env": {
        "GOOGLE_ACCOUNT": "personal"
      }
    },
    "google-work": {
      "command": "mcplexer",
      "args": [
        "--prefix",
        "work",
        "--label",
        "Work",
        "--",
        "npx",
        "-y",
        "@example/google-workspace-mcp"
      ],
      "env": {
        "GOOGLE_ACCOUNT": "work"
      }
    }
  }
}
```

The wrapper passes its environment through to the upstream command, so per-account `.mcp.json` `env` values still work.

For remote MCP endpoints, pass `--url`. By default MCPlexer tries Streamable HTTP first and falls back to legacy SSE.

```json
{
  "mcpServers": {
    "calendar-work-remote": {
      "command": "mcplexer",
      "args": [
        "--prefix",
        "work",
        "--label",
        "Work",
        "--url",
        "https://mcp.example.com/mcp",
        "--header-env",
        "Authorization=WORK_MCP_AUTH"
      ],
      "env": {
        "WORK_MCP_AUTH": "Bearer replace-me"
      }
    }
  }
}
```

You can force a remote transport when needed:

```bash
mcplexer --prefix work --url https://mcp.example.com/mcp --transport http
mcplexer --prefix legacy --url https://mcp.example.com/sse --transport sse
```

## Other ways to run MCPlexer

### Run with npx

You can also run MCPlexer through `npx` without a global install:

```bash
npx -y @oztamir/mcplexer --help
```

For `.mcp.json`, use `npx` as the command and put MCPlexer arguments after the package name:

```json
{
  "mcpServers": {
    "google-personal": {
      "command": "npx",
      "args": [
        "-y",
        "@oztamir/mcplexer",
        "--prefix",
        "personal",
        "--label",
        "Personal",
        "--",
        "npx",
        "-y",
        "@example/google-workspace-mcp"
      ]
    }
  }
}
```

### Link a local checkout

From a local checkout of this repo:

```bash
pnpm install
pnpm build
pnpm link --global
```

## CLI reference

```text
mcplexer --prefix <name> [--label <label>] -- <command> [args...]
mcplexer --prefix <name> [--label <label>] --url <mcp-url> [--transport auto|http|sse]
```

Options:

- `--prefix <name>`: tool-name prefix. Must contain only letters, numbers, `_`, or `-`.
- `--label <label>`: human label used in the description note. Defaults to the prefix.
- `--separator <text>`: separator between prefix and tool name. Defaults to `:`.
- `--note <text>`: custom note appended to every tool description.
- `--url <url>`: remote upstream MCP endpoint.
- `--transport <mode>`: `stdio`, `auto`, `http`, or `sse`.
- `--header <name: value>`: literal remote header. Repeatable.
- `--header-env <name=ENV>`: remote header whose value is read from an environment variable. Repeatable.

## How it works

MCPlexer is itself a stdio MCP server. It connects to one upstream MCP server, lists upstream tools, rewrites each tool name and description, then forwards `tools/call` requests by stripping the configured prefix before calling upstream.
