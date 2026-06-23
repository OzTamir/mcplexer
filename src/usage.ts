import { VERSION } from "./version.js"

export function usageText(): string {
  return `MCPlexer ${VERSION}

Prefix one upstream MCP server's tools so multiple labeled instances can coexist.

Usage:
  mcplexer --prefix <name> [--label <label>] -- <command> [args...]
  mcplexer --prefix <name> [--label <label>] --url <mcp-url> [--transport auto|http|sse]

Options:
  --prefix <name>        Tool name prefix, e.g. personal -> personal:get-calendar-events
  --label <label>        Human label used in the description note (defaults to prefix)
  --separator <text>     Separator between prefix and tool name (defaults to :)
  --note <text>          Description note appended to every tool description
  --url <url>            Remote upstream MCP endpoint
  --transport <mode>     stdio, auto, http, or sse (remote defaults to auto)
  --header <name: value> Header for remote upstreams; repeatable
  --header-env <name=ENV> Header whose value is read from an environment variable
  --help                 Show this help
  --version              Show the version
`
}

export function defaultDescriptionNote(label: string): string {
  return `Note: this is one of multiple instances of this MCP, labeled "${label}".`
}
