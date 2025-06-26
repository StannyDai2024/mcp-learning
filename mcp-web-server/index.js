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
        const { message } = req.body;
        
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
        
        console.log(`Processing query: ${message}`);
        
        // 调用 processQueryWithToolInfo 获取工具调用信息
        const result = await mcpClient.processQueryWithToolInfo(message);
        
        res.json({ 
            success: true, 
            response: result.response,
            toolCalls: result.toolCalls || []
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
        const { message } = req.query;
        
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

        console.log(`Processing stream query: ${message}`);

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
            // 开始流式处理
            await mcpClient.processQueryStream(message, onUpdate);
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
        mcpConnected: !!mcpClient
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
    if (mcpClient) {
        await mcpClient.cleanup();
    }
    process.exit(0);
}); 