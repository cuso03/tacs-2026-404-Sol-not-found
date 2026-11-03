import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { getMisActividades, getPreferencias, actualizarPreferenciaClima } from '../services/usuarios';
import type { ProveedorClima } from '../types/api';

export function useMisActividades(page: number, limit: number) {
  return useQuery({
    queryKey: [...queryKeys.misActividades, page, limit],
    queryFn: () => getMisActividades({ page, limit }),
    placeholderData: (previous) => previous,
  });
}

export function usePreferencias() {
  return useQuery({
    queryKey: ['usuario', 'preferencias'],
    queryFn: getPreferencias,
    staleTime: 60 * 1000,
  });
}

export function useActualizarPreferenciaClima() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proveedorClima: ProveedorClima) => actualizarPreferenciaClima(proveedorClima),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['usuario', 'preferencias'] });
      void queryClient.invalidateQueries({ queryKey: ['actividades'] });
      void queryClient.invalidateQueries({ queryKey: ['clima'] });
    },
  });
}
