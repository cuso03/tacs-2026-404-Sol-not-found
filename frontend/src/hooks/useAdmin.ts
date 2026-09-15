import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { getEstadisticas, simularMonitoreo } from '../services/admin';

export function useEstadisticas() {
  return useQuery({
    queryKey: queryKeys.estadisticas,
    queryFn: getEstadisticas,
  });
}

export function useSimularMonitoreo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: simularMonitoreo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.estadisticas });
    },
  });
}