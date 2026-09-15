import type { SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/** Select nativo accesible con la apariencia del sistema shadcn/ui. */
export function NativeSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />;
}
