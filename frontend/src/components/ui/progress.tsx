import { cn } from '../../lib/utils';

/** Barra de progreso accesible basada en el patrón Progress de shadcn/ui. */
export function Progress({ value, className }: { value: number; className?: string }) {
  const normalized = Math.min(100, Math.max(0, value));
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={normalized}>
      <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${normalized}%` }} />
    </div>
  );
}
