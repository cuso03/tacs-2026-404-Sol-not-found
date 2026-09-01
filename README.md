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

### Ejecutar los tests

Los tests del backend utilizan Vitest. Desde la raíz del proyecto:

```bash
cd backend
npm test
```

El script `npm test` ejecuta internamente `vitest run`. También puede invocarse de forma directa con `npx vitest run`.

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

## Uso de inteligencia artificial

El setup de IA incluyó dos agentes de programación con acceso al repositorio y a la terminal: **Codex de OpenAI** y **OpenCode**. Estas herramientas cumplen la función de harness al conectar los modelos con el código y las herramientas de desarrollo. Codex se utilizó con el modelo **GPT-5.6 Sol** y OpenCode con **Xiaomi MiMo-V2.5**.

Además, se utilizó **Gemini desde su interfaz web** para obtener propuestas de código que luego fueron revisadas y adaptadas antes de incorporarlas al proyecto; no se registró el modelo específico empleado en esa interfaz.

Estas herramientas se emplearon para analizar requerimientos, explorar alternativas de diseño, asistir en la implementación y los tests, revisar código y redactar documentación.

Los prompts describen la tarea, sus criterios de aceptación y las restricciones técnicas. Por ejemplo: analizar una historia de usuario antes de implementarla, proponer una solución compatible con la arquitectura existente o revisar una funcionalidad junto con sus tests.

Las propuestas generadas se revisan y validan por el equipo.

### Decisiones de arquitectura

Las decisiones de arquitectura relevantes y su justificación se registran como ADR en [`docs/adr`](docs/adr/). Los ADR no forman parte del harness: conservan el contexto y el motivo de las decisiones tomadas por el equipo.
