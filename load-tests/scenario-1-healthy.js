import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

/**
 * Escenario 1: Servicio Legacy Activo y Saludable
 *
 * Evalúa la disponibilidad, latencia y aciertos de caché del backend
 * cuando el contenedor 'legacy-weather' está activo y respondiendo.
 *
 * Ejecución:
 *   k6 run load-tests/scenario-1-healthy.js
 *   O con Docker:
 *   docker run --rm -i --network=host grafana/k6 run - < load-tests/scenario-1-healthy.js
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

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ACTIVIDAD_ID = __ENV.ACTIVIDAD_ID || '';
const TOKEN = __ENV.AUTH_TOKEN || '';

if (!TOKEN || !ACTIVIDAD_ID) {
  console.warn('⚠️ AVISO: Se requiere definir ACTIVIDAD_ID y AUTH_TOKEN (JWT de usuario) para ejecutar las pruebas de carga contra /api/actividades/:id/clima.');
}

export default function () {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (TOKEN) {
    headers['Authorization'] = `Bearer ${TOKEN}`;
  }

  const res = http.get(`${BASE_URL}/api/actividades/${ACTIVIDAD_ID}/clima`, { headers });

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

  // Si respondió en < 50ms, casi con seguridad fue atendida por la caché en memoria del backend
  if (res.timings.duration < 50) {
    cacheHitGuess.add(1);
  }

  sleep(0.2); // Pequeña pausa entre iteraciones de cada VU
}
