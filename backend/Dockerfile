# Usamos una imagen ligera de Node.js v22
FROM node:22-alpine

# Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos los archivos de dependencias
COPY package*.json ./

# Instalamos las dependencias dentro del contenedor
RUN npm install

# Copiamos el resto del código del backend
COPY . .

# Exponemos el puerto 3000 donde corre Express
EXPOSE 3000

# Comando por defecto para iniciar la aplicación en modo desarrollo
CMD ["npm", "run", "dev"]