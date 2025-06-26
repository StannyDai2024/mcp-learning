import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    getAlerts,
    getForecast,
    calculate,
    // 自定义业务工具
    createHtmlReport
} from './tools/index.js'

const server = new McpServer({
    name: "custom-business-tools",
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

// 原有示例工具（可选保留）
registerTool(getAlerts())
registerTool(getForecast())
registerTool(calculate());

// 自定义业务工具
registerTool(createHtmlReport());

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("自定义业务MCP服务器已启动");
    console.log("- 高德地图功能请使用官方MCP服务");
    console.log("- 本服务器专注于业务逻辑工具（如HTML报告生成）");
}

main().catch(console.error);
