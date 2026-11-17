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

# Tests de carga reales contra el stack (k6 en load-tests/)
k6 run load-tests/scenario-1-healthy.js
k6 run load-tests/scenario-2-outage.js

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

## TP5: observabilidad de la búsqueda

### Entorno e instrumentación

Con los archivos `.env` preparados según las instrucciones anteriores y la
sesión institucional en `legacy-weather/token.json` para el proveedor legacy
([configuración de Entrega 4](docs/ENTREGA_04.md)):

```bash
docker compose up -d --build
```

| Herramienta | Acceso | Función |
| --- | --- | --- |
| Aplicación | http://localhost:5173 | Buscar actividades |
| Grafana | http://localhost:3001/d/sol-search | Dashboard de métricas |
| Jaeger | http://localhost:16686 | Trazas y spans |
| Prometheus | http://localhost:9090 | Consultar métricas históricas |

Se instrumenta **frontend → GET /api/actividades → backend → MongoDB → resultado**.
La aplicación envía telemetría por **OTLP al Collector**, que exporta trazas a
Jaeger y expone métricas para Prometheus; Grafana consulta Prometheus.
Configuraciones y dashboard: [`observability/`](observability/).

HTTP/XHR usa instrumentación automática y propaga `traceparent`. Los spans
manuales son `actividades.buscar.ui` (hasta disponer del resultado),
`actividades.buscar`, `actividades.db.count` y `actividades.db.find`.
MongoDB se instrumenta manualmente porque el driver de Mongoose 9 no está
soportado por la biblioteca automática evaluada. La API crea los instrumentos;
los SDK gestionan contexto, procesamiento y exportación. No se exportan tokens,
datos personales ni textos de búsqueda. No se mide el renderizado.

| Métrica OTel → Prometheus | Qué registra / unidad | Atributos |
| --- | --- | --- |
| `search.http.requests` → `search_http_requests_total` | Respuestas HTTP terminadas / solicitudes | método GET, ruta fija, outcome success/error |
| `search.http.duration` → `search_http_duration_seconds` | Duración hasta terminar la respuesta / segundos | los mismos |
| `search.completed` → `search_completed_total` | Búsquedas exitosas, incluso vacías / búsquedas | operation search |
| `search.db.duration` → `search_db_duration_seconds` | Cada consulta completada o fallida / segundos | operation count/find, outcome success/error |
| `load.http.requests` → `load_http_requests_total` | Intentos terminados del generador / solicitudes | phase warmup/load, users 1–100, outcome¹ |
| `load.http.duration` → `load_http_duration_seconds` | Duración del intento del generador / segundos | los mismos |

¹ `success`, `timeout`, `http_error`, `invalid_response`, `network_error`, `aborted`.
Los atributos tienen valores acotados. Un filtro inválido cuenta como error HTTP,
pero no como búsqueda completada. Un **timeout del cliente puede coexistir con
0 % de errores HTTP del backend**: el generador dejó de esperar y el servidor
puede continuar trabajando. El dashboard distingue ambas señales.

Los paneles muestran solicitudes/s, errores HTTP, p95 HTTP, búsquedas exitosas/s,
p95 de MongoDB y fallos/timeouts/p95 del cliente. Usan `rate` e
`histogram_quantile(0.95, ...)` sobre buckets; p95 estima el tiempo por debajo
del cual queda el 95 % de observaciones. Puede diferir del p95 exacto del CSV.

### Reproducir las pruebas

Con Node 22+, Docker y las dependencias de raíz/backend/frontend instaladas:

```bash
npm run observability:run -- --headed
npm run observability:report
```

El primer comando prepara datos sintéticos y prueba filtros, resultados y un
error real HTTP 400 (`limit=0`) con Playwright. Después genera carga HTTP con
Node/fetch y vuelve a probar la pantalla durante cada nivel. Usa el componente
real `Discover` en una página aislada (5180), un backend (3002) y una base de
prueba. No evalúa Auth0; desactiva cron/notificaciones y no llama al clima externo.
Los puertos deben estar libres. Al terminar limpia sus procesos y base de prueba.

Por defecto: 2000 actividades, 2/10/30 usuarios, 120 s por nivel, calentamiento
30 s y pausa 250 ms por usuario después de cada respuesta. Muestrea una de cada
diez solicitudes del generador y todas las del navegador. No introduce demoras
artificiales. Para la prueba de estrés o una verificación corta:

```bash
npm run observability:run -- --users 50,100 --duration 60 --data 50000 --pause 0 --warmup 10
npm run observability:run -- --quick
```

Los archivos se generan en `observability-results/<fecha>/` (ignorados por Git):
HTML, CSV, resúmenes, entorno, capturas, métricas y trazas JSON. El segundo comando
inicial abre el último HTML. Las evidencias seleccionadas están versionadas abajo.
`--headed` muestra el navegador; `--help` lista las opciones. Pruebas del generador:
`npm run observability:test`.

En Grafana seleccionar `sol-backend-pruebas`; en Jaeger buscar ese servicio o
`sol-frontend-pruebas`. El generador emite como `sol-load-generator` y vincula el
destino con `target.service.name`. Sus paneles excluyen calentamiento y solicitudes
de Playwright. **No data** indica ausencia de mediciones; cero indica un valor
observado. Los porcentajes son móviles: priorizar períodos estables y los
intervalos del reporte. Las primeras capturas no contienen métricas del generador.

Para ejecución local sin Compose, habilitar `OTEL_ENABLED=true` y
`VITE_OTEL_ENABLED=true` con los endpoints de los `.env.example`. Si MongoDB 8
rechaza el kernel local, configurar `MONGO_GLIBC_TUNABLES=glibc.pthread.rseq=1`
en el `.env` raíz y recrear Mongo; mantener esa opción entre escenarios
([contexto](https://jira.mongodb.org/browse/SERVER-121912)).

### Resultados y análisis

Mediciones del **11/11/2026**: i7-1255U, 12 CPU lógicas, 15,34 GiB RAM,
Node 22.17 y Chromium 158. Aplicación/generador en la máquina e infraestructura
en Docker, sin límites explícitos de CPU/RAM por contenedor. Comparar escenarios
**dentro de cada experimento**: cambian datos y pausas entre referencia y estrés.

| Experimento | Usuarios | Intentos | HTTP 200 | Timeouts | Fallos cliente | p95 cliente | HTTP 200/s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Referencia | 2 | 861 | 861 | 0 | 0 % | 37,97 ms | 7,17 |
| Referencia | 10 | 4314 | 4314 | 0 | 0 % | 39,04 ms | 35,94 |
| Referencia | 30 | 12510 | 12510 | 0 | 0 % | 57,41 ms | 104,21 |
| Estrés | 50 | 598 | 593 | 5 | 0,84 % | 10,74 s | 9,42 |
| Estrés | 100 | 712 | 665 | 47 | 6,60 % | 15,00 s | 10,29 |

Referencia: 2000 actividades, pausa 250 ms, 120 s/nivel y calentamiento 30 s.
Estrés: 50000 actividades, sin pausa, 60 s/nivel y calentamiento 10 s. Las tasas
incluyen el cierre de intentos pendientes (62,966 y 64,610 s en estrés). El p95
incluye fallos; el plazo de 15 s limita la observación del cliente.

1. **Tiempos, volumen y errores:** de 50 a 100 usuarios, p95 +39,6 %, respuestas
   correctas/s +9,3 % y fallos de 0,84 % a 6,60 %. Fueron timeouts; errores HTTP
   del backend: 0 %. El frontend no mostró resultados dentro de 30 s con 100
   usuarios; el runner marcó `failed` y conservó ambas mediciones.
2. **Etapa lenta:** en las trazas seleccionadas, el conteo ocupó el 99,3 % del
   tiempo de negocio con 50 usuarios y el 97,4 % con 100 (15,106 de 15,510 s).
   El span incluye espera del driver/conexión y no solo ejecución de MongoDB.
3. **Métricas y trazas:** las métricas muestran la degradación agregada; las
   trazas permiten localizarla en el acceso de conteo y seguir cada operación.
4. **Evidencia y límites:** los archivos enlazados sostienen esa observación,
   pero no identifican por sí solos CPU, conexiones u otra causa interna.
   Son datos sintéticos, carga cerrada y una prueba de navegador por nivel en
   una máquina compartida; no se evaluó Auth0 ni capacidad de producción.
5. **Mejora propuesta:** revisar `countDocuments` con `explain("executionStats")`;
   evaluar fechas BSON Date sin `$toDate` e índices adecuados. No se implementó.
   Verificarla repitiendo los mismos escenarios y comparando p95, timeouts,
   respuestas correctas/s y duración del conteo.

### Evidencias

| Experimento | Capturas | Mediciones y condiciones |
| --- | --- | --- |
| Referencia | [2 usuarios](docs/observability/baseline/grafana-2.png), [30 usuarios](docs/observability/baseline/grafana-30.png) | [CSV](docs/observability/baseline/requests.csv), [resumen e intervalos](docs/observability/baseline/summary.json), [entorno](docs/observability/baseline/environment.json) |
| Estrés | [50 usuarios](docs/observability/stress/grafana-50.png), [100 usuarios](docs/observability/stress/grafana-100.png), [fallo del frontend](docs/observability/stress/frontend-100-timeout.png) | [CSV](docs/observability/stress/requests.csv), [resumen e intervalos](docs/observability/stress/summary.json), [entorno](docs/observability/stress/environment.json) |

Trazas JSON: [recorrido exitoso](docs/observability/stress/traza-exitosa.json),
[validación 400](docs/observability/stress/traza-validacion-400.json),
[conteo lento, 50 usuarios](docs/observability/stress/traza-lenta-50.json) y
[100 usuarios](docs/observability/stress/traza-lenta-100.json).
Los resúmenes usan UTC y las capturas UTC−3.
[Procedencia y hashes](docs/observability/manifest.json). Estas copias permanecen
accesibles aunque se reinicien Jaeger/Prometheus.

Validación tras integrar `dev`: builds, lint del frontend, 165 tests del backend,
49 del frontend y cinco del generador. Imágenes de frontend/backend construidas
con `npm ci`; aplicación, API, MongoDB y observabilidad verificadas en Docker:
HTTP 200/400, proxy nginx, nueve paneles y trazas de éxito/error con Chromium.
La prueba del componente `Discover` usó un servidor de prueba también en Docker;
el navegador se ejecutó en el host. Se comprobó la redirección de la SPA a Auth0,
sin automatizar el login. [Verificación y límites](docs/observability/docker/verification.json),
[traza exitosa](docs/observability/docker/trace-success.json) y
[traza de error](docs/observability/docker/trace-error.json).
La imagen legacy se construyó, pero su ejecución autenticada quedó pendiente
por falta de la sesión institucional. No se creó ni publicó un tag de entrega.

Para TP5 se utilizó Codex para instrumentación, configuración y verificaciones;
el grupo debe revisar y poder explicar los resultados.

## Uso de inteligencia artificial (entregas anteriores)

El setup de IA incluyó agentes de asistencia de código para el análisis de los requerimientos, ingeniería inversa del binario, propuestas de diseño y redacción de tests y documentación técnica.

### Decisiones de arquitectura

Las decisiones de arquitectura relevantes y su justificación se registran como ADR en [`docs/adr`](docs/adr/):
- [ADR 0001: Gestión de participantes en memoria](docs/adr/0001-gestion-de-participantes-en-memoria.md)
- [ADR 0002: Quórum, empate y estado reprogramada](docs/adr/0002-quorum-empate-y-estado-reprogramada.md)
- [ADR 0003: Correcciones de actividades, clima real y estadísticas](docs/adr/0003-correcciones-actividades-clima-y-estadisticas.md)
- [ADR 0004: Visual Crossing como proveedor de clima](docs/adr/0004-visual-crossing-como-proveedor-de-clima.md)
- [ADR 0005: Integración resiliente del proveedor de clima legacy](docs/adr/0005-integracion-resiliente-proveedor-clima-legacy.md)
