export interface GeocodedLocation {
  latitud: number;
  longitud: number;
  direccion: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

const geocodingBaseUrl = import.meta.env.VITE_GEOCODING_URL || 'https://nominatim.openstreetmap.org/search';
const cache = new Map<string, GeocodedLocation | null>();
let nextRequestAt = 0;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

/**
 * Convierte una dirección ingresada por el usuario en un punto geográfico.
 * Las búsquedas se cachean y serializan a un máximo de una solicitud por segundo
 * para respetar la política del servicio público de Nominatim.
 */
export async function geocodeAddress(query: string): Promise<GeocodedLocation | null> {
  const normalizedQuery = query.trim().replace(/\s+/g, ' ');
  if (normalizedQuery.length < 3) throw new Error('Ingresá al menos 3 caracteres para buscar.');

  const cacheKey = normalizedQuery.toLocaleLowerCase('es');
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;

  const delay = Math.max(0, nextRequestAt - Date.now());
  if (delay > 0) await wait(delay);
  nextRequestAt = Date.now() + 1_000;

  const url = new URL(geocodingBaseUrl, window.location.origin);
  url.searchParams.set('q', normalizedQuery);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');

  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'Accept-Language': 'es-AR,es;q=0.9' },
  });
  if (!response.ok) throw new Error('El buscador de ubicaciones no está disponible. Intentá nuevamente.');

  const [result] = await response.json() as NominatimResult[];
  const location = result
    ? { latitud: Number(result.lat), longitud: Number(result.lon), direccion: result.display_name }
    : null;

  if (location && (!Number.isFinite(location.latitud) || !Number.isFinite(location.longitud))) {
    throw new Error('El buscador devolvió una ubicación inválida.');
  }

  cache.set(cacheKey, location);
  return location;
}
