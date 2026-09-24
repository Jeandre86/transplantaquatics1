interface FilterSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  light?: boolean;
}

// Styling is fixed for the light surfaces the filters sit on; `light` is accepted for
// backwards compatibility with existing call sites but does not change the rendering.
export default function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="font-mono text-xs tracking-widest uppercase text-neutral-400">
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="font-mono text-sm border px-2 py-1.5 appearance-none cursor-pointer focus:outline-none focus:ring-1 bg-neutral-50 border-neutral-200 text-white focus:ring-neutral-400"
        style={{ borderRadius: 0 }}
      >
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
