# 🚀 Vercel + Railway 部署指南

## 📋 部署前检查清单

- [ ] 项目代码已推送到 GitHub
- [ ] 准备好 OpenAI API Key
- [ ] 注册 Railway 账号
- [ ] 注册 Vercel 账号

## 🛤️ 第一步：Railway 部署后端

### 1. 准备 Railway 账号
1. 访问 [railway.app](https://railway.app)
2. 使用 GitHub 账号登录
3. 授权 Railway 访问你的仓库

### 2. 创建新项目
1. 点击 "New Project"
2. 选择 "Deploy from GitHub repo"
3. 选择你的 `mcp-learning` 仓库
4. 选择 "Add variables later"

### 3. 配置服务
1. Railway 会自动检测到多个服务
2. 选择部署 `mcp-web-server` 目录
3. 等待自动检测 Node.js 项目

### 4. 设置环境变量
在 Railway 项目设置中添加：
```
API_KEY=你的OpenAI API密钥
BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
NODE_ENV=production
CORS_ORIGIN=*
PORT=3001
```

### 5. 部署
1. 点击 "Deploy"
2. 等待构建完成
3. 复制生成的域名，格式类似：`your-app-name.railway.app`

## 🌐 第二步：Vercel 部署前端

### 1. 准备 Vercel 账号
1. 访问 [vercel.com](https://vercel.com)
2. 使用 GitHub 账号登录
3. 授权 Vercel 访问你的仓库

### 2. 创建新项目
1. 点击 "New Project"
2. 找到并导入你的 `mcp-learning` 仓库
3. 选择 Framework Preset: "Create React App"
4. Root Directory: `mcp-web-client`

### 3. 配置环境变量
在 Vercel 项目设置中添加：
```
REACT_APP_API_BASE=https://your-app-name.railway.app/api
```
（替换为上一步 Railway 生成的域名）

### 4. 部署设置
- Build Command: `npm run build`
- Output Directory: `build`
- Install Command: `npm install`

### 5. 部署
1. 点击 "Deploy"
2. 等待构建完成
3. 访问生成的域名，格式类似：`your-app.vercel.app`

## 🔧 第三步：后续配置优化

### 1. 更新 CORS 设置
回到 Railway，更新环境变量：
```
CORS_ORIGIN=https://your-app.vercel.app
```

### 2. 自定义域名（可选）
- **Vercel**: Project Settings > Domains
- **Railway**: Project Settings > Networking

### 3. 环境变量安全检查
确保敏感信息没有暴露在前端代码中

## 🎯 测试部署

### 1. 功能测试
- [ ] 前端页面正常加载
- [ ] 后端 API 连接正常
- [ ] 工具调用功能正常
- [ ] 错误处理正常

### 2. 性能测试
- [ ] 页面加载速度
- [ ] API 响应时间
- [ ] 工具执行速度

## ⚡ 常见问题解决

### CORS 错误
```
Access to fetch at 'https://api.railway.app' from origin 'https://app.vercel.app' has been blocked by CORS policy
```
**解决方案**：确保 Railway 的 `CORS_ORIGIN` 设置正确

### API 连接失败
```
Failed to fetch
```
**解决方案**：检查 Vercel 的 `REACT_APP_API_BASE` 环境变量

### 部署失败
**解决方案**：检查构建日志，通常是依赖问题或环境变量缺失

## 🔄 自动部署设置

### Git 集成
- Railway 和 Vercel 都支持 Git 自动部署
- 推送到 main 分支会自动触发部署
- 可以设置不同分支对应不同环境

### 分支策略
```
main → 生产环境 (Vercel + Railway)
dev  → 测试环境 (Preview deployments)
```

## 📊 监控和日志

### Railway 监控
- Project Dashboard 查看 API 调用统计
- Logs 查看服务器日志
- Metrics 查看资源使用情况

### Vercel 监控
- Analytics 查看页面访问统计
- Functions 查看边缘函数执行情况
- Performance 查看页面性能指标

---

## 🎉 部署完成！

访问你的应用：`https://your-app.vercel.app`

**下一步可以考虑：**
- 配置自定义域名
- 设置监控告警
- 优化性能
- 添加更多功能 