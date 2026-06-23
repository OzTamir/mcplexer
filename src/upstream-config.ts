import type { Environment, UpstreamConfig } from "./config-types.js"
import { CliUsageError, MissingEnvironmentVariableError } from "./config-types.js"
import type { RawCliOptions, TransportMode } from "./raw-cli.js"

export function buildUpstreamConfig(raw: RawCliOptions, env: Environment): UpstreamConfig {
  if (raw.url !== undefined) {
    if (raw.upstreamArgs.length > 0) {
      throw new CliUsageError(
        "Use either --url for a remote MCP or -- <command> for stdio, not both",
      )
    }

    return {
      kind: "remote",
      transport: remoteTransport(raw.transport),
      url: raw.url,
      headers: buildHeaders(raw.headers, raw.headerEnvs, env),
    }
  }

  if (raw.transport !== undefined && raw.transport !== "stdio") {
    throw new CliUsageError("Remote transports require --url")
  }

  const command = raw.upstreamArgs[0]
  if (command === undefined) {
    throw new CliUsageError("A stdio upstream command is required after --")
  }

  return {
    kind: "stdio",
    command,
    args: raw.upstreamArgs.slice(1),
  }
}

function remoteTransport(transport: TransportMode | undefined): "auto" | "http" | "sse" {
  if (transport === undefined || transport === "auto") {
    return "auto"
  }

  if (transport === "http" || transport === "sse") {
    return transport
  }

  throw new CliUsageError("--transport stdio cannot be used with --url")
}

function buildHeaders(
  headers: readonly string[],
  headerEnvs: readonly string[],
  env: Environment,
): Readonly<Record<string, string>> {
  const result: Record<string, string> = {}

  for (const header of headers) {
    const parsed = parseHeader(header)
    result[parsed.name] = parsed.value
  }

  for (const headerEnv of headerEnvs) {
    const parsed = parseHeaderEnv(headerEnv, env)
    result[parsed.name] = parsed.value
  }

  return result
}

function parseHeader(header: string): { readonly name: string; readonly value: string } {
  const colonIndex = header.indexOf(":")
  if (colonIndex === -1) {
    throw new CliUsageError(`Header ${header} must use "Name: value" syntax`)
  }

  const name = header.slice(0, colonIndex).trim()
  const value = header.slice(colonIndex + 1).trim()

  if (name.length === 0) {
    throw new CliUsageError("Header name cannot be empty")
  }

  return { name, value }
}

function parseHeaderEnv(
  headerEnv: string,
  env: Environment,
): { readonly name: string; readonly value: string } {
  const equalsIndex = headerEnv.indexOf("=")
  if (equalsIndex === -1) {
    throw new CliUsageError(`Header env ${headerEnv} must use "Name=ENV_VAR" syntax`)
  }

  const name = headerEnv.slice(0, equalsIndex).trim()
  const variableName = headerEnv.slice(equalsIndex + 1).trim()
  if (name.length === 0 || variableName.length === 0) {
    throw new CliUsageError("Header env name and variable cannot be empty")
  }

  const value = env[variableName]
  if (value === undefined) {
    throw new MissingEnvironmentVariableError(variableName)
  }

  return { name, value }
}
