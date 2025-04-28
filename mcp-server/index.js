import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    getAlerts,
    getForecast,
    calculate
} from './tools/index.js'

// Create server instance
class WeatherServer extends McpServer {
    constructor() {
        super({
            name: "weather",
            version: "1.0.0",
            capabilities: {
                resources: {},
                tools: {},
            },
        });

        // Auto register all tools from tools directory
        this.registerTool(getAlerts());
        this.registerTool(getForecast());
        this.registerTool(calculate());
    }

    registerTool(toolConfig) {
        const { name, description, schema, handler } = toolConfig;
        this.tool(name, description, schema, handler);
    }
}

const server = new WeatherServer();

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Weather MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
