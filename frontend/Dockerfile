# ---- Stage 1: Build ----
FROM node:22-alpine AS build

WORKDIR /app

# Copiamos los archivos de dependencias
COPY package*.json ./

# Instalamos las dependencias dentro del contenedor
RUN npm ci

# Build args → env vars para que Vite los inyecte en el bundle
ARG VITE_API_URL=/api
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE
ARG VITE_OTEL_ENABLED=false
ARG VITE_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN
ENV VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID
ENV VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE
ENV VITE_OTEL_ENABLED=$VITE_OTEL_ENABLED
ENV VITE_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=$VITE_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT

# Copiamos el resto del código
COPY . .

# Construimos la aplicación para producción
RUN npm run build

# ---- Stage 2: Serve con nginx ----
FROM nginx:alpine

# Copiamos el build estático
COPY --from=build /app/dist /usr/share/nginx/html

# Config de nginx con proxy reverso al backend y soporte SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
