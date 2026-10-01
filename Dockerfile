# ---- Etapa 1: compilar el frontend ----
FROM node:22-alpine AS front
WORKDIR /app
RUN corepack enable
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

ARG VITE_API_URL=/api
ARG VITE_USER_ID=auth0|user-1
ARG VITE_USER_ROLE=admin
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_USER_ID=$VITE_USER_ID
ENV VITE_USER_ROLE=$VITE_USER_ROLE

COPY frontend/ .
RUN pnpm exec vite build
# ---- Etapa 2: imagen final (nginx + backend) ----
FROM node:22-alpine
RUN apk add --no-cache nginx redis && mkdir -p /run/nginx

# Backend
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend/ .

# Frontend compilado + config de nginx
COPY --from=front /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/http.d/default.conf
RUN sed -i 's#http://backend:3000#http://127.0.0.1:3000#; s#listen 80;#listen 10000;#' /etc/nginx/http.d/default.conf

ENV NODE_ENV=production
EXPOSE 10000
CMD ["sh", "-c", "export PORT=3000 && redis-server --daemonize yes --save '' --appendonly no --maxmemory 100mb --maxmemory-policy noeviction && nginx && exec npm start"]

