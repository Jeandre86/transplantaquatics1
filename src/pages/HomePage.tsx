import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUp } from 'lucide-react';
import { rankings } from '../data/rankings';
import { athletes } from '../data/athletes';
import { articles } from '../data/articles';
import { TRANSPLANT_TYPES, type AgeGroup, type Gender, type Event, type Course } from '../types';
import RankingTable from '../components/RankingTable';
import RankingFilters from '../components/RankingFilters';
import AthleteCard from '../components/AthleteCard';
import ArticleCard from '../components/ArticleCard';
import StatBlock from '../components/StatBlock';
import Eyebrow from '../components/Eyebrow';
import { getFlagEmoji, getTransplantColor } from '../lib/utils';

// ── Dark hero lane motif ──────────────────────────────────────────────────────
function LaneHero() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Swim lanes */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0 border-r"
          style={{
            left: `${(i + 1) * 12.5}%`,
            borderColor: i === 3 ? 'rgba(199,243,104,0.25)' : 'rgba(255,255,255,0.06)',
            borderWidth: i === 3 ? '2px' : '1px',
          }}
        />
      ))}
      {/* Decorative timing numbers */}
      <div className="absolute top-8 right-8 font-mono text-xs" style={{ color: 'rgba(199,243,104,0.35)', letterSpacing: '0.1em' }}>
        <div>58.92</div>
        <div className="mt-1">1:01.14</div>
        <div className="mt-1">1:01.77</div>
        <div className="mt-1">1:02.88</div>
      </div>
      <div className="absolute bottom-10 left-8 font-mono text-xs" style={{ color: 'rgba(199,243,104,0.2)' }}>
        <div>SPLIT 01 / 29.11</div>
        <div className="mt-1">SPLIT 02 / 29.81</div>
        <div className="mt-1">FINAL / 58.92</div>
      </div>
      {/* Speed-slash pattern */}
      <div className="absolute inset-0 speed-lines opacity-40" />
    </div>
  );
}

export default function HomePage() {
  const [ageGroup, setAgeGroup]         = useState<AgeGroup>('40-49');
  const [gender, setGender]             = useState<Gender>('Men');
  const [event, setEvent]               = useState<Event>('100m Freestyle');
  const [course, setCourse]             = useState<Course>('LCM');
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    function onScroll() { setShowBackToTop(window.scrollY > 300); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const filtered = rankings
    .filter(r => r.ageGroup === ageGroup && r.gender === gender && r.event === event && r.course === course)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 5);

  const featuredAthletes = athletes.slice(0, 4);
  const featuredArticles = articles.slice(0, 3);

  return (
    <div style={{ backgroundColor: 'var(--paper)' }}>

      {/* ── HERO — dark navy ─────────────────────────────────────────────────── */}
      <section
        className="relative min-h-screen flex items-center overflow-hidden"
        style={{ backgroundColor: 'var(--navy)' }}
      >
        <LaneHero />
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-24 w-full">
          <Eyebrow color="accent" onDark>Global Transplant Swimming</Eyebrow>
          <h1
            className="mt-6 leading-none display"
            style={{ color: 'var(--ink-on-dark)', fontSize: 'clamp(2.8rem, 7vw, 6.5rem)' }}
          >
            Every Second<br />
            <span style={{ color: 'var(--accent)' }}>Counts.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed" style={{ color: 'rgba(232,248,250,0.65)' }}>
            The world platform for transplant swimming — athletes, results, rankings and records captured to 0.001s resolution.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              to="/rankings"
              className="inline-flex items-center gap-2 px-6 py-3 font-bold text-black text-sm uppercase tracking-wider transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--accent)', fontFamily: "'League Spartan', sans-serif" }}
            >
              Explore Rankings <ArrowRight size={16} />
            </Link>
            <Link
              to="/athletes"
              className="inline-flex items-center gap-2 px-6 py-3 font-bold text-sm uppercase tracking-wider border transition-colors hover:bg-white/10"
              style={{ color: 'var(--ink-on-dark)', borderColor: 'rgba(255,255,255,0.3)' }}
            >
              Find an Athlete
            </Link>
          </div>
        </div>
      </section>

      {/* ── STATS STRIP — light ice ──────────────────────────────────────────── */}
      <section style={{ backgroundColor: 'var(--ice)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatBlock value="12,482" label="Athletes" accent />
            <StatBlock value="86"     label="Countries" accent />
            <StatBlock value="142,390" label="Results" accent />
            <StatBlock value="68"     label="Records" accent />
          </div>
          <p className="mt-6 font-mono text-xs" style={{ color: 'var(--muted)' }}>
            Demo values — for illustrative purposes
          </p>
        </div>
      </section>

      {/* ── RANKINGS PREVIEW — white surface ─────────────────────────────────── */}
      <section style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <Eyebrow color="accent">The Numbers</Eyebrow>
              <h2 className="mt-3 display text-4xl md:text-5xl" style={{ color: 'var(--ink)' }}>World Rankings</h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
                Age Group → Gender → Event → Course. All transplant types compete together.
              </p>
            </div>
          </div>
          <RankingFilters
            ageGroup={ageGroup} gender={gender} event={event} course={course}
            onChange={({ ageGroup: ag, gender: g, event: ev, course: co }) => {
              setAgeGroup(ag); setGender(g); setEvent(ev); setCourse(co);
            }}
          />
          <div className="mt-6">
            <RankingTable rankings={filtered} showVerified={false} />
          </div>
          <div className="mt-8">
            <Link
              to="/rankings"
              className="inline-flex items-center gap-2 font-mono text-sm uppercase tracking-wider hover:opacity-80 transition-opacity"
              style={{ color: 'var(--blue)' }}
            >
              View all rankings <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FASTEST BY TRANSPLANT TYPE — paper ───────────────────────────────── */}
      <section style={{ backgroundColor: 'var(--paper)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <Eyebrow>Discovery</Eyebrow>
          <div className="mt-3 flex flex-col md:flex-row md:items-end md:justify-between gap-2">
            <h2 className="font-bold text-4xl md:text-5xl" style={{ color: 'var(--ink)' }}>
              Fastest by Transplant Type
            </h2>
            <span
              className="font-mono text-xs px-3 py-1 uppercase tracking-wider self-start md:self-auto"
              style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
            >
              Discovery view — not an official ranking
            </span>
          </div>
          <p className="mt-3 max-w-lg text-sm" style={{ color: 'var(--muted)' }}>
            Explore the fastest swimmers by transplant type. Useful for athletes who want to see where swimmers with similar transplant backgrounds are performing.
          </p>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TRANSPLANT_TYPES.map(type => (
              <div
                key={type}
                className="p-5 transition-colors group"
                style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--aqua)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getTransplantColor(type) }} />
                  <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{type}</span>
                </div>
                {(() => {
                  const fastest = rankings.find(r => r.transplantType === type);
                  if (!fastest) return <div className="text-sm" style={{ color: 'var(--muted)' }}>No data yet</div>;
                  return (
                    <>
                      <Link to={`/athletes/${fastest.athleteId}`} className="font-bold text-base leading-tight hover:underline" style={{ color: 'var(--ink)' }}>
                        {fastest.athleteName}
                      </Link>
                      <div className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{getFlagEmoji(fastest.countryCode)} {fastest.country}</div>
                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="font-mono text-2xl font-bold" style={{ color: 'var(--blue)' }}>{fastest.time}</span>
                        <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>{fastest.event} · {fastest.course}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED ATHLETES — ice tint ─────────────────────────────────────── */}
      <section style={{ backgroundColor: 'var(--ice)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <Eyebrow color="accent">The Athletes</Eyebrow>
          <h2 className="mt-3 display text-4xl md:text-5xl" style={{ color: 'var(--ink)' }}>Athletes making history.</h2>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredAthletes.map(a => (
              <AthleteCard key={a.id} athlete={a} />
            ))}
          </div>
          <div className="mt-8">
            <Link
              to="/athletes"
              className="inline-flex items-center gap-2 font-mono text-sm uppercase tracking-wider hover:opacity-80 transition-opacity"
              style={{ color: 'var(--blue)' }}
            >
              All athletes <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FROM THE POOL DECK — white ────────────────────────────────────────── */}
      <section style={{ backgroundColor: 'var(--surface)' }}>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <Eyebrow>From the Pool Deck</Eyebrow>
          <div className="mt-3 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <h2 className="font-bold text-4xl md:text-5xl" style={{ color: 'var(--ink)' }}>
              Stories from the world<br />of transplant swimming.
            </h2>
            <Link
              to="/from-the-pool-deck"
              className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider hover:opacity-70 transition-opacity self-start md:self-auto"
              style={{ color: 'var(--muted)' }}
            >
              Read all stories <ArrowRight size={12} />
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredArticles.map(a => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BAND — dark navy ──────────────────────────────────────────────── */}
      <section style={{ backgroundColor: 'var(--navy)' }}>
        <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="display text-3xl md:text-4xl" style={{ color: 'var(--ink-on-dark)' }}>
              Join the platform.
            </h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--muted-on-dark)' }}>
              Register your results, claim your profile, and be part of the world record.
            </p>
          </div>
          <Link
            to="/join"
            className="flex-shrink-0 inline-flex items-center gap-2 px-8 py-4 font-bold uppercase tracking-wider text-black transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'var(--accent)', fontFamily: "'League Spartan', sans-serif" }}
          >
            Get Started <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── BACK TO TOP ───────────────────────────────────────────────────────── */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Back to top"
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          width: '2.5rem',
          height: '2.5rem',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--ink)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          opacity: showBackToTop ? 1 : 0,
          pointerEvents: showBackToTop ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
          zIndex: 40,
          boxShadow: '0 2px 8px rgba(7,26,43,0.12)',
        }}
      >
        <ArrowUp size={16} />
      </button>
    </div>
  );
}
