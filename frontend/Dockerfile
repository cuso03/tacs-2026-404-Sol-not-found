# Usamos una imagen ligera de Node
FROM node:20-alpine

# Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos los archivos de dependencias primero (para aprovechar la caché de Docker)
COPY package.json ./

# Instalamos pnpm de forma global para no depender del resolvedor Arborist del proyecto.
RUN npm install --global pnpm@10.33.0
RUN pnpm install --no-frozen-lockfile

# Copiamos el resto del código
COPY . .

# Exponemos el puerto de Vite
EXPOSE 5173

# Comando para levantar la aplicación en modo desarrollo
CMD ["pnpm", "run", "dev"]
