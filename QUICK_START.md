# 🚀 快速开始指南 - MCP团建规划系统

## 🎯 项目概览

本项目是基于 **Model Context Protocol (MCP)** 的团建活动规划系统，采用创新的**混合MCP架构**：

```
用户 → AI助手 → [高德官方MCP] → 真实地图数据
                ↘ [自定义MCP] → HTML报告生成
```

### 🌟 核心特性
- ✅ **高德官方MCP集成** - 真实位置和餐厅数据
- ✅ **自定义业务逻辑** - HTML报告生成
- ✅ **智能降级策略** - API不可用时自动使用知识库
- ✅ **多轮对话支持** - 完整的会话管理
- ✅ **现代化UI** - 响应式聊天界面

## 📋 系统要求

- **Node.js**: v18.20.7+ (推荐 v22.14.0+)
- **npm**: 最新版本
- **高德API Key**: [申请地址](https://lbs.amap.com/) (可选但推荐)

## 🔧 快速配置

### 第一步：安装依赖

```bash
# 安装根目录依赖
npm install

# 安装各模块依赖
cd mcp-client && npm install && cd ..
cd mcp-server && npm install && cd ..
cd mcp-web-client && npm install && cd ..
cd mcp-web-server && npm install && cd ..
```

### 第二步：配置高德API Key (可选)

1. **申请API Key** - 参考 [AMAP_SETUP.md](./AMAP_SETUP.md)
2. **配置环境变量**:
   ```bash
   # 编辑 .env 文件
   AMAP_MAPS_API_KEY=你的32位API_Key
   ```

### 第三步：启动系统

```bash
# 方式1：使用npm scripts（推荐）
npm run start:server   # 启动Web服务器
npm run start:client   # 启动前端界面

# 方式2：手动启动
cd mcp-web-server && npm start &
cd mcp-web-client && npm start
```

### 第四步：开始体验

访问 http://localhost:3000 开始对话！

## 💬 使用示例

### 团建规划对话

```
👤 "帮我规划一个团建活动，我们有10个人想吃川菜"

🤖 "好的！我来为您规划川菜团建活动。请问您希望在哪个城市的哪个区域呢？"

👤 "北京朝阳区"

🤖 "正在为您搜索北京朝阳区的川菜餐厅..."
   [调用 amap_poi_search 工具获取真实数据]
   
   "我为您找到了几家优质川菜餐厅：
   
   💰 经济实惠方案（80元/人）
   - 巴蜀风情川菜馆
   - 地址：建国门外大街
   - 预算：约800元
   
   💎 中等消费方案（150元/人）
   - 蜀香阁
   - 地址：东三环中路
   - 预算：约1500元
   
   您比较倾向于哪个方案呢？"

👤 "中等消费方案看起来不错"

🤖 "太好了！接下来为您生成精美的HTML团建规划报告"
   [调用 custom_create_html_report 工具]
   
   "✅ 团建规划报告已生成！包含详细的餐厅信息、交通指南和活动建议。"
```

## 🔧 系统架构

### MCP工具分类

#### 高德官方MCP工具 (前缀: `amap_`)
- `amap_poi_search` - POI搜索
- `amap_around_search` - 周边搜索  
- `amap_geocoding` - 地址转坐标
- `amap_reverse_geocoding` - 坐标转地址
- `amap_weather` - 天气查询

#### 自定义业务工具 (前缀: `custom_`)
- `custom_create_html_report` - 生成团建报告
- `custom_get_alerts` - 获取告警信息
- `custom_get_forecast` - 获取预报信息

### 智能路由机制

```javascript
// 系统自动根据工具前缀选择合适的MCP服务器
if (toolName.startsWith('amap_')) {
    // 使用高德官方MCP
    return amapMcpClient.callTool(originalName, args);
} else if (toolName.startsWith('custom_')) {
    // 使用自定义MCP
    return customMcpClient.callTool(originalName, args);
}
```

## 📊 系统监控

### 健康检查
```bash
curl http://localhost:3001/api/health
```

响应示例：
```json
{
  "success": true,
  "status": "healthy",
  "mcp": {
    "initialized": true,
    "amap": {
      "connected": true,
      "toolCount": 12
    },
    "custom": {
      "connected": true,
      "toolCount": 4
    },
    "totalTools": 16
  },
  "activeSessions": 2
}
```

### 工具列表查询
```bash
curl http://localhost:3001/api/tools
```

## 🧪 测试指南

### 连接测试
```bash
npm test  # 测试MCP连接状态
```

### 功能测试场景

#### 1️⃣ 智能推荐模式（无API Key）
- 系统使用内置知识库
- 可以完整演示对话流程
- 适合快速演示和开发

#### 2️⃣ 真实数据模式（有API Key）
- 调用高德真实API
- 获取最新的餐厅和位置信息
- 适合生产使用

#### 3️⃣ 多轮对话测试
- 开启多轮对话功能
- 测试会话历史管理
- 验证上下文理解能力

## 🔍 故障排查

### 常见问题

1. **高德MCP连接失败**
   ```bash
   # 检查API Key
   echo $AMAP_MAPS_API_KEY
   
   # 测试连接
   npx -y @amap/amap-maps-mcp-server
   ```

2. **自定义MCP连接失败**
   ```bash
   # 检查依赖
   cd mcp-server && npm list
   
   # 测试服务器
   node index.js
   ```

3. **前端连接问题**
   ```bash
   # 检查后端状态
   curl http://localhost:3001/api/health
   
   # 检查CORS设置
   curl -H "Origin: http://localhost:3000" http://localhost:3001/api/health
   ```

### 调试模式

```bash
# 启用详细日志
DEBUG=mcp:* npm run start:server

# 查看网络请求
DEBUG=mcp:transport npm run start:server
```

## 🚀 部署指南

### 开发环境
- 可以不配置API Key，使用智能推荐
- 启用详细日志便于调试

### 演示环境  
- 建议配置API Key获得最佳体验
- 保留降级策略确保稳定性
- 监控API调用量

### 生产环境
- 申请高配额API Key
- 配置缓存策略
- 设置监控告警
- 配置负载均衡

## 📚 相关文档

- [高德API Key申请指南](./AMAP_SETUP.md)
- [高德MCP集成详解](./INTEGRATION_GUIDE.md)  
- [项目架构说明](./mcp-server/README.md)
- [高德MCP官方文档](https://lbs.amap.com/api/mcp-server/summary)

---

🎉 **恭喜！您现在拥有了一个功能完整的团建规划AI助手！**

它不仅展示了MCP协议的强大能力，还解决了实际的团队活动规划需求。无论是技术演示还是实际使用，都能提供出色的体验。 