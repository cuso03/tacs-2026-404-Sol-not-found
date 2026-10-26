# TP TACS 2026-C2 — Entrega 4: Proveedor de Clima Legacy

Este documento detalla la integración, arquitectura de resiliencia, hallazgos de ingeniería inversa y procedimientos operativos para el proveedor de clima legacy (**Humedad, Datos y Pronósticos S.A.**) en **404 Sol Not Found**.

---

## 1. Puesta en Marcha del Entorno Completo

### Prerrequisitos
- Docker Engine v20.10+ y Docker Compose v2.0+.
- Cuenta institucional de UTN FRBA (`@frba.utn.edu.ar`).
- Clave de API de Visual Crossing (para el proveedor estándar en `VISUAL_CROSSING_API_KEY`).

### Levantar el Entorno con Docker Compose

Desde la raíz del repositorio:

```bash
docker compose up -d --build
```

Esto levantará los siguientes servicios en una red interna compartida:
- **`tacs-frontend`**: Interfaz de usuario (React / Vite) expuesta en `http://localhost:5173`.
- **`tacs-backend`**: API REST (Node.js / Express) expuesta en `http://localhost:3000`.
- **`tacs-legacy-weather`**: Binario legacy (`tacs-linux-amd64`) corriendo en contenedor Linux en el puerto interno `:8080` (sin exposición pública al host).
- **`tacs-mongo`**: Base de datos MongoDB en `localhost:27018` (interno `:27017`).
- **`redis`**: Instancia de Redis para colas y caché en `:6379`.
- **`rabbitmq`**: Broker de mensajería para notificaciones en `:5672` (Management UI en `:15672`).

### Autenticación del Servicio Legacy

El binario legacy gestiona internamente su autenticación mediante Google OIDC para validar pertenencia a la organización `@frba.utn.edu.ar`.
1. Al iniciarse, el binario busca y administra de forma autónoma su sesión en `~/.tacs/session.token`.
2. El propio binario se encarga de crear su directorio y resolver el ciclo de vida del token sin requerir configuración manual en el backend.
3. El archivo `session.token` se mantiene persistido localmente por el binario dentro del contenedor y se encuentra debidamente ignorado en Git.

---

## 2. Fallas Descubiertas en el Binario Legacy

A partir de la descompilación y análisis estático con `iced-x86` y la inspección en runtime, se descubrieron los siguientes comportamientos problemáticos del binario:

| Comportamiento Problemático | Detección / Evidencia en el Binario | Impacto | Mitigación Implementada |
|---|---|---|---|
| **Motor de Caos Embebido (`rollDice`)** | Función `main.rollDice` en el binario: ejecuta un ticker cada 45 segundos con 10% probabilidad de `outage` (503) y 15% de `degraded`. | El servicio responde aleatoriamente con HTTP 503 o cortes abruptos sin previo aviso. | **Circuit Breaker** (abre a los 5 fallos evitando cascada) y **Fallback automático** transparente hacia Visual Crossing. |
| **Dependencia de Token OIDC Institucional** | Función `main.authenticate`: valida claims del token mediante `google.golang.org/api/idtoken` exigiendo `claims["hd"] == "frba.utn.edu.ar"`. | Si el token expira o no pertenece al dominio, devuelve HTTP 403 Forbidden. | Validación de códigos 401/403 sin reintento inútil; reenvío inmediato a fallback para no bloquear al usuario. |
| **Telemetría y Heartbeat Cifrado** | Función `main.startAnalytics`: cifra eventos cada 30s con AES-256-GCM usando la clave privada embebida en `.noptrdata` y hace POST a `https://tacs.dale.ar/config`. | Si la red bloquea la salida a internet hacia el endpoint de analytics, el binario acumula buffers en memoria (`eventsBuffer`). | Control de volumen y monitoreo con healthcheck en `/healthz` y `/readyz`. |
| **Contrato JSON-RPC Rígido** | Función `main.forecastRPC`: solo acepta `POST /rpc` con método `"weather.forecast"`. No soporta rangos de fechas ni métodos REST. | No es posible solicitar pronóstico horario multidiario en una sola llamada. | El adaptador (`LegacyWeatherAdapter`) traduce peticiones de rango en consultas horarias con concurrencia acotada (4 simultáneas) y caché local de 10m. |
| **Potencial Retorno de Datos Inválidos o Fuera de Rango** | Estructuras de respuesta `forecastResult` generadas por generadores determinísticos o mocks internos. | Respuestas con HTTP 200 que pueden contener valores numéricos fuera de rango físico (temperaturas absurdas o NaN). | **Validación estricta con Zod**: se valida que temperatura esté en [-60, 60]°C, humedad en [0, 100]%, viento >= 0. Ante fallo, se cataloga como `WEATHER_INVALID_RESPONSE`. |
| **Caídas Inesperadas del Proceso** | Si el proceso Go recibe señales o encuentra fallos fatales, termina con exit code 1. | Inaccesibilidad total del servicio de clima legacy. | Directiva Docker `restart: unless-stopped` que levanta automáticamente el contenedor en segundos sin intervención humana. |

---

## 3. Arquitectura y Técnicas de Resiliencia (ADRs)

Las decisiones de arquitectura y la justificación de cada técnica se encuentran registradas en [ADR 0005](adr/0005-integracion-resiliente-proveedor-clima-legacy.md).

### Resumen de Parámetros Elegidos

- **Timeouts:** 3.000 ms en todas las llamadas salientes con `AbortController`.
- **Reintentos:** 2 reintentos con backoff exponencial (`baseDelay = 150ms`, `maxDelay = 1200ms`) y Jitter aleatorio. Solo para fallos transitorios (5xx, red, timeout).
- **Circuit Breaker:** Umbral de fallo de 5 errores consecutivos -> `OPEN`. Tiempo de cooldown de 30 segundos -> `HALF_OPEN`. 2 éxitos en `HALF_OPEN` -> `CLOSED`.
- **Caché:** En memoria con TTL de 10 minutos indexada por lat/lon/hora. Absorbe ráfagas repetitivas.
- **Rate Limiting:** Token Bucket upstream a 10 peticiones/segundo para proteger al binario y 30 consultas/min por usuario.
- **Fallback:** Conmutación automática a Visual Crossing garantizando 100% de disponibilidad.

---

## 4. Diagrama de Despliegue con Servicio Legacy

```mermaid
flowchart TB
    subgraph Host["Host / Red Externa"]
        UserBrowser["Navegador del Usuario"]
        AdminBrowser["Navegador del Administrador"]
    end

    subgraph DockerEnv["Docker Compose Network (tacs-network)"]
        Frontend["Frontend SPA (Nginx / Vite)<br>Puerto: 5173"]
        Backend["Backend API (Node.js / Express)<br>Puerto: 3000"]
        
        subgraph Storage["Persistencia & Mensajería"]
            Mongo[("MongoDB 8<br>Puerto: 27017")]
            Redis[("Redis 8<br>Puerto: 6379")]
            Rabbit[("RabbitMQ 3<br>Puerto: 5672")]
        end

        subgraph LegacyBox["Contenedor Aislado (legacy-weather)"]
            LegacyBinary["Binario: tacs-linux-amd64<br>Puerto Interno: 8080 (No mapeado al host)"]
            TokenVol["Sesión: /root/.tacs (No versionado)"]
        end
    end

    subgraph ExternalServices["Servicios Externos / Internet"]
        Auth0["Auth0 Identity Provider"]
        VisualCrossing["Visual Crossing Weather API"]
        TelemetryServer["Telemetría: https://tacs.dale.ar/config"]
    end

    UserBrowser -->|HTTP :5173| Frontend
    AdminBrowser -->|HTTP :5173| Frontend
    Frontend -->|REST API :3000| Backend
    
    Backend -->|Mongoose| Mongo
    Backend -->|BullMQ| Redis
    Backend -->|AMQP Notificaciones| Rabbit
    Backend -->|HTTPS API Key| VisualCrossing
    Backend -->|OIDC JWT| Auth0
    
    Backend -->|POST /rpc /readyz /healthz :8080| LegacyBinary
    LegacyBinary -->|Heartbeat AES-GCM| TelemetryServer
```

---

## 5. Cuentas Institucionales Utilizadas

Para el flujo de autenticación y operación del servicio legacy de UTN FRBA:
- **Dominio requerido:** `@frba.utn.edu.ar`
- **Client ID de Google OIDC:** `235030233089-137pks34ei7rahu2mu2t02mh1917139k.apps.googleusercontent.com`
- **Cuentas institucionales de prueba:**
  - `alumno.tacs@frba.utn.edu.ar`
  - `docente.tacs@frba.utn.edu.ar`

---

## 6. Ejecución de Pruebas Automatizadas y Pruebas de Carga

### Tests de Resiliencia (con Stubs)
```bash
npm --prefix backend test tests/resilience/
```
Verifica unitariamente el Circuit Breaker, Retries con Jitter, Timeouts, Caché en memoria y Fallback sin requerir el binario real.

### Tests de Carga (Load Test)
```bash
npm --prefix backend run test:load
```
Evalúa concurrentemente 50 peticiones en los dos escenarios exigidos:
1. **Servicio legacy activo:** Mide latencias y verifica aciertos de caché (`legacy_cache_hits`).
2. **Servicio legacy caído:** Mide tolerancia a fallos, confirmando que el 100% de las respuestas son 200 OK mediante fallback y el Circuit Breaker transiciona a `OPEN`.
