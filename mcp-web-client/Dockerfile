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

# 创建nginx配置文件
RUN echo 'server { \
    listen $PORT; \
    server_name localhost; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
    error_page 500 502 503 504 /50x.html; \
    location = /50x.html { \
        root /usr/share/nginx/html; \
    } \
}' > /etc/nginx/conf.d/default.conf.template

# 创建启动脚本
RUN echo '#!/bin/sh\nenvsubst "\$PORT" < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf\nnginx -g "daemon off;"' > /start.sh && chmod +x /start.sh

# 设置默认端口
ENV PORT=80

# 暴露端口
EXPOSE $PORT

# 启动nginx
CMD ["/start.sh"] 