import { z } from "zod"

import { CliUsageError } from "./config-types.js"

const TRANSPORT_MODES = ["auto", "stdio", "http", "sse"] as const
const PREFIX_PATTERN = /^[A-Za-z0-9_-]+$/u

const RawCliSchema = z.object({
  prefix: z
    .string()
    .regex(PREFIX_PATTERN, "--prefix must contain only letters, numbers, underscores, or dashes")
    .optional(),
  label: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
  separator: z.string().min(1).default(":"),
  transport: z.enum(TRANSPORT_MODES).optional(),
  url: z.url().optional(),
  headers: z.array(z.string()),
  headerEnvs: z.array(z.string()),
  oauthBearerEnv: z.string().min(1).optional(),
  oauthClientId: z.string().min(1).optional(),
  oauthClientSecretEnv: z.string().min(1).optional(),
  oauthScope: z.string().min(1).optional(),
  oauthClientName: z.string().min(1).optional(),
  upstreamArgs: z.array(z.string()),
  showHelp: z.boolean(),
  showVersion: z.boolean(),
})

export type RawCliOptions = z.infer<typeof RawCliSchema>
export type TransportMode = (typeof TRANSPORT_MODES)[number]

type RawCliDraft = {
  prefix?: string
  label?: string
  note?: string
  separator: string
  transport?: string
  url?: string
  headers: string[]
  headerEnvs: string[]
  oauthBearerEnv?: string
  oauthClientId?: string
  oauthClientSecretEnv?: string
  oauthScope?: string
  oauthClientName?: string
  upstreamArgs: readonly string[]
  showHelp: boolean
  showVersion: boolean
}

type OptionRead = {
  readonly value: string
  readonly nextIndex: number
}

type OptionContext = {
  readonly argv: readonly string[]
  readonly index: number
  readonly draft: RawCliDraft
}

export function readRawOptions(argv: readonly string[]): RawCliOptions {
  return parseRawCliOptions(readRawDraft(argv))
}

function parseRawCliOptions(raw: RawCliDraft): RawCliOptions {
  const parsed = RawCliSchema.safeParse(raw)
  if (parsed.success) {
    return parsed.data
  }

  const issue = parsed.error.issues[0]
  if (issue === undefined) {
    throw new CliUsageError("Invalid command line arguments")
  }

  throw new CliUsageError(issue.message)
}

function readRawDraft(argv: readonly string[]): RawCliDraft {
  const draft = createRawDraft()
  let index = 0

  while (index < argv.length) {
    const arg = argv[index]
    if (arg === undefined) {
      throw new CliUsageError("Argument parser reached an unexpected empty slot")
    }

    if (arg === "--") {
      draft.upstreamArgs = argv.slice(index + 1)
      return draft
    }

    const nextIndex = readKnownOption(arg, { argv, index, draft })
    index = nextIndex
  }

  return draft
}

function createRawDraft(): RawCliDraft {
  return {
    headers: [],
    headerEnvs: [],
    upstreamArgs: [],
    showHelp: false,
    showVersion: false,
    separator: ":",
  }
}

function readKnownOption(arg: string, context: OptionContext): number {
  switch (optionName(arg)) {
    case "--help":
    case "-h":
      context.draft.showHelp = true
      return context.index + 1
    case "--version":
    case "-v":
      context.draft.showVersion = true
      return context.index + 1
    case "--prefix":
      return applyValueOption(context, "--prefix", (value) => {
        context.draft.prefix = value
      })
    case "--label":
      return applyValueOption(context, "--label", (value) => {
        context.draft.label = value
      })
    case "--separator":
      return applyValueOption(context, "--separator", (value) => {
        context.draft.separator = value
      })
    case "--note":
      return applyValueOption(context, "--note", (value) => {
        context.draft.note = value
      })
    case "--transport":
      return applyValueOption(context, "--transport", (value) => {
        context.draft.transport = value
      })
    case "--url":
      return applyValueOption(context, "--url", (value) => {
        context.draft.url = value
      })
    case "--header":
      return applyValueOption(context, "--header", (value) => {
        context.draft.headers.push(value)
      })
    case "--header-env":
      return applyValueOption(context, "--header-env", (value) => {
        context.draft.headerEnvs.push(value)
      })
    case "--oauth-bearer-env":
      return applyValueOption(context, "--oauth-bearer-env", (value) => {
        context.draft.oauthBearerEnv = value
      })
    case "--oauth-client-id":
      return applyValueOption(context, "--oauth-client-id", (value) => {
        context.draft.oauthClientId = value
      })
    case "--oauth-client-secret-env":
      return applyValueOption(context, "--oauth-client-secret-env", (value) => {
        context.draft.oauthClientSecretEnv = value
      })
    case "--oauth-scope":
      return applyValueOption(context, "--oauth-scope", (value) => {
        context.draft.oauthScope = value
      })
    case "--oauth-client-name":
      return applyValueOption(context, "--oauth-client-name", (value) => {
        context.draft.oauthClientName = value
      })
    default:
      throw new CliUsageError(`Unknown option ${arg}. Put upstream commands after --.`)
  }
}

function applyValueOption(
  context: OptionContext,
  flag: string,
  apply: (value: string) => void,
): number {
  const option = readOptionValue(context.argv, context.index, flag)
  apply(option.value)
  return option.nextIndex
}

function optionName(arg: string): string {
  const equalsIndex = arg.indexOf("=")
  return equalsIndex === -1 ? arg : arg.slice(0, equalsIndex)
}

function readOptionValue(argv: readonly string[], index: number, flag: string): OptionRead {
  const arg = argv[index]
  if (arg === undefined) {
    throw new CliUsageError(`${flag} needs a value`)
  }

  const inlinePrefix = `${flag}=`
  if (arg.startsWith(inlinePrefix)) {
    return { value: arg.slice(inlinePrefix.length), nextIndex: index + 1 }
  }

  const value = argv[index + 1]
  if (value === undefined || value === "--" || value.startsWith("--")) {
    throw new CliUsageError(`${flag} needs a value`)
  }

  return { value, nextIndex: index + 2 }
}
