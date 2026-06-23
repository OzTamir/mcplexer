import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

const server = new McpServer({ name: "echo-fixture", version: "0.1.0" })

server.registerTool(
  "echo",
  {
    description: "Echo a message.",
    inputSchema: z.object({ message: z.string() }),
  },
  async ({ message }) => ({
    content: [{ type: "text", text: `echo:${message}` }],
  }),
)

await server.connect(new StdioServerTransport())
