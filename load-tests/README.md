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
# Escenario 1: Legacy Saludable
k6 run load-tests/scenario-1-healthy.js

# Simular caída del servicio legacy
docker compose stop legacy-weather

# Escenario 2: Outage con Fallback
k6 run load-tests/scenario-2-outage.js

# Volver a levantar el legacy
docker compose start legacy-weather
```

### Opción B: Usando Docker (sin instalar k6 localmente)
Podés ejecutar la imagen oficial de Grafana k6 apuntando a la red del host o a la red de Docker:

```bash
# En Windows (PowerShell):
docker run --rm -i --network=host grafana/k6 run - < load-tests/scenario-1-healthy.js

# Detener el servicio legacy para simular outage:
docker compose stop legacy-weather

docker run --rm -i --network=host grafana/k6 run - < load-tests/scenario-2-outage.js

# Restaurar el contenedor:
docker compose start legacy-weather
```

---

## Variables de Entorno Opcionales

Podés parametrizar la URL base, el token de autorización y el ID de la actividad a testear:

```bash
k6 run -e BASE_URL=http://localhost:3000 -e ACTIVIDAD_ID=6adfa... -e AUTH_TOKEN=ey... load-tests/scenario-1-healthy.js
```
