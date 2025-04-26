import OpenAI from "openai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import readline from "readline/promises";
import dotenv from "dotenv";

// load environment variables from .env
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.API_KEY,
    baseURL: process.env.BASE_URL
});

class MCPClient {
    mcp;
    llm;
    transport = null;
    tools = [];
    constructor() {
        // Initialize llm client and MCP client
        this.callModel = openai.chat.completions.create.bind(openai.chat.completions);
        this.mcp = new Client({ name: "mcp-client-cli", version: "1.0.0" });
    }

    /**
     * 基于 mcp 规范
     * 1. 建立和 client 和 server 端的连接
     * 2. 拉取 mcp-server 提供的工具列表（tool list）
     * 
     */
    async connectToServer(serverScriptPath) {
        /**
         * Connect to an MCP server
         *
         */
        try {
            // Initialize transport and connect to server
            this.transport = new StdioClientTransport({
                command: process.execPath,
                args: [serverScriptPath],
            });
            this.mcp.connect(this.transport);
            // List available tools
            const toolsResult = await this.mcp.listTools();
            // 转换成模型认识的 tool 格式
            this.tools = toolsResult.tools.map((tool) => {
                return {
                    type: "function",
                    function: {
                        name: tool.name,
                        description: tool.description,
                        parameters: tool.inputSchema,
                    },
                };
            });
            console.log("Connected to server with tools:", this.tools.map(({ function: { name } }) => name));
        }
        catch (e) {
            console.log("Failed to connect to MCP server: ", e);
            throw e;
        }
    }

    /**
     * 调用大模型
     * 模型会自己感知需要调哪些工具
     * 
     * 在需要工具调用的场景下
     * 利用 mcp 提供的能力实现工具调用并拿到结果，然后再次调用大模型就可以拿到最后回答
     */
    async processQuery(query) {
        /**
         * Process a query using Claude and available tools
         *
         * @param query - The user's input query
         * @returns Processed response as a string
         */
        const messages = [
            {
                role: "user",
                content: query,
            },
        ];
        const response = await this.callModel({
            model: "qwen-turbo",
            messages,
            tools: this.tools,
        });

        const finalText = [];
        const toolResults = [];
        const delta = response.choices[0]?.message;
        const { tool_calls, content } = delta || {};

        if (tool_calls?.length && content) {
            finalText.push('llm 调用工具的思考过程🤔: ', content);
        } else if (content) {
            finalText.push(content);
        }
        if (tool_calls?.length) {
            // Execute tool call
            const toolCall = tool_calls[0];
            const functionName = toolCall?.function?.name;
            const functionArgs = JSON.parse(toolCall?.function?.arguments || `{}`);
            const toolName = functionName;
            const toolArgs = functionArgs;

            console.log(`\n[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`);
            const result = await this.mcp.callTool({
                name: toolName,
                arguments: toolArgs,
            });
            toolResults.push(result);
            
            // Continue conversation with tool results
            messages.push({
                role: "user",
                content: result.content,
            });
            // Get next response from Claude
            const response = await this.callModel({
                model: "qwen-turbo",
                messages,
            });
            finalText.push(response.choices[0]?.message?.content || "");
        }
        return finalText.join("\n");
    }

    /**
     * 
     * 创建了一个对话流
     * 在命令行里接收输入，然后输出大模型的回答
     */
    async chatLoop() {
        /**
         * Run an interactive chat loop
         */
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        try {
            console.log("\nMCP Client Started!");
            console.log("Type your queries or 'quit' to exit.");
            while (true) {
                const message = await rl.question("\nQuery: ");
                if (message.toLowerCase() === "quit") {
                    break;
                }
                try {
                    const response = await this.processQuery(message);
                    console.log("\n" + response);
                }
                catch (e) {
                    console.log("Error processing query: ", e);
                }
            }
        } finally {
            rl.close();
        }
    }

    async cleanup() {
        /**
         * Clean up resources
         */
        await this.mcp.close();
    }
}

async function main() {
    if (process.argv.length < 3) {
        console.log("Usage: node build/index.js <path_to_server_script>");
        return;
    }

    const mcpClient = new MCPClient();
    try {
        await mcpClient.connectToServer(process.argv[2]);
        await mcpClient.chatLoop();
    } catch (e) {
        console.log("Error: ", e);
    } finally {
        await mcpClient.cleanup();
        process.exit(0);
    }
}

main();
