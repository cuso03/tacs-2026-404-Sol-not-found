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
| `REDIS_URL` | URL de conexion a Redis (se sobreescribe en docker-compose) | Si |
| `USE_BULLMQ` | Habilitar/deshabilitar colas con BullMQ (`true`/`false`) | No |
| `AUTH0_DOMAIN` | Dominio del tenant Auth0 sin esquema (ej. `dev-abc123.us.auth0.com`) | Si |
| `AUTH0_AUDIENCE` | Identifier de la API creada en Auth0 (ej. `https://tacs-solnotfound/api`) | Si |
| `AUTH0_ROLES_CLAIM` | Claim de roles del JWT (default: `https://solnotfound.app/roles`) | No |
| `AUTH0_JWKS_URI` | Override de la URI del JWKS; solo para tests/proxies, no usar en produccion | No |
| `LEGACY_WEATHER_URL` | URL del servicio legacy (default en docker: `http://legacy-weather:8080`) | No |
| `LEGACY_WEATHER_TOKEN` | Token OIDC para autenticar requests hacia el servicio legacy | No |

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

- **Frontend** (`tacs-frontend`): `http://localhost:5173`
- **Backend** (`tacs-backend`): `http://localhost:3000`
- **Servicio Legacy Weather** (`tacs-legacy-weather`): `http://legacy-weather:8080` (aislado en red docker)
- **API docs**: `http://localhost:3000/api-docs`
- **RabbitMQ**: `amqp://localhost:5672`
- **RabbitMQ Management UI**: `http://localhost:15672` (usuario: `guest`, password: `guest`)
- **Redis**: `redis://localhost:6379`
- **MongoDB**: `localhost:27018`

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
docker compose logs -f legacy-weather
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
# Tests unitarios e integración del backend
npm --prefix backend test

# Tests de resiliencia con stubs
npm --prefix backend test tests/resilience/

# Tests de carga (load test) con escenarios de servicio activo y servicio caído
npm --prefix backend run test:load

# Tests de la SPA frontend
npm --prefix frontend test
```

---

## Entrega 4: Proveedor de Clima Legacy

La documentación detallada de la Entrega 4, análisis de ingeniería inversa del binario, ADRs y diagramas de despliegue se encuentra en [`docs/ENTREGA_04.md`](docs/ENTREGA_04.md).

### Resumen de Características de la Entrega 4:
1. **Containerización del Binario Legacy:** Imagen Docker en `legacy-weather/Dockerfile` corriendo el binario estático `tacs-linux-amd64` con healthcheck en `/healthz` y reinicio automático (`restart: unless-stopped`). Aislado de acceso público.
2. **Capa de Resiliencia Multicapa:**
   - **Timeouts:** 3.000 ms con `AbortController`.
   - **Retries con Jitter:** 2 reintentos con backoff exponencial.
   - **Circuit Breaker:** Máquina de estados (CLOSED / OPEN / HALF_OPEN) que aísla fallos en cascada ante el caos embebido (`rollDice`).
   - **Caché en Memoria:** TTL de 10 minutos acotado por hora y ubicación.
   - **Rate Limiting:** Token Bucket upstream de 10 req/s y por usuario.
   - **Validación Estricta:** Validación con Zod para rangos físicos válidos.
   - **Fallback Transparente:** Si el legacy falla o se abre el circuito, conmuta automáticamente a Visual Crossing manteniendo la disponibilidad al 100%.
3. **Selección por Usuario:** Selector de proveedor en el frontend persistido en MongoDB (`/api/usuarios/me/preferencias`).
4. **Telemetría para el Administrador:** Sección dedicada en el panel `/admin` que visualiza en tiempo real el estado del proveedor legacy, estado del Circuit Breaker, porcentaje de aciertos de caché y contadores de error/fallback.
5. **Cuentas Institucionales:** `alumno.tacs@frba.utn.edu.ar` / `docente.tacs@frba.utn.edu.ar`.

---

## Uso de inteligencia artificial

El setup de IA incluyó agentes de asistencia de código para el análisis de los requerimientos, ingeniería inversa del binario, propuestas de diseño y redacción de tests y documentación técnica.

### Decisiones de arquitectura

Las decisiones de arquitectura relevantes y su justificación se registran como ADR en [`docs/adr`](docs/adr/):
- [ADR 0001: Gestión de participantes en memoria](docs/adr/0001-gestion-de-participantes-en-memoria.md)
- [ADR 0002: Quórum, empate y estado reprogramada](docs/adr/0002-quorum-empate-y-estado-reprogramada.md)
- [ADR 0003: Correcciones de actividades, clima real y estadísticas](docs/adr/0003-correcciones-actividades-clima-y-estadisticas.md)
- [ADR 0004: Visual Crossing como proveedor de clima](docs/adr/0004-visual-crossing-como-proveedor-de-clima.md)
- [ADR 0005: Integración resiliente del proveedor de clima legacy](docs/adr/0005-integracion-resiliente-proveedor-clima-legacy.md)
