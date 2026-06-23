import { describe, expect, it } from "vitest"

import { CliUsageError, MissingEnvironmentVariableError, parseCliArgs } from "../src/config.js"

describe("parseCliArgs", () => {
  it("builds a stdio upstream config when a command follows --", () => {
    const parsed = parseCliArgs([
      "--prefix",
      "personal",
      "--label",
      "Personal",
      "--",
      "node",
      "server.js",
    ])

    expect(parsed).toEqual({
      kind: "config",
      config: {
        prefix: "personal",
        label: "Personal",
        separator: ":",
        note: 'Note: this is one of multiple instances of this MCP, labeled "Personal".',
        upstream: {
          kind: "stdio",
          command: "node",
          args: ["server.js"],
        },
      },
    })
  })

  it("builds a remote config with literal and env-backed headers", () => {
    const parsed = parseCliArgs(
      [
        "--prefix=work",
        "--url",
        "https://mcp.example.com/mcp",
        "--transport",
        "http",
        "--header",
        "X-Tenant: work",
        "--header-env",
        "Authorization=WORK_AUTH",
      ],
      { WORK_AUTH: "Bearer token" },
    )

    expect(parsed).toEqual({
      kind: "config",
      config: {
        prefix: "work",
        label: "work",
        separator: ":",
        note: 'Note: this is one of multiple instances of this MCP, labeled "work".',
        upstream: {
          kind: "remote",
          transport: "http",
          url: "https://mcp.example.com/mcp",
          headers: {
            Authorization: "Bearer token",
            "X-Tenant": "work",
          },
          auth: { kind: "none" },
        },
      },
    })
  })

  it("builds a remote config with bearer OAuth from env", () => {
    const parsed = parseCliArgs(
      [
        "--prefix",
        "work",
        "--url",
        "https://mcp.example.com/mcp",
        "--oauth-bearer-env",
        "MCP_TOKEN",
      ],
      { MCP_TOKEN: "token-123" },
    )

    expect(parsed).toMatchObject({
      kind: "config",
      config: {
        upstream: {
          kind: "remote",
          auth: { kind: "bearer", token: "token-123" },
        },
      },
    })
  })

  it("builds a remote config with OAuth client credentials", () => {
    const parsed = parseCliArgs(
      [
        "--prefix",
        "work",
        "--url",
        "https://mcp.example.com/mcp",
        "--oauth-client-id",
        "client-id",
        "--oauth-client-secret-env",
        "MCP_CLIENT_SECRET",
        "--oauth-scope",
        "calendar.read calendar.write",
        "--oauth-client-name",
        "MCPlexer Work",
      ],
      { MCP_CLIENT_SECRET: "secret" },
    )

    expect(parsed).toMatchObject({
      kind: "config",
      config: {
        upstream: {
          kind: "remote",
          auth: {
            kind: "client_credentials",
            clientId: "client-id",
            clientSecret: "secret",
            scope: "calendar.read calendar.write",
            clientName: "MCPlexer Work",
          },
        },
      },
    })
  })

  it("builds a remote config with browser OAuth", () => {
    const parsed = parseCliArgs(
      [
        "--prefix",
        "notion-work",
        "--url",
        "https://mcp.notion.com/mcp",
        "--oauth-flow",
        "browser",
        "--oauth-callback-port",
        "49887",
        "--oauth-store",
        "/tmp/mcplexer-notion.json",
        "--oauth-no-open",
        "--oauth-scope",
        "read write",
        "--oauth-client-name",
        "MCPlexer Notion",
      ],
      {},
    )

    expect(parsed).toMatchObject({
      kind: "config",
      config: {
        upstream: {
          kind: "remote",
          auth: {
            kind: "browser",
            callbackPort: 49887,
            openBrowser: false,
            storePath: "/tmp/mcplexer-notion.json",
            scope: "read write",
            clientName: "MCPlexer Notion",
          },
        },
      },
    })
  })

  it("throws a usage error when prefix is missing", () => {
    expect(() => parseCliArgs(["--", "node", "server.js"])).toThrow(CliUsageError)
  })

  it("throws a usage error when prefix contains unsupported characters", () => {
    expect(() => parseCliArgs(["--prefix", "bad:prefix", "--", "node", "server.js"])).toThrow(
      CliUsageError,
    )
  })

  it("throws a usage error when a referenced header env var is missing", () => {
    expect(() =>
      parseCliArgs(
        [
          "--prefix",
          "work",
          "--url",
          "https://mcp.example.com/mcp",
          "--header-env",
          "Authorization=WORK_AUTH",
        ],
        {},
      ),
    ).toThrow(MissingEnvironmentVariableError)
  })

  it("throws a usage error when OAuth is combined with an Authorization header", () => {
    expect(() =>
      parseCliArgs(
        [
          "--prefix",
          "work",
          "--url",
          "https://mcp.example.com/mcp",
          "--header",
          "Authorization: Bearer manual",
          "--oauth-bearer-env",
          "MCP_TOKEN",
        ],
        { MCP_TOKEN: "token-123" },
      ),
    ).toThrow(CliUsageError)
  })

  it("throws a usage error when browser OAuth is combined with bearer env", () => {
    expect(() =>
      parseCliArgs(
        [
          "--prefix",
          "work",
          "--url",
          "https://mcp.example.com/mcp",
          "--oauth-flow",
          "browser",
          "--oauth-bearer-env",
          "MCP_TOKEN",
        ],
        { MCP_TOKEN: "token-123" },
      ),
    ).toThrow(CliUsageError)
  })

  it("throws a usage error when OAuth options are used for stdio upstreams", () => {
    expect(() =>
      parseCliArgs(
        ["--prefix", "work", "--oauth-bearer-env", "MCP_TOKEN", "--", "node", "server.js"],
        {
          MCP_TOKEN: "token-123",
        },
      ),
    ).toThrow(CliUsageError)
  })
})
