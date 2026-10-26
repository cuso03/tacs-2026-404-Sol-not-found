import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { crearActividadesEnLote, limpiarActividadesEnLote } from './helpers/activity-generator.js';

/**
 * Escenario 2: Servicio Legacy Caído (Outage / Degradado - Dinámico)
 *
 * 1. setup(): Crea 50 actividades en MongoDB con el token del usuario.
 * 2. default(data): VUs concurrentes consultan el clima mientras 'legacy-weather' está detenido
 *    o degradado. Se valida que el Circuit Breaker actúe y conmute a Fallback (HTTP 200 OK).
 * 3. teardown(data): Elimina las 50 actividades de prueba al finalizar.
 *
 * Ejecución con k6 local:
 *   # 1. Simular caída del legacy:
 *   docker compose stop legacy-weather
 *
 *   # 2. Ejecutar la prueba:
 *   k6 run -e AUTH_TOKEN="<TU_TOKEN_JWT>" load-tests/scenario-2-outage.js
 *
 *   # 3. Restaurar el contenedor:
 *   docker compose start legacy-weather
 */

export const options = {
  scenarios: {
    legacy_outage_resilience: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 20 }, // Rampa inicial (el Circuit Breaker transiciona a OPEN)
        { duration: '30s', target: 50 }, // Carga con Circuit Breaker OPEN y Fallback activo
        { duration: '10s', target: 0 },  // Descenso
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    // 0% de caídas para el usuario final: la aplicación debe seguir respondiendo 200 OK gracias al Fallback
    http_req_failed: ['rate<0.01'],
    // Al abrirse el Circuit Breaker (fail-fast), las peticiones no sufren timeouts de red hacia el legacy
    http_req_duration: ['p(95)<2500'],
  },
};

const fallbackCounter = new Counter('fallbacks_triggered');
const successRate = new Rate('successful_requests');

export function setup() {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';
  const token = __ENV.AUTH_TOKEN || '';
  const count = parseInt(__ENV.ACTIVITY_COUNT || '50', 10);

  if (!token) {
    throw new Error('❌ Se requiere la variable AUTH_TOKEN con el JWT de usuario para ejecutar la prueba.');
  }

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
    'status es 200 OK (disponibilidad preservada)': (r) => r.status === 200,
    'datos climáticos presentes': (r) => {
      try {
        const body = r.json();
        return body && body.clima_actual && typeof body.clima_actual.temperatura === 'number';
      } catch {
        return false;
      }
    },
    'fallback activado': (r) => {
      try {
        const body = r.json();
        return body && body.fallback === true;
      } catch {
        return false;
      }
    },
  });

  successRate.add(isOk);

  try {
    const body = res.json();
    if (body && body.fallback === true) {
      fallbackCounter.add(1);
    }
  } catch {
    // ignore
  }

  sleep(0.2);
}

export function teardown(data) {
  const keep = __ENV.KEEP_ACTIVITIES === 'true';
  if (!keep && data && data.actividadesIds) {
    limpiarActividadesEnLote(data.baseUrl, data.token, data.actividadesIds);
  } else if (keep) {
    console.log(`[teardown] KEEP_ACTIVITIES=true: Se conservan las ${data.actividadesIds?.length} actividades en la base.`);
  }
}
