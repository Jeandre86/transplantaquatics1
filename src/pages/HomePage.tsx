import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { athletes } from '../data/athletes';
import { articles } from '../data/articles';
import { rankings } from '../data/rankings';
import { latestRecords, records } from '../data/records';
import { TRANSPLANT_TYPES, type AgeGroup, type Course, type Event, type Gender } from '../types';
import { getFlagEmoji, getTransplantColor } from '../lib/utils';
import ArticleCard from '../components/ArticleCard';
import Eyebrow from '../components/Eyebrow';
import RankingFilters from '../components/RankingFilters';

const section = 'mx-auto w-full max-w-7xl px-4 py-16 sm:py-20';
const title = 'mt-3 text-3xl font-extrabold tracking-tight text-[var(--ink)] sm:text-4xl';

export default function HomePage() {
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('40-49');
  const [gender, setGender] = useState<Gender>('Men');
  const [event, setEvent] = useState<Event>('100m Freestyle');
  const [course, setCourse] = useState<Course>('LCM');
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const topRankings = rankings
    .filter(r => r.ageGroup === ageGroup && r.gender === gender && r.event === event && r.course === course)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 5);
  const featuredAthletes = athletes.slice(0, 4);
  const featuredRecords = latestRecords.slice(0, 4);
  const featuredArticles = articles.slice(0, 3);

  return (
    <div className="bg-[var(--paper)]">
      <section className="relative isolate flex min-h-[820px] items-center overflow-hidden bg-[var(--navy)]">
        <img src="/assets/aquatics-hero.png" alt="" className="absolute inset-0 -z-20 h-full w-full object-cover object-center opacity-40" />
        <div className="absolute inset-0 -z-10 bg-[rgba(7,26,43,0.85)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-30">
          {Array.from({ length: 7 }, (_, i) => <div key={i} className="absolute inset-y-0 border-l border-white/30" style={{ left: `${(i + 1) * 12.5}%` }} />)}
          <div className="absolute inset-y-0 left-1/2 border-l-2 border-[var(--lime)]/70" />
        </div>
        <div className="relative mx-auto w-full max-w-7xl px-4 py-24 sm:py-28 lg:py-36">
          <div className="max-w-3xl">
            <Eyebrow color="accent" onDark>World Transplant Aquatics</Eyebrow>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.06] tracking-tight text-white sm:text-5xl lg:text-7xl">
              The global home of transplant aquatic sport.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
              Measuring, verifying, and celebrating elite athletic achievements for transplant recipients worldwide. This is where performance lives.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/rankings" className="inline-flex items-center gap-2 rounded px-6 py-3.5 text-xs font-extrabold uppercase tracking-widest text-[var(--navy)] transition hover:bg-white sm:text-sm" style={{ background: 'var(--accent)' }}>
                Explore rankings <ArrowRight size={16} />
              </Link>
              <Link to="/submit" className="inline-flex items-center gap-2 rounded border border-white/70 px-6 py-3.5 text-xs font-extrabold uppercase tracking-widest text-white transition hover:bg-white/10 sm:text-sm">
                Submit timing <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute bottom-8 left-8 hidden font-mono text-[10px] leading-5 tracking-wider text-[var(--lime)]/35 sm:block">SPLIT 01 / 29.11<br />SPLIT 02 / 29.81<br />FINAL / 58.92</div>
        <div className="absolute right-8 top-8 hidden font-mono text-xs leading-6 tracking-wider text-[var(--lime)]/35 lg:block">
          <div>58.92</div><div>1:01.14</div><div>1:01.77</div><div>1:02.88</div>
        </div>
      </section>

      <section className="border-b border-[var(--border)] bg-[var(--navy)] text-white">
        <div className={`${section} !py-14`}>
          <Eyebrow color="accent" onDark>Global timings</Eyebrow>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">World Rankings</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/70 sm:text-base">The definitive master board for transplant aquatic disciplines. Explore verified performances across age groups, events, and courses.</p>
          <div className="mt-8 border border-white/15 bg-transparent p-4 sm:p-5">
          <RankingFilters dark ageGroup={ageGroup} gender={gender} event={event} course={course} onChange={({ ageGroup: ag, gender: g, event: ev, course: co }) => { setAgeGroup(ag as AgeGroup); setGender(g as Gender); setEvent(ev as Event); setCourse(co as Course); }} />
          </div>
          <div className="mt-5 overflow-x-auto rounded-lg border border-white/10">
            <div className="min-w-[600px]">
              <div className="flex items-center bg-[#0b233d] px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-[var(--accent)] sm:px-5">
                <span className="w-14">Rank</span><span className="min-w-0 flex-1 px-2">Athlete</span><span className="hidden w-20 sm:block">Country</span><span className="hidden w-40 md:block">Event</span><span className="w-24 text-right">Time</span>
              </div>
              {topRankings.length ? topRankings.map((r, i) => (
                <Link key={`${r.athleteId}-${r.rank}`} to={`/athletes/${r.athleteId}`} className={`flex items-center border-t border-white/10 px-4 py-4 transition hover:bg-white/5 sm:px-5 ${i % 2 ? 'bg-white/[0.025]' : ''}`}>
                  <span className="w-14 font-mono text-sm font-bold text-[var(--lime)]">#{r.rank}</span>
                  <span className="min-w-0 flex-1 truncate px-2 text-sm font-bold text-white">{r.athleteName}</span>
                  <span className="hidden w-20 text-sm text-white/70 sm:block">{getFlagEmoji(r.countryCode)} {r.countryCode}</span>
                  <span className="hidden w-40 text-sm text-white/70 md:block">{r.event}</span>
                  <span className="w-24 text-right font-mono text-sm font-bold text-white">{r.time}</span>
                </Link>
              )) : <p className="px-5 py-8 text-sm text-white/60">No rankings match these filters yet.</p>}
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:text-sm">
            <span className="text-white/50">Times shown are illustrative sample data.</span>
            <Link to="/rankings" className="inline-flex items-center gap-2 font-bold uppercase tracking-wider text-white hover:text-[var(--accent)]">View full leaderboards <ArrowRight size={15} /></Link>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className={section}>
          <Eyebrow color="blue">The athletes</Eyebrow>
          <h2 className={title}>Athletes making history</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">Meet the swimmers redefining performance and possibility after transplant.</p>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {featuredAthletes.map(a => (
              <Link key={a.id} to={`/athletes/${a.id}`} className="group border border-[var(--border)] bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg">
                <div className="flex items-start gap-4">
                  <div className="flex size-13 shrink-0 items-center justify-center bg-[var(--navy)] font-mono text-sm font-bold text-white">{a.firstName[0]}{a.lastName[0]}</div>
                  <div className="min-w-0"><h3 className="truncate font-bold text-[var(--ink)] group-hover:text-[var(--blue)]">{a.firstName} {a.lastName}</h3><p className="mt-1 text-sm text-[var(--muted)]">{getFlagEmoji(a.countryCode)} {a.country}</p><p className="mt-2 text-xs text-[var(--muted)]">{a.ageGroup} · {a.transplantType}</p></div>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"><span>View athlete profile</span><ArrowRight size={14} className="text-[var(--blue)]" /></div>
              </Link>
            ))}
          </div>
          <Link to="/athletes" className="mt-7 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--blue)]">All athletes <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="bg-[var(--paper)]">
        <div className={section}>
          <Eyebrow color="blue">Global achievements</Eyebrow>
          <h2 className={title}>Transplant World Records</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">The highest verified performances across transplant aquatics.</p>
          <div className="mt-9 grid gap-4 md:grid-cols-2">
            {featuredRecords.map(r => <Link key={r.id} to="/records" className="flex flex-col justify-between gap-5 border border-[var(--border)] bg-white p-5 transition hover:shadow-md sm:flex-row sm:items-center sm:p-6">
              <div><div className="mb-3 flex items-center gap-2"><span className="rounded bg-[var(--lime)] px-2 py-1 text-[10px] font-extrabold text-[var(--navy)]">WR</span><span className="text-xs font-bold uppercase tracking-widest text-[var(--blue)]">{r.course} · {r.ageGroup} · {r.category}</span></div><h3 className="font-extrabold text-[var(--ink)]">{r.event}</h3><p className="mt-1 text-sm text-[var(--muted)]">{r.athleteName} · {r.country}</p><p className="mt-2 text-xs text-[var(--muted)]">{r.meet}</p></div>
              <span className="shrink-0 font-mono text-2xl font-bold text-[var(--ink)] sm:text-3xl">{r.time}</span>
            </Link>)}
          </div>
          <Link to="/records" className="mt-7 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--blue)]">Explore all records <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[var(--navy)] text-white">
        <img src="/assets/aquatics-stats.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-[rgba(7,26,43,.72)]" />
        <div className={`${section} relative grid grid-cols-2 gap-8 text-center sm:grid-cols-4`}>
          {[["1,420+", 'Verified athletes'], ['54', 'Countries represented'], [String(records.length), 'WTG record performances'], ['0.001s', 'Timing precision']].map(([value, label]) => <div key={label}><p className="font-mono text-3xl font-bold text-[var(--accent)] sm:text-4xl">{value}</p><p className="mt-2 text-xs uppercase tracking-widest text-white/70 sm:text-sm">{label}</p></div>)}
          <p className="col-span-full -mt-2 text-center font-mono text-[10px] uppercase tracking-wider text-white/40">Illustrative platform statistics · sample values</p>
        </div>
      </section>

      <section className="bg-white">
        <div className={section}>
          <Eyebrow color="blue">Discovery</Eyebrow>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><h2 className="text-3xl font-extrabold tracking-tight text-[var(--ink)] sm:text-4xl">Fastest by transplant type</h2><span className="w-fit border border-[var(--border)] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">Discovery view · not an official ranking</span></div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">Explore leading performances from swimmers with similar transplant backgrounds.</p>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {TRANSPLANT_TYPES.map(type => { const fastest = rankings.find(r => r.transplantType === type); return <div key={type} className="border border-[var(--border)] bg-[var(--paper)] p-5"><div className="mb-3 flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ backgroundColor: getTransplantColor(type) }} /><span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">{type}</span></div>{fastest ? <><Link to={`/athletes/${fastest.athleteId}`} className="font-bold text-[var(--ink)] hover:text-[var(--blue)]">{fastest.athleteName}</Link><p className="mt-1 text-sm text-[var(--muted)]">{getFlagEmoji(fastest.countryCode)} {fastest.country}</p><div className="mt-3 flex flex-wrap items-baseline gap-2"><span className="font-mono text-2xl font-bold text-[var(--blue)]">{fastest.time}</span><span className="text-xs text-[var(--muted)]">{fastest.event} · {fastest.course}</span></div></> : <p className="text-sm text-[var(--muted)]">No data yet</p>}</div>; })}
          </div>
        </div>
      </section>

      <section className="bg-[var(--paper)]">
        <div className={section}>
          <Eyebrow color="blue">From the pool deck</Eyebrow>
          <h2 className={title}>Stories from the world of transplant swimming</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">The people, preparation, and progress behind the performances.</p>
          <div className="mt-9 grid gap-6 md:grid-cols-3">{featuredArticles.map(a => <ArticleCard key={a.id} article={a} />)}</div>
          <Link to="/from-the-pool-deck" className="mt-7 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--blue)]">Read all stories <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="bg-[var(--navy)] text-center text-white">
        <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-20">
          <p className="text-3xl font-extrabold tracking-tight sm:text-4xl">Different journeys. Same water.</p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">Join the network to submit official times, track performance, and take your place in the global transplant aquatics community.</p>
          <Link to="/join" className="mt-7 inline-flex items-center gap-2 rounded px-6 py-3.5 text-xs font-extrabold uppercase tracking-widest text-[var(--navy)] transition hover:bg-white sm:text-sm" style={{ background: 'var(--accent)' }}>Join the network <ArrowRight size={16} /></Link>
        </div>
      </section>

      <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top" className={`fixed bottom-6 right-6 z-40 flex size-10 items-center justify-center border border-[var(--border)] bg-white text-[var(--ink)] shadow-lg transition-opacity ${showBackToTop ? 'opacity-100' : 'pointer-events-none opacity-0'}`}><ArrowUp size={16} /></button>
    </div>
  );
}
