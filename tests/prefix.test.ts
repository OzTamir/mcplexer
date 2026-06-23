import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import { describe, expect, it } from "vitest"

import { prefixTool, prefixToolName, unprefixToolName } from "../src/prefix.js"

const OPTIONS = {
  prefix: "personal",
  label: "Personal",
  separator: ":",
  note: 'Note: this is one of multiple instances of this MCP, labeled "Personal".',
} as const

describe("tool prefixing", () => {
  it("prefixes tool names with the configured separator", () => {
    expect(prefixToolName("get-calendar-events", OPTIONS)).toBe("personal:get-calendar-events")
  })

  it("strips only the configured prefix", () => {
    expect(unprefixToolName("personal:get-calendar-events", OPTIONS)).toBe("get-calendar-events")
    expect(unprefixToolName("work:get-calendar-events", OPTIONS)).toBeUndefined()
  })

  it("appends the instance note to existing descriptions", () => {
    const tool = {
      name: "get-calendar-events",
      description: "Read calendar events.",
      inputSchema: { type: "object" },
    } satisfies Tool

    expect(prefixTool(tool, OPTIONS)).toEqual({
      name: "personal:get-calendar-events",
      description:
        'Read calendar events.\n\nNote: this is one of multiple instances of this MCP, labeled "Personal".',
      inputSchema: { type: "object" },
    })
  })

  it("uses the instance note as the description when upstream has none", () => {
    const tool = {
      name: "ping",
      inputSchema: { type: "object" },
    } satisfies Tool

    expect(prefixTool(tool, OPTIONS).description).toBe(
      'Note: this is one of multiple instances of this MCP, labeled "Personal".',
    )
  })
})
