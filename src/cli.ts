#!/usr/bin/env node
import { CliUsageError, MissingEnvironmentVariableError, parseCliArgs } from "./config.js"
import { runProxy } from "./proxy.js"

async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const parsed = parseCliArgs(argv)

  switch (parsed.kind) {
    case "help":
      process.stdout.write(parsed.text)
      return
    case "version":
      process.stdout.write(`${parsed.text}\n`)
      return
    case "config":
      await runProxy(parsed.config)
      return
    default:
      return assertNever(parsed)
  }
}

function assertNever(value: never): never {
  throw new CliUsageError(`Unexpected CLI parse result: ${JSON.stringify(value)}`)
}

// no-excuse-ok: catch
main().catch((error: unknown) => {
  if (error instanceof CliUsageError || error instanceof MissingEnvironmentVariableError) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 2
    return
  }

  if (error instanceof Error) {
    process.stderr.write(`${error.stack ?? error.message}\n`)
    process.exitCode = 1
    return
  }

  process.stderr.write(`Unknown failure: ${String(error)}\n`)
  process.exitCode = 1
})
