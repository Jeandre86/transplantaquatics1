import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePublishedArticles } from '../hooks/usePublishedArticles';
import { latestRecords } from '../data/records';
import { TRANSPLANT_TYPES, type Course, type Event, type Gender, type Ranking } from '../types';
import { getFlagEmoji, getTransplantColor, is25mEvent, timeToSeconds } from '../lib/utils';
import ArticleCard from '../components/ArticleCard';
import Eyebrow from '../components/Eyebrow';
import { useFastestByTransplantType } from '../hooks/useFastestByTransplantType';
import { loadDatabaseRankings } from '../lib/databaseRankings';
import { describeSupabaseError } from '../lib/supabase';
import { loadPublicSwimmerDirectory, type PublicSwimmerProfile } from '../lib/swimmerSubmissions';
import { Skeleton } from '../components/Skeleton';

const section = 'mx-auto w-full max-w-7xl px-4 py-16 sm:py-20';
const title = 'mt-3 text-3xl font-extrabold tracking-tight text-[var(--ink)] sm:text-4xl';
const HOME_EVENTS: Event[] = ['50m Freestyle', '100m Freestyle', '50m Backstroke', '100m Backstroke', '50m Breaststroke', '50m Butterfly', '200m Individual Medley'];

function AnimatedStat({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 1400;
    let frame = 0;
    let startedAt: number | null = null;
    const animate = (now: number) => {
      if (startedAt === null) startedAt = now;
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setCount(Math.round(value * eased));
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return <>{count.toLocaleString('en-US')}{suffix}</>;
}

export default function HomePage() {
  const { articles } = usePublishedArticles();
  const [gender, setGender] = useState<Gender>('Women');
  const [event, setEvent] = useState<Event>('50m Freestyle');
  const [course, setCourse] = useState<Course>('LCM');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [databaseRankings, setDatabaseRankings] = useState<Ranking[]>([]);
  const [rankingsLoading, setRankingsLoading] = useState(true);
  const [rankingsError, setRankingsError] = useState<string | null>(null);
  const [athleteProfiles, setAthleteProfiles] = useState<PublicSwimmerProfile[]>([]);
  const [athletesLoading, setAthletesLoading] = useState(true);
  const [athletesError, setAthletesError] = useState<string | null>(null);
  const { swims: fastestSwims, loading: fastestLoading, error: fastestError } = useFastestByTransplantType();

  useEffect(() => {
    let active = true;
    loadDatabaseRankings()
      .then(rows => { if (active) setDatabaseRankings(rows); })
      .catch(error => { if (active) setRankingsError(describeSupabaseError(error)); })
      .finally(() => { if (active) setRankingsLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    loadPublicSwimmerDirectory()
      .then(rows => { if (active) setAthleteProfiles(rows); })
      .catch(error => { if (active) setAthletesError(describeSupabaseError(error)); })
      .finally(() => { if (active) setAthletesLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const fastestEventSwims = databaseRankings
    .filter(r => r.gender === gender && r.event === event && r.course === course && !is25mEvent(r.event))
    .sort((a, b) => timeToSeconds(a.time) - timeToSeconds(b.time) || a.athleteName.localeCompare(b.athleteName));
  const fastestByAthlete = new Map<string, Ranking>();
  fastestEventSwims.forEach(swim => { if (!fastestByAthlete.has(swim.athleteId)) fastestByAthlete.set(swim.athleteId, swim); });
  const topRankings = [...fastestByAthlete.values()].slice(0, 5);
  const featuredAthletes = [...athleteProfiles].sort((a, b) => {
    const recordsA = latestRecords.filter(record => record.athleteName.toLowerCase() === `${a.first_name} ${a.last_name}`.toLowerCase()).length;
    const recordsB = latestRecords.filter(record => record.athleteName.toLowerCase() === `${b.first_name} ${b.last_name}`.toLowerCase()).length;
    return recordsB - recordsA || a.last_name.localeCompare(b.last_name);
  }).slice(0, 3);
  const countryCount = new Set(athleteProfiles.map(profile => profile.country_code).filter(Boolean)).size;
  const featuredRecords = [...latestRecords]
    .sort((a, b) => Number(is25mEvent(a.event)) - Number(is25mEvent(b.event)))
    .slice(0, 4);
  const featuredArticles = articles.slice(0, 3);

  return (
    <div className="flex flex-col bg-[var(--paper)]">
      <section className="order-1 relative isolate flex min-h-[calc(100svh-3.5rem)] items-center overflow-hidden bg-[var(--navy)]" style={{ backgroundImage: "linear-gradient(90deg, rgba(7, 26, 43, 0.94) 0%, rgba(7, 26, 43, 0.82) 52%, rgba(7, 26, 43, 0.45) 100%), url('/assets/aquatics-hero.png')", backgroundPosition: 'center', backgroundSize: 'cover' }}>
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-30">
          {Array.from({ length: 7 }, (_, i) => <div key={i} className="absolute inset-y-0 border-l border-white/30" style={{ left: `${(i + 1) * 12.5}%` }} />)}
          <div className="absolute inset-y-0 left-1/2 border-l-2 border-[var(--lime)]/70" />
        </div>
        <div aria-label="Race split times" className="absolute right-6 top-6 z-10 hidden font-mono text-right text-xs leading-6 tracking-wider text-[var(--lime)]/30 sm:block lg:right-8 lg:top-8">
          <div>58.92</div><div>1:01.14</div><div>1:01.77</div><div>1:02.88</div>
        </div>
        <div aria-label="Race splits" className="absolute bottom-6 left-6 z-10 hidden font-mono text-[10px] leading-5 tracking-wider text-[var(--lime)]/30 sm:block lg:bottom-8 lg:left-8">SPLIT 01 / 29.11<br />SPLIT 02 / 29.81<br />FINAL / 58.92</div>
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
      </section>

      <section className="order-3 border-b border-[var(--border)] bg-[var(--paper)] text-[var(--ink)]">
        <div className={`${section} !py-12`}>
          <div className="grid items-start gap-8 lg:grid-cols-[0.8fr_1.5fr] lg:gap-12">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">World rankings</h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--muted)]">The fastest verified swims this season. One row per athlete, ranked by time within a single event so every comparison is fair.</p>
              <Link to="/rankings" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-dark)] hover:underline">See full rankings <ArrowRight size={15} /></Link>
            </div>
            <div className="border border-[var(--border)] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor="home-ranking-event">Ranking event</label>
                  <select id="home-ranking-event" value={event} onChange={e => setEvent(e.target.value as Event)} className="max-w-full bg-transparent text-sm font-semibold text-[var(--ink)] focus:outline focus:outline-2 focus:outline-[var(--accent-dark)]">{HOME_EVENTS.map(item => <option key={item} value={item}>{item}</option>)}</select>
                  <label className="sr-only" htmlFor="home-ranking-course">Ranking course</label>
                  <select id="home-ranking-course" value={course} onChange={e => setCourse(e.target.value as Course)} className="bg-transparent text-xs text-[var(--muted)] focus:outline focus:outline-2 focus:outline-[var(--accent-dark)]"><option value="LCM">Long course</option><option value="SCM">Short course</option></select>
                </div>
                <div className="inline-flex border border-[var(--border)] p-0.5" aria-label="Ranking gender">
                  {(['Women', 'Men'] as const).map(value => <button key={value} type="button" onClick={() => setGender(value)} aria-pressed={gender === value} className={`px-3 py-1.5 text-xs font-semibold ${gender === value ? 'bg-[var(--navy)] text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>{value}</button>)}
                </div>
              </div>
              <div className="flex items-center gap-3 bg-[var(--navy)] px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-white/70"><span className="w-5">#</span><span className="min-w-0 flex-1">Athlete</span><span className="w-20">Age group</span><span className="w-16 text-right">Time</span></div>
              {rankingsLoading ? <div role="status" aria-label="Loading world rankings">{Array.from({ length: 5 }, (_, index) => <div key={index} className="flex items-center gap-3 border-t border-[var(--border)] px-4 py-3"><Skeleton className="h-4 w-5" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-12" /></div>)}</div>
                : rankingsError ? <p role="status" className="px-4 py-6 text-sm text-red-700">World rankings could not be loaded: {rankingsError}</p>
                  : topRankings.length ? topRankings.map((r, i) => <Link key={`${r.athleteId}-${r.rank}`} to={`/athletes/${r.athleteId}`} className={`flex items-center gap-3 border-t border-[var(--border)] px-4 py-3 transition hover:bg-[var(--ice)] ${i % 2 ? 'bg-[var(--paper)]' : 'bg-white'}`}>
                    <span className="w-5 font-mono text-sm font-bold text-[var(--accent-dark)]">{i + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--ink)]">{getFlagEmoji(r.countryCode)} {r.athleteName}<span className="ml-2 font-mono text-[10px] text-[var(--muted)]">{r.countryCode}</span></span><span className="w-20 text-xs text-[var(--muted)]">{r.ageGroup}</span><span className="w-16 text-right font-mono text-sm font-bold text-[var(--ink)]">{r.time}</span>
                  </Link>) : <p className="px-4 py-6 text-sm text-[var(--muted)]">No verified swims match this event yet.</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="order-5 bg-white">
        <div className={section}>
          <Eyebrow color="blue">The athletes</Eyebrow>
          <h2 className={title}>Athletes making history</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">Meet the swimmers redefining performance and possibility after transplant.</p>
          {athletesLoading ? <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading athletes">{Array.from({ length: 3 }, (_, index) => <div key={index} className="border border-[var(--border)] bg-white p-5"><div className="flex items-start gap-4"><Skeleton className="size-13 shrink-0" /><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-2/3" /></div></div></div>)}</div>
            : athletesError ? <p role="status" className="mt-8 border-t border-[var(--border)] py-6 text-sm text-red-700">Athlete profiles could not be loaded: {athletesError}</p>
            : featuredAthletes.length ? <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredAthletes.map(a => (
              <Link key={a.id} to={`/athletes/${a.id}`} className="group border border-[var(--border)] bg-white p-4 transition hover:border-[var(--accent-dark)]">
                <div className="flex items-center gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--ice)] font-mono text-xs font-bold text-[var(--navy)]">{a.first_name[0]}{a.last_name[0]}</div><div className="min-w-0"><h3 className="truncate text-sm font-bold text-[var(--ink)] group-hover:text-[var(--blue)]">{a.first_name} {a.last_name}</h3><p className="mt-1 truncate text-xs text-[var(--muted)]">{getFlagEmoji(a.country_code ?? '')} {a.country}</p></div></div>
                <p className="mt-3 border-b border-[var(--border)] pb-2 text-xs text-[var(--muted)]">{a.transplant_type} transplant{a.club_name ? ` · ${a.club_name}` : ''}</p>
                {(() => { const best = databaseRankings.filter(r => r.athleteId === a.id && !is25mEvent(r.event)).sort((x, y) => timeToSeconds(x.time) - timeToSeconds(y.time))[0]; const recordsCount = latestRecords.filter(record => record.athleteName.toLowerCase() === `${a.first_name} ${a.last_name}`.toLowerCase()).length; return <div className="flex items-end justify-between gap-2 pt-2"><span className="min-w-0"><span className="block text-[10px] text-[var(--muted)]">{best ? `Best · ${best.event}` : 'Best swim'}</span><span className="font-mono text-lg font-bold text-[var(--ink)]">{best?.time ?? '—'}</span></span><span className="shrink-0 text-right text-[10px] font-semibold text-[var(--accent-dark)]">{recordsCount} {recordsCount === 1 ? 'world record' : 'world records'}</span></div>; })()}
              </Link>
            ))}
          </div> : <p className="mt-8 border-t border-[var(--border)] py-6 text-sm text-[var(--muted)]">Athlete profiles will appear here as swimmers join and publish their profiles.</p>}
          <Link to="/athletes" className="mt-7 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--blue)]">All athletes <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="order-6 bg-[var(--paper)]">
        <div className={section}>
          <Eyebrow color="blue">Global achievements</Eyebrow>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-3xl font-extrabold tracking-tight text-[var(--ink)] sm:text-4xl">Latest world records</h2><p className="mt-2 text-sm text-[var(--muted)]">Set at the Dresden 2025 World Transplant Games.</p></div><Link to="/records" className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--accent-dark)] hover:underline">All {latestRecords.length} records <ArrowRight size={14} /></Link></div>
          <div className="mt-7 border-t border-[var(--border)]">
            {featuredRecords.map(r => <Link key={r.id} to="/records" className="grid gap-2 border-b border-[var(--border)] py-4 transition-colors hover:bg-white sm:grid-cols-[1.1fr_0.65fr_1.35fr_auto] sm:items-center sm:gap-5">
              <span><span className="block text-sm font-semibold text-[var(--ink)]">{r.event}</span><span className="mt-1 block text-xs text-[var(--muted)]">{r.gender} · {r.ageGroup}</span></span>
              <span className="text-xs text-[var(--muted)]">{r.meet}</span>
              <span className="flex items-center gap-2 text-xs font-semibold text-[var(--ink)]"><span>{getFlagEmoji(r.countryCode ?? '')}</span>{r.athleteName}</span>
              <span className="text-right font-mono text-xl font-bold text-[var(--ink)]">{r.time}</span>
            </Link>)}
          </div>
        </div>
      </section>

      <section className="order-2 ta-page-top relative isolate overflow-hidden border-y border-white/10 text-white" aria-label="Transplant Aquatics in numbers">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-70">
          {Array.from({ length: 7 }, (_, index) => <span key={index} className={`absolute inset-y-0 ${index === 3 ? 'border-l-2 border-[var(--lime)]/70' : 'border-l border-white/20'}`} style={{ left: `${(index + 1) * 12.5}%` }} />)}
        </div>
        <div className="relative mx-auto grid max-w-7xl grid-cols-2 px-4 py-8 sm:py-10 md:grid-cols-4">
          {[
            { value: athleteProfiles.length, suffix: '', label: 'Athletes' },
            { value: countryCount, suffix: '', label: 'Countries' },
            { value: latestRecords.length, suffix: '', label: 'World records' },
            { value: databaseRankings.length, suffix: '', label: 'Results' },
          ].map(stat => <div key={stat.label} className="relative z-10 flex flex-col items-center justify-center px-2 py-5 text-center sm:px-4">
            <p className="font-mono text-3xl font-black tracking-tight text-[var(--lime)] sm:text-4xl lg:text-5xl"><AnimatedStat value={stat.value} suffix={stat.suffix} /></p>
            <p className="mt-2 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--accent)] sm:text-[11px] sm:tracking-[0.16em]">{stat.label}</p>
          </div>)}
        </div>
      </section>


      <section className="order-4 bg-[var(--navy)] text-white">
        <div className={section}>
          <Eyebrow color="accent" onDark>Discovery</Eyebrow>
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.5fr] lg:gap-12">
            <div><h2 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">Fastest by transplant type</h2><p className="mt-4 max-w-md text-sm leading-relaxed text-white/65">See how swimmers with the same transplant compare. Everyone is measured in one event, so the times are a fair comparison.</p><p className="mt-5 border-l-2 border-[var(--accent)] pl-3 text-xs leading-relaxed text-white/55">For discovery only. This isn’t an official ranking, and only verified swims are included.</p><Link to="/rankings/transplant-type" className="mt-6 inline-flex items-center gap-2 bg-[var(--accent)] px-4 py-3 text-xs font-bold text-[var(--navy)] transition-colors hover:bg-white">Find your transplant ranking <ArrowRight size={15} /></Link></div>
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><span className="text-xs font-semibold text-white/80">{event} · {course === 'LCM' ? 'Long course' : 'Short course'}</span><span className="font-mono text-[9px] text-white/45">Fastest verified swimmer per type</span></div>
              <div className="divide-y divide-white/10 border-y border-white/10">
                {TRANSPLANT_TYPES.slice(0, 4).map(type => {
                  const swim = fastestSwims.filter(item => item.transplantType === type && item.event === event && item.course === course && item.status === 'verified').sort((a, b) => timeToSeconds(a.time) - timeToSeconds(b.time))[0];
                  const times = fastestSwims.filter(item => TRANSPLANT_TYPES.slice(0, 4).includes(item.transplantType as typeof TRANSPLANT_TYPES[number]) && item.event === event && item.course === course && item.status === 'verified').map(item => timeToSeconds(item.time)).filter(Number.isFinite);
                  const fastestTime = Math.min(...times, Number.POSITIVE_INFINITY);
                  const barWidth = swim && Number.isFinite(fastestTime) ? Math.max(12, fastestTime / timeToSeconds(swim.time) * 100) : 0;
                  return <div key={type} className="grid grid-cols-[10px_58px_minmax(0,1fr)_54px] items-center gap-2 py-3 sm:grid-cols-[10px_72px_minmax(0,1fr)_60px] sm:gap-3">
                    <span className="size-2 rounded-full" style={{ backgroundColor: getTransplantColor(type) }} />
                    <span className="text-xs font-semibold text-white/85">{type}</span>
                    {fastestLoading ? <div role="status" aria-label="Loading fastest swims"><Skeleton dark className="h-4 w-3/4" /></div> : fastestError ? <span className="text-xs text-white/55">Unable to load</span> : swim ? <div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><span className="shrink-0 text-xs">{getFlagEmoji(swim.countryCode)}</span><Link to={`/athletes/${swim.athleteId}`} className="truncate text-xs font-semibold text-white hover:underline">{swim.athleteName}</Link><span className="hidden text-[10px] text-white/45 sm:inline">{swim.gender} · {swim.ageGroup}</span></div><div className="mt-1.5 h-1 bg-white/10"><span className="block h-full" style={{ width: `${barWidth}%`, backgroundColor: getTransplantColor(type) }} /></div></div> : <span className="text-[10px] text-white/50">Awaiting first verified swim</span>}
                    <span className="text-right font-mono text-sm font-bold text-white">{swim?.time ?? '—'}</span>
                  </div>;
                })}
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-white/45">Awaiting a first verified swim: Pancreas, Bone marrow, Living donor. <Link to="/submit" className="text-[var(--accent)] hover:underline">Submit a result</Link></p>
              {fastestError && <p role="status" className="mt-2 text-xs text-red-200">Fastest swims could not be loaded: {fastestError}</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="order-7 bg-[var(--paper)]">
        <div className={section}>
          <Eyebrow color="blue">From the pool deck</Eyebrow>
          <h2 className={title}>Stories from the world of transplant swimming</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">The people, preparation, and progress behind the performances.</p>
          {featuredArticles.length ? <div className="mt-9 grid gap-6 md:grid-cols-3">{featuredArticles.map(a => <ArticleCard key={a.id} article={a} />)}</div> : <p className="mt-8 border-t border-[var(--border)] py-6 text-sm text-[var(--muted)]">No stories have been published yet.</p>}
          <Link to="/from-the-pool-deck" className="mt-7 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--blue)]">Read all stories <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="order-8 bg-[var(--navy)] text-center text-white">
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
