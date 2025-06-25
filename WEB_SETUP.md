# MCP Web Chat 启动指南

## 📁 项目结构

```
mcp-learning/
├── mcp-server/          # MCP 服务器 (工具提供方)
├── mcp-client/          # 原命令行客户端 (已修改为可导出)
├── mcp-web-server/      # Web API 服务器 (新增)
├── mcp-web-client/      # React 前端 (新增)
└── WEB_SETUP.md        # 本文档
```

## 🚀 快速启动

### 1. 检查环境配置

确保你的 `mcp-client/.env` 文件已配置：

```bash
# mcp-client/.env
API_KEY=your_openai_api_key
BASE_URL=your_api_base_url  # 例如: https://dashscope.aliyuncs.com/compatible-mode/v1
```

### 2. 启动后端 API 服务器

```bash
cd mcp-web-server
npm start
```

看到以下输出表示启动成功：
```
Server running on port 3001
Health check: http://localhost:3001/api/health
MCP Client initialized successfully
Connected to server with tools: calculate, get-forecast, get-alerts
```

### 3. 启动前端应用

新开一个终端：

```bash
cd mcp-web-client
npm start
```

浏览器会自动打开 `http://localhost:3000`

## 🎯 使用示例

启动后，你可以在 Web 界面中试试这些问题：

1. **计算功能**
   - "计算 15 + 27"
   - "100 除以 4 等于多少？"
   - "25 乘以 8"

2. **天气预报** (需要美国境内的经纬度)
   - "纽约的天气预报" (系统会提示需要经纬度)
   - "请告诉我经纬度 40.7128, -74.0060 的天气预报"

3. **天气警报**
   - "加利福尼亚州有什么天气警报吗？"
   - "纽约州的天气警报"

## 🔧 API 端点

后端提供以下 API：

- `GET /api/health` - 健康检查
- `GET /api/tools` - 获取可用工具列表  
- `POST /api/chat` - 发送聊天消息

## 🐛 故障排除

### 问题 1: 前端显示"未连接"

**解决方案：**
1. 确保后端服务器正在运行 (端口 3001)
2. 检查 `mcp-client/.env` 配置
3. 查看后端控制台是否有错误信息

### 问题 2: 工具调用失败

**解决方案：**
1. 检查 API 密钥是否正确配置
2. 确保网络连接正常 (天气 API 需要网络)
3. 查看浏览器控制台和后端日志

### 问题 3: 端口冲突

**解决方案：**
```bash
# 修改后端端口 (mcp-web-server/index.js)
const PORT = process.env.PORT || 3002;

# 修改前端 API 地址 (mcp-web-client/src/App.js)  
const API_BASE = 'http://localhost:3002/api';
```

## 📝 技术栈

- **后端**: Express.js + MCP SDK
- **前端**: React.js + Axios
- **通信**: REST API
- **样式**: 纯 CSS (响应式设计)

## 🎨 界面特性

- ✅ 实时连接状态显示
- ✅ 工具列表展示
- ✅ 消息气泡样式
- ✅ 加载状态指示
- ✅ 错误处理提示
- ✅ 响应式设计 (支持移动端)
- ✅ 欢迎消息和使用建议

## 🔄 回到命令行版本

如果需要使用原来的命令行版本：

```bash
cd mcp-client
node index.js ../mcp-server/index.js
```

## 🚀 下一步优化

可以考虑的改进方向：

1. **流式响应** - 实时显示 AI 思考过程
2. **会话历史** - 保存聊天记录
3. **工具可视化** - 展示工具调用详情
4. **主题切换** - 深色/浅色模式
5. **文件上传** - 支持文档分析

---

现在你可以享受 MCP 的 Web 版本了！🎉 