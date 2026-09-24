import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Medal } from '../types';

interface MedalDisplayProps {
  medals: Medal[];
}

// WTG host city lookup
const WTG_EDITIONS: Record<number, { city: string; country: string }> = {
  2025: { city: 'Padua',          country: 'Italy' },
  2023: { city: 'Perth',          country: 'Australia' },
  2019: { city: 'Newcastle',      country: 'United Kingdom' },
  2017: { city: 'Malaga',         country: 'Spain' },
  2015: { city: 'Mar del Plata',  country: 'Argentina' },
  2013: { city: 'Durban',         country: 'South Africa' },
  2011: { city: 'Gothenburg',     country: 'Sweden' },
  2009: { city: 'Gold Coast',     country: 'Australia' },
  2007: { city: 'Bangkok',        country: 'Thailand' },
};

// Tint colours for each column — dark-mode friendly
const TINT = {
  Gold:   { bg: 'rgba(255,195,0,0.10)',  border: 'rgba(255,195,0,0.18)',   text: '#FFD966', dim: 'rgba(255,195,0,0.35)' },
  Silver: { bg: 'rgba(180,180,200,0.08)',border: 'rgba(180,180,200,0.16)', text: '#C8C8D8', dim: 'rgba(180,180,200,0.3)' },
  Bronze: { bg: 'rgba(180,100,30,0.10)', border: 'rgba(180,100,30,0.18)',  text: '#D4956A', dim: 'rgba(180,100,30,0.35)' },
};

// Proportional bar gradients
const BAR_GRADIENT = {
  Gold:   'linear-gradient(180deg, #FFE066 0%, #F5A800 55%, #B87A00 100%)',
  Silver: 'linear-gradient(180deg, #E8E8F0 0%, #B0B0C0 55%, #808090 100%)',
  Bronze: 'linear-gradient(180deg, #D4956A 0%, #A0622A 55%, #7A4A1A 100%)',
};

// Small medal icon for column headers
function MedalDot({ color }: { color: 'Gold' | 'Silver' | 'Bronze' }) {
  const fills = { Gold: '#F5A800', Silver: '#B0B0C0', Bronze: '#A0622A' };
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="13" r="6" fill={fills[color]} />
      <circle cx="10" cy="13" r="5" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
      <path d="M7 7.5L10 3L13 7.5" fill={fills[color]} opacity="0.7" />
      <path d="M10 10L10.9 12.7H13.8L11.4 14.4L12.4 17.1L10 15.5L7.6 17.1L8.6 14.4L6.2 12.7H9.1L10 10Z"
        fill="rgba(255,255,255,0.45)" />
    </svg>
  );
}

export default function MedalDisplay({ medals }: MedalDisplayProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // ── Filter to WTG only ────────────────────────────────────────────────────
  const wtgMedals = medals.filter(m =>
    m.competition.toLowerCase().includes('world transplant games')
  );

  // ── Overall totals ────────────────────────────────────────────────────────
  const totalGold   = wtgMedals.filter(m => m.color === 'Gold').length;
  const totalSilver = wtgMedals.filter(m => m.color === 'Silver').length;
  const totalBronze = wtgMedals.filter(m => m.color === 'Bronze').length;
  const totalMedals = totalGold + totalSilver + totalBronze;

  // ── Group by year ─────────────────────────────────────────────────────────
  const yearMap = new Map<number, { gold: Medal[]; silver: Medal[]; bronze: Medal[] }>();
  wtgMedals.forEach(m => {
    if (!yearMap.has(m.year)) yearMap.set(m.year, { gold: [], silver: [], bronze: [] });
    const entry = yearMap.get(m.year)!;
    if (m.color === 'Gold')   entry.gold.push(m);
    if (m.color === 'Silver') entry.silver.push(m);
    if (m.color === 'Bronze') entry.bronze.push(m);
  });
  const editions = Array.from(yearMap.entries()).sort(([a], [b]) => b - a);

  function toggleRow(year: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(year) ? next.delete(year) : next.add(year);
      return next;
    });
  }

  // ── Bar chart sizing ──────────────────────────────────────────────────────
  const maxCount   = Math.max(totalGold, totalSilver, totalBronze, 1);
  const BAR_MAX    = 120; // px
  const barH = (n: number) => n === 0 ? 4 : Math.max(16, Math.round((n / maxCount) * BAR_MAX));

  if (totalMedals === 0) {
    return (
      <div
        className="py-16 text-center font-mono text-sm"
        style={{ color: 'var(--muted)', border: '1px solid var(--navy-light)' }}
      >
        No World Transplant Games medals recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-0">

      {/* ── Summary bar chart ───────────────────────────────────────────────── */}
      <div
        className="px-8 pt-8 pb-6"
        style={{ backgroundColor: 'var(--navy-mid)', borderBottom: '1px solid var(--navy-light)' }}
      >
        {/* Label + total */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="font-mono text-xs tracking-widest uppercase mb-1" style={{ color: 'var(--muted)' }}>
              World Transplant Games
            </p>
            <p className="font-mono text-xs tracking-widest uppercase" style={{ color: 'var(--aqua)' }}>
              Medal Summary
            </p>
          </div>
          <div className="text-right">
            <span
              className="font-mono font-black leading-none"
              style={{ fontSize: 48, color: 'var(--ink)' }}
            >
              {totalMedals}
            </span>
            <p className="font-mono text-xs tracking-widest uppercase mt-0.5" style={{ color: 'var(--muted)' }}>
              Total
            </p>
          </div>
        </div>

        {/* Bars */}
        <div className="flex items-end gap-6" style={{ height: BAR_MAX + 72 }}>
          {(['Gold', 'Silver', 'Bronze'] as const).map(color => {
            const count = color === 'Gold' ? totalGold : color === 'Silver' ? totalSilver : totalBronze;
            const h     = barH(count);
            const t     = TINT[color];
            const empty = count === 0;

            return (
              <div key={color} className="flex flex-col items-center gap-2" style={{ minWidth: 72 }}>
                {/* Count number */}
                <span
                  className="font-mono font-black leading-none"
                  style={{ fontSize: 36, color: empty ? 'var(--muted)' : t.text, opacity: empty ? 0.35 : 1 }}
                >
                  {count}
                </span>

                {/* Proportional bar */}
                <div
                  style={{
                    width: 72,
                    height: `${h}px`,
                    background: empty ? 'var(--navy-light)' : BAR_GRADIENT[color],
                    opacity: empty ? 0.4 : 1,
                    transition: 'height 0.35s ease',
                  }}
                />

                {/* Label */}
                <span
                  className="font-mono text-xs tracking-[0.12em] uppercase"
                  style={{ color: empty ? 'var(--muted)' : t.text, opacity: empty ? 0.4 : 0.8 }}
                >
                  {color}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Medals Breakdown table ───────────────────────────────────────────── */}
      <div style={{ backgroundColor: 'var(--navy)' }}>

        {/* Table header */}
        <div
          className="grid items-center px-5 py-3"
          style={{
            gridTemplateColumns: '1fr 72px 72px 72px 56px 36px',
            borderBottom: '1px solid var(--navy-light)',
          }}
        >
          <span className="font-mono text-xs tracking-widest uppercase" style={{ color: 'var(--muted)' }}>
            Edition
          </span>
          {(['Gold', 'Silver', 'Bronze'] as const).map(color => (
            <div key={color} className="flex flex-col items-center gap-1">
              <MedalDot color={color} />
              <span className="font-mono text-xs tracking-widest uppercase" style={{ color: TINT[color].text }}>
                {color}
              </span>
            </div>
          ))}
          <span className="font-mono text-xs tracking-widest uppercase text-right" style={{ color: 'var(--muted)' }}>
            Total
          </span>
          <span /> {/* expand toggle column */}
        </div>

        {/* Edition rows */}
        {editions.map(([year, data]) => {
          const info      = WTG_EDITIONS[year];
          const rowTotal  = data.gold.length + data.silver.length + data.bronze.length;
          const isOpen    = expanded.has(year);

          return (
            <div key={year} style={{ borderBottom: '1px solid var(--navy-light)' }}>

              {/* Main row */}
              <div
                className="grid items-center px-5 py-4 cursor-pointer group"
                style={{ gridTemplateColumns: '1fr 72px 72px 72px 56px 36px' }}
                onClick={() => toggleRow(year)}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {/* Edition info */}
                <div>
                  <span className="font-mono font-bold text-sm" style={{ color: 'var(--ink)' }}>
                    WTG {year}
                  </span>
                  {info && (
                    <span className="ml-2 font-mono text-xs" style={{ color: 'var(--muted)' }}>
                      {info.city}, {info.country}
                    </span>
                  )}
                </div>

                {/* Gold cell */}
                <div
                  className="flex items-center justify-center py-2 mx-1"
                  style={{
                    backgroundColor: data.gold.length > 0 ? TINT.Gold.bg : 'transparent',
                    border: data.gold.length > 0 ? `1px solid ${TINT.Gold.border}` : '1px solid transparent',
                  }}
                >
                  <span
                    className="font-mono font-bold text-base"
                    style={{ color: data.gold.length > 0 ? TINT.Gold.text : 'var(--muted)', opacity: data.gold.length === 0 ? 0.3 : 1 }}
                  >
                    {data.gold.length}
                  </span>
                </div>

                {/* Silver cell */}
                <div
                  className="flex items-center justify-center py-2 mx-1"
                  style={{
                    backgroundColor: data.silver.length > 0 ? TINT.Silver.bg : 'transparent',
                    border: data.silver.length > 0 ? `1px solid ${TINT.Silver.border}` : '1px solid transparent',
                  }}
                >
                  <span
                    className="font-mono font-bold text-base"
                    style={{ color: data.silver.length > 0 ? TINT.Silver.text : 'var(--muted)', opacity: data.silver.length === 0 ? 0.3 : 1 }}
                  >
                    {data.silver.length}
                  </span>
                </div>

                {/* Bronze cell */}
                <div
                  className="flex items-center justify-center py-2 mx-1"
                  style={{
                    backgroundColor: data.bronze.length > 0 ? TINT.Bronze.bg : 'transparent',
                    border: data.bronze.length > 0 ? `1px solid ${TINT.Bronze.border}` : '1px solid transparent',
                  }}
                >
                  <span
                    className="font-mono font-bold text-base"
                    style={{ color: data.bronze.length > 0 ? TINT.Bronze.text : 'var(--muted)', opacity: data.bronze.length === 0 ? 0.3 : 1 }}
                  >
                    {data.bronze.length}
                  </span>
                </div>

                {/* Total */}
                <div className="text-right">
                  <span className="font-mono font-black text-base" style={{ color: 'var(--ink)' }}>
                    {rowTotal}
                  </span>
                </div>

                {/* Expand toggle */}
                <div className="flex items-center justify-center">
                  <div
                    className="w-6 h-6 flex items-center justify-center transition-colors"
                    style={{
                      border: '1px solid var(--navy-light)',
                      color: 'var(--muted)',
                    }}
                  >
                    {isOpen
                      ? <ChevronUp size={12} />
                      : <ChevronDown size={12} />
                    }
                  </div>
                </div>
              </div>

              {/* Expanded detail — individual events */}
              {isOpen && (
                <div
                  className="px-5 pb-4"
                  style={{ backgroundColor: 'rgba(255,255,255,0.015)', borderTop: '1px solid var(--navy-light)' }}
                >
                  <div className="space-y-0 mt-3">
                    {[
                      ...data.gold.map(m => ({ ...m, colorKey: 'Gold' as const })),
                      ...data.silver.map(m => ({ ...m, colorKey: 'Silver' as const })),
                      ...data.bronze.map(m => ({ ...m, colorKey: 'Bronze' as const })),
                    ].map((m, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-4 py-2.5 px-3"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      >
                        <MedalDot color={m.colorKey} />
                        <span className="text-sm flex-1" style={{ color: 'var(--ice)' }}>
                          {m.event}
                        </span>
                        <span
                          className="font-mono text-xs px-2 py-0.5 tracking-wider"
                          style={{
                            backgroundColor: TINT[m.colorKey].bg,
                            border: `1px solid ${TINT[m.colorKey].border}`,
                            color: TINT[m.colorKey].text,
                          }}
                        >
                          {m.colorKey.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Totals footer row */}
        <div
          className="grid items-center px-5 py-4"
          style={{
            gridTemplateColumns: '1fr 72px 72px 72px 56px 36px',
            borderTop: '2px solid var(--navy-light)',
            backgroundColor: 'var(--navy-mid)',
          }}
        >
          <span className="font-mono text-xs tracking-widest uppercase font-bold" style={{ color: 'var(--muted)' }}>
            All WTG Editions
          </span>
          <div className="flex items-center justify-center">
            <span className="font-mono font-black text-base" style={{ color: TINT.Gold.text }}>
              {totalGold}
            </span>
          </div>
          <div className="flex items-center justify-center">
            <span className="font-mono font-black text-base" style={{ color: TINT.Silver.text }}>
              {totalSilver}
            </span>
          </div>
          <div className="flex items-center justify-center">
            <span className="font-mono font-black text-base" style={{ color: TINT.Bronze.text }}>
              {totalBronze}
            </span>
          </div>
          <div className="text-right">
            <span className="font-mono font-black text-lg" style={{ color: 'var(--accent)' }}>
              {totalMedals}
            </span>
          </div>
          <span />
        </div>
      </div>

    </div>
  );
}
