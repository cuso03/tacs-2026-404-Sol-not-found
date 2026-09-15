import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function Alert({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div role="alert" className={cn('relative w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800', className)} {...props} />; }
export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) { return <h5 className={cn('mb-1 font-semibold leading-none', className)} {...props} />; }
export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) { return <p className={cn('text-sm leading-relaxed', className)} {...props} />; }
