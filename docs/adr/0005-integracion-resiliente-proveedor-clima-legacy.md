# ADR 0005: Integración Resiliente del Proveedor de Clima Legacy

## Estado
Aceptado

## Contexto
En la Entrega 4 se incorporó como proveedor adicional de clima el servicio legacy desarrollado por "Humedad, Datos y Pronósticos S.A." a través de un binario compilado en Go (`tacs-linux-amd64`).

El análisis de ingeniería inversa y observación en runtime reveló que este servicio presenta serias deficiencias operativas y de confiabilidad:
1. **Inestabilidad simulada:** Contiene una rutina periódica (`rollDice`) ejecutada cada 45 segundos con 10% de probabilidad de corte total del servicio (`outage`) y 15% de probabilidad de degradación (`degraded` respondiendo HTTP 503 en `/readyz`).
2. **Validación de Identidad y Telemetría Cifrada:** Exige autenticación OIDC de Google perteneciente exclusivamente al dominio institucional `@frba.utn.edu.ar`. Además, reporta eventos de ciclo de vida cada 30 segundos cifrados con AES-256-GCM hacia `https://tacs.dale.ar/config`.
3. **Contrato de RPC Único:** No cuenta con endpoints REST convencionales para rangos; atiende únicamente peticiones JSON-RPC sobre `POST /rpc` con el método `"weather.forecast"`.
4. **Respuestas Inconsistentes:** Ante degradaciones o fallos de infraestructura, puede responder respuestas no válidas, con datos numéricos anómalos o códigos de error 5xx.

El sistema debe operar este servicio sin comprometer la alta disponibilidad de la aplicación para los usuarios y garantizando que el monitoreo de actividades no sufra interrupciones.

## Decisión

Se diseñó e implementó una arquitectura de **capa de resiliencia multicapa** y un ruteador inteligente (`ResilientWeatherRouter`) con las siguientes técnicas:

### 1. Aislamiento y Auto-recuperación en Contenedores (Docker)
- El binario legacy corre en un contenedor Linux independiente (`legacy-weather`) aislado en la red interna de Docker.
- Política de reinicio `restart: unless-stopped` que garantiza el auto-levantamiento ante salidas inesperadas del proceso.
- Sondeo de liveness a través de `GET /healthz`.

### 2. Timeouts Estrictos
- Todas las llamadas HTTP hacia `POST /rpc`, `/healthz` y `/readyz` están protegidas con `AbortController`.
- Timeout configurado en **3.000 ms**. Si el servicio legacy se cuelga o bloquea, se aborta la petición y se lanza `WEATHER_TIMEOUT`.

### 3. Reintentos con Backoff Exponencial y Jitter
- Hasta **2 reintentos** (3 intentos en total) exclusivamente ante fallas transitorias (errores de red, HTTP 500, 502, 503, o timeouts).
- Los errores de autenticación (401/403) o parámetros erróneos (400) no se reintentan para evitar saturar el servicio.
- Fórmula de backoff: `Math.min(maxDelay, baseDelay * 2^(attempt - 1)) + randomJitter`. El jitter previene el efecto *thundering herd*.

### 4. Circuit Breaker (Máquina de Estados)
- Estados: `CLOSED`, `OPEN`, `HALF_OPEN`.
- **Umbral de apertura:** 5 fallos consecutivos transicionan el circuito a `OPEN`.
- En `OPEN`, las llamadas entrantes fallan inmediatamente (*fail-fast*) sin golpear la red ni degradar la latencia.
- **Cooldown de reset:** 30 segundos. Luego pasa a `HALF_OPEN` permitiendo peticiones sonda.
- Si 2 llamadas consecutivas en `HALF_OPEN` tienen éxito, el circuito vuelve a `CLOSED`; si alguna falla, vuelve a `OPEN`.

### 5. Caché en Memoria Acotada (TTL 10m)
- Almacenamiento clave-valor indexado por coordenadas redondeadas y hora: `${lat.toFixed(3)}_${lon.toFixed(3)}_${horaIso}`.
- TTL de 10 minutos para datos meteorológicos.
- Reduce drásticamente el caudal de consultas repetidas hacia el binario legacy y absorbe picos de carga.
- Telemetría de hits, misses y Hit Ratio registrada en el almacén de métricas.

### 6. Control de Caudal (Rate Limiting)
- Limitador upstream mediante Token Bucket: máximo 10 peticiones/segundo hacia el binario legacy.
- Limitador por usuario: 30 consultas/minuto por usuario autenticado.

### 7. Validación Estricta de Contratos (Zod)
- No se confía en que un HTTP 200 contenga datos válidos.
- Se valida con esquema Zod estricto que:
  - `temperature_c` sea un número finito entre -60°C y 60°C.
  - `humidity_pct` y `precipitation_probability_pct` estén entre 0% y 100%.
  - `wind_kph` sea >= 0.
  - La condición pertenezca al catálogo mapeable del dominio.
- Cualquier dato no conforme es rechazado con `WEATHER_INVALID_RESPONSE`.

### 8. Fallback Transparente
- Si el usuario eligió el proveedor `legacy` y este entra en fallo (circuit breaker abierto, timeout o error 5xx), el sistema conmuta automáticamente al proveedor predeterminado (`VisualCrossingAdapter`).
- La respuesta retorna exitosa (HTTP 200) informando en la metadata `proveedor: 'legacy'` y `fallback: true`.
- Esto garantiza disponibilidad del 100% ante caídas del servicio legacy.

## Consecuencias
- **Positivas:**
  - El sistema tolera el 100% de las caídas simuladas del binario (`rollDice` o interrupciones de proceso).
  - La experiencia de usuario no se degrada: la UI advierte sutilmente la situación de respaldo sin interrumpir el flujo.
  - El administrador cuenta con visibilidad en tiempo real de la tasa de aciertos de caché, estado del circuit breaker y fallbacks activados.
- **Negativas:**
  - Requiere mantener sincronizados los modelos de dominio ante posibles discrepancias entre ambos proveedores.
