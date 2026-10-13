import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const alertStyles = {
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
};

export function Alert({ className, variant = 'error', ...props }: HTMLAttributes<HTMLDivElement> & { variant?: keyof typeof alertStyles }) {
  return <div role={variant === 'error' ? 'alert' : 'status'} className={cn('relative w-full rounded-lg border px-4 py-3 text-sm', alertStyles[variant], className)} {...props} />;
}
export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) { return <h5 className={cn('mb-1 font-semibold leading-none', className)} {...props} />; }
export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) { return <p className={cn('text-sm leading-relaxed', className)} {...props} />; }
