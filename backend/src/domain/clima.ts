import { ReglasClima } from '../interfaces/models/actividad';
import { PronosticoHora } from '../interfaces/models/pronostico';


/** Evalúa si un pronóstico horario cumple las reglas climáticas de una actividad. */
export function pronosticoEsAdecuado(pronostico: PronosticoHora, reglas: ReglasClima): boolean {
  return (
    pronostico.probabilidad_lluvia <= reglas.probabilidad_lluvia_max &&
    pronostico.temperatura >= reglas.temperatura_min &&
    pronostico.temperatura <= reglas.temperatura_max &&
    pronostico.viento <= reglas.viento_max
  );
}

/**
 * Filtra pronósticos por hora y retorna solo los que cumplen las reglas,
 * agrupados por fecha (YYYY-MM-DD).
 */
export function filtrarHorasAdecuadas(
  pronosticos: PronosticoHora[],
  reglas: ReglasClima,
): Map<string, PronosticoHora[]> {
  const porDia = new Map<string, PronosticoHora[]>();
  for (const p of pronosticos) {
    if (pronosticoEsAdecuado(p, reglas)) {
      const fecha = p.fecha.slice(0, 10);
      const existing = porDia.get(fecha) ?? [];
      existing.push(p);
      porDia.set(fecha, existing);
    }
  }
  return porDia;
}
