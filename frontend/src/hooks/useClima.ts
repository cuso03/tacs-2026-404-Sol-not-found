import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { getClimaActividad } from '../services/clima';

export function useClimaActividad(activityId: string) {
  return useQuery({
    queryKey: queryKeys.clima(activityId),
    queryFn: () => getClimaActividad(activityId),
    enabled: !!activityId,
  });
}