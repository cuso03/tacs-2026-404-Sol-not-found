import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

/**
 * Escenario 2: Servicio Legacy Caído (Outage / Degradado)
 *
 * Evalúa la tolerancia a fallos del sistema cuando el contenedor 'legacy-weather'
 * está detenido (`docker compose stop legacy-weather`) o arrojando fallos 503 (`rollDice`).
 *
 * La aplicación debe mantener alta disponibilidad (100% de respuestas 200 OK)
 * activando transparentemente el Circuit Breaker y conmutando a Fallback (Visual Crossing).
 *
 * Ejecución:
 *   k6 run load-tests/scenario-2-outage.js
 *   O con Docker:
 *   docker run --rm -i --network=host grafana/k6 run - < load-tests/scenario-2-outage.js
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

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ACTIVIDAD_ID = __ENV.ACTIVIDAD_ID || 'test-actividad-id';
const TOKEN = __ENV.AUTH_TOKEN || '';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (TOKEN) {
    headers['Authorization'] = `Bearer ${TOKEN}`;
  }

  const res = http.get(`${BASE_URL}/api/actividades/${ACTIVIDAD_ID}/clima`, { headers });

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
