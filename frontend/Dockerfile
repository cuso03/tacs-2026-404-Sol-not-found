# Usamos una imagen ligera de Node
FROM node:20-alpine

# Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos los archivos de dependencias primero (para aprovechar la caché de Docker)
COPY package.json package-lock.json* ./

# Instalamos las dependencias
RUN npm install --package-lock=false

# Copiamos el resto del código
COPY . .

# Exponemos el puerto de Vite
EXPOSE 5173

# Comando para levantar la aplicación en modo desarrollo
CMD ["npm", "run", "dev"]
