import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { MCPClient } from '../mcp-client/index.js';

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

// 全局单例 MCPClient（简化版，无需多用户支持）
let mcpClient = null;

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

// 初始化 MCP 连接
async function initMCP() {
    try {
        mcpClient = new MCPClient();
        const serverPath = path.join(__dirname, '../mcp-server/index.js');
        await mcpClient.connectToServer(serverPath);
        console.log('MCP Client initialized successfully');
    } catch (error) {
        console.error('Failed to initialize MCP Client:', error);
        process.exit(1);
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

        if (!mcpClient) {
            return res.status(500).json({ 
                success: false, 
                error: 'MCP Client not initialized' 
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
            
            // 使用会话历史调用MCP处理
            result = await mcpClient.processQueryWithMessages(session.messages);
            
            // 更新会话历史（包含AI回复）
            session.messages = result.messages;
            
            console.log(`💬 会话 ${sessionId} 消息数: ${session.messages.length}`);
        } else {
            // 🔥 单轮对话模式（原有逻辑）
            result = await mcpClient.processQueryWithToolInfo(message);
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

        if (!mcpClient) {
            return res.status(500).json({ 
                success: false, 
                error: 'MCP Client not initialized' 
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
                
                // 使用会话历史进行流式处理
                await mcpClient.processQueryStreamWithMessages(session.messages, onUpdate, (updatedMessages) => {
                    // 回调函数：更新会话历史
                    session.messages = updatedMessages;
                    console.log(`💬 流式会话 ${sessionId} 消息数: ${session.messages.length}`);
                });
                
            } else {
                // 🔥 单轮对话流式处理（原有逻辑）
                await mcpClient.processQueryStream(message, onUpdate);
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
            tools: mcpClient?.tools || []
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
    res.json({
        success: true,
        status: 'healthy',
        mcpConnected: !!mcpClient,
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
    if (mcpClient) {
        await mcpClient.cleanup();
    }
    process.exit(0);
}); 