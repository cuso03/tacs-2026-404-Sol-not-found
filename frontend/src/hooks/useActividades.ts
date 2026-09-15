import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import * as actividades from '../services/actividades';
import type { ReglasClimaPayload } from '../types/api';

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
    },
  });
}