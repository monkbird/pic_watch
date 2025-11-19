import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs) => twMerge(clsx(inputs));

export const Button = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm active:scale-95",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm active:scale-95",
    ghost: "hover:bg-slate-100 text-slate-600 hover:text-slate-900",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100",
  };
  const sizes = {
    icon: "h-8 w-8 p-1.5",
    sm: "h-7 px-2 text-xs",
    md: "h-9 px-4 py-2 text-sm",
  };
  return (
    <button className={cn(`inline-flex items-center justify-center rounded-md font-medium transition-all disabled:opacity-50`, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
};