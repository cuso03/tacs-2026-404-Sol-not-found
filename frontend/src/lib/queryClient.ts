import { QueryClient } from '@tanstack/react-query';

export const queryKeys = {
  actividades: ['actividades'] as const,
  actividad: (id: string) => ['actividad', id] as const,
  misActividades: ['mis-actividades'] as const,
  resultadosVotacion: (activityId: string, votingId: string) => ['resultados-votacion', activityId, votingId] as const,
  clima: (activityId: string) => ['clima', activityId] as const,
  estadisticas: ['estadisticas'] as const,
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});