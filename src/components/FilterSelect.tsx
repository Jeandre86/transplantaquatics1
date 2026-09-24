interface FilterSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  light?: boolean;
  dark?: boolean;
}

// The dark variant is used when filters sit inside the navy rankings panel.
export default function FilterSelect({ label, value, options, onChange, dark = false }: FilterSelectProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className={`font-mono text-xs tracking-widest uppercase ${dark ? 'text-white/60' : 'text-neutral-500'}`}>
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`font-mono text-sm border px-2 py-1.5 appearance-none cursor-pointer focus:outline-none focus:ring-1 ${dark ? 'border-white/20 bg-[#071a2b] text-white focus:ring-[#00c2d7]' : 'border-neutral-200 bg-white text-neutral-900 focus:ring-neutral-400'}`}
        style={{ borderRadius: 0 }}
      >
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
