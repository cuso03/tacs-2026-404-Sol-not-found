import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import * as actividades from '../services/actividades';
import type { CrearActividadPayload, ReglasClimaPayload } from '../types/api';

/** Busca actividades del catálogo con filtros y paginación. */
export function useActividades(params: Record<string, string | number>) {
  return useQuery({
    queryKey: [...queryKeys.actividades, params],
    queryFn: () => actividades.searchActividades(params),
    placeholderData: (previous) => previous,
  });
}

/** Detalle completo de una actividad. */
export function useActividad(id?: string) {
  return useQuery({
    queryKey: queryKeys.actividad(id ?? ''),
    queryFn: () => actividades.getActividad(id!),
    enabled: !!id,
  });
}

export function useCrearActividad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: actividades.createActividad,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.actividades });
      queryClient.invalidateQueries({ queryKey: queryKeys.misActividades });
      queryClient.invalidateQueries({ queryKey: queryKeys.estadisticas });
    },
  });
}

export function useConfigurarReglas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rules }: { id: string; rules: ReglasClimaPayload }) => actividades.configureReglas(id, rules),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.actividad(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.actividades });
      queryClient.invalidateQueries({ queryKey: queryKeys.misActividades });
      queryClient.invalidateQueries({ queryKey: queryKeys.estadisticas });
    },
  });
}

export function useUnirseActividad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: actividades.joinActividad,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.actividad(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.misActividades });
      queryClient.invalidateQueries({ queryKey: queryKeys.actividades });
      queryClient.invalidateQueries({ queryKey: ['resultados-votacion', id] });
    },
  });
}

export function useSalirseActividad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: actividades.leaveActividad,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.actividad(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.misActividades });
      queryClient.invalidateQueries({ queryKey: queryKeys.actividades });
      queryClient.invalidateQueries({ queryKey: ['resultados-votacion', id] });
    },
  });
}

export function useModificarActividad() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CrearActividadPayload }) => actividades.updateActividad(id, payload),
    onSuccess: (_data, { id }) => {
      client.invalidateQueries({ queryKey: queryKeys.actividad(id) });
      client.invalidateQueries({ queryKey: queryKeys.actividades });
      client.invalidateQueries({ queryKey: queryKeys.misActividades });
      client.invalidateQueries({ queryKey: queryKeys.clima(id) });
      client.invalidateQueries({ queryKey: ['resultados-votacion', id] });
      client.invalidateQueries({ queryKey: queryKeys.estadisticas });
    },
  });
}

export function useEliminarActividad() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: actividades.deleteActividad,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.actividades });
      client.invalidateQueries({ queryKey: queryKeys.misActividades });
      client.invalidateQueries({ queryKey: queryKeys.estadisticas });
    },
  });
}
