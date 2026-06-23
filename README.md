<div align="center">
  <img src="https://raw.githubusercontent.com/OzTamir/mcplexer/main/assets/mcplexer.svg" alt="MCPlexer logo" width="128" height="128">
  <h1>MCPlexer</h1>
  <p>
    <a href="https://www.npmjs.com/package/@oztamir/mcplexer">
      <img alt="npm package" src="https://img.shields.io/npm/v/%40oztamir%2Fmcplexer?logo=npm&label=npm&color=cb3837">
    </a>
  </p>
</div>

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

For hosted MCPs that use a normal user OAuth flow, such as Notion MCP, use browser OAuth:

```json
{
  "mcpServers": {
    "notion-work": {
      "command": "mcplexer",
      "args": [
        "--prefix",
        "work",
        "--label",
        "Work Notion",
        "--url",
        "https://mcp.notion.com/mcp",
        "--oauth-flow",
        "browser"
      ]
    }
  }
}
```

On first use, MCPlexer prints the authorization URL to stderr and opens it in your browser. After you approve access, it receives the local callback on `127.0.0.1`, stores the OAuth tokens under `~/.config/mcplexer/oauth/`, and reconnects automatically. The downstream agent only sees the prefixed MCP tools.

The callback port is not tied to Notion. By default MCPlexer picks a deterministic high loopback port from the upstream URL and prefix, so multiple labeled instances do not all fight for one fixed port. If your OAuth provider or pre-registered client requires an exact redirect URI, set it explicitly with `--oauth-callback-port`. If the provider requires a known public client ID, pass it with `--oauth-client-id`. If you cannot open a browser automatically, add `--oauth-no-open` and open the printed URL manually. Use `--oauth-store` when you need a custom token cache path.

If you already have an OAuth access token, let MCPlexer pass it through the MCP SDK auth provider:

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
        "--oauth-bearer-env",
        "WORK_MCP_TOKEN"
      ],
      "env": {
        "WORK_MCP_TOKEN": "replace-me"
      }
    }
  }
}
```

For machine-to-machine OAuth, use client credentials:

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
        "--oauth-client-id",
        "your-client-id",
        "--oauth-client-secret-env",
        "WORK_MCP_CLIENT_SECRET",
        "--oauth-scope",
        "calendar.read calendar.write"
      ],
      "env": {
        "WORK_MCP_CLIENT_SECRET": "replace-me"
      }
    }
  }
}
```

For non-OAuth remote authentication, you can still pass static headers with `--header` or `--header-env`. Do not combine OAuth options with an `Authorization` header.

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

## Agent skill

This repo exposes an [agent skill](skills/mcplexer) that teaches AI coding agents
when and how to use MCPlexer — adding a second labeled instance of an MCP server,
and migrating an existing MCP entry to a prefixed setup.

Install it with [`npx skills`](https://github.com/vercel-labs/skills):

```bash
npx skills add OzTamir/mcplexer
```

Or install it as a Claude Code plugin:

```text
/plugin marketplace add OzTamir/mcplexer
/plugin install mcplexer@mcplexer
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
- `--oauth-bearer-env <ENV>`: remote OAuth bearer token read from an environment variable.
- `--oauth-flow browser`: remote OAuth authorization-code flow with a local browser callback.
- `--oauth-callback-port <port>`: local browser OAuth callback port. Defaults to a deterministic high port based on upstream URL and prefix.
- `--oauth-store <path>`: OAuth token/client cache path for browser flow.
- `--oauth-no-open`: print the OAuth URL without trying to open a browser.
- `--oauth-client-id <id>`: OAuth client ID. In browser flow, use this for a pre-registered public client. In `client_credentials`, pair it with `--oauth-client-secret-env`.
- `--oauth-client-secret-env <ENV>`: OAuth `client_credentials` client secret environment variable.
- `--oauth-scope <scope>`: optional OAuth scope for `client_credentials`.
- `--oauth-client-name <name>`: optional OAuth client display name for metadata.

## How it works

MCPlexer is itself a stdio MCP server. It connects to one upstream MCP server, lists upstream tools, rewrites each tool name and description, then forwards `tools/call` requests by stripping the configured prefix before calling upstream.
