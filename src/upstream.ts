import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

import type { RemoteUpstreamConfig, UpstreamConfig } from "./config.js"
import { ExactOptionalTransport } from "./transport-adapter.js"
import { VERSION } from "./version.js"

export type ConnectedUpstream = {
  readonly client: Client
}

type ConnectionResult =
  | { readonly ok: true; readonly upstream: ConnectedUpstream }
  | { readonly ok: false; readonly error: Error }

export class UpstreamConnectionError extends Error {
  readonly name = "UpstreamConnectionError"

  constructor(
    readonly target: string,
    readonly transport: string,
    options?: ErrorOptions,
  ) {
    super(`Could not connect to upstream MCP ${target} using ${transport}`, options)
  }
}

export class NonErrorThrownError extends Error {
  readonly name = "NonErrorThrownError"

  constructor(readonly thrown: unknown) {
    super("A dependency threw a non-Error value")
  }
}

export async function connectUpstream(config: UpstreamConfig): Promise<ConnectedUpstream> {
  switch (config.kind) {
    case "stdio":
      return await connectStdioUpstream(config.command, config.args)
    case "remote":
      return await connectRemoteUpstream(config)
    default:
      return assertNever(config)
  }
}

async function connectStdioUpstream(
  command: string,
  args: readonly string[],
): Promise<ConnectedUpstream> {
  const client = createClient()
  const transport = new StdioClientTransport({
    command,
    args: Array.from(args),
    env: childEnvironment(),
    stderr: "pipe",
  })

  transport.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk)
  })

  await client.connect(new ExactOptionalTransport(transport))
  return { client }
}

async function connectRemoteUpstream(config: RemoteUpstreamConfig): Promise<ConnectedUpstream> {
  switch (config.transport) {
    case "http":
      return await connectStreamableHttp(config)
    case "sse":
      return await connectSse(config)
    case "auto":
      return await connectRemoteAuto(config)
    default:
      return assertNever(config.transport)
  }
}

async function connectRemoteAuto(config: RemoteUpstreamConfig): Promise<ConnectedUpstream> {
  const http = await tryConnection(() => connectStreamableHttp(config))
  if (http.ok) {
    return http.upstream
  }

  const sse = await tryConnection(() => connectSse(config))
  if (sse.ok) {
    return sse.upstream
  }

  throw new UpstreamConnectionError(config.url, "auto", {
    cause: new AggregateError([http.error, sse.error], "HTTP and SSE transports both failed"),
  })
}

async function connectStreamableHttp(config: RemoteUpstreamConfig): Promise<ConnectedUpstream> {
  const client = createClient()
  const transport = new StreamableHTTPClientTransport(new URL(config.url), {
    requestInit: { headers: config.headers },
  })

  await client.connect(new ExactOptionalTransport(transport))
  return { client }
}

async function connectSse(config: RemoteUpstreamConfig): Promise<ConnectedUpstream> {
  const client = createClient()
  const transport = new SSEClientTransport(new URL(config.url), {
    requestInit: { headers: config.headers },
  })

  await client.connect(new ExactOptionalTransport(transport))
  return { client }
}

async function tryConnection(connect: () => Promise<ConnectedUpstream>): Promise<ConnectionResult> {
  try {
    return { ok: true, upstream: await connect() }
  } catch (error) {
    if (error instanceof Error) {
      return { ok: false, error }
    }

    return { ok: false, error: new NonErrorThrownError(error) }
  }
}

function createClient(): Client {
  return new Client({ name: "mcplexer", version: VERSION })
}

function childEnvironment(): Record<string, string> {
  const env: Record<string, string> = {}

  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value
    }
  }

  return env
}

function assertNever(value: never): never {
  throw new UpstreamConnectionError(JSON.stringify(value), "unknown")
}
