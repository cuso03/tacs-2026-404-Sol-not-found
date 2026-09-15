import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

/** Botón del sistema visual, basado en el componente Button de shadcn/ui. */
export function Button({ className, variant = 'default', size = 'default', type = 'button', ...props }: ButtonProps) {
  const variants = {
    default: 'bg-blue-600 text-white shadow-sm hover:bg-blue-700',
    outline: 'border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-100',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
    ghost: 'text-slate-700 hover:bg-slate-100 hover:text-slate-950',
    destructive: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700',
  };
  const sizes = {
    default: 'h-10 px-4 py-2', sm: 'h-8 rounded-md px-3 text-xs', lg: 'h-11 rounded-md px-8', icon: 'size-10',
  };

  return <button type={type} className={cn('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50', variants[variant], sizes[size], className)} {...props} />;
}

export default Button;
