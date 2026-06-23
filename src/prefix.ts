import type { Tool } from "@modelcontextprotocol/sdk/types.js"

export type PrefixOptions = {
  readonly prefix: string
  readonly label: string
  readonly separator: string
  readonly note: string
}

export function prefixTool(tool: Tool, options: PrefixOptions): Tool {
  return {
    ...tool,
    name: prefixToolName(tool.name, options),
    description: appendDescriptionNote(tool.description, options.note),
  }
}

export function prefixToolName(name: string, options: PrefixOptions): string {
  return `${options.prefix}${options.separator}${name}`
}

export function unprefixToolName(name: string, options: PrefixOptions): string | undefined {
  const expectedPrefix = `${options.prefix}${options.separator}`
  if (!name.startsWith(expectedPrefix)) {
    return undefined
  }

  const upstreamName = name.slice(expectedPrefix.length)
  return upstreamName.length === 0 ? undefined : upstreamName
}

function appendDescriptionNote(description: string | undefined, note: string): string {
  if (description === undefined || description.length === 0) {
    return note
  }

  return `${description}\n\n${note}`
}
