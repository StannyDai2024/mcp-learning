import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    getAlerts,
    getForecast,
    calculate
} from './tools/index.js'

const server = new McpServer({
    name: "weather",
    version: "1.0.0",
    capabilities: {
        resources: {},
        tools: {},
    },
});

function registerTool(toolConfig) {
    const { name, description, schema, handler } = toolConfig;
    server.tool(name, description, schema, handler);
    return server;
}
registerTool(getAlerts())
registerTool(getForecast())
registerTool(calculate());

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Weather MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
