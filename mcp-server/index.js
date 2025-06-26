import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    getAlerts,
    getForecast,
    calculate,
    // 团建活动规划工具
    getLocation,
    askUserPreference,
    searchRestaurants,
    generatePlan,
    createHtmlReport
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

// 原有工具
registerTool(getAlerts())
registerTool(getForecast())
registerTool(calculate());

// 团建活动规划工具
registerTool(getLocation());
registerTool(askUserPreference());
registerTool(searchRestaurants());
registerTool(generatePlan());
registerTool(createHtmlReport());

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
