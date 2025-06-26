import { MCPClient } from './index.js';
import { spawn } from 'child_process';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import dotenv from 'dotenv';

dotenv.config();

/**
 * 多MCP客户端管理器
 * 支持同时连接高德官方MCP服务器和自定义MCP服务器
 */
export class MultiMCPClient {
    constructor() {
        this.amapMcp = null;        // 高德官方MCP客户端
        this.customMcp = null;      // 自定义MCP客户端
        this.allTools = [];         // 合并的工具列表
        this.isInitialized = false;
    }

    /**
     * 初始化所有MCP连接
     */
    async initialize() {
        try {
            console.log('🚀 初始化多MCP客户端管理器...');
            
            // 并行初始化两个MCP客户端
            await Promise.all([
                this.initializeAmapMcp(),
                this.initializeCustomMcp()
            ]);

            // 合并工具列表
            this.mergeTools();
            
            this.isInitialized = true;
            console.log('✅ 多MCP客户端初始化完成');
            console.log(`📊 可用工具总数: ${this.allTools.length}`);
            
        } catch (error) {
            console.error('❌ 多MCP客户端初始化失败:', error);
            throw error;
        }
    }

    /**
     * 初始化高德MCP客户端
     */
    async initializeAmapMcp() {
        try {
            console.log('🗺️ 正在连接高德官方MCP服务器...');
            
            // 检查API Key
            const apiKey = process.env.AMAP_MAPS_API_KEY || 'e7b3928a2e218b5acea635d76560d3fe';
            if (!apiKey || apiKey === '请在https://lbs.amap.com申请API_Key并替换此处') {
                console.warn('⚠️ 高德API Key未配置，将跳过高德MCP连接');
                return;
            }

            // 使用标准MCP客户端连接高德服务器
            this.amapMcp = new Client({ 
                name: "amap-mcp-client", 
                version: "1.0.0" 
            });

            // 创建到高德MCP服务器的传输连接
            const transport = new StdioClientTransport({
                command: 'npx',
                args: ['-y', '@amap/amap-maps-mcp-server'],
                env: {
                    ...process.env,
                    AMAP_MAPS_API_KEY: apiKey
                }
            });

            await this.amapMcp.connect(transport);
            
            // 获取高德MCP工具列表
            const amapToolsResult = await this.amapMcp.listTools();
            this.amapTools = amapToolsResult.tools.map((tool) => ({
                type: "function",
                function: {
                    name: `amap_${tool.name}`,  // 添加前缀避免冲突
                    description: `[高德地图] ${tool.description}`,
                    parameters: tool.inputSchema,
                },
                source: 'amap',
                originalName: tool.name
            }));

            console.log(`✅ 高德MCP连接成功，工具数量: ${this.amapTools.length}`);
            console.log('🔧 高德工具:', this.amapTools.map(t => t.function.name));

        } catch (error) {
            console.error('❌ 高德MCP连接失败:', error);
            this.amapMcp = null;
            this.amapTools = [];
        }
    }

    /**
     * 初始化自定义MCP客户端
     */
    async initializeCustomMcp() {
        try {
            console.log('🔧 正在连接自定义MCP服务器...');
            
            this.customMcp = new MCPClient();
            const serverPath = new URL('../mcp-server/index.js', import.meta.url).pathname;
            await this.customMcp.connectToServer(serverPath);
            
            // 获取自定义工具列表（添加前缀）
            this.customTools = this.customMcp.tools.map(tool => ({
                ...tool,
                function: {
                    ...tool.function,
                    name: `custom_${tool.function.name}`,  // 添加前缀
                    description: `[自定义] ${tool.function.description}`
                },
                source: 'custom',
                originalName: tool.function.name
            }));

            console.log(`✅ 自定义MCP连接成功，工具数量: ${this.customTools.length}`);
            console.log('🔧 自定义工具:', this.customTools.map(t => t.function.name));

        } catch (error) {
            console.error('❌ 自定义MCP连接失败:', error);
            this.customMcp = null;
            this.customTools = [];
        }
    }

    /**
     * 合并所有工具列表
     */
    mergeTools() {
        this.allTools = [
            ...(this.amapTools || []),
            ...(this.customTools || [])
        ];

        console.log('📋 工具列表合并完成:');
        this.allTools.forEach(tool => {
            console.log(`  - ${tool.function.name} (${tool.source})`);
        });
    }

    /**
     * 智能路由：根据工具名称选择合适的MCP客户端
     */
    getMcpClientForTool(toolName) {
        if (toolName.startsWith('amap_')) {
            return {
                client: this.amapMcp,
                originalName: toolName.replace('amap_', ''),
                source: 'amap'
            };
        } else if (toolName.startsWith('custom_')) {
            return {
                client: this.customMcp,
                originalName: toolName.replace('custom_', ''),
                source: 'custom'
            };
        } else {
            // 兼容旧的工具名称（默认为自定义）
            return {
                client: this.customMcp,
                originalName: toolName,
                source: 'custom'
            };
        }
    }

    /**
     * 调用工具（智能路由）
     */
    async callTool(toolName, arguments_, originalCallTool = null) {
        const { client, originalName, source } = this.getMcpClientForTool(toolName);
        
        if (!client) {
            throw new Error(`MCP客户端不可用: ${source}`);
        }

        console.log(`🔧 调用${source}工具: ${originalName}`);

        if (source === 'custom') {
            // 🔥 修复：使用传入的原始callTool方法，避免递归调用
            if (originalCallTool) {
                return await originalCallTool({
                    name: originalName,
                    arguments: arguments_
                });
            } else {
                // 如果没有传入原始方法，直接使用客户端方法（这种情况应该很少发生）
                return await client.mcp.callTool({
                    name: originalName,
                    arguments: arguments_
                });
            }
        } else {
            // 高德MCP直接使用Client的方法
            return await client.callTool({
                name: originalName,
                arguments: arguments_
            });
        }
    }

    /**
     * 处理查询（兼容原有接口）
     */
    async processQueryWithToolInfo(query) {
        if (!this.isInitialized) {
            throw new Error('MultiMCPClient未初始化，请先调用initialize()');
        }

        // 使用自定义MCP的处理逻辑，但工具列表使用合并后的
        const originalTools = this.customMcp.tools;
        this.customMcp.tools = this.allTools;

        try {
            // 🔥 修复：保存原始方法并传递给callTool避免递归
            const originalCallTool = this.customMcp.mcp.callTool.bind(this.customMcp.mcp);
            this.customMcp.mcp.callTool = async (request) => {
                return await this.callTool(request.name, request.arguments, originalCallTool);
            };

            const result = await this.customMcp.processQueryWithToolInfo(query);
            
            // 恢复原始方法
            this.customMcp.mcp.callTool = originalCallTool;
            this.customMcp.tools = originalTools;
            
            return result;
        } catch (error) {
            // 发生错误时也要恢复
            this.customMcp.tools = originalTools;
            throw error;
        }
    }

    /**
     * 处理带历史消息的查询（兼容原有接口）
     */
    async processQueryWithMessages(messages) {
        if (!this.isInitialized) {
            throw new Error('MultiMCPClient未初始化，请先调用initialize()');
        }

        const originalTools = this.customMcp.tools;
        this.customMcp.tools = this.allTools;

        try {
            const originalCallTool = this.customMcp.mcp.callTool.bind(this.customMcp.mcp);
            this.customMcp.mcp.callTool = async (request) => {
                return await this.callTool(request.name, request.arguments, originalCallTool);
            };

            const result = await this.customMcp.processQueryWithMessages(messages);
            
            this.customMcp.mcp.callTool = originalCallTool;
            this.customMcp.tools = originalTools;
            
            return result;
        } catch (error) {
            this.customMcp.tools = originalTools;
            throw error;
        }
    }

    /**
     * 流式处理查询（兼容原有接口）
     */
    async processQueryStream(query, onUpdate) {
        if (!this.isInitialized) {
            throw new Error('MultiMCPClient未初始化，请先调用initialize()');
        }

        const originalTools = this.customMcp.tools;
        this.customMcp.tools = this.allTools;

        try {
            const originalCallTool = this.customMcp.mcp.callTool.bind(this.customMcp.mcp);
            this.customMcp.mcp.callTool = async (request) => {
                return await this.callTool(request.name, request.arguments, originalCallTool);
            };

            await this.customMcp.processQueryStream(query, onUpdate);
            
            this.customMcp.mcp.callTool = originalCallTool;
            this.customMcp.tools = originalTools;
            
        } catch (error) {
            this.customMcp.tools = originalTools;
            throw error;
        }
    }

    /**
     * 流式处理带历史消息的查询（兼容原有接口）
     */
    async processQueryStreamWithMessages(messages, onUpdate, onMessagesUpdate) {
        if (!this.isInitialized) {
            throw new Error('MultiMCPClient未初始化，请先调用initialize()');
        }

        const originalTools = this.customMcp.tools;
        this.customMcp.tools = this.allTools;

        try {
            const originalCallTool = this.customMcp.mcp.callTool.bind(this.customMcp.mcp);
            this.customMcp.mcp.callTool = async (request) => {
                return await this.callTool(request.name, request.arguments, originalCallTool);
            };

            await this.customMcp.processQueryStreamWithMessages(messages, onUpdate, onMessagesUpdate);
            
            this.customMcp.mcp.callTool = originalCallTool;
            this.customMcp.tools = originalTools;
            
        } catch (error) {
            this.customMcp.tools = originalTools;
            throw error;
        }
    }

    /**
     * 获取所有可用工具
     */
    get tools() {
        return this.allTools;
    }

    /**
     * 获取连接状态
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            amap: {
                connected: !!this.amapMcp,
                toolCount: this.amapTools?.length || 0
            },
            custom: {
                connected: !!this.customMcp,
                toolCount: this.customTools?.length || 0
            },
            totalTools: this.allTools.length
        };
    }

    /**
     * 清理资源
     */
    async cleanup() {
        try {
            if (this.customMcp) {
                await this.customMcp.cleanup();
            }
            if (this.amapMcp) {
                // 高德MCP客户端的清理
                // （根据高德SDK文档，可能需要特定的清理方法）
            }
            console.log('🧹 MultiMCPClient清理完成');
        } catch (error) {
            console.error('❌ MultiMCPClient清理失败:', error);
        }
    }
} 