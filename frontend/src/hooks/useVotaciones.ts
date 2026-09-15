import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import {
  abrirVotacion,
  cerrarVotacion,
  getFechasDisponibles,
  getResultadosVotacion,
  votar,
  type AbrirVotacionPayload,
} from '../services/votaciones';

export function useResultadosVotacion(activityId: string, votingId?: string) {
  return useQuery({
    queryKey: queryKeys.resultadosVotacion(activityId, votingId ?? ''),
    queryFn: () => getResultadosVotacion(activityId, votingId!),
    enabled: !!votingId,
  });
}

export function useFechasDisponibles() {
  return useMutation({
    mutationFn: (activityId: string) => getFechasDisponibles(activityId),
  });
}

export function useAbrirVotacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId, payload }: { activityId: string; payload: AbrirVotacionPayload }) =>
      abrirVotacion(activityId, payload),
    onSuccess: (_data, { activityId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.actividad(activityId) });
    },
  });
}

export function useVotar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId, votingId, alternativaId }: { activityId: string; votingId: string; alternativaId: string }) =>
      votar(activityId, votingId, alternativaId),
    onSuccess: (_data, { activityId, votingId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.resultadosVotacion(activityId, votingId) });
    },
  });
}

export function useCerrarVotacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId, votingId }: { activityId: string; votingId: string }) =>
      cerrarVotacion(activityId, votingId),
    onSuccess: (_data, { activityId, votingId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.actividad(activityId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.resultadosVotacion(activityId, votingId) });
    },
  });
}