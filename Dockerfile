# 多階段:① 安裝+建置前端 ② 精簡 runtime 跑 Node 服務(同時供前端 + /api 代理 Claude)
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
EXPOSE 8080
CMD ["node", "server/server.mjs"]
