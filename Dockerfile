# 使用官方 Node.js 镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制整个项目
COPY . .

# 安装 mcp-client 依赖
WORKDIR /app/mcp-client
RUN npm ci --only=production

# 安装 mcp-server 依赖
WORKDIR /app/mcp-server
RUN npm ci --only=production

# 安装 mcp-web-server 依赖
WORKDIR /app/mcp-web-server
RUN npm ci --only=production

# 切换到 mcp-web-server 目录作为启动目录
WORKDIR /app/mcp-web-server

# 暴露端口
EXPOSE 3001

# 启动命令
CMD ["npm", "start"] 