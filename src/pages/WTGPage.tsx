import { Link } from 'react-router-dom';
import { latestRecords } from '../data/records';
import { getFlagEmoji } from '../lib/utils';
import Eyebrow from '../components/Eyebrow';

export default function WTGPage() {
  const wtgRecords = latestRecords.slice(0, 5);

  return (
    <div style={{ backgroundColor: 'var(--navy)', minHeight: '100vh' }}>
      {/* Hero */}
      <section
        className="ta-page-top border-b relative overflow-hidden"
        style={{
          borderColor: 'var(--navy-light)',
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

      {/* Next Games */}
      <section
        className="border-b"
        style={{ backgroundColor: 'var(--navy-mid)', borderColor: 'var(--navy-light)' }}
      >
        <div className="max-w-7xl mx-auto px-4 py-14">
          <Eyebrow color="accent" className="mb-2">Next Games</Eyebrow>
          <h2 className="font-bold text-2xl md:text-3xl" style={{ color: 'var(--ink-on-dark)' }}>
            Leuven, Belgium · 2027
          </h2>
          <p className="mt-3 font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>Dates to be confirmed</p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-12 space-y-16">

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

      </div>
    </div>
  );
}
