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
     * 🔥 新增：基于历史消息的查询处理方法（用于多轮对话）
     */
    async processQueryWithMessages(messages) {
        const result = await this.processQueryWithHistory(messages);
        return {
            response: result.response || result,
            toolCalls: result.toolCalls || [],
            messages: result.messages || messages
        };
    }

    /**
     * 🔥 新增：基于历史消息的流式处理方法（用于多轮对话）
     */
    async processQueryStreamWithMessages(messages, onUpdate, onMessagesUpdate) {
        // 克隆消息数组以避免修改原始数组
        const workingMessages = [...messages];

        try {
            // 🔥 新功能：多轮工具调用（支持消息历史）
            await this.processQueryWithMultiRoundToolsWithHistory(workingMessages, onUpdate, onMessagesUpdate);
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
     * 🔥 新增：支持消息历史的多轮工具调用
     */
    async processQueryWithMultiRoundToolsWithHistory(messages, onUpdate, onMessagesUpdate, maxRounds = 5) {
        let roundCount = 0;
        let allExecutedToolCalls = []; // 记录所有轮次的工具调用
        
        while (roundCount < maxRounds) {
            roundCount++;
            console.log(`🔄 多轮对话模式 - 第 ${roundCount} 轮工具调用...`);
            
            // 第一阶段：AI思考并决定工具调用
            onUpdate({
                type: 'content',
                data: '',
                phase: roundCount === 1 ? 'thinking' : `thinking_round_${roundCount}`
            });

            const response = await this.callModel({
                model: "qwen-turbo",
                messages,
                tools: this.tools,
                parallel_tool_calls: true,
                stream: true
            });

            let currentContent = '';
            let currentToolCalls = [];

            // 流式获取AI的思考过程和工具调用决策
            for await (const chunk of response) {
                const delta = chunk.choices[0]?.delta;
                
                if (delta?.content) {
                    currentContent += delta.content;
                    onUpdate({
                        type: 'content',
                        data: currentContent,
                        phase: roundCount === 1 ? 'thinking' : `thinking_round_${roundCount}`
                    });
                }

                if (delta?.tool_calls) {
                    currentToolCalls = this.mergeToolCalls(currentToolCalls, delta.tool_calls);
                }
            }

            // 结束当前轮次的思考阶段
            onUpdate({
                type: 'thinking_complete',
                data: { 
                    content: currentContent,
                    toolCalls: currentToolCalls.map(tc => tc.function.name),
                    round: roundCount
                },
                phase: 'thinking_complete'
            });

            if (currentToolCalls?.length > 0) {
                // 第二阶段：执行工具调用
                console.log(`🔧 多轮对话模式 - 第 ${roundCount} 轮执行 ${currentToolCalls.length} 个工具...`);
                
                const roundToolCalls = await this.executeToolsForRound(
                    currentToolCalls, 
                    onUpdate, 
                    messages, 
                    currentContent,
                    roundCount
                );
                
                // 记录本轮工具调用
                allExecutedToolCalls.push(...roundToolCalls);
                
                // 继续下一轮循环，让AI基于工具结果决定是否需要更多工具
                continue;
                
            } else {
                // 没有工具调用，AI决定结束，生成最终回答
                console.log(`✅ 多轮对话模式 - 第 ${roundCount} 轮无工具调用，开始生成最终回答...`);
                
                // 如果有内容，说明AI已经给出了最终回答
                if (currentContent.trim()) {
                    // 添加AI的最终回复到消息历史
                    messages.push({
                        role: "assistant",
                        content: currentContent
                    });

                    // 更新消息历史
                    if (onMessagesUpdate) {
                        onMessagesUpdate(messages);
                    }

                    onUpdate({
                        type: 'complete',
                        data: { 
                            finalContent: currentContent,
                            toolCalls: allExecutedToolCalls.map(this.formatToolCallForFrontend),
                            totalRounds: roundCount
                        },
                        phase: 'complete'
                    });
                } else {
                    // 没有内容，需要调用最终回答生成
                    await this.getFinalResponseStreamMultiRoundWithHistory(messages, allExecutedToolCalls, onUpdate, onMessagesUpdate, roundCount);
                }
                
                break;
            }
        }

        // 达到最大轮次限制
        if (roundCount >= maxRounds) {
            console.log(`⚠️ 多轮对话模式 - 达到最大轮次限制 (${maxRounds})，强制生成最终回答...`);
            await this.getFinalResponseStreamMultiRoundWithHistory(messages, allExecutedToolCalls, onUpdate, onMessagesUpdate, roundCount);
        }
    }

    /**
     * 🔥 新增：支持消息历史的多轮工具调用最终回答生成
     */
    async getFinalResponseStreamMultiRoundWithHistory(messages, allExecutedToolCalls, onUpdate, onMessagesUpdate, totalRounds) {
        onUpdate({
            type: 'final_thinking_start',
            data: { totalRounds },
            phase: 'final_response'
        });

        const response = await this.callModel({
            model: "qwen-turbo",
            messages,
            stream: true
            // 注意：最终回答阶段不传入tools，确保AI专注于总结和回答
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

        // 添加AI的最终回复到消息历史
        messages.push({
            role: "assistant",
            content: finalContent
        });

        // 更新消息历史
        if (onMessagesUpdate) {
            onMessagesUpdate(messages);
        }

        console.log(`🔍 多轮对话模式 - 最终回答 (${totalRounds} 轮):`, finalContent);
        console.log(`🔍 多轮对话模式 - 累计工具调用数量:`, allExecutedToolCalls.length);

        // 完成
        onUpdate({
            type: 'complete',
            data: { 
                finalContent: finalContent,
                toolCalls: allExecutedToolCalls.map(this.formatToolCallForFrontend),
                totalRounds: totalRounds
            },
            phase: 'complete'
        });
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
            // 🔥 新功能：多轮工具调用
            await this.processQueryWithMultiRoundTools(messages, onUpdate);
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
     * 🔥 新增：多轮工具调用的核心方法
     * 支持AI根据前一轮工具结果继续调用更多工具
     */
    async processQueryWithMultiRoundTools(messages, onUpdate, maxRounds = 5) {
        let roundCount = 0;
        let allExecutedToolCalls = []; // 记录所有轮次的工具调用
        
        while (roundCount < maxRounds) {
            roundCount++;
            console.log(`🔄 开始第 ${roundCount} 轮工具调用...`);
            
            // 第一阶段：AI思考并决定工具调用
            onUpdate({
                type: 'content',
                data: '',
                phase: roundCount === 1 ? 'thinking' : `thinking_round_${roundCount}`
            });

            const response = await this.callModel({
                model: "qwen-turbo",
                messages,
                tools: this.tools,
                parallel_tool_calls: true,
                stream: true
            });

            let currentContent = '';
            let currentToolCalls = [];

            // 流式获取AI的思考过程和工具调用决策
            for await (const chunk of response) {
                const delta = chunk.choices[0]?.delta;
                
                if (delta?.content) {
                    currentContent += delta.content;
                    onUpdate({
                        type: 'content',
                        data: currentContent,
                        phase: roundCount === 1 ? 'thinking' : `thinking_round_${roundCount}`
                    });
                }

                if (delta?.tool_calls) {
                    currentToolCalls = this.mergeToolCalls(currentToolCalls, delta.tool_calls);
                }
            }

            // 结束当前轮次的思考阶段
            onUpdate({
                type: 'thinking_complete',
                data: { 
                    content: currentContent,
                    toolCalls: currentToolCalls.map(tc => tc.function.name),
                    round: roundCount
                },
                phase: 'thinking_complete'
            });

            if (currentToolCalls?.length > 0) {
                // 第二阶段：执行工具调用
                console.log(`🔧 第 ${roundCount} 轮执行 ${currentToolCalls.length} 个工具...`);
                
                const roundToolCalls = await this.executeToolsForRound(
                    currentToolCalls, 
                    onUpdate, 
                    messages, 
                    currentContent,
                    roundCount
                );
                
                // 记录本轮工具调用
                allExecutedToolCalls.push(...roundToolCalls);
                
                // 继续下一轮循环，让AI基于工具结果决定是否需要更多工具
                continue;
                
            } else {
                // 没有工具调用，AI决定结束，生成最终回答
                console.log(`✅ 第 ${roundCount} 轮无工具调用，开始生成最终回答...`);
                
                // 如果有内容，说明AI已经给出了最终回答
                if (currentContent.trim()) {
                    // 添加AI的最终回复到消息历史
                    messages.push({
                        role: "assistant",
                        content: currentContent
                    });

                    onUpdate({
                        type: 'complete',
                        data: { 
                            finalContent: currentContent,
                            toolCalls: allExecutedToolCalls.map(this.formatToolCallForFrontend),
                            totalRounds: roundCount
                        },
                        phase: 'complete'
                    });
                } else {
                    // 没有内容，需要调用最终回答生成
                    await this.getFinalResponseStreamMultiRound(messages, allExecutedToolCalls, onUpdate, roundCount);
                }
                
                break;
            }
        }

        // 达到最大轮次限制
        if (roundCount >= maxRounds) {
            console.log(`⚠️ 达到最大轮次限制 (${maxRounds})，强制生成最终回答...`);
            await this.getFinalResponseStreamMultiRound(messages, allExecutedToolCalls, onUpdate, roundCount);
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
     * 🔥 新增：执行单轮工具调用
     */
    async executeToolsForRound(toolCalls, onUpdate, messages, initialContent, roundCount) {
        // 通知开始工具调用
        onUpdate({
            type: 'tool_start',
            data: { 
                tools: toolCalls.map(tc => ({
                    name: tc.function.name,
                    arguments: JSON.parse(tc.function.arguments || '{}')
                })),
                round: roundCount
            },
            phase: 'tool_execution'
        });

        // 执行工具调用
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
                        index,
                        round: roundCount
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
                            index,
                            round: roundCount
                        },
                        phase: 'tool_execution'
                    });

                    return {
                        toolCall,
                        functionName,
                        functionArgs,
                        toolResponse,
                        executionTime,
                        success: true,
                        round: roundCount
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
                            index,
                            round: roundCount
                        },
                        phase: 'tool_execution'
                    });

                    return {
                        toolCall,
                        functionName,
                        functionArgs,
                        toolResponse: null,
                        error: error.message,
                        executionTime,
                        success: false,
                        round: roundCount
                    };
                }
            })
        );

        // 处理工具调用结果
        const processedToolCalls = executedToolCalls.map(result => 
            result.status === 'fulfilled' ? result.value : {
                success: false,
                error: result.reason?.message || 'Unknown error',
                toolResponse: null,
                round: roundCount
            }
        );

        // 分离成功和失败的工具调用
        const successfulCalls = processedToolCalls.filter(call => call.success);
        const failedCalls = processedToolCalls.filter(call => !call.success);

        // 将工具调用结果添加到消息历史
        if (successfulCalls.length > 0 || failedCalls.length > 0) {
            // 添加助手的工具调用请求
            messages.push({
                role: "assistant",
                content: initialContent || null,
                tool_calls: processedToolCalls.map(({ toolCall, functionName, functionArgs }) => ({
                    id: toolCall.id,
                    type: "function",
                    function: {
                        name: functionName,
                        arguments: JSON.stringify(functionArgs),
                    }
                }))
            });

            // 添加工具调用结果
            successfulCalls.forEach(({ functionName, toolResponse }) => {
                messages.push({
                    role: "tool",
                    name: functionName,
                    content: JSON.stringify(toolResponse)
                });
            });

            // 添加失败的工具调用信息
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

            // 如果有失败的工具，给AI额外指导
            if (failedCalls.length > 0) {
                const failedToolNames = failedCalls.map(call => call.functionName).join(', ');
                messages.push({
                    role: "user",
                    content: `注意：工具 ${failedToolNames} 执行失败了。请基于可用的信息继续处理，如果需要可以尝试其他工具。`
                });
            }
        }

        return processedToolCalls;
    }

    /**
     * 🔥 新增：多轮工具调用后的最终回答生成
     */
    async getFinalResponseStreamMultiRound(messages, allExecutedToolCalls, onUpdate, totalRounds) {
        onUpdate({
            type: 'final_thinking_start',
            data: { totalRounds },
            phase: 'final_response'
        });

        const response = await this.callModel({
            model: "qwen-turbo",
            messages,
            stream: true
            // 注意：最终回答阶段不传入tools，确保AI专注于总结和回答
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

        console.log(`🔍 多轮工具调用最终回答 (${totalRounds} 轮):`, finalContent);
        console.log(`🔍 累计工具调用数量:`, allExecutedToolCalls.length);

        // 完成
        onUpdate({
            type: 'complete',
            data: { 
                finalContent: finalContent,
                toolCalls: allExecutedToolCalls.map(this.formatToolCallForFrontend),
                totalRounds: totalRounds
            },
            phase: 'complete'
        });
    }

    /**
     * 🔥 新增：格式化工具调用结果供前端显示
     */
    formatToolCallForFrontend = (toolCallData) => {
        const { functionName, functionArgs, toolResponse, executionTime, success, error, round } = toolCallData;
        return {
            name: functionName,
            arguments: functionArgs,
            result: success ? toolResponse : null,
            error: success ? null : error,
            success: success,
            executionTime: executionTime || 0,
            round: round || 1
        };
    }

    /**
     * 🔥 新增：支持历史消息的流式工具执行
     */
    async executeToolsStreamWithHistory(toolCalls, onUpdate, messages, initialContent, onMessagesUpdate) {
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
        await this.getFinalResponseStreamWithHistory(messages, processedToolCalls, onUpdate, onMessagesUpdate);
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
     * 🔥 新增：支持历史消息的最终回答流式方法
     */
    async getFinalResponseStreamWithHistory(messages, executedToolCalls, onUpdate, onMessagesUpdate) {
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

        // 添加AI的最终回复到消息历史
        messages.push({
            role: "assistant",
            content: finalContent
        });

        // 更新消息历史
        if (onMessagesUpdate) {
            onMessagesUpdate(messages);
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
     * 🔥 新增：基于历史消息的非流式处理方法
     */
    async processQueryWithHistory(messages) {
        // 克隆消息数组以避免修改原始数组
        const workingMessages = [...messages];
        
        const response = await this.callModel({
            model: "qwen-turbo",
            messages: workingMessages,
            tools: this.tools,
            parallel_tool_calls: true,
        });

        const finalText = [];
        const delta = response.choices[0]?.message;
        const { tool_calls, content } = delta || {};

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
            workingMessages.push({
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
                workingMessages.push({
                    role: "tool",
                    name: functionName,
                    content: JSON.stringify(toolResponse)
                });
            });
            
            // Get next response from llm
            const response = await this.callModel({
                model: "qwen-turbo",
                messages: workingMessages,
            });
            const finalResponse = response.choices[0]?.message?.content || "";
            finalText.push(finalResponse);
            
            // 添加AI的最终回复到消息历史
            workingMessages.push({
                role: "assistant",
                content: finalResponse
            });
        } else {
            // 没有工具调用，直接添加AI回复到消息历史
            workingMessages.push({
                role: "assistant",
                content: content
            });
        }
        
        const responseText = finalText.join("\n");
        
        // 返回结果和更新后的消息历史
        if (executedToolCalls.length > 0) {
            return {
                response: responseText,
                toolCalls: executedToolCalls.map(({ functionName, functionArgs, toolResponse, executionTime }) => ({
                    name: functionName,
                    arguments: functionArgs,
                    result: toolResponse,
                    executionTime
                })),
                messages: workingMessages
            };
        }
        
        return {
            response: responseText,
            toolCalls: [],
            messages: workingMessages
        };
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
