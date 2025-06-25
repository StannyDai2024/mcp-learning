# 使用Node.js作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖（包括开发依赖，构建时需要）
RUN npm ci

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 使用nginx来提供静态文件
FROM nginx:alpine

# 复制构建结果到nginx目录
COPY --from=0 /app/build /usr/share/nginx/html

# 复制nginx配置（支持SPA路由）
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# 暴露80端口
EXPOSE 80

# 启动nginx
CMD ["nginx", "-g", "daemon off;"] 