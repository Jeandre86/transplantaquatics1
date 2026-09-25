import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { latestRecords } from '../data/records';
import { getFlagEmoji } from '../lib/utils';
import Eyebrow from '../components/Eyebrow';

const speedLines = {
  backgroundImage:
    'repeating-linear-gradient(-55deg, transparent, transparent 18px, rgba(255,255,255,0.015) 18px, rgba(255,255,255,0.015) 19px)',
};

// Live countdown hook
function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState(() =>
    Math.max(0, targetDate.getTime() - Date.now()),
  );
  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(Math.max(0, targetDate.getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  const days = Math.floor(timeLeft / 86400000);
  const hrs = Math.floor((timeLeft % 86400000) / 3600000);
  const mins = Math.floor((timeLeft % 3600000) / 60000);
  const secs = Math.floor((timeLeft % 60000) / 1000);
  return { days, hrs, mins, secs };
}

// Mock medal table data — top 10 nations at World Transplant Games
const MEDAL_TABLE = [
  { rank: 1, country: 'Australia', code: 'AU', gold: 18, silver: 14, bronze: 12, total: 44 },
  { rank: 2, country: 'United Kingdom', code: 'GB', gold: 14, silver: 16, bronze: 13, total: 43 },
  { rank: 3, country: 'South Africa', code: 'ZA', gold: 12, silver: 9, bronze: 8, total: 29 },
  { rank: 4, country: 'France', code: 'FR', gold: 10, silver: 8, bronze: 7, total: 25 },
  { rank: 5, country: 'Germany', code: 'DE', gold: 9, silver: 11, bronze: 10, total: 30 },
  { rank: 6, country: 'United States', code: 'US', gold: 8, silver: 7, bronze: 9, total: 24 },
  { rank: 7, country: 'Netherlands', code: 'NL', gold: 7, silver: 8, bronze: 6, total: 21 },
  { rank: 8, country: 'Canada', code: 'CA', gold: 6, silver: 5, bronze: 7, total: 18 },
  { rank: 9, country: 'Brazil', code: 'BR', gold: 5, silver: 6, bronze: 5, total: 16 },
  { rank: 10, country: 'Japan', code: 'JP', gold: 4, silver: 5, bronze: 6, total: 15 },
];

// Past WTG editions
const PAST_GAMES = [
  {
    year: 2025,
    location: 'Dresden, Germany',
    swimmers: 312,
    nations: 29,
    records: 8,
    highlight: 'Eight world records. Michael van der Berg\'s 58.92s 100m Free.',
  },
  {
    year: 2023,
    location: 'Perth, Australia',
    swimmers: 274,
    nations: 26,
    records: 5,
    highlight: 'Record athlete turnout. Five world records broken.',
  },
  {
    year: 2019,
    location: 'Newcastle, United Kingdom',
    swimmers: 248,
    nations: 24,
    records: 6,
    highlight: 'Host nation UK top of the medal table. Camille Dupont\'s first WTG appearance.',
  },
  {
    year: 2017,
    location: 'Malaga, Spain',
    swimmers: 202,
    nations: 21,
    records: 4,
    highlight: 'First WTG in Spain. New records in backstroke and medley.',
  },
  {
    year: 2015,
    location: 'Innsbruck, Austria',
    swimmers: 178,
    nations: 18,
    records: 3,
    highlight: 'Landmark 40th anniversary of transplant sport. Hans Müller\'s first gold.',
  },
];

export default function WTGPage() {
  const WTG_DATE = new Date('2027-08-01T09:00:00');
  const { days, hrs, mins, secs } = useCountdown(WTG_DATE);

  const wtgRecords = latestRecords.slice(0, 5);

  return (
    <div style={{ backgroundColor: 'var(--navy)', minHeight: '100vh' }}>
      {/* Hero */}
      <section
        className="border-b relative overflow-hidden"
        style={{
          backgroundColor: 'var(--navy-mid)',
          borderColor: 'var(--navy-light)',
          ...speedLines,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-20 md:py-28">
          <Eyebrow color="accent" className="mb-4">The Games</Eyebrow>
          <h1
            className="display text-4xl md:text-6xl lg:text-7xl font-black uppercase leading-tight tracking-tight"
            style={{ color: 'var(--ink-on-dark)' }}
          >
            World Transplant<br />Games
          </h1>
          <p className="mt-5 text-lg md:text-xl max-w-2xl" style={{ color: 'var(--muted-on-dark)' }}>
            The pinnacle of transplant sport. Every two years, hundreds of recipients compete
            across swimming and other disciplines — celebrating life, resilience, and the gift of donation.
          </p>
        </div>
      </section>

      {/* Countdown to WTG 2027 */}
      <section
        className="border-b"
        style={{ backgroundColor: 'var(--navy-mid)', borderColor: 'var(--navy-light)' }}
      >
        <div className="max-w-7xl mx-auto px-4 py-14">
          <Eyebrow color="accent" className="mb-2">Next Games</Eyebrow>
          <h2 className="font-bold text-2xl md:text-3xl" style={{ color: 'var(--ink-on-dark)' }}>
            Leuven, Belgium — 1–8 August 2027
          </h2>

          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: days, label: 'Days' },
              { value: hrs, label: 'Hours' },
              { value: mins, label: 'Minutes' },
              { value: secs, label: 'Seconds' },
            ].map(unit => (
              <div
                key={unit.label}
                className="border text-center py-8 px-4"
                style={{ borderColor: 'var(--navy-light)', backgroundColor: 'var(--navy)' }}
              >
                <div
                  className="display font-black font-mono leading-none"
                  style={{ color: 'var(--accent)', fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}
                >
                  {String(unit.value).padStart(unit.label === 'Days' ? 3 : 2, '0')}
                </div>
                <div
                  className="mt-3 font-mono text-xs uppercase tracking-widest"
                  style={{ color: 'var(--muted-on-dark)' }}
                >
                  {unit.label}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
            Live countdown · World Transplant Games 2027 · Leuven, Belgium
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-12 space-y-16">

        {/* Medal table */}
        <section>
          <Eyebrow light className="mb-6">All-Time Medal Table</Eyebrow>
          <div
            className="border overflow-hidden"
            style={{ borderColor: 'var(--navy-light)' }}
          >
            {/* Table header */}
            <div
              className="grid text-left font-mono text-xs uppercase tracking-widest px-4 py-3 border-b"
              style={{
                backgroundColor: 'var(--navy-mid)',
                borderColor: 'var(--navy-light)',
                color: 'var(--muted-on-dark)',
                gridTemplateColumns: '2.5rem 1fr 3.5rem 3.5rem 3.5rem 3.5rem',
              }}
            >
              <span>#</span>
              <span>Nation</span>
              <span className="text-center">🥇</span>
              <span className="text-center">🥈</span>
              <span className="text-center">🥉</span>
              <span className="text-center">Total</span>
            </div>

            {MEDAL_TABLE.map((row, idx) => (
              <div
                key={row.code}
                className="grid items-center px-4 py-3.5 border-b last:border-b-0"
                style={{
                  borderColor: 'var(--navy-light)',
                  backgroundColor: idx === 0 ? 'rgba(199,243,104,0.04)' : 'transparent',
                  gridTemplateColumns: '2.5rem 1fr 3.5rem 3.5rem 3.5rem 3.5rem',
                }}
              >
                <span
                  className="font-mono text-sm font-bold"
                  style={{ color: idx < 3 ? 'var(--accent)' : 'var(--muted-on-dark)' }}
                >
                  {row.rank}
                </span>
                <span className="font-mono text-sm" style={{ color: 'var(--ink-on-dark)' }}>
                  {getFlagEmoji(row.code)} {row.country}
                </span>
                <span className="font-mono font-bold text-sm text-center" style={{ color: '#F5C542' }}>
                  {row.gold}
                </span>
                <span className="font-mono text-sm text-center" style={{ color: '#C0C0C0' }}>
                  {row.silver}
                </span>
                <span className="font-mono text-sm text-center" style={{ color: '#CD7F32' }}>
                  {row.bronze}
                </span>
                <span className="font-mono font-bold text-sm text-center" style={{ color: 'var(--ink-on-dark)' }}>
                  {row.total}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Records set at WTG */}
        <section>
          <Eyebrow light className="mb-6">World Records Set at WTG</Eyebrow>
          <div className="space-y-3">
            {wtgRecords.map(rec => (
              <div
                key={rec.id}
                className="border px-6 py-4 flex flex-wrap items-center justify-between gap-3"
                style={{
                  borderColor: 'rgba(199,243,104,0.25)',
                  backgroundColor: 'rgba(199,243,104,0.03)',
                }}
              >
                <div>
                  <div className="font-mono text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>
                    {rec.gender} · {rec.ageGroup} · {rec.course}
                  </div>
                  <div className="font-bold" style={{ color: 'var(--ink-on-dark)' }}>
                    {rec.event}
                  </div>
                  <div className="mt-1 font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
                    {getFlagEmoji(rec.country.slice(0, 2))} {rec.athleteName} · {rec.country} · {rec.meet}
                  </div>
                </div>
                <div className="font-mono font-black text-3xl" style={{ color: 'var(--accent)' }}>
                  {rec.time}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Link
              to="/records"
              className="font-mono text-xs uppercase tracking-widest"
              style={{ color: 'var(--accent)' }}
            >
              View all records →
            </Link>
          </div>
        </section>

        {/* Past games */}
        <section>
          <Eyebrow light className="mb-6">Past Games</Eyebrow>
          <div className="space-y-4">
            {PAST_GAMES.map(g => (
              <div
                key={g.year}
                className="border px-6 py-5"
                style={{ borderColor: 'var(--navy-light)', backgroundColor: 'var(--navy-mid)' }}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div
                      className="display font-black text-2xl md:text-3xl"
                      style={{ color: 'var(--ink-on-dark)' }}
                    >
                      WTG {g.year}
                    </div>
                    <div className="mt-1 font-mono text-sm" style={{ color: 'var(--muted-on-dark)' }}>
                      {g.location}
                    </div>
                  </div>
                  <div className="flex gap-6">
                    {[
                      { value: String(g.swimmers), label: 'Swimmers' },
                      { value: String(g.nations), label: 'Nations' },
                      { value: String(g.records), label: 'Records' },
                    ].map(stat => (
                      <div key={stat.label} className="text-center">
                        <div className="font-mono font-bold text-xl" style={{ color: 'var(--aqua)' }}>
                          {stat.value}
                        </div>
                        <div className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--muted-on-dark)' }}>
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--muted-on-dark)' }}>
                  {g.highlight}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
