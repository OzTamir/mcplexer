import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  type CallToolResult,
  CallToolResultSchema,
  ErrorCode,
  ListToolsRequestSchema,
  type ListToolsResult,
  ListToolsResultSchema,
  McpError,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js"

import type { CliConfig } from "./config.js"
import { prefixTool, unprefixToolName } from "./prefix.js"
import { connectUpstream } from "./upstream.js"
import { VERSION } from "./version.js"

export async function runProxy(config: CliConfig): Promise<void> {
  const upstream = await connectUpstream(config.upstream)
  const server = new Server({ name: "mcplexer", version: VERSION }, { capabilities: { tools: {} } })

  server.setRequestHandler(ListToolsRequestSchema, async (): Promise<ListToolsResult> => {
    const tools = await listAllTools(upstream.client)
    return { tools: tools.map((tool) => prefixTool(tool, config)) }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const upstreamName = unprefixToolName(request.params.name, config)
    if (upstreamName === undefined) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Tool ${request.params.name} is not managed by prefix ${config.prefix}${config.separator}`,
      )
    }

    return await upstream.client.request(
      {
        method: "tools/call",
        params: { ...request.params, name: upstreamName },
      },
      CallToolResultSchema,
    )
  })

  await server.connect(new StdioServerTransport())
}

async function listAllTools(client: Client): Promise<readonly Tool[]> {
  const tools: Tool[] = []
  let cursor: string | undefined

  do {
    const request =
      cursor === undefined ? { method: "tools/list" } : { method: "tools/list", params: { cursor } }
    const result = await client.request(request, ListToolsResultSchema)
    tools.push(...result.tools)
    cursor = result.nextCursor
  } while (cursor !== undefined)

  return tools
}
