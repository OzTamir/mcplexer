import { type CliParseResult, CliUsageError, type Environment } from "./config-types.js"
import { readRawOptions } from "./raw-cli.js"
import { buildUpstreamConfig } from "./upstream-config.js"
import { defaultDescriptionNote, usageText } from "./usage.js"
import { VERSION } from "./version.js"

export type {
  CliConfig,
  CliParseResult,
  Environment,
  RemoteUpstreamConfig,
  StdioUpstreamConfig,
  UpstreamConfig,
} from "./config-types.js"
export { CliUsageError, MissingEnvironmentVariableError } from "./config-types.js"
export { usageText } from "./usage.js"

export function parseCliArgs(
  argv: readonly string[],
  env: Environment = process.env,
): CliParseResult {
  const raw = readRawOptions(argv)

  if (raw.showHelp) {
    return { kind: "help", text: usageText() }
  }

  if (raw.showVersion) {
    return { kind: "version", text: `mcplexer ${VERSION}` }
  }

  const prefix = requireOption(raw.prefix, "--prefix is required")
  const label = raw.label ?? prefix

  return {
    kind: "config",
    config: {
      prefix,
      label,
      separator: raw.separator,
      note: raw.note ?? defaultDescriptionNote(label),
      upstream: buildUpstreamConfig(raw, env),
    },
  }
}

function requireOption(value: string | undefined, message: string): string {
  if (value === undefined) {
    throw new CliUsageError(message)
  }

  return value
}
