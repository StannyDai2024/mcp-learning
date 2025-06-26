# 高德官方MCP服务集成指南

## 🎯 架构概览

我们采用混合MCP架构，结合高德官方服务和自定义业务逻辑：

```
用户 → AI助手 → [高德官方MCP] → 真实地图数据
                ↘ [自定义MCP] → HTML报告生成
```

## 🔧 当前实现状态

### ✅ 已完成
- **自定义MCP服务器** - HTML报告生成功能
- **智能对话引导** - AI可以基于知识库推荐餐厅
- **多轮对话支持** - 完整的会话管理
- **美观的Web界面** - 现代化的聊天体验

### 🚧 待集成
- **高德官方MCP服务** - 真实位置和餐厅数据

## 📋 高德MCP服务接入步骤

### 第一步：获取高德MCP访问权限

1. 访问 [高德MCP Server控制台](https://lbs.amap.com/api/mcp-server/summary)
2. 注册账号并创建应用
3. 选择所需的MCP服务能力：
   - ✅ **IP定位** - 获取用户大概位置
   - ✅ **关键词搜索** - 搜索POI信息  
   - ✅ **周边搜索** - 半径内餐厅搜索
   - ✅ **详情搜索** - 获取餐厅详细信息
   - ⭐ **地理编码** - 地址转坐标
   - ⭐ **逆地理编码** - 坐标转地址

### 第二步：配置MCP客户端连接

修改 `mcp-client/index.js` 支持多MCP服务器：

```javascript
class MultiMCPClient {
    constructor() {
        this.amapMcp = null;      // 高德官方MCP
        this.customMcp = null;    // 自定义MCP
    }

    async initialize() {
        // 连接高德官方MCP服务器
        this.amapMcp = new MCPClient();
        await this.amapMcp.connectToServer({
            type: 'sse',  // 高德使用SSE协议
            url: 'AMAP_MCP_SERVER_URL',  // 从控制台获取
            apiKey: 'YOUR_AMAP_MCP_KEY'
        });

        // 连接自定义MCP服务器
        this.customMcp = new MCPClient();
        await this.customMcp.connectToServer('./mcp-server/index.js');
    }

    async processQuery(query) {
        // 智能路由：根据查询内容选择合适的MCP服务
        if (this.isLocationQuery(query)) {
            return await this.amapMcp.processQuery(query);
        } else if (this.isBusinessLogicQuery(query)) {
            return await this.customMcp.processQuery(query);
        } else {
            // 混合处理：需要多个服务协作
            return await this.processHybridQuery(query);
        }
    }

    async processHybridQuery(query) {
        // 示例：团建规划需要地图数据 + 业务逻辑
        // 1. 使用高德MCP获取位置和餐厅
        const location = await this.amapMcp.callTool('ip-location');
        const restaurants = await this.amapMcp.callTool('nearby-search', {
            keywords: '川菜餐厅',
            location: location.coordinates,
            radius: 3000
        });

        // 2. 使用自定义MCP生成报告
        const report = await this.customMcp.callTool('create-html-report', {
            restaurants,
            userPreferences: extractPreferences(query)
        });

        return { restaurants, report };
    }
}
```

### 第三步：修改Web服务器支持多MCP

```javascript
// mcp-web-server/index.js
const multiMcpClient = new MultiMCPClient();
await multiMcpClient.initialize();

// 在API处理中使用
app.post('/api/chat', async (req, res) => {
    const result = await multiMcpClient.processQuery(req.body.message);
    res.json({ success: true, response: result });
});
```

## 🧪 分阶段测试策略

### 阶段1：当前版本（智能推荐）
```bash
# 启动当前系统
cd mcp-web-server && npm start
cd mcp-web-client && npm start

# 测试对话
用户: "帮我规划一个团建活动，8个人想吃川菜"
AI: 基于内置知识库推荐餐厅 + 生成HTML报告
```

### 阶段2：高德MCP集成（真实数据）
```bash
# 配置高德MCP后测试
用户: "帮我规划一个团建活动，8个人想吃川菜"
AI: 调用高德MCP获取真实餐厅 + 生成HTML报告
```

## 🔍 调试和验证

### 验证高德MCP连接
```javascript
// 测试高德MCP工具
const tools = await amapMcp.listTools();
console.log('可用工具:', tools.map(t => t.name));

// 测试IP定位
const location = await amapMcp.callTool('ip-location');
console.log('当前位置:', location);

// 测试周边搜索
const pois = await amapMcp.callTool('nearby-search', {
    keywords: '餐厅',
    location: '116.397428,39.90923',
    radius: 1000
});
console.log('周边餐厅:', pois);
```

### 验证自定义MCP功能
```javascript
// 测试HTML报告生成
const report = await customMcp.callTool('create-html-report', {
    selectedPlan: mockPlanData
});
console.log('报告生成成功:', report.filePath);
```

## 📊 性能优化建议

### 1. 缓存策略
```javascript
// 缓存高德MCP响应
const locationCache = new Map();
const poisCache = new Map();

async function getCachedLocation(ip) {
    if (!locationCache.has(ip)) {
        const location = await amapMcp.callTool('ip-location', { ip });
        locationCache.set(ip, location);
    }
    return locationCache.get(ip);
}
```

### 2. 并行调用
```javascript
// 并行调用多个高德MCP工具
const [location, weather] = await Promise.all([
    amapMcp.callTool('ip-location'),
    amapMcp.callTool('weather-query', { city: 'beijing' })
]);
```

### 3. 错误降级
```javascript
try {
    // 尝试使用高德MCP
    const result = await amapMcp.callTool('nearby-search', params);
    return result;
} catch (error) {
    console.warn('高德MCP调用失败，使用本地推荐:', error);
    // 降级到智能推荐
    return getLocalRecommendations(params);
}
```

## 🚀 部署建议

### 开发环境
- 使用智能推荐模式进行功能开发
- 逐步集成高德MCP服务
- 完善错误处理和降级策略

### 演示环境
- 配置高德MCP获取真实数据
- 保留智能推荐作为备用方案
- 监控API调用量和响应时间

### 生产环境
- 完整的错误处理和监控
- 合理的缓存策略
- API限流和成本控制

## 📞 技术支持

遇到问题时的排查顺序：
1. 检查高德MCP服务状态和配置
2. 验证网络连接和API权限
3. 查看MCP客户端连接日志
4. 测试自定义MCP工具功能
5. 联系高德技术支持或查阅官方文档

---

通过这种混合架构，我们既能享受高德官方MCP服务的专业能力，又保持了自定义业务逻辑的灵活性。 