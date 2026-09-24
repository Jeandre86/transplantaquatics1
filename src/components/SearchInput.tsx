import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  large?: boolean;
}

export default function SearchInput({ value, onChange, placeholder = 'Search...', large = false }: SearchInputProps) {
  return (
    <div className="relative w-full">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
        size={large ? 20 : 16}
      />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full border border-neutral-200 bg-neutral-50 text-white focus:outline-none focus:ring-1 focus:ring-neutral-400 ${
          large ? 'pl-10 pr-4 py-4 text-lg' : 'pl-9 pr-4 py-2.5 text-sm'
        }`}
        style={{
          borderRadius: 0,
          // Placeholder uses rgba for cross-browser support
        }}
      />
      <style>{`
        input[type="text"]::placeholder { color: var(--muted); opacity: 0.8; }
      `}</style>
    </div>
  );
}
