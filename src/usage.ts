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
  --oauth-bearer-env <ENV> Use an OAuth bearer token from an environment variable
  --oauth-flow browser OAuth authorization-code flow with a local browser callback
  --oauth-callback-port <port> Local browser OAuth callback port (defaults to 33418)
  --oauth-store <path> OAuth token/client cache path for browser flow
  --oauth-no-open        Print browser OAuth URL without opening it
  --oauth-client-id <id> OAuth client_id for browser or client_credentials flows
  --oauth-client-secret-env <ENV> OAuth client_credentials client_secret environment variable
  --oauth-scope <scope>  OAuth scope for client_credentials, space-separated when needed
  --oauth-client-name <name> OAuth client display name for metadata
  --help                 Show this help
  --version              Show the version
`
}

export function defaultDescriptionNote(label: string): string {
  return `Note: this is one of multiple instances of this MCP, labeled "${label}".`
}
