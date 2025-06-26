import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { MultiMCPClient } from '../mcp-client/multi-mcp-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS 配置 - 支持生产环境
const corsOptions = {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// 全局单例 MultiMCPClient（支持高德+自定义双MCP架构）
let multiMcpClient = null;

// 🔥 新增：会话管理
const sessions = new Map(); // sessionId -> messages[]
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30分钟超时

// 🔥 新增：清理过期会话
setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of sessions.entries()) {
        if (now - session.lastActivity > SESSION_TIMEOUT) {
            sessions.delete(sessionId);
            console.log(`🧹 清理过期会话: ${sessionId}`);
        }
    }
}, 5 * 60 * 1000); // 每5分钟清理一次

// 🔥 新增：获取或创建会话
function getOrCreateSession(sessionId) {
    if (!sessionId) return null;
    
    let session = sessions.get(sessionId);
    if (!session) {
        session = {
            messages: [],
            lastActivity: Date.now(),
            createdAt: Date.now()
        };
        sessions.set(sessionId, session);
        console.log(`🆔 创建新会话: ${sessionId}`);
    } else {
        session.lastActivity = Date.now();
    }
    
    return session;
}

// 初始化多MCP连接（高德官方MCP + 自定义MCP）
async function initMCP() {
    try {
        console.log('🚀 初始化多MCP架构...');
        multiMcpClient = new MultiMCPClient();
        await multiMcpClient.initialize();
        
        const status = multiMcpClient.getStatus();
        console.log('✅ 多MCP客户端初始化成功');
        console.log(`📊 状态摘要:`);
        console.log(`  - 高德MCP: ${status.amap.connected ? '✅' : '❌'} (${status.amap.toolCount} 工具)`);
        console.log(`  - 自定义MCP: ${status.custom.connected ? '✅' : '❌'} (${status.custom.toolCount} 工具)`);
        console.log(`  - 总工具数: ${status.totalTools}`);
        
    } catch (error) {
        console.error('❌ 多MCP客户端初始化失败:', error);
        // 不直接退出，允许降级到智能推荐模式
        console.warn('⚠️ 将使用智能推荐模式运行');
    }
}

// 🔥 智能团建助手系统提示（混合MCP架构）
const SYSTEM_PROMPT = `你是一个智能助手，特别擅长团建活动规划，同时也能回答各种其他问题。

## 🌟 重要说明
你现在可以使用两套MCP工具：
1. **高德地图官方MCP工具** - 用于位置和地图相关功能（工具名前缀：amap_）
   - amap_geocoding - 地址转坐标
   - amap_reverse_geocoding - 坐标转地址
   - amap_poi_search - POI搜索
   - amap_around_search - 周边搜索
   - amap_weather - 天气查询
   等等
2. **自定义业务MCP工具** - 用于业务逻辑（工具名前缀：custom_）
   - custom_create_html_report - 生成HTML报告

## 🎯 团建活动规划专长
当用户需要团建、聚餐、团队活动等相关帮助时，你的专业流程是：

### 信息收集（自然对话方式）
1. **参与人数** - 了解聚餐规模
2. **位置信息** - 
   - 如果用户没有明确位置，可以询问或建议常见商务区
   - 暂时通过描述性方式处理位置（如"北京朝阳区"、"上海浦东新区"等）
3. **菜系偏好** - 川菜、粤菜、日料、火锅、西餐、韩餐等
4. **预算范围** - 经济实惠（50-100元）、中等消费（100-200元）、高端消费（200元以上）
5. **时间安排** - 可选信息

### 工具使用策略
**优先使用高德官方MCP工具获取真实数据：**
- **amap_poi_search** - 搜索餐厅POI信息
- **amap_around_search** - 搜索周边餐厅
- **amap_geocoding** - 地址转坐标（如果用户提供地址）
- **amap_reverse_geocoding** - 坐标转地址（获取详细位置信息）
- **amap_weather** - 查询天气信息（为活动提供参考）

**降级策略：** 如果高德工具不可用，则使用智能推荐：
- 基于内置知识库推荐该区域知名餐厅
- 提供餐厅的详细信息（地址、特色菜、人均消费等）

**最终报告生成：**
- **custom_create_html_report** - 用户选定方案后生成HTML报告

### 方案生成原则
基于用户需求和区域特点，智能生成3个不同档次的方案：
- **经济实惠方案** - 性价比优先（50-100元/人）
- **中等消费方案** - 平衡价格和品质（100-200元/人）
- **高端奢华方案** - 更好的体验和服务（200元以上/人）

### 餐厅推荐示例知识库
**北京朝阳区川菜：**
- 经济：巴蜀风情川菜馆（建国门外大街，人均80元）
- 中等：蜀香阁（东三环中路，人均150元）
- 高端：川办餐厅（国贸，人均280元）

**上海浦东新区粤菜：**
- 经济：港式茶餐厅（陆家嘴，人均90元）
- 中等：翠华轩（世纪大道，人均180元）
- 高端：粤菜世家（金茂大厦，人均320元）

## 💡 对话风格
- 自然友好，不机械化询问
- 根据用户提供的信息灵活调整
- 主动给出专业建议和具体餐厅推荐
- 既专业又贴近生活
- 当生成最终方案时，说明"接下来为您生成精美的HTML团建规划报告"，然后调用create-html-report工具
- 对于非团建问题，同样热情专业地回答

## ✅ 已集成功能
高德官方MCP服务已完全集成，现在可以：
- ✅ 实时获取真实位置信息（通过geocoding/reverse_geocoding）
- ✅ 搜索真实的周边餐厅数据（通过poi_search/around_search）
- ✅ 获取实时天气信息（通过weather查询）
- ✅ 地址与坐标互转（支持精确定位）

## 🔮 未来可扩展功能
- 路线规划和导航
- 实时营业状态查询
- 餐厅评分和点评信息
- 周边交通和停车信息`;

// 构建带系统提示的消息数组
function buildMessagesWithSystemPrompt(messages) {
    const systemMessage = {
        role: "system",
        content: SYSTEM_PROMPT
    };
    
    // 检查是否已经有系统消息
    const hasSystemMessage = messages.length > 0 && messages[0].role === "system";
    
    if (hasSystemMessage) {
        // 更新现有的系统消息
        return [systemMessage, ...messages.slice(1)];
    } else {
        // 添加新的系统消息
        return [systemMessage, ...messages];
    }
}

// 核心 API：处理用户查询
app.post('/api/chat', async (req, res) => {
    try {
        const { message, multiChatEnabled = false, sessionId } = req.body;
        
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ 
                success: false, 
                error: 'Message is required and must be a string' 
            });
        }

        if (!multiMcpClient) {
            return res.status(500).json({ 
                success: false, 
                error: 'MultiMCP Client not initialized' 
            });
        }
        
        console.log(`Processing query: ${message} (MultiChat: ${multiChatEnabled}, Session: ${sessionId})`);
        
        let result;
        
        if (multiChatEnabled && sessionId) {
            // 🔥 多轮对话模式
            const session = getOrCreateSession(sessionId);
            
            // 添加用户消息到会话历史
            session.messages.push({
                role: "user",
                content: message
            });
            
            // 应用系统提示
            const processMessages = buildMessagesWithSystemPrompt(session.messages);
            
            // 使用会话历史调用MCP处理
            result = await multiMcpClient.processQueryWithMessages(processMessages);
            
            // 更新会话历史（过滤掉系统消息）
            session.messages = result.messages.filter(msg => msg.role !== "system");
            
            console.log(`💬 会话 ${sessionId} 消息数: ${session.messages.length}`);
        } else {
            // 🔥 单轮对话模式
            result = await multiMcpClient.processQueryWithToolInfo(message);
        }
        
        res.json({ 
            success: true, 
            response: result.response,
            toolCalls: result.toolCalls || [],
            sessionInfo: multiChatEnabled && sessionId ? {
                sessionId,
                messageCount: sessions.get(sessionId)?.messages.length || 0
            } : null
        });
    } catch (error) {
        console.error('Error processing query:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 流式聊天接口 (Server-Sent Events)
app.get('/api/chat-stream', async (req, res) => {
    try {
        const { message, multiChatEnabled, sessionId } = req.query;
        
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ 
                success: false, 
                error: 'Message is required and must be a string' 
            });
        }

        if (!multiMcpClient) {
            return res.status(500).json({ 
                success: false, 
                error: 'MultiMCP Client not initialized' 
            });
        }

        // 设置SSE响应头
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': corsOptions.origin,
            'Access-Control-Allow-Credentials': 'true'
        });

        const isMultiChat = multiChatEnabled === 'true';
        console.log(`Processing stream query: ${message} (MultiChat: ${isMultiChat}, Session: ${sessionId})`);

        // 流式更新回调函数
        const onUpdate = (data) => {
            try {
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            } catch (error) {
                console.error('Error writing SSE data:', error);
            }
        };

        // 客户端断开检测
        req.on('close', () => {
            console.log('Client disconnected from stream');
        });

        try {
            if (isMultiChat && sessionId) {
                // 🔥 多轮对话流式处理
                const session = getOrCreateSession(sessionId);
                
                // 添加用户消息到会话历史
                session.messages.push({
                    role: "user",
                    content: message
                });
                
                // 应用系统提示
                const processMessages = buildMessagesWithSystemPrompt(session.messages);
                
                // 使用会话历史进行流式处理
                await multiMcpClient.processQueryStreamWithMessages(processMessages, onUpdate, (updatedMessages) => {
                    // 回调函数：更新会话历史（过滤掉系统消息）
                    session.messages = updatedMessages.filter(msg => msg.role !== "system");
                    console.log(`💬 流式会话 ${sessionId} 消息数: ${session.messages.length}`);
                });
                
            } else {
                // 🔥 单轮对话流式处理
                await multiMcpClient.processQueryStream(message, onUpdate);
            }
        } catch (error) {
            console.error('Stream processing error:', error);
            onUpdate({
                type: 'error',
                data: { error: error.message },
                phase: 'error'
            });
        } finally {
            res.end();
        }

    } catch (error) {
        console.error('Stream setup error:', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }
});

// 🔥 新增：会话管理API
app.get('/api/sessions/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = sessions.get(sessionId);
        
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }
        
        res.json({
            success: true,
            session: {
                sessionId,
                messageCount: session.messages.length,
                createdAt: session.createdAt,
                lastActivity: session.lastActivity
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 🔥 新增：删除会话API
app.delete('/api/sessions/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        const deleted = sessions.delete(sessionId);
        
        res.json({
            success: true,
            deleted,
            message: deleted ? 'Session deleted successfully' : 'Session not found'
        });
        
        if (deleted) {
            console.log(`🗑️ 手动删除会话: ${sessionId}`);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取可用工具列表
app.get('/api/tools', (req, res) => {
    try {
        res.json({
            success: true,
            tools: multiMcpClient?.tools || [],
            status: multiMcpClient?.getStatus() || null
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 健康检查
app.get('/api/health', (req, res) => {
    const mcpStatus = multiMcpClient?.getStatus();
    res.json({
        success: true,
        status: 'healthy',
        mcp: mcpStatus || { initialized: false },
        activeSessions: sessions.size
    });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    await initMCP();
});

// 优雅关闭
process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    console.log(`清理 ${sessions.size} 个活跃会话...`);
    sessions.clear();
    if (multiMcpClient) {
        await multiMcpClient.cleanup();
    }
    process.exit(0);
}); 