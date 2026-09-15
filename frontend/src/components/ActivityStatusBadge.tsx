import { activityStatusLabels } from '../lib/formatters';
import type { EstadoActividad } from '../types/api';
import { Badge } from './ui/badge';

const variants: Record<EstadoActividad, 'secondary' | 'warning' | 'success' | 'destructive' | 'outline'> = {
  PROPUESTA: 'secondary',
  EN_VOTACION: 'warning',
  CONFIRMADA: 'success',
  REPROGRAMADA: 'outline',
  CANCELADA: 'destructive',
  FINALIZADA: 'outline',
};

/** Estado de actividad con color y texto consistentes en todas las pantallas. */
export default function ActivityStatusBadge({ status }: { status: EstadoActividad }) {
  return <Badge variant={variants[status]}>{activityStatusLabels[status]}</Badge>;
}
