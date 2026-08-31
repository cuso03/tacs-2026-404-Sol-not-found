import { randomUUID } from 'node:crypto';
import { Actividad } from '../interfaces/models/actividad';
import { Alternativa, Votacion } from '../interfaces/models/votacion';
import { PronosticoHora } from '../interfaces/models/pronostico';
import { IWeatherProvider } from '../interfaces/services/IWeatherProvider';
import { ActividadRepository } from '../interfaces/repositories/actividadRepository';
import { IVotingJobQueue } from '../interfaces/services/votingJobQueue';
import { filtrarHorasAdecuadas } from '../domain/clima';
import { ActividadEventNotifier } from './notifications/ActividadEventNotifier';

/** Resultado de obtener fechas disponibles. */
export type FechasDisponiblesResult =
  | { status: 'not_found' }
  | { status: 'no_rules' }
  | { status: 'ok'; fechas: string[] };

/** Resultado de abrir una votación. */
export type AbrirVotacionResult =
  | { status: 'not_found' }
  | { status: 'forbidden' }
  | { status: 'already_voting' }
  | { status: 'no_rules' }
  | { status: 'opened'; actividad: Actividad };

/** Resultado de registrar un voto. */
export type VotarResult =
  | { status: 'not_found' }
  | { status: 'voting_not_found' }
  | { status: 'voting_closed' }
  | { status: 'not_participant' }
  | { status: 'invalid_alternative' }
  | { status: 'voted'; votacion: Votacion };

/** Resultado de consultar resultados parciales. */
export type ResultadosVotacionResult =
  | { status: 'not_found' }
  | { status: 'voting_not_found' }
  | { status: 'ok'; votacion: Votacion; conteo: Record<string, number>; totalVotos: number };

/** Resultado de cerrar manualmente una votación. */
export type CerrarVotacionResult =
  | { status: 'not_found' }
  | { status: 'voting_not_found' }
  | { status: 'forbidden' }
  | { status: 'voting_closed' }
  | { status: 'closed'; actividad: Actividad };

/** Datos para abrir una votación. */
export interface AbrirVotacionDto {
  alternativas?: Array<{ fecha_horario: string }>;
  duracion_horas: number;
}

/** Servicio de caso de uso para votaciones de reprogramación. */
export class VotacionService {
  constructor(
    private readonly repository: ActividadRepository,
    private readonly weatherService: IWeatherProvider,
    private readonly jobQueue: IVotingJobQueue,
    private readonly eventNotifier: ActividadEventNotifier
  ) {}

  /**
   * Retorna fechas futuras con pronóstico disponible y clima adecuado
   * según las reglas de la actividad.
   */
  async obtenerFechasDisponibles(actividadId: string): Promise<FechasDisponiblesResult> {
    const actividad = await this.repository.findById(actividadId);
    if (!actividad) return { status: 'not_found' };
    if (!actividad.reglasClima) return { status: 'no_rules' };

    const ahora = new Date();
    const pronosticos = await this.weatherService.obtenerPronostico(
      actividad.ubicacion,
      ahora.toISOString(),
      actividad.reglasClima.dias_max_reprogramacion,
    );

    const horasAdecuadas = filtrarHorasAdecuadas(pronosticos, actividad.reglasClima);

    const fechas: string[] = [];
    for (const [fecha, horas] of horasAdecuadas) {
      const fechaDate = new Date(fecha + 'T12:00:00');
      if (fechaDate <= ahora) continue;

      const horasEnRango = horas.filter((h) => {
        const horaStr = h.fecha.slice(11, 16);
        return (
          horaStr >= actividad.reglasClima!.rango_horario.horario_min &&
          horaStr <= actividad.reglasClima!.rango_horario.horario_max
        );
      });

      if (horasEnRango.length > 0) {
        fechas.push(fecha);
      }
    }

    return { status: 'ok', fechas };
  }

  /**
   * Abre una votación de reprogramación para una actividad.
   * Si no se proveen alternativas, el sistema las genera automáticamente
   * consultando el pronóstico y priorizando el mismo día de semana.
   */
  async abrirVotacion(actividadId: string, organizadorId: string, dto: AbrirVotacionDto): Promise<AbrirVotacionResult> {
    const actividad = await this.repository.findById(actividadId);
    if (!actividad) return { status: 'not_found' };
    if (actividad.creadorId !== organizadorId) return { status: 'forbidden' };
    if (actividad.estado === 'EN_VOTACION') return { status: 'already_voting' };
    if (!actividad.reglasClima) return { status: 'no_rules' };

    let alternativas: Alternativa[];
    let automatica: boolean;

    if (dto.alternativas && dto.alternativas.length > 0) {
      alternativas = dto.alternativas.map((a) => ({ id: randomUUID(), fecha_horario: a.fecha_horario }));
      automatica = false;
    } else {
      alternativas = await this.generarAlternativasAutomaticas(actividad);
      automatica = true;
    }

    const ahora = new Date();
    const cierraEn = new Date(ahora.getTime() + dto.duracion_horas * 60 * 60 * 1000);

    const votacion: Votacion = {
      id: randomUUID(),
      abiertaEn: ahora.toISOString(),
      cierraEn: cierraEn.toISOString(),
      duracionHoras: dto.duracion_horas,
      automatica,
      alternativas,
      votos: {},
    };

    const votaciones = [...actividad.votaciones, votacion];

    const updated = await this.repository.update({
      ...actividad,
      estado: 'EN_VOTACION',
      votaciones,
    });

    if (!updated) return { status: 'not_found' };

    await this.jobQueue.programarCierreVotacion(actividadId, votacion.id, cierraEn);

    return { status: 'opened', actividad: updated };
  }

  /** Retorna una votación por su ID dentro de una actividad. */
  private buscarVotacion(actividad: Actividad, votacionId: string): Votacion | undefined {
    return actividad.votaciones.find((v) => v.id === votacionId);
  }

  /**
   * Registra el voto de un participante en la votación indicada.
   * Si el usuario ya había votado, sobreescribe su voto anterior.
   */
  async votar(actividadId: string, votacionId: string, userId: string, alternativaId: string): Promise<VotarResult> {
    const actividad = await this.repository.findById(actividadId);
    if (!actividad) return { status: 'not_found' };

    const votacion = this.buscarVotacion(actividad, votacionId);
    if (!votacion) return { status: 'voting_not_found' };

    const ahora = new Date();
    if (new Date(votacion.cierraEn) <= ahora) return { status: 'voting_closed' };
    if (actividad.estado !== 'EN_VOTACION') return { status: 'voting_closed' };
    if (!actividad.participantes.includes(userId)) return { status: 'not_participant' };

    const alternativaExiste = votacion.alternativas.some((a) => a.id === alternativaId);
    if (!alternativaExiste) return { status: 'invalid_alternative' };

    const votosActualizados = { ...votacion.votos, [userId]: alternativaId };
    const votacionActualizada: Votacion = { ...votacion, votos: votosActualizados };

    const votaciones = actividad.votaciones.map((v) => (v.id === votacionId ? votacionActualizada : v));

    const updated = await this.repository.update({
      ...actividad,
      votaciones,
    });

    if (!updated) return { status: 'not_found' };

    return { status: 'voted', votacion: votacionActualizada };
  }

  /** Retorna los resultados parciales de la votación indicada. */
  async obtenerResultados(actividadId: string, votacionId: string): Promise<ResultadosVotacionResult> {
    const actividad = await this.repository.findById(actividadId);
    if (!actividad) return { status: 'not_found' };

    const votacion = this.buscarVotacion(actividad, votacionId);
    if (!votacion) return { status: 'voting_not_found' };

    const conteo: Record<string, number> = {};
    for (const alt of votacion.alternativas) {
      conteo[alt.id] = 0;
    }
    for (const altId of Object.values(votacion.votos)) {
      if (conteo[altId] !== undefined) {
        conteo[altId]++;
      }
    }

    const totalVotos = Object.keys(votacion.votos).length;

    return { status: 'ok', votacion, conteo, totalVotos };
  }

  /**
   * Cierra manualmente una votación de reprogramación.
   * Solo el organizador puede ejecutar esta acción.
   */
  async cerrarVotacionManual(actividadId: string, votacionId: string, userId: string): Promise<CerrarVotacionResult> {
    const actividad = await this.repository.findById(actividadId);
    if (!actividad) return { status: 'not_found' };
    if (actividad.creadorId !== userId) return { status: 'forbidden' };

    const votacion = this.buscarVotacion(actividad, votacionId);
    if (!votacion) return { status: 'voting_not_found' };

    const ahora = new Date();
    if (new Date(votacion.cierraEn) <= ahora) return { status: 'voting_closed' };
    if (actividad.estado !== 'EN_VOTACION') return { status: 'voting_closed' };

    await this.cerrarVotacion(actividadId, votacionId);

    const actividadActualizada = await this.repository.findById(actividadId);
    return { status: 'closed', actividad: actividadActualizada! };
  }

  /**
   * Cierra la votación y resuelve la reprogramación.
   * La alternativa más votada gana si alcanza el quórum (min_participantes).
   * Si no hay quórum, la actividad se cancela.
   */
  async cerrarVotacion(actividadId: string, votacionId: string): Promise<void> {
    const actividad = await this.repository.findById(actividadId);
    if (!actividad || actividad.estado !== 'EN_VOTACION') return;

    const votacion = this.buscarVotacion(actividad, votacionId);
    if (!votacion) return;

    const conteo: Record<string, number> = {};
    for (const alt of votacion.alternativas) conteo[alt.id] = 0;
    for (const altId of Object.values(votacion.votos)) {
      if (conteo[altId] !== undefined) conteo[altId]++;
    }

    let ganadora: Alternativa | null = null;
    let maxVotos = 0;
    for (const alt of votacion.alternativas) {
      if (conteo[alt.id] > maxVotos) {
        maxVotos = conteo[alt.id];
        ganadora = alt;
      }
    }

    const totalVotos = Object.keys(votacion.votos).length;

    // Resolución y Notificación Síncrona
    if (ganadora && maxVotos > 0 && totalVotos >= actividad.min_participantes) {
      await this.repository.update({
        ...actividad,
        estado: 'CONFIRMADA',
        fecha_horario: ganadora.fecha_horario,
      });
      // US 13: Disparar alerta de reprogramación
      await this.eventNotifier.notificarReprogramacion(actividad, ganadora.fecha_horario);
    } else {
      await this.repository.update({
        ...actividad,
        estado: 'CANCELADA',
      });
      // US 13: Disparar alerta de cancelación
      await this.eventNotifier.notificarCancelacion(actividad);
    }
  }

  /**
   * Genera alternativas automáticamente priorizando fechas que caigan
   * el mismo día de semana que la actividad original, luego las más cercanas.
   */
  private async generarAlternativasAutomaticas(actividad: Actividad): Promise<Alternativa[]> {
    const reglas = actividad.reglasClima!;
    const ahora = new Date();

    const pronosticos = await this.weatherService.obtenerPronostico(
      actividad.ubicacion,
      ahora.toISOString(),
      reglas.dias_max_reprogramacion,
    );

    const horasAdecuadas = filtrarHorasAdecuadas(pronosticos, reglas);

    const diaSemanaOriginal = new Date(actividad.fecha_horario).getDay();

    const candidatas: Array<{ fecha: string; hora: PronosticoHora; esMismoDia: boolean; distancia: number }> = [];

    for (const [fecha, horas] of horasAdecuadas) {
      const fechaDate = new Date(fecha + 'T12:00:00');
      if (fechaDate <= ahora) continue;

      const horasEnRango = horas.filter((h) => {
        const horaStr = h.fecha.slice(11, 16);
        return horaStr >= reglas.rango_horario.horario_min && horaStr <= reglas.rango_horario.horario_max;
      });

      for (const hora of horasEnRango) {
        const fechaHoraDate = new Date(hora.fecha);
        const esMismoDia = fechaHoraDate.getDay() === diaSemanaOriginal;
        const distancia = Math.abs(fechaHoraDate.getTime() - new Date(actividad.fecha_horario).getTime());
        candidatas.push({ fecha, hora, esMismoDia, distancia });
      }
    }

    candidatas.sort((a, b) => {
      if (a.esMismoDia !== b.esMismoDia) return a.esMismoDia ? -1 : 1;
      return a.distancia - b.distancia;
    });

    const maxAlternativas = 5;
    const selec = candidatas.slice(0, maxAlternativas);

    return selec.map((c) => ({
      id: randomUUID(),
      fecha_horario: c.hora.fecha,
    }));
  }
}
