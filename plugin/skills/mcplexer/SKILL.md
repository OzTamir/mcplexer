---
name: mcplexer
description: >-
  Use when running two or more instances of the SAME MCP server would collide on
  identical tool names — e.g. a second Google/Gmail/Calendar account, work +
  personal GitHub, multiple Slack workspaces, two Notion accounts, or any
  "personal vs work" split of one MCP. Also use to migrate an existing single MCP
  entry (in `.mcp.json`, Claude Desktop, Cursor, or VS Code config) into a
  labeled, prefixed instance. MCPlexer is a tiny stdio proxy that prefixes
  upstream tool names (e.g. `personal:get-calendar-events`) and appends a label
  note to each description so multiple copies of one server coexist cleanly.
  Trigger whenever the user mentions running two of the same MCP, "work and
  personal" accounts for an MCP server, namespacing/prefixing MCP tools, or
  tool-name collisions between MCP servers.
---

# MCPlexer

MCPlexer is a stdio MCP proxy. It connects to ONE upstream MCP server, lists its
tools, rewrites each tool's name and description, and forwards `tools/call`
requests to the original upstream tool after stripping the prefix.

The point: MCP clients key tools by name. If you run the same server twice (two
Google accounts, two GitHub orgs), both expose `get-calendar-events` and the
client can't tell them apart. MCPlexer gives each instance a distinct prefix:

- upstream tool `get-calendar-events`
- exposed as `personal:get-calendar-events` and `work:get-calendar-events`
- each description gains a note like `Note: this is one of multiple instances of this MCP, labeled "Personal".`

The call `personal:get-calendar-events` is forwarded to the upstream's plain
`get-calendar-events`. The upstream server never knows it was wrapped.

## When this applies

Reach for MCPlexer when the user wants **two or more live instances of the same
MCP server**. Common phrasings: "add my work Google account too", "I want both
personal and work GitHub", "run the Slack MCP for two workspaces", "the tools
clash when I add the second one".

Do NOT use it for running two *different* servers — distinct servers already have
distinct tool names, so prefixing adds noise for no benefit. It's specifically a
collision-avoidance and labeling tool.

## Prerequisites

MCPlexer must be runnable as a command. Two options — pick based on the user's setup:

- **Global install** (cleanest for `.mcp.json` that reference the `mcplexer` command):
  ```bash
  npm install --global @oztamir/mcplexer
  # or: pnpm add --global @oztamir/mcplexer
  ```
- **No install** — invoke through `npx` directly in the config (see the npx variant below). Good when the user can't or won't install globally.

Confirm with `mcplexer --help` (global) before editing configs that depend on the global command.

## The two arrangements

MCPlexer wraps either a **local** upstream (a command it launches over stdio) or
a **remote** upstream (an HTTP/SSE URL). The shape of the args differs:

| Upstream kind | How MCPlexer reaches it |
|---|---|
| Local command (stdio) | Put the full upstream command after `--` |
| Remote endpoint | Pass `--url <endpoint>`; auth via `--header` / `--header-env` |

`--prefix <name>` is always required. `--label <label>` is optional and defaults
to the prefix; it's the human-readable text in the description note, so set it
when you want something nicer than the raw prefix (e.g. label `Work` for prefix `work`).

## Workflow A — Add a new labeled instance

Use this when the user already has one instance working (or none yet) and wants
to add another copy of the same server under its own label.

1. **Identify the upstream**: the command + args (local) or the URL (remote) for
   the server, plus any per-instance `env` (account selector, API key, etc.).
2. **Choose a prefix and label** (see "Choosing a prefix" below).
3. **Write the entry**, wrapping the upstream with MCPlexer.

**Local upstream** — the original command goes after `--`. The wrapper passes its
environment through to the upstream, so per-instance `env` still works:

```json
{
  "mcpServers": {
    "google-personal": {
      "command": "mcplexer",
      "args": [
        "--prefix", "personal",
        "--label", "Personal",
        "--",
        "npx", "-y", "@example/google-workspace-mcp"
      ],
      "env": { "GOOGLE_ACCOUNT": "personal" }
    },
    "google-work": {
      "command": "mcplexer",
      "args": [
        "--prefix", "work",
        "--label", "Work",
        "--",
        "npx", "-y", "@example/google-workspace-mcp"
      ],
      "env": { "GOOGLE_ACCOUNT": "work" }
    }
  }
}
```

**No global install (npx variant)** — `command` is `npx`, and MCPlexer's own args
come after the package name. The upstream command still goes after `--`:

```json
{
  "mcpServers": {
    "google-personal": {
      "command": "npx",
      "args": [
        "-y", "@oztamir/mcplexer",
        "--prefix", "personal",
        "--label", "Personal",
        "--",
        "npx", "-y", "@example/google-workspace-mcp"
      ]
    }
  }
}
```

**Remote upstream** — use `--url`. By default MCPlexer tries Streamable HTTP then
falls back to SSE. Read header values from env so secrets stay out of the args:

```json
{
  "mcpServers": {
    "calendar-work-remote": {
      "command": "mcplexer",
      "args": [
        "--prefix", "work",
        "--label", "Work",
        "--url", "https://mcp.example.com/mcp",
        "--header-env", "Authorization=WORK_MCP_AUTH"
      ],
      "env": { "WORK_MCP_AUTH": "Bearer replace-me" }
    }
  }
}
```

## Workflow B — Migrate an existing MCP entry

Use this when the user already has a working single entry for a server and wants
to bring it under MCPlexer (usually because they're about to add a second copy).

The transformation is mechanical. For a **local** entry, MCPlexer slots in front
of the existing command, and the old `command` + `args` move to after `--`. The
`env` stays at the top level — the wrapper passes it through unchanged.

**Before:**
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "ghp_personal" }
    }
  }
}
```

**After** (prefix `personal`, label `Personal`):
```json
{
  "mcpServers": {
    "github-personal": {
      "command": "mcplexer",
      "args": [
        "--prefix", "personal",
        "--label", "Personal",
        "--",
        "npx", "-y", "@modelcontextprotocol/server-github"
      ],
      "env": { "GITHUB_TOKEN": "ghp_personal" }
    }
  }
}
```

For a **remote** entry (one that used a `url`/`type: http` style server), drop the
URL into `--url` and translate any auth headers into `--header-env` (preferred,
keeps the secret in `env`) or `--header` for non-secret literals.

Migration checklist:

1. **Copy `command` + `args` verbatim** to after `--` (local), or move the URL to
   `--url` (remote). Don't alter the upstream invocation itself.
2. **Keep `env` at the top level.** It's inherited by the upstream process.
3. **Prefix BOTH instances** when adding a second one. Migrating the existing
   entry to a prefix (rather than leaving it bare) keeps the two symmetric and
   makes tool names predictable — `personal:*` and `work:*`, not `*` and `work:*`.
4. **Warn about renamed tools.** After migration, tool names change
   (`get-issue` → `personal:get-issue`). Any saved prompts, slash commands, or
   automations that reference the old names must be updated. Call this out — it's
   the one thing that silently breaks.
5. **Rename the server key** too (`github` → `github-personal`) so the config
   reads clearly, though only the prefix affects tool names.

## Choosing a prefix and label

- **Prefix** must contain only letters, numbers, `_`, or `-` (it becomes part of
  every tool name). Keep it short and lowercase: `personal`, `work`, `acme`.
- **Label** is free text for humans, shown in the description note. Defaults to
  the prefix; set it for nicer casing (`Personal`, `Acme Corp`).
- **Separator** defaults to `:` (`personal:get-issue`). Override with
  `--separator` only if a client mangles colons; `__` is a safe alternative.

## Verify it works

After editing the config, have the user restart their MCP client and confirm:

- Both instances appear, and their tools are prefixed (`personal:…`, `work:…`).
- Tool descriptions carry the label note.
- Calling a prefixed tool produces a result from the correct account.

If a tool call fails with a prefix/separator error, the call name didn't start
with `<prefix><separator>` — check the client is using the rewritten names, not
the upstream ones.

## Full CLI reference

For the complete option list (`--note`, `--transport`, repeatable headers,
edge cases) see [references/cli-reference.md](references/cli-reference.md).
