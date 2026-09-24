interface StatBlockProps {
  value: string;
  label: string;
  accent?: boolean;
  /** onDark = true when the stat sits on a dark navy section */
  onDark?: boolean;
  /** legacy prop alias */
  light?: boolean;
}

export default function StatBlock({ value, label, accent = false, onDark, light }: StatBlockProps) {
  const isDark = onDark || light;
  return (
    <div className="text-center px-6">
      <div
        className="font-black font-mono text-5xl md:text-6xl leading-none tracking-tight"
        style={{ color: accent ? 'var(--accent)' : (isDark ? 'var(--ink-on-dark)' : 'var(--ink)') }}
      >
        {value}
      </div>
      <div
        className="mt-2 font-mono text-xs tracking-widest uppercase"
        style={{ color: isDark ? 'var(--muted-on-dark)' : 'var(--muted)' }}
      >
        {label}
      </div>
    </div>
  );
}
