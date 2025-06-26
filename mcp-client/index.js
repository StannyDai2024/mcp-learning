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
     * 带工具调用信息的查询处理方法（用于Web版本）
     */
    async processQueryWithToolInfo(query) {
        const result = await this.processQuery(query);
        return {
            response: result.response || result,
            toolCalls: result.toolCalls || []
        };
    }

    /**
     * 流式处理查询方法（用于实时输出）
     */
    async processQueryStream(query, onUpdate) {
        const messages = [
            {
                role: "user",
                content: query,
            },
        ];

        try {
            // 第一次调用：流式获取LLM响应
            const response = await this.callModel({
                model: "qwen-turbo",
                messages,
                tools: this.tools,
                parallel_tool_calls: true,
                stream: true,  // 启用流式响应
            });

            let content = '';
            let toolCalls = [];
            let finishReason = null;

            // 处理流式响应
            for await (const chunk of response) {
                const delta = chunk.choices[0]?.delta;
                finishReason = chunk.choices[0]?.finish_reason;

                // 处理内容流
                if (delta?.content) {
                    content += delta.content;
                    onUpdate({
                        type: 'content',
                        data: content,
                        phase: 'thinking'
                    });
                }

                // 处理工具调用
                if (delta?.tool_calls) {
                    toolCalls = this.mergeToolCalls(toolCalls, delta.tool_calls);
                }
            }

            // 如果LLM决定调用工具
            if (toolCalls && toolCalls.length > 0) {
                onUpdate({
                    type: 'thinking_complete',
                    data: { content, toolCalls: toolCalls.map(tc => tc.function.name) },
                    phase: 'thinking'
                });

                await this.executeToolsStream(toolCalls, onUpdate, messages, content);
            } else {
                // 没有工具调用，直接完成
                onUpdate({
                    type: 'complete',
                    data: { 
                        content: content,  // 最终内容就是思考内容
                        toolCalls: [] 
                    },
                    phase: 'complete'
                });
            }

        } catch (error) {
            onUpdate({
                type: 'error',
                data: { error: error.message },
                phase: 'error'
            });
            throw error;
        }
    }

    /**
     * 合并工具调用增量数据
     */
    mergeToolCalls(existing, delta) {
        const result = [...existing];
        
        for (const deltaCall of delta) {
            const index = deltaCall.index;
            
            if (!result[index]) {
                result[index] = {
                    id: deltaCall.id,
                    type: deltaCall.type,
                    function: {
                        name: deltaCall.function?.name || '',
                        arguments: deltaCall.function?.arguments || ''
                    }
                };
            } else {
                // 合并参数
                if (deltaCall.function?.arguments) {
                    result[index].function.arguments += deltaCall.function.arguments;
                }
                if (deltaCall.function?.name) {
                    result[index].function.name = deltaCall.function.name;
                }
            }
        }
        
        return result;
    }

    /**
     * 流式执行工具调用
     */
    async executeToolsStream(toolCalls, onUpdate, messages, initialContent) {
        // 通知开始工具调用
        onUpdate({
            type: 'tool_start',
            data: { 
                tools: toolCalls.map(tc => ({
                    name: tc.function.name,
                    arguments: JSON.parse(tc.function.arguments || '{}')
                }))
            },
            phase: 'tool_execution'
        });

        // 执行工具调用（改进错误处理）
        const executedToolCalls = await Promise.allSettled(
            toolCalls.map(async (toolCall, index) => {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments || '{}');
                
                // 通知单个工具开始执行
                onUpdate({
                    type: 'tool_progress',
                    data: { 
                        name: functionName,
                        arguments: functionArgs,
                        status: 'executing',
                        index 
                    },
                    phase: 'tool_execution'
                });

                const startTime = Date.now();
                
                try {
                    const toolResponse = await this.mcp.callTool({
                        name: functionName,
                        arguments: functionArgs,
                    });
                    
                    const executionTime = Date.now() - startTime;

                    // 通知单个工具完成
                    onUpdate({
                        type: 'tool_progress',
                        data: { 
                            name: functionName,
                            arguments: functionArgs,
                            status: 'completed',
                            result: toolResponse,
                            executionTime,
                            index 
                        },
                        phase: 'tool_execution'
                    });

                    return {
                        toolCall,
                        functionName,
                        functionArgs,
                        toolResponse,
                        executionTime,
                        success: true
                    };
                } catch (error) {
                    const executionTime = Date.now() - startTime;
                    
                    // 通知单个工具失败
                    onUpdate({
                        type: 'tool_progress',
                        data: { 
                            name: functionName,
                            arguments: functionArgs,
                            status: 'error',
                            error: error.message,
                            executionTime,
                            index 
                        },
                        phase: 'tool_execution'
                    });

                    // 返回失败信息而不是抛出错误
                    return {
                        toolCall,
                        functionName,
                        functionArgs,
                        toolResponse: null,
                        error: error.message,
                        executionTime,
                        success: false
                    };
                }
            })
        );

        // 处理Promise.allSettled的结果
        const processedToolCalls = executedToolCalls.map(result => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                // 理论上不会到这里，因为我们在上面catch了所有错误
                return {
                    success: false,
                    error: result.reason?.message || 'Unknown error',
                    toolResponse: null
                };
            }
        });

        // 分离成功和失败的工具调用
        const successfulCalls = processedToolCalls.filter(call => call.success);
        const failedCalls = processedToolCalls.filter(call => !call.success);

        // 构建包含工具调用结果的消息
        if (successfulCalls.length > 0 || failedCalls.length > 0) {
            // 添加助手的工具调用请求（包括所有尝试的调用）
            messages.push({
                role: "assistant",
                content: null,
                tool_calls: processedToolCalls.map(({ toolCall, functionName, functionArgs }) => ({
                    id: toolCall.id,
                    type: "function",
                    function: {
                        name: functionName,
                        arguments: JSON.stringify(functionArgs),
                    }
                }))
            });

            // 添加工具调用结果（成功的）
            successfulCalls.forEach(({ functionName, toolResponse }) => {
                messages.push({
                    role: "tool",
                    name: functionName,
                    content: JSON.stringify(toolResponse)
                });
            });

            // 添加工具调用失败信息
            failedCalls.forEach(({ functionName, error }) => {
                messages.push({
                    role: "tool",
                    name: functionName,
                    content: JSON.stringify({
                        error: error,
                        message: `工具 ${functionName} 执行失败: ${error}`
                    })
                });
            });

            // 如果有失败的工具，给LLM额外的指导
            if (failedCalls.length > 0) {
                const failedToolNames = failedCalls.map(call => call.functionName).join(', ');
                messages.push({
                    role: "user",
                    content: `注意：工具 ${failedToolNames} 执行失败了。请基于可用的信息尽力回答用户的问题，如果信息不足，请说明哪些工具失败了，并给出可能的原因或建议。`
                });
            }
        }

        // 第二次LLM调用获取最终回答（无论工具是否成功都会执行）
        await this.getFinalResponseStream(messages, processedToolCalls, onUpdate);
    }

    /**
     * 获取最终回答的流式方法
     */
    async getFinalResponseStream(messages, executedToolCalls, onUpdate) {
        onUpdate({
            type: 'final_thinking_start',
            data: {},
            phase: 'final_response'
        });

        const response = await this.callModel({
            model: "qwen-turbo",
            messages,
            stream: true
        });

        let finalContent = '';

        for await (const chunk of response) {
            const delta = chunk.choices[0]?.delta;
            
            if (delta?.content) {
                finalContent += delta.content;
                onUpdate({
                    type: 'final_content',
                    data: finalContent,
                    phase: 'final_response'
                });
            }
        }

        console.log('🔍 Final Response:', finalContent);
        console.log('🔍 Tool Results:', executedToolCalls);

        // 完成
        onUpdate({
            type: 'complete',
            data: { 
                finalContent: finalContent,  // 最终回答内容
                toolCalls: executedToolCalls.map(({ functionName, functionArgs, toolResponse, executionTime, success, error }) => ({
                    name: functionName,
                    arguments: functionArgs,
                    result: success ? toolResponse : null,
                    error: success ? null : error,
                    success: success,
                    executionTime
                }))
            },
            phase: 'complete'
        });
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
         * Process a query using llm and available tools
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
            parallel_tool_calls: true,
        });

        const finalText = [];
        const delta = response.choices[0]?.message;
        const { tool_calls, content } = delta || {};
        // console.dir(delta, { depth: null })

        if (tool_calls?.length && content) {
            finalText.push('llm 调用工具的思考过程🤔: ', content);
        } else if (content) {
            finalText.push(content);
        }
        let executedToolCalls = [];
        
        if (tool_calls?.length) {
            // Execute tool calls in parallel
            const toolCalls = await Promise.all(tool_calls.map(async (toolCall) => {
                const functionName = toolCall?.function?.name;
                const functionArgs = JSON.parse(toolCall?.function?.arguments || `{}`);
                const toolName = functionName;
                const toolArgs = functionArgs;

                console.log(`\n[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}, waiting...]`);
                const startTime = Date.now();
                const toolResponse = await this.mcp.callTool({
                    name: toolName,
                    arguments: toolArgs,
                });
                const endTime = Date.now();

                return {
                    toolCall,
                    functionName,
                    functionArgs,
                    toolResponse,
                    executionTime: endTime - startTime
                };
            }));
            
            executedToolCalls = toolCalls;

            // 将所有 AI 决策的工具调用信息添加到消息中
            messages.push({
                role: "assistant",
                content: null,
                tool_calls: executedToolCalls.map(({ toolCall, functionName, functionArgs }) => ({
                    id: toolCall.id,
                    type: "function",
                    function: {
                        name: functionName,
                        arguments: JSON.stringify(functionArgs),
                    }
                }))
            });

            // 将所有工具调用的结果添加到消息中
            executedToolCalls.forEach(({ functionName, toolResponse }) => {
                messages.push({
                    role: "tool",
                    name: functionName,
                    content: JSON.stringify(toolResponse)
                });
            });
            // console.dir(messages, { depth: null })
            // Get next response from llm, 假设这里只会调用一次工具（实际应用中可能需要循环调用工具直到没有工具调用为止）
            const response = await this.callModel({
                model: "qwen-turbo",
                messages,
            });
            // console.dir(response, { depth: null })
            finalText.push(response.choices[0]?.message?.content || "");
        }
        
        const responseText = finalText.join("\n");
        
        // 如果有工具调用，返回带工具信息的结果
        if (executedToolCalls.length > 0) {
            return {
                response: responseText,
                toolCalls: executedToolCalls.map(({ functionName, functionArgs, toolResponse, executionTime }) => ({
                    name: functionName,
                    arguments: functionArgs,
                    result: toolResponse,
                    executionTime
                }))
            };
        }
        
        // TODO FIXEDME
        return responseText;
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

// Export MCPClient class for use in web server
export { MCPClient };

async function main() {
    if (process.argv.length < 3) {
        console.log("Usage: node <path_to_client_script> <path_to_server_script>");
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

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
