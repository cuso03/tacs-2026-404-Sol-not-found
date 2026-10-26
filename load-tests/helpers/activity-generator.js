import http from 'k6/http';

const CIUDADES_MOCK = [
  { ciudad: 'Buenos Aires', pais: 'Argentina', lat: -34.6037, lon: -58.3816 },
  { ciudad: 'Córdoba', pais: 'Argentina', lat: -31.4201, lon: -64.1888 },
  { ciudad: 'Rosario', pais: 'Argentina', lat: -32.9468, lon: -60.6393 },
  { ciudad: 'La Plata', pais: 'Argentina', lat: -34.9214, lon: -57.9545 },
  { ciudad: 'Mar del Plata', pais: 'Argentina', lat: -38.0055, lon: -57.5562 },
];

const TIPOS_ACTIVIDAD = ['aire_libre', 'techada', 'mixta'];

/**
 * Genera y crea 'count' actividades en MongoDB a través de la API REST del backend.
 * Devuelve un array de strings con los IDs generados.
 */
export function crearActividadesEnLote(baseUrl, token, count = 50) {
  const ids = [];
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  console.log(`[setup] Generando ${count} actividades de prueba para el test de carga...`);

  for (let i = 0; i < count; i++) {
    const loc = CIUDADES_MOCK[i % CIUDADES_MOCK.length];
    const tipo = TIPOS_ACTIVIDAD[i % TIPOS_ACTIVIDAD.length];

    // Fecha entre 2 y 10 días a futuro para asegurar disponibilidad en el pronóstico (< 15 días)
    const offsetDias = 2 + (i % 8);
    const hora = 10 + (i % 10);
    const fecha = new Date(Date.now() + offsetDias * 86400000 + hora * 3600000);
    fecha.setMinutes(0);
    fecha.setSeconds(0);
    fecha.setMilliseconds(0);

    const payload = JSON.stringify({
      titulo: `Actividad Carga Dinámica #${i + 1} - ${loc.ciudad}`,
      descripcion: `Actividad autogenerada para pruebas de carga concurrentes de clima #${i + 1}`,
      tipo: tipo,
      ubicacion: {
        tipo: 'coordenadas',
        latitud: loc.lat,
        longitud: loc.lon,
        direccion: `${loc.ciudad}, ${loc.pais}`,
      },
      fecha_horario: fecha.toISOString(),
      min_participantes: 2,
      max_participantes: 10 + (i % 20),
    });

    const res = http.post(`${baseUrl}/api/actividades`, payload, { headers });

    if (res.status === 201) {
      try {
        const body = res.json();
        const id = body.id || (body._id ? body._id.toString() : null);
        if (id) {
          ids.push(id);
        }
      } catch (err) {
        console.warn(`[setup] No se pudo parsear respuesta al crear actividad #${i + 1}: ${err}`);
      }
    } else {
      console.warn(`[setup] Falló creación de actividad #${i + 1}: HTTP ${res.status} - ${res.body}`);
    }
  }

  console.log(`[setup] Se crearon exitosamente ${ids.length} de ${count} actividades.`);
  return ids;
}

/**
 * Elimina las actividades creadas para no dejar datos residuales en MongoDB.
 */
export function limpiarActividadesEnLote(baseUrl, token, ids = []) {
  if (!ids || ids.length === 0) return;

  const headers = {
    'Authorization': `Bearer ${token}`,
  };

  console.log(`[teardown] Limpiando ${ids.length} actividades de prueba en MongoDB...`);
  let eliminadas = 0;

  for (const id of ids) {
    const res = http.del(`${baseUrl}/api/actividades/${id}`, null, { headers });
    if (res.status === 204 || res.status === 200 || res.status === 404) {
      eliminadas++;
    }
  }

  console.log(`[teardown] Limpieza completada: ${eliminadas}/${ids.length} eliminadas.`);
}
