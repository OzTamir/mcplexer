import { createHash } from "node:crypto"

import type { Environment, RemoteAuthConfig, UpstreamConfig } from "./config-types.js"
import { CliUsageError, MissingEnvironmentVariableError } from "./config-types.js"
import type { RawCliOptions, TransportMode } from "./raw-cli.js"

const MIN_DYNAMIC_CALLBACK_PORT = 49152
const MAX_DYNAMIC_CALLBACK_PORT = 65535

export function buildUpstreamConfig(raw: RawCliOptions, env: Environment): UpstreamConfig {
  if (raw.url !== undefined) {
    if (raw.upstreamArgs.length > 0) {
      throw new CliUsageError(
        "Use either --url for a remote MCP or -- <command> for stdio, not both",
      )
    }

    const headers = buildHeaders(raw.headers, raw.headerEnvs, env)
    const auth = buildRemoteAuth(raw, env)
    rejectAuthorizationHeaderWithAuth(headers, auth)

    return {
      kind: "remote",
      transport: remoteTransport(raw.transport),
      url: raw.url,
      headers,
      auth,
    }
  }

  if (hasOAuthOptions(raw)) {
    throw new CliUsageError("OAuth options require --url")
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

function buildRemoteAuth(raw: RawCliOptions, env: Environment): RemoteAuthConfig {
  if (raw.oauthFlow === "browser") {
    if (raw.oauthBearerEnv !== undefined || raw.oauthClientSecretEnv !== undefined) {
      throw new CliUsageError(
        "Browser OAuth cannot be combined with bearer tokens or client secrets",
      )
    }

    return {
      kind: "browser",
      callbackPort: raw.oauthCallbackPort ?? defaultOAuthCallbackPort(raw),
      openBrowser: raw.oauthOpenBrowser,
      storePath: raw.oauthStore ?? defaultOAuthStorePath(raw, env),
      clientName: raw.oauthClientName ?? "MCPlexer",
      ...(raw.oauthClientId === undefined ? {} : { clientId: raw.oauthClientId }),
      ...(raw.oauthScope === undefined ? {} : { scope: raw.oauthScope }),
    }
  }

  if (hasBrowserOAuthOptions(raw)) {
    throw new CliUsageError("Browser OAuth options require --oauth-flow browser")
  }

  if (raw.oauthBearerEnv !== undefined) {
    if (raw.oauthClientId !== undefined || raw.oauthClientSecretEnv !== undefined) {
      throw new CliUsageError("Use either --oauth-bearer-env or OAuth client credentials, not both")
    }

    return {
      kind: "bearer",
      token: readEnv(raw.oauthBearerEnv, env, "--oauth-bearer-env"),
    }
  }

  if (!hasOAuthOptions(raw)) {
    return { kind: "none" }
  }

  if (raw.oauthClientId === undefined || raw.oauthClientSecretEnv === undefined) {
    throw new CliUsageError(
      "OAuth client credentials require --oauth-client-id and --oauth-client-secret-env",
    )
  }

  return {
    kind: "client_credentials",
    clientId: raw.oauthClientId,
    clientSecret: readEnv(raw.oauthClientSecretEnv, env, "--oauth-client-secret-env"),
    ...(raw.oauthScope === undefined ? {} : { scope: raw.oauthScope }),
    ...(raw.oauthClientName === undefined ? {} : { clientName: raw.oauthClientName }),
  }
}

function hasOAuthOptions(raw: RawCliOptions): boolean {
  return (
    raw.oauthBearerEnv !== undefined ||
    raw.oauthClientId !== undefined ||
    raw.oauthClientSecretEnv !== undefined ||
    raw.oauthScope !== undefined ||
    raw.oauthClientName !== undefined ||
    raw.oauthFlow !== undefined ||
    hasBrowserOAuthOptions(raw)
  )
}

function hasBrowserOAuthOptions(raw: RawCliOptions): boolean {
  return (
    raw.oauthStore !== undefined || raw.oauthCallbackPort !== undefined || !raw.oauthOpenBrowser
  )
}

function defaultOAuthCallbackPort(raw: RawCliOptions): number {
  const hash = createHash("sha256")
    .update(`${raw.url ?? ""}\n${raw.prefix ?? ""}`)
    .digest()
  const range = MAX_DYNAMIC_CALLBACK_PORT - MIN_DYNAMIC_CALLBACK_PORT + 1
  return MIN_DYNAMIC_CALLBACK_PORT + (hash.readUInt32BE(0) % range)
}

function defaultOAuthStorePath(raw: RawCliOptions, env: Environment): string {
  const { HOME: home } = env
  if (home === undefined) {
    throw new CliUsageError("--oauth-flow browser requires HOME or --oauth-store")
  }

  const storeKey = Buffer.from(`${raw.url ?? ""}\n${raw.prefix ?? ""}`, "utf8").toString(
    "base64url",
  )
  return `${home}/.config/mcplexer/oauth/${storeKey}.json`
}

function rejectAuthorizationHeaderWithAuth(
  headers: Readonly<Record<string, string>>,
  auth: RemoteAuthConfig,
): void {
  if (auth.kind === "none") {
    return
  }

  for (const headerName of Object.keys(headers)) {
    if (headerName.toLowerCase() === "authorization") {
      throw new CliUsageError("Do not combine OAuth options with an Authorization header")
    }
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

  return { name, value: readEnv(variableName, env, "--header-env") }
}

function readEnv(variableName: string, env: Environment, optionName: string): string {
  const value = env[variableName]
  if (value === undefined) {
    throw new MissingEnvironmentVariableError(variableName, optionName)
  }

  return value
}
