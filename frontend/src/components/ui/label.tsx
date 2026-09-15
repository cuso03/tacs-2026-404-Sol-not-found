import type { LabelHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/** Etiqueta accesible para controles de formulario. */
export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium leading-none text-slate-800 peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)} {...props} />;
}
