# ---- Stage 1: Build ----
FROM node:22-alpine AS build

WORKDIR /app

# Copiamos los archivos de dependencias primero (para aprovechar la caché de Docker)
COPY package.json ./

RUN npm install 

# Build args → env vars para que Vite los inyecte en el bundle
ARG VITE_API_URL=/api
ARG VITE_USER_ID=auth0|user-1
ARG VITE_USER_ROLE=admin

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_USER_ID=$VITE_USER_ID
ENV VITE_USER_ROLE=$VITE_USER_ROLE

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
