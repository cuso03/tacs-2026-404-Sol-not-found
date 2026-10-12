import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { getEstadisticas } from '../services/admin';

export function useEstadisticas() {
  return useQuery({ queryKey: queryKeys.estadisticas, queryFn: getEstadisticas, refetchInterval: 15000, refetchOnWindowFocus: true });
}
