import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { getMisActividades } from '../services/usuarios';

export function useMisActividades(page: number, limit: number) {
  return useQuery({
    queryKey: [...queryKeys.misActividades, page, limit],
    queryFn: () => getMisActividades({ page, limit }),
    placeholderData: (previous) => previous,
  });
}