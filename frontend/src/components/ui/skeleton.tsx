import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/** Placeholder de carga basado en el patrón Skeleton de shadcn/ui. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200', className)} {...props} />;
}
