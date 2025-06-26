# MCP 团建活动规划服务器

这是一个基于 Model Context Protocol (MCP) 的团建活动规划服务器，集成高德地图官方MCP服务和自定义HTML报告生成功能。

## 🚀 功能特性

### 🌍 高德官方MCP服务集成
本项目直接集成[高德地图官方MCP Server](https://lbs.amap.com/api/mcp-server/summary)，无需自己实现API调用：

#### 📍 位置与搜索服务
- **地理编码** - 地址转坐标
- **逆地理编码** - 坐标转详细地址  
- **IP定位** - 获取IP所在位置
- **关键词搜索** - 搜索POI地点信息
- **周边搜索** - 半径范围内POI搜索
- **详情搜索** - 获取POI详细信息

#### 🚗 路径规划服务
- **步行路径规划** - 100km内步行方案
- **骑行路径规划** - 500km内骑行方案
- **驾车路径规划** - 小客车通勤方案
- **公交路径规划** - 综合公共交通方案
- **距离测量** - 两点间距离计算

#### 🌤️ 其他实用服务
- **天气查询** - 城市天气预报
- **生成专属地图** - 定制化地图
- **导航到目的地** - 导航功能

### 🔧 自定义MCP工具
- **create-html-report** - 生成精美的团建规划HTML报告

## 📋 服务架构

```
团建助手 → 高德官方MCP Server → 真实地图数据
         ↘ 自定义MCP工具 → HTML报告生成
```

## 🔑 接入配置

### 第一步：获取高德MCP服务
1. 访问 [高德MCP Server控制台](https://lbs.amap.com/api/mcp-server/summary)
2. 创建应用并获取相关配置
3. 按照官方文档进行接入配置

### 第二步：配置MCP客户端
在 `mcp-client` 中配置多个MCP服务器连接：

```javascript
// 连接高德官方MCP服务器
const amapMcpClient = new MCPClient();
await amapMcpClient.connectToServer('amap-mcp-server-config');

// 连接自定义MCP服务器（HTML报告生成）
const customMcpClient = new MCPClient();
await customMcpClient.connectToServer('./mcp-server/index.js');
```

### 第三步：智能工具调度
```javascript
// 位置和餐厅搜索 → 使用高德官方MCP
const location = await amapMcpClient.callTool('geo-coding', { address: '北京朝阳区' });
const restaurants = await amapMcpClient.callTool('nearby-search', { 
    keywords: '川菜餐厅',
    location: location.coordinates,
    radius: 3000
});

// HTML报告生成 → 使用自定义MCP
const report = await customMcpClient.callTool('create-html-report', {
    selectedPlan: planData
});
```

## 🌟 优势对比

### 🆚 自己实现 vs 官方MCP服务

| 方面 | 自己实现API | 高德官方MCP |
|------|-------------|-------------|
| **数据质量** | 需要处理API响应格式 | 官方优化的数据结构 |
| **维护成本** | 需要跟进API变更 | 官方维护，自动更新 |
| **功能丰富度** | 有限的API接口 | 完整的MCP工具集 |
| **错误处理** | 需要自己实现 | 官方标准化处理 |
| **开发效率** | 需要编写大量代码 | 开箱即用 |
| **稳定性** | 依赖自己的实现 | 官方服务保障 |

## 🎯 团建规划流程

### 智能对话示例
```
用户: "帮我规划一个团建活动，我们有8个人想吃川菜"

AI助手流程:
1. 调用高德MCP "ip-location" → 获取用户大概位置
2. 调用高德MCP "nearby-search" → 搜索周边川菜餐厅
3. AI分析并生成3个方案
4. 用户选择方案后
5. 调用自定义MCP "create-html-report" → 生成最终报告
```

### 工具调用链
```
IP定位 → 周边搜索 → AI方案生成 → HTML报告
 ↑                                    ↑
高德官方MCP                      自定义MCP
```

## 🚀 快速开始

### 环境准备
```bash
# 安装依赖
npm install @modelcontextprotocol/sdk

# 启动自定义MCP服务器（HTML报告生成）
cd mcp-server && npm start

# 启动Web服务器
cd mcp-web-server && npm start

# 启动前端
cd mcp-web-client && npm start
```

### 配置高德MCP服务
按照[高德MCP接入文档](https://lbs.amap.com/api/mcp-server/summary)进行配置

## 💡 最佳实践

### 1. 服务分工明确
- **高德官方MCP** - 负责所有地图相关功能
- **自定义MCP** - 负责业务逻辑（HTML报告等）

### 2. 智能降级策略
- 高德MCP服务不可用时，可切换到本地模拟数据
- 保证演示的连续性

### 3. 性能优化
- 利用高德MCP的缓存机制
- 合理使用周边搜索的半径参数

## 🔮 扩展可能

### 集成更多官方MCP服务
- **美团MCP** - 餐厅评价和订餐
- **滴滴MCP** - 打车和路线优化
- **微信MCP** - 社交分享功能

### 业务功能扩展
- **活动签到** - 基于地理围栏
- **费用分摊** - 集成支付工具
- **满意度调研** - 活动后反馈

## 📚 参考资料

- [高德MCP Server官方文档](https://lbs.amap.com/api/mcp-server/summary)
- [MCP协议规范](https://modelcontextprotocol.io/)
- [团建活动最佳实践指南](./docs/team-building-guide.md)

---

通过集成高德官方MCP服务，我们获得了企业级的地图服务能力，同时保持了自定义业务逻辑的灵活性。这种混合架构既保证了数据质量，又提供了独特的业务价值。 