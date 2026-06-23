export type StdioUpstreamConfig = {
  readonly kind: "stdio"
  readonly command: string
  readonly args: readonly string[]
}

export type RemoteUpstreamConfig = {
  readonly kind: "remote"
  readonly transport: "auto" | "http" | "sse"
  readonly url: string
  readonly headers: Readonly<Record<string, string>>
}

export type UpstreamConfig = StdioUpstreamConfig | RemoteUpstreamConfig

export type CliConfig = {
  readonly prefix: string
  readonly label: string
  readonly separator: string
  readonly note: string
  readonly upstream: UpstreamConfig
}

export type CliParseResult =
  | { readonly kind: "config"; readonly config: CliConfig }
  | { readonly kind: "help"; readonly text: string }
  | { readonly kind: "version"; readonly text: string }

export type Environment = Readonly<Record<string, string | undefined>>

class BaseUsageError extends Error {}

export class CliUsageError extends BaseUsageError {
  readonly name = "CliUsageError"
}

export class MissingEnvironmentVariableError extends BaseUsageError {
  readonly name = "MissingEnvironmentVariableError"

  constructor(readonly variableName: string) {
    super(`Environment variable ${variableName} is required by --header-env`)
  }
}
