# Pruebas de Carga (Load Testing con k6) — Entrega 4

Este directorio contiene las pruebas de carga automatizadas con **[Grafana k6](https://k6.io/)** exigidas por la consigna para evaluar el comportamiento del sistema bajo estrés frente al proveedor legacy.

---

## Escenarios Requeridos

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
# Definir variables requeridas
export ACTIVIDAD_ID="6adfab58e9f1720175168335"
export AUTH_TOKEN="<TU_TOKEN_JWT>"

# Escenario 1: Legacy Saludable
k6 run -e ACTIVIDAD_ID=$ACTIVIDAD_ID -e AUTH_TOKEN=$AUTH_TOKEN load-tests/scenario-1-healthy.js

# Simular caída del servicio legacy
docker compose stop legacy-weather

# Escenario 2: Outage con Fallback
k6 run -e ACTIVIDAD_ID=$ACTIVIDAD_ID -e AUTH_TOKEN=$AUTH_TOKEN load-tests/scenario-2-outage.js

# Volver a levantar el legacy
docker compose start legacy-weather
```

### Opción B: Usando Docker (sin instalar k6 localmente)
Podés ejecutar la imagen oficial de Grafana k6 apuntando a la red del host o a la red de Docker:

```bash
# En Windows (PowerShell):
$ACTIVIDAD_ID = "6adfab58e9f1720175168335"
$AUTH_TOKEN = "<TU_TOKEN_JWT>"

docker run --rm -i --network=host grafana/k6 run -e ACTIVIDAD_ID=$ACTIVIDAD_ID -e AUTH_TOKEN=$AUTH_TOKEN - < load-tests/scenario-1-healthy.js

# Detener el servicio legacy para simular outage:
docker compose stop legacy-weather

docker run --rm -i --network=host grafana/k6 run -e ACTIVIDAD_ID=$ACTIVIDAD_ID -e AUTH_TOKEN=$AUTH_TOKEN - < load-tests/scenario-2-outage.js

# Restaurar el contenedor:
docker compose start legacy-weather
```

---

## Variables de Entorno Requeridas

> [!IMPORTANT]
> Para ejecutar las pruebas de carga contra el endpoint `/api/actividades/:id/clima`, **es obligatorio** proporcionar tanto el token JWT del usuario como el ID de la actividad a consultar:
> - `AUTH_TOKEN`: Token JWT válido de Auth0 (Bearer) para pasar el middleware de autenticación y resolver la preferencia de proveedor (`legacy` o default).
> - `ACTIVIDAD_ID`: ID de una actividad existente en la base de datos (ej. `6adfab58e9f1720175168335`) cuya fecha esté dentro del rango de pronóstico (próximos 15 días).

### Ejemplo de ejecución con variables:

```bash
# Con k6 instalado localmente:
k6 run -e ACTIVIDAD_ID="6adfab58e9f1720175168335" -e AUTH_TOKEN="<TU_TOKEN_JWT>" load-tests/scenario-1-healthy.js

# O pasando BASE_URL si corre en otro host o puerto:
k6 run -e BASE_URL="http://localhost:3000" -e ACTIVIDAD_ID="6adfab58e9f1720175168335" -e AUTH_TOKEN="<TU_TOKEN_JWT>" load-tests/scenario-1-healthy.js
```

### Usando Docker:
```bash
docker run --rm -i --network=host grafana/k6 run -e BASE_URL="http://localhost:3000" -e ACTIVIDAD_ID="6adfab58e9f1720175168335" -e AUTH_TOKEN="<TU_TOKEN_JWT>" - < load-tests/scenario-1-healthy.js
```
