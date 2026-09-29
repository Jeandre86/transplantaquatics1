import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  large?: boolean;
  id?: string;
  dark?: boolean;
}

export default function SearchInput({ value, onChange, placeholder = 'Search...', large = false, id, dark = false }: SearchInputProps) {
  return (
    <div className="relative w-full">
      <Search
        className={`absolute left-3 top-1/2 -translate-y-1/2 ${dark ? 'text-white/40' : 'text-neutral-400'}`}
        size={large ? 20 : 16}
      />
      <input
        id={id}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`ta-search-input w-full border focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${dark ? 'border-[var(--navy-light)] bg-[var(--navy-mid)] text-[var(--ink-on-dark)] placeholder:text-white/40' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--muted)]'} ${
          large ? 'pl-10 pr-4 py-4 text-lg' : 'pl-9 pr-4 py-2.5 text-sm'
        }`}
        style={{
          borderRadius: 0,
          minHeight: large ? 56 : 42,
          colorScheme: dark ? 'dark' : 'light',
        }}
      />
    </div>
  );
}
