# 404 Sol Not Found

## Despliegue con Docker en una misma maquina

### Prerrequisitos

- [Docker](https://docs.docker.com/get-docker/) v20.10+
- [Docker Compose](https://docs.docker.com/compose/install/) v2.0+

### Variables de entorno

Crea un archivo `backend/.env` basado en el ejemplo:

```bash
cp backend/.env.example backend/.env
```

| Variable | Descripcion | Requerido |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram (obtenido via @BotFather) | Si |
| `TELEGRAM_CHAT_ID` | ID del chat/grupo de Telegram | Si |
| `RABBITMQ_URL` | URL de conexion a RabbitMQ (se sobreescribe en docker-compose) | Si |
| `OPENWEATHER_API_KEY` | API key de OpenWeatherMap | Si |
| `REDIS_URL` | URL de conexion a Redis (se sobreescribe en docker-compose) | Si |
| `USE_BULLMQ` | Habilitar/deshabilitar colas con BullMQ (`true`/`false`) | No |

> **Nota:** En el `docker-compose.yml`, `RABBITMQ_URL` y `REDIS_URL` se configuran automaticamente apuntando a los servicios internos de Docker (`amqp://rabbitmq:5672` y `redis://redis:6379`). No es necesario definirlas en el `.env` para el despliegue con Docker, pero si las incluis seran ignoradas.

### Iniciar servicios

```bash
docker compose up -d
```

Esto levantara:

- **Backend** (`tacs-backend`): `http://localhost:3000`
- **API docs**: `http://localhost:3000/api-docs`
- **RabbitMQ**: `amqp://localhost:5672`
- **RabbitMQ Management UI**: `http://localhost:15672` (usuario: `guest`, password: `guest`)
- **Redis**: `redis://localhost:6379`

### Detener servicios

```bash
docker compose down
```

### Reconstruir despues de cambios en dependencias

```bash
docker compose up -d --build
```

### Ver logs

```bash
docker compose logs -f backend
docker compose logs -f rabbitmq
docker compose logs -f redis
```

### Desarrollo local (sin Docker)

```bash
# Instalar dependencias del backend
cd backend && npm install

# Copiar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# Iniciar en modo desarrollo
npm run dev
```

### Estructura del proyecto

```
.
├── backend/
│   ├── Dockerfile
│   ├── .env.example
│   └── ...
├── frontend/
│   ├── Dockerfile
│   └── ...
├── docker-compose.yml
└── README.md
```