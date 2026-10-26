import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { getEstadisticas, getTelemetriaClima } from '../services/admin';

export function useEstadisticas() {
  return useQuery({ queryKey: queryKeys.estadisticas, queryFn: getEstadisticas, refetchInterval: 15000, refetchOnWindowFocus: true });
}

export function useTelemetriaClima() {
  return useQuery({
    queryKey: ['admin', 'estadisticas', 'clima'],
    queryFn: getTelemetriaClima,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });
}
