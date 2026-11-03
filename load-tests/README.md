# Pruebas de Carga (Load Testing con k6) — Entrega 4

Este directorio contiene las pruebas de carga automatizadas con **[Grafana k6](https://k6.io/)** exigidas por la consigna para evaluar el comportamiento del sistema bajo estrés frente al proveedor legacy.

---

## Escenarios de Carga Dinámicos

Las pruebas son **completamente dinámicas y autónomas**:
1. **`setup()`**: Crea automáticamente un lote de 50 actividades en MongoDB con el token del usuario y fechas válidas dentro de los próximos 15 días (rotando ubicaciones entre Buenos Aires, Córdoba, Rosario, La Plata y Mar del Plata).
2. **`default(data)`**: Los Virtual Users (hasta 50 VUs) consultan en paralelo el clima de las actividades creadas, distribuyendo el tráfico para poner a prueba la caché en memoria, el limitador de tasa y el Circuit Breaker.
3. **`teardown(data)`**: Al finalizar el test, elimina automáticamente todas las actividades de prueba generadas, manteniendo la base de datos limpia.

### 1. Escenario 1: Servicio Legacy Activo y Saludable (`scenario-1-healthy.js`)
- **Objetivo**: Evaluar concurrencia (hasta 50 VUs), latencia y aciertos de la **caché en memoria** cuando el contenedor `legacy-weather` está levantado y respondiendo.
- **Resultado Esperado**:
  - 100% de peticiones con HTTP 200 OK (`http_req_failed < 0.01`).
  - La mayoría de las llamadas repetidas son atendidas en `< 50ms` gracias a la caché en memoria (`fast_responses_cache`).

### 2. Escenario 2: Servicio Legacy Caído / En Outage (`scenario-2-outage.js`)
- **Objetivo**: Evaluar la **resiliencia y alta disponibilidad** cuando el contenedor `legacy-weather` está detenido (`docker compose stop legacy-weather`) o en outage por el motor de caos interno (`rollDice`).
- **Resultado Esperado**:
  - 100% de peticiones con HTTP 200 OK (`http_req_failed < 0.01`).
  - Se activa el **Circuit Breaker** (transicionando a `OPEN` tras 5 fallos consecutivos), ejecutando *fail-fast* sin saturar la red.
  - Conmutación automática a **Fallback** transparente (Visual Crossing), entregando los datos climáticos sin interrumpir el servicio al usuario.

---

## Cómo Ejecutar las Pruebas

### Prerrequisitos
Tener la infraestructura levantada:
```bash
docker compose up -d --build
```

### Opción A: Usando el binario local de k6
Si tenés `k6` instalado en tu sistema (`winget install k6` en Windows, `brew install k6` en Mac o `apt install k6` en Linux):

```bash
# En Windows PowerShell:
$env:AUTH_TOKEN = "<TU_TOKEN_JWT>"

# Escenario 1: Legacy Saludable
k6 run -e AUTH_TOKEN=$env:AUTH_TOKEN load-tests/scenario-1-healthy.js

# Simular caída del servicio legacy
docker compose stop legacy-weather

# Escenario 2: Outage con Fallback
k6 run -e AUTH_TOKEN=$env:AUTH_TOKEN load-tests/scenario-2-outage.js

# Volver a levantar el legacy
docker compose start legacy-weather
```

```bash
# En Linux / macOS / Bash:
export AUTH_TOKEN="<TU_TOKEN_JWT>"

# Escenario 1: Legacy Saludable
k6 run -e AUTH_TOKEN=$AUTH_TOKEN load-tests/scenario-1-healthy.js

# Simular caída del servicio legacy
docker compose stop legacy-weather

# Escenario 2: Outage con Fallback
k6 run -e AUTH_TOKEN=$AUTH_TOKEN load-tests/scenario-2-outage.js

# Volver a levantar el legacy
docker compose start legacy-weather
```

### Opción B: Usando Docker (sin instalar k6 localmente)
```powershell
# En Windows (PowerShell):
$AUTH_TOKEN = "<TU_TOKEN_JWT>"

docker run --rm -i --network=host grafana/k6 run -e AUTH_TOKEN=$AUTH_TOKEN - < load-tests/scenario-1-healthy.js
```

---

## Parámetros y Variables de Entorno

| Variable | Requerida | Por Defecto | Descripción |
|---|---|---|---|
| `AUTH_TOKEN` | **Sí** | *(vacío)* | Token JWT institucional (Bearer) del usuario autenticado. |
| `ACTIVITY_COUNT` | No | `50` | Cantidad de actividades dinámicas a generar en `setup()`. |
| `KEEP_ACTIVITIES` | No | `false` | Si se define en `true`, no elimina las actividades en `teardown()`. |
| `BASE_URL` | No | `http://localhost:3000` | URL base de la API backend. |

### Ejemplo personalizando la cantidad de actividades:
```bash
k6 run -e AUTH_TOKEN="<TU_TOKEN_JWT>" -e ACTIVITY_COUNT=20 -e KEEP_ACTIVITIES=false load-tests/scenario-1-healthy.js
```
