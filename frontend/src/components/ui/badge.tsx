import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';
}

/** Etiqueta compacta basada en el patrón Badge de shadcn/ui. */
export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'border-transparent bg-blue-600 text-white',
    secondary: 'border-transparent bg-slate-100 text-slate-700',
    outline: 'border-slate-200 bg-white text-slate-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    destructive: 'border-rose-200 bg-rose-50 text-rose-700',
  };
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', variants[variant], className)} {...props} />;
}
