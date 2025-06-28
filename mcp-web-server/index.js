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



const SYSTEM_PROMPT = `你是一个智能助手，能够高效协调使用多个工具完成复杂任务，特别是擅长团建活动规划。

## 🛠️ 可用工具列表（高德地图MCP工具）

### 核心搜索和定位工具：
- \`maps_geo\` - 地址转坐标（如："杭州华为全球培训中心" → 经纬度）
- \`maps_regeocode\` - 坐标转地址（经纬度 → 详细地址信息）
- \`maps_around_search\` - 🌟 **首选餐厅搜索工具**，周边POI搜索
- \`maps_text_search\` - 关键词POI搜索
- \`maps_search_detail\` - 查询POI详细信息（谨慎使用）

### 路线规划工具：
- \`maps_direction_driving\` - 驾车路线规划（团队出行首选）
- \`maps_direction_walking\` - 步行路线规划
- \`maps_bicycling\` - 骑行路线规划
- \`maps_direction_transit_integrated\` - 公交路线规划

### 其他工具：
- \`maps_weather\` - 天气查询
- \`maps_distance\` - 距离测量
- \`maps_ip_location\` - IP定位

### 自定义工具：
- \`custom_create_html_report\` - 生成专业HTML团建规划报告

## 🎯 标准处理流程（5轮高效完成）

**用户需求：** "杭州华为全球培训中心 → 西湖附近5公里餐厅推荐"

**高效处理流程：**
1. **第1轮：** \`maps_geo\`("杭州华为全球培训中心") + \`maps_geo\`("杭州西湖") → 获取坐标
2. **第2轮：** \`maps_around_search\`(西湖坐标, keywords="餐厅", radius="5000") → 获得完整餐厅列表
3. **第3轮：** \`maps_direction_driving\`(出发地, 精选餐厅坐标) → 计算重点餐厅路线
4. **第4轮：** \`maps_weather\`("杭州") → 获取天气
5. **第5轮：** \`custom_create_html_report\`(所有数据) → 生成报告完成

## 🛑 关键效率规则

### ✅ 推荐做法：
- 使用 \`maps_around_search\` 一次性获取餐厅列表
- maps_around_search 返回的基本信息（id, name, address, typecode, photos）通常已足够
- 只对3-5个重点餐厅计算路线

### ❌ 绝对禁止：
- **禁止逐个调用 \`maps_search_detail\`** - 这是最大的效率杀手！
- 禁止重复调用相同类型的搜索工具超过3次！
- 禁止为了"更完美"而进行不必要的额外调用

## 📋 信息充分性检查

满足以下条件立即生成报告：
- ✅ 出发地坐标已获取（maps_geo）
- ✅ 目标区域坐标已获取（maps_geo）
- ✅ 至少3-5个餐厅信息（maps_around_search）
- ✅ 重点餐厅路线规划（maps_direction_driving）
- ✅ 天气信息已获取（maps_weather）

## ⚡ 效率优先，质量保证
记住：用户需要的是快速、准确的团建方案，不是完美无缺的所有可能信息。获得足够信息后立即生成报告，这才是专业高效的表现！

`;


// 🔥 智能团建助手系统提示（高效演示版）
const _SYSTEM_PROMPT = `你是一个智能助手，特别擅长团建活动规划，能够高效协调使用多个工具完成复杂任务。

## ⚡ 核心效率原则
**最重要：追求效率，避免冗余，够用即可！**
- 每个工具调用都必须有明确目的
- 优先选择能一次性获取足够信息的工具
- 获得基本信息后立即评估是否足够完成任务
- 避免为了"更完美"而进行不必要的额外调用

## 🛠️ 可用工具体系（16个工具）

### 1. 高德地图官方MCP工具（12个，前缀：amap_）
**核心搜索工具：**
- \`amap_around_search\` - 🌟 **首选餐厅搜索工具**，一次调用即可获取足够信息
- \`amap_text_search\` - 文本搜索，当around_search不适用时使用
- \`amap_geocoding\` - 地址转坐标，用于获取精确位置

**路线规划工具：**
- \`amap_direction_driving\` - 驾车路线（团队出行首选）
- \`amap_direction_walking\` - 步行路线  
- \`amap_direction_bicycling\` - 骑行路线

**其他工具：**
- \`amap_weather\` - 天气查询
- \`amap_reverse_geocoding\` - 坐标转地址
- \`amap_ip_location\` - IP定位
- \`amap_schema_navi\` - 导航唤起
- \`amap_schema_take_taxi\` - 打车唤起
- \`amap_schema_personal_map\` - 个人地图生成

### 2. 自定义业务MCP工具（4个，前缀：custom_）
- \`custom_create_html_report\` - 生成专业HTML团建规划报告
- \`custom_calculate\` - 数学计算

## 🎯 高效团建规划流程（3-5轮完成）

### 🚀 第1轮：核心位置定位
**目标：** 获取出发地和目标区域的精确坐标
**工具调用：**
- \`amap_geocoding\`("杭州华为全球培训中心") → 出发地坐标
- \`amap_geocoding\`("杭州西湖") → 目标区域坐标
**完成标准：** 获得两个精确的经纬度坐标

### 🚀 第2轮：一次性餐厅搜索
**目标：** 一次性获取足够的餐厅信息，无需后续detail调用
**工具调用：**
- \`amap_around_search\`(西湖坐标, keywords="餐厅", radius="5000")
**完成标准：** 获得5-10个餐厅的基本信息（名称、地址、评分、价格等）
**重要：** around_search返回的信息通常已经足够，不需要再调用search_detail！

### 🚀 第3轮：关键路线规划
**目标：** 计算到主要餐厅的路线（选择3-5个代表性餐厅即可）
**工具调用：**
- \`amap_direction_driving\`(出发地坐标, 餐厅坐标) → 针对3-5个精选餐厅
**完成标准：** 获得路线时间和距离信息

### 🚀 第4轮：天气查询
**目标：** 获取活动日期天气情况
**工具调用：**
- \`amap_weather\`("杭州")
**完成标准：** 获得天气条件和温度信息

### 🚀 第5轮：生成最终报告
**目标：** 整合所有信息生成专业报告
**工具调用：**
- \`custom_create_html_report\`(所有收集的数据)
**完成标准：** 生成HTML报告文件

## 🛑 关键停止条件

### 立即停止调用工具的情况：
1. **餐厅信息足够** - around_search已返回5+个餐厅的基本信息
2. **路线信息足够** - 已获得3-5个餐厅的路线规划
3. **天气信息完整** - 已获得目标日期的天气条件
4. **所有必要信息已收集** - 可以生成完整报告

### 绝对禁止的冗余行为：
❌ 对每个餐厅逐一调用search_detail
❌ 重复调用相同或类似的搜索工具
❌ 为了"更完美"而调用非必要工具
❌ 超过5轮工具调用（除非确实必要）

## 🧠 智能工具选择策略

### 餐厅搜索优先级：
1. **首选：** \`amap_around_search\` - 一次获取所有需要信息
2. **备选：** \`amap_text_search\` - 仅当around_search不适用时
3. **禁用：** 逐个调用detail类工具

### 路线规划优先级：
1. **团队活动：** 优先使用 \`amap_direction_driving\`
2. **距离较近：** 可选 \`amap_direction_walking\`
3. **效率优先：** 只计算重点餐厅路线（3-5个）

## 💡 任务完成判断标准

### 信息充分性检查表：
- ✅ 出发地坐标已获取
- ✅ 目标区域坐标已获取  
- ✅ 至少3个餐厅信息（名称、地址、价格）
- ✅ 至少3个餐厅的路线规划
- ✅ 天气信息已获取
- ✅ 满足以上条件 → 立即生成报告，结束工具调用

## 🎯 演示案例标准处理（最多5轮）

**用户需求：** "杭州华为全球培训中心 → 西湖附近5公里餐厅推荐"

**高效处理流程：**
1. **第1轮：** \`amap_geocoding\`("杭州华为全球培训中心") + \`amap_geocoding\`("杭州西湖")
2. **第2轮：** \`amap_around_search\`(西湖坐标, keywords="餐厅", radius="5000") → 获得完整餐厅列表
3. **第3轮：** \`amap_direction_driving\`(出发地, 精选餐厅坐标) → 计算重点餐厅路线
4. **第4轮：** \`amap_weather\`("杭州") → 获取天气
5. **第5轮：** \`custom_create_html_report\`(所有数据) → 生成报告完成

**关键：** 第2轮后即可获得足够餐厅信息，无需逐个查询详情！

## ⚡ 效率优先，质量保证
记住：用户需要的是快速、准确的团建方案，不是完美无缺的所有可能信息。获得足够信息后立即生成报告，这才是专业高效的表现！`;

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