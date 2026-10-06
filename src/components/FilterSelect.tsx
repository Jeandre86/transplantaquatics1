interface FilterSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  dark?: boolean;
}

export default function FilterSelect({ label, value, options, onChange, dark = false }: FilterSelectProps) {
  const generatedId = useId();
  return (
    <div className="flex flex-col gap-0.5">
      <label htmlFor={generatedId} className={`font-mono text-sm tracking-wide uppercase ${dark ? 'text-white/70' : 'text-[var(--muted)]'}`}>
        {label}
      </label>
      <select
        id={generatedId}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`ta-select font-mono text-sm border px-3 py-2 appearance-none cursor-pointer focus:outline-none focus:ring-2 ${dark ? 'border-white/20 bg-[var(--navy-mid)] text-white focus:ring-[var(--accent)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] focus:ring-[var(--accent)]'}`}
        style={{ borderRadius: 0, colorScheme: dark ? 'dark' : 'light', minHeight: 40 }}
      >
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
import { useId } from 'react';
