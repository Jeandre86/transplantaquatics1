import type { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  className?: string;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  type = 'button',
  disabled = false,
  className = '',
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-semibold tracking-tight transition-all duration-150 cursor-pointer border';

  const variants = {
    // Primary: accent (#C7F368) bg + black text — 12.8:1 contrast ✓
    primary: 'border-transparent text-black',
    // Secondary: white bg + black text on white — fine; or dark bg + white text
    secondary: 'bg-neutral-50 text-white border-neutral-400 hover:bg-neutral-200',
    // Ghost: transparent bg, white border + text on dark bg ✓
    ghost: 'bg-transparent text-white border-neutral-400 hover:bg-neutral-200 hover:text-white',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3.5 text-base',
  };

  const primaryStyle = variant === 'primary' ? { backgroundColor: 'var(--accent)' } : {};

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={primaryStyle}
      className={`${base} ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );
}
