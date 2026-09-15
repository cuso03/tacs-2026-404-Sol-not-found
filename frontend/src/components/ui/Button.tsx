import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
}

export default function Button({ children, variant = 'primary', className = '', ...props }: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center gap-2 font-semibold text-sm px-4 py-2 rounded-xl shadow-sm transition";
  
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-slate-100 hover:bg-slate-200 text-slate-700",
    danger: "bg-rose-600 hover:bg-rose-700 text-white",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}