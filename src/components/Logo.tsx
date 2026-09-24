interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  light?: boolean;
  className?: string;
}

const WIDTHS = { sm: 112, md: 150, lg: 200 };

export default function Logo({ size = 'md', light = false, className = '' }: LogoProps) {
  return (
    <img
      src="/assets/transplant-aquatics-logo.svg"
      alt="Transplant Aquatics"
      width={WIDTHS[size]}
      className={`block h-auto ${className}`}
      style={{ width: WIDTHS[size], filter: light ? undefined : 'brightness(0) saturate(100%) invert(8%) sepia(32%) saturate(1524%) hue-rotate(169deg) brightness(91%) contrast(99%)' }}
    />
  );
}
