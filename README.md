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
| `WEATHER_PROVIDER` | Proveedor de clima (`OPENWEATHER` para OpenWeather; cualquier otro valor usa el mock) | No |
| `REDIS_URL` | URL de conexion a Redis (se sobreescribe en docker-compose) | Si |
| `USE_BULLMQ` | Habilitar/deshabilitar colas con BullMQ (`true`/`false`) | No |
| `AUTH0_DOMAIN` | Dominio del tenant Auth0 sin esquema (ej. `dev-abc123.us.auth0.com`) | Si |
| `AUTH0_AUDIENCE` | Identifier de la API creada en Auth0 (ej. `https://tacs-solnotfound/api`) | Si |
| `AUTH0_ROLES_CLAIM` | Claim de roles del JWT (default: `https://solnotfound.app/roles`) | No |
| `AUTH0_JWKS_URI` | Override de la URI del JWKS; solo para tests/proxies, no usar en produccion | No |

Para el build del frontend, `docker-compose.yml` inyecta además (definelas en un
archivo `.env` en la raiz, ver `.env.example`):

| Variable | Descripcion | Requerido |
|---|---|---|
| `VITE_AUTH0_DOMAIN` | Mismo valor que `AUTH0_DOMAIN` | Si |
| `VITE_AUTH0_CLIENT_ID` | Client ID de la aplicacion SPA en Auth0 | Si |
| `VITE_AUTH0_AUDIENCE` | Mismo valor que `AUTH0_AUDIENCE` | Si |

> Si falta alguna `VITE_AUTH0_*`, la SPA muestra una pantalla de configuracion en
> lugar de arrancar en blanco.

> **Nota:** En el `docker-compose.yml`, `RABBITMQ_URL` y `REDIS_URL` se configuran automaticamente apuntando a los servicios internos de Docker (`amqp://rabbitmq:5672` y `redis://redis:6379`). No es necesario definirlas en el `.env` para el despliegue con Docker, pero si las incluis seran ignoradas.

> **Notificaciones:** Por limitaciones de entorno de pruebas, las notificaciones se envían en modo broadcast a un canal/chat de configuración global. En una etapa futura, se cruzará el array de destinatarios con el UsuarioMongoRepository para obtener el chat_id individual de Telegram de cada participante.

### Autenticacion con Auth0

El login es exclusivamente de autenticacion: la identidad de cada request es el
claim `sub` del JWT. El rol admin viaja en el claim
`https://solnotfound.app/roles` (array con `"admin"`).

**1. Aplicacion SPA**

1. En el dashboard de Auth0: **Applications → Create Application**, tipo
   **Single Page Application**.
2. En *Settings*, copiar **Domain** y **Client ID**.
3. En *Settings → Application URIs*, agregar como **Allowed Callback URLs**,
   **Allowed Logout URLs** y **Allowed Web Origins**:
   `http://localhost:5173` (agregar las URLs de produccion cuando existan).

**2. API (audience)**

1. **APIs → Create API**: Name libre, **Identifier** `https://tacs-solnotfound/api`.
2. El Identifier es `AUTH0_AUDIENCE` (backend) y `VITE_AUTH0_AUDIENCE` (frontend);
   deben ser identicos. El issuer validado por el backend es `https://<DOMAIN>/`.

**3. Conexiones de usuario**

- **Authentication → Database**: habilitar `Username-Password-Authentication`
  (para pruebas, puede desactivarse *Require Email Verification*).
- **Authentication → Social → Google**: opcional, para login con cuenta Google.

**4. Claim de roles (admin)**

1. **Actions → Flows → Login → Build**. Agregar el siguiente snippet y darle
   **Deploy**:

   ```js
   exports.onExecutePostLogin = async (event, api) => {
     const roles = event.user.app_metadata?.roles ?? [];
     if (Array.isArray(roles) && roles.length > 0) {
       api.authorization.addClaim('https://solnotfound.app/roles', roles);
     }
   };
   ```

2. Para dar el rol admin a un usuario: **User Management → Users** → seleccionar
   el usuario → pestaña **Metadata** → en `app_metadata` agregar
   `{"roles": ["admin"]}`. Los cambios aplican en el proximo login.

**5. Verificacion**

1. Abrir la app, iniciar sesion y comprobar que el header muestra el nombre del
   usuario y que **Salir** cierra la sesion.
2. Con un usuario admin, `GET /api/admin/estadisticas` debe responder `200`;
   sin el rol debe responder `403`.

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
