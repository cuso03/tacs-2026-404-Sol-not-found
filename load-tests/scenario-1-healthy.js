import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { crearActividadesEnLote, limpiarActividadesEnLote, configurarProveedorLegacy } from './helpers/activity-generator.js';

/**
 * Escenario 1: Servicio Legacy Activo y Saludable (Dinámico)
 *
 * 1. setup(): Crea 50 actividades en MongoDB con el token del usuario y fechas válidas.
 * 2. default(data): VUs concurrentes consultan en paralelo el clima de las actividades creadas.
 * 3. teardown(data): Elimina las 50 actividades de prueba al finalizar.
 *
 * Ejecución con k6 local:
 *   k6 run -e AUTH_TOKEN="<TU_TOKEN_JWT>" load-tests/scenario-1-healthy.js
 *
 * O con Docker:
 *   docker run --rm -i --network=host grafana/k6 run -e AUTH_TOKEN="<TU_TOKEN_JWT>" - < load-tests/scenario-1-healthy.js
 */

export const options = {
  scenarios: {
    legacy_healthy_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 20 }, // Calentamiento y rampa
        { duration: '30s', target: 50 }, // Carga sostenida de 50 usuarios concurrentes
        { duration: '10s', target: 0 },  // Descenso
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    // Menos del 1% de errores HTTP (todos deben ser 200 OK)
    http_req_failed: ['rate<0.01'],
    // 95% de las peticiones deben responder en menos de 1000ms (gracias a la caché en memoria)
    http_req_duration: ['p(95)<1000'],
  },
};

const successRate = new Rate('successful_requests');
const cacheHitGuess = new Counter('fast_responses_cache');

export function setup() {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';
  const token = __ENV.AUTH_TOKEN || '';
  const count = parseInt(__ENV.ACTIVITY_COUNT || '50', 10);

  if (!token) {
    throw new Error('❌ Se requiere la variable AUTH_TOKEN con el JWT de usuario para ejecutar la prueba.');
  }

  // Asegura que el usuario tenga configurado el proveedor legacy
  configurarProveedorLegacy(baseUrl, token);

  const ids = crearActividadesEnLote(baseUrl, token, count);
  if (ids.length === 0) {
    throw new Error('❌ No se pudo crear ninguna actividad de prueba. Verifica el backend y el token.');
  }

  return {
    baseUrl,
    token,
    actividadesIds: ids,
  };
}

export default function (data) {
  if (!data || !data.actividadesIds || data.actividadesIds.length === 0) {
    return;
  }

  // Selección aleatoria para simular tráfico concurrente distribuido sobre múltiples actividades
  const idx = Math.floor(Math.random() * data.actividadesIds.length);
  const actividadId = data.actividadesIds[idx];

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  const res = http.get(`${data.baseUrl}/api/actividades/${actividadId}/clima`, { headers });

  const isOk = check(res, {
    'status es 200 OK': (r) => r.status === 200,
    'respuesta contiene estructura de clima': (r) => {
      try {
        const body = r.json();
        return body && body.clima_actual && typeof body.clima_actual.temperatura === 'number';
      } catch {
        return false;
      }
    },
  });

  successRate.add(isOk);

  // Si respondió en < 50ms, fue atendida por la caché en memoria del backend
  if (res.timings.duration < 50) {
    cacheHitGuess.add(1);
  }

  sleep(0.2); // Pequeña pausa entre iteraciones de cada VU
}

export function teardown(data) {
  const keep = __ENV.KEEP_ACTIVITIES === 'true';
  if (!keep && data && data.actividadesIds) {
    limpiarActividadesEnLote(data.baseUrl, data.token, data.actividadesIds);
  } else if (keep) {
    console.log(`[teardown] KEEP_ACTIVITIES=true: Se conservan las ${data.actividadesIds?.length} actividades en la base.`);
  }
}
