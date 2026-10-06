import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CircleAlert, Plus, Trash2, Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { COURSES, EVENTS, type Course } from '../types';
import { getCompetitionAgeGroup, getSubmissionPoints, getWorldRecordBaseline } from '../lib/competitionAge';
import { loadMeetCatalog, type MeetCatalogEdition } from '../lib/meetCatalog';
import { findOrCreateSubmittedMeet, findSubmittedMeet, loadManagedSwimmers, loadMeetResults, saveSwimmerResult, type SubmittedMeetDraft, type SubmittedSwimmerResult, type SwimmerProfile } from '../lib/swimmerSubmissions';
import { Skeleton } from '../components/Skeleton';

type Step = 1 | 2 | 3;
interface MeetForm {
  catalogMeetId: string | null;
  name: string;
  meetDate: string;
  location: string;
  course: Course;
  isWorldTransplantGames: boolean;
  openingCeremonyDate: string;
}
interface EventEntry { id: string; event: string; time: string }

const JUNIOR_EVENTS = ['25m Freestyle', '25m Backstroke', '25m Breaststroke', '25m Butterfly'];
const RESULT_EVENTS = [...JUNIOR_EVENTS, ...EVENTS];
const newEntry = (): EventEntry => ({ id: crypto.randomUUID(), event: '', time: '' });
const TIME_PATTERN = /^\d{1,2}:\d{2}\.\d{1,2}$|^\d{1,3}\.\d{1,2}$/;

function seconds(time: string): number {
  const parts = time.split(':').map(Number);
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
}

function missingDatabaseMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/swimmer_profiles|submitted_meets|swimmer_results|schema cache|relation .* does not exist/i.test(message)) {
    return 'The result-submission tables are not set up in Supabase yet. Run the meet submission migration in supabase/migrations/20260930100000_create_meet_submissions.sql.';
  }
  return message || 'We could not save your submission. Please try again.';
}

export default function SubmitResultPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [meet, setMeet] = useState<MeetForm>({ catalogMeetId: null, name: '', meetDate: '', location: '', course: 'LCM', isWorldTransplantGames: false, openingCeremonyDate: '' });
  const [meetCatalog, setMeetCatalog] = useState<MeetCatalogEdition[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [swimmers, setSwimmers] = useState<SwimmerProfile[]>([]);
  const [swimmerId, setSwimmerId] = useState('');
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [entries, setEntries] = useState<EventEntry[]>([newEntry()]);
  const [existingResults, setExistingResults] = useState<SubmittedSwimmerResult[]>([]);
  const [savedResults, setSavedResults] = useState<SubmittedSwimmerResult[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!auth.isLoading && !auth.isLoggedIn) navigate('/login', { replace: true });
  }, [auth.isLoading, auth.isLoggedIn, navigate]);

  useEffect(() => {
    let cancelled = false;
    loadManagedSwimmers().then(data => {
      if (!cancelled) {
        setSwimmers(data);
        setSwimmerId(current => current || data.find(profile => profile.isAccountHolder)?.id || data[0]?.id || '');
      }
    }).catch(reason => { if (!cancelled) setError(missingDatabaseMessage(reason)); })
      .finally(() => { if (!cancelled) setProfilesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadMeetCatalog().then(rows => {
      if (!cancelled) setMeetCatalog(rows);
    }).catch(() => {
      if (!cancelled) setCatalogError('The official meet directory could not be loaded. You can still enter a meet manually.');
    }).finally(() => {
      if (!cancelled) setCatalogLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const selectedSwimmer = useMemo(() => swimmers.find(swimmer => swimmer.id === swimmerId), [swimmers, swimmerId]);
  const selectedCatalogMeet = useMemo(() => meetCatalog.find(entry => entry.id === meet.catalogMeetId) ?? null, [meetCatalog, meet.catalogMeetId]);
  const isCatalogWorldTransplantGames = (entry: MeetCatalogEdition) => entry.series_id === 'world-transplant-games-summer' || entry.series_id === 'world-transplant-games-winter';
  const selectCatalogMeet = (catalogMeetId: string) => {
    const selected = meetCatalog.find(entry => entry.id === catalogMeetId);
    if (!selected) {
      setMeet(current => ({ ...current, catalogMeetId: null, name: '', meetDate: '', location: '', isWorldTransplantGames: false, openingCeremonyDate: '' }));
      return;
    }
    const isWorldTransplantGames = isCatalogWorldTransplantGames(selected);
    const location = [selected.host_city, selected.host_country].filter(Boolean).join(', ');
    setMeet(current => ({
      ...current,
      catalogMeetId: selected.id,
      name: selected.name,
      meetDate: selected.meet_date ?? '',
      location,
      isWorldTransplantGames,
      openingCeremonyDate: isWorldTransplantGames ? selected.meet_date ?? '' : '',
    }));
  };
  const currentMeetDraft = (): SubmittedMeetDraft => ({
    catalogMeetId: meet.catalogMeetId,
    name: meet.name,
    meetDate: meet.meetDate,
    location: meet.location,
    course: meet.course,
    isWorldTransplantGames: meet.isWorldTransplantGames,
    openingCeremonyDate: meet.isWorldTransplantGames ? meet.openingCeremonyDate : null,
  });
  const eventSelectionsAreUnique = new Set(entries.filter(entry => entry.event).map(entry => entry.event)).size === entries.filter(entry => entry.event).length;
  const entriesAreValid = entries.length > 0 && eventSelectionsAreUnique && entries.every(entry => entry.event && TIME_PATTERN.test(entry.time.trim()));
  const meetIsValid = Boolean(meet.name.trim() && meet.meetDate && meet.location.trim() && meet.course && (!meet.isWorldTransplantGames || meet.openingCeremonyDate));
  const wtgClubValid = !meet.isWorldTransplantGames || Boolean(selectedSwimmer?.clubId || selectedSwimmer?.clubRequestPending);
  const existingByEvent = useMemo(() => new Map(existingResults.map(result => [result.event, result])), [existingResults]);

  const continueToEvents = async () => {
    setError('');
    if (!meetIsValid || !selectedSwimmer) return;
    if (!wtgClubValid) {
      setError('A swimmer must belong to a club to compete at the World Transplant Games. Select a listed club or submit a club request under Profile → Account → My swimmers.');
      return;
    }
    setLoadingExisting(true);
    try {
      const matchingMeetId = await findSubmittedMeet(currentMeetDraft());
      const prior = matchingMeetId ? await loadMeetResults(matchingMeetId, selectedSwimmer.id) : [];
      setExistingResults(prior);
      setEntries([newEntry()]);
      setStep(2);
    } catch (reason) {
      setError(missingDatabaseMessage(reason));
    } finally { setLoadingExisting(false); }
  };

  const updateEntry = (id: string, change: Partial<EventEntry>) => setEntries(current => current.map(entry => {
    if (entry.id !== id) return entry;
    const next = { ...entry, ...change };
    if (change.event) {
      const prior = existingByEvent.get(change.event);
      if (prior) next.time = prior.time;
    }
    return next;
  }));

  const submitResults = async () => {
    if (!selectedSwimmer || !entriesAreValid) return;
    setSaving(true);
    setError('');
    try {
      const meetId = await findOrCreateSubmittedMeet(currentMeetDraft());
      const ageReferenceDate = meet.isWorldTransplantGames ? meet.openingCeremonyDate : meet.meetDate;
      const ageGroup = getCompetitionAgeGroup(selectedSwimmer.dateOfBirth, ageReferenceDate);
      if (!ageGroup) throw new Error('We could not calculate the swimmer’s age group for this meet. Check their date of birth and the meet date.');

      const saved = await Promise.all(entries.map(entry => {
        const recordTime = getWorldRecordBaseline(ageGroup, selectedSwimmer.gender, entry.event, meet.course);
        const recordCandidate = Boolean(meet.isWorldTransplantGames && recordTime && seconds(entry.time) < recordTime);
        return saveSwimmerResult({
          meetId,
          swimmer: selectedSwimmer,
          event: entry.event,
          time: entry.time,
          ageGroup,
          points: getSubmissionPoints({ ageGroup, gender: selectedSwimmer.gender, event: entry.event, course: meet.course, time: entry.time }),
          recordCandidate,
        });
      }));
      setSavedResults(saved);
      setStep(3);
    } catch (reason) {
      setError(missingDatabaseMessage(reason));
    } finally { setSaving(false); }
  };

  if (auth.isLoading || !auth.isLoggedIn) return null;

  return <main className="min-h-[70vh] bg-[var(--paper)]">
    <section className="ta-page-top text-white">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent)]">My results</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Submit a result</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">Add a meet once, then record one time for each event your swimmer competed in. Results appear as swimmer-submitted as soon as you submit.</p>
      </div>
    </section>

    <div className="mx-auto max-w-4xl space-y-5 px-4 py-7 sm:px-6 sm:py-9">
      {step < 3 && <div className="flex items-center gap-3 text-xs font-semibold text-[var(--muted)]"><span className={`flex size-7 items-center justify-center ${step === 1 ? 'bg-[var(--navy)] text-white' : 'bg-[var(--accent)] text-[var(--navy)]'}`}>1</span><span>Meet & swimmer</span><span className="h-px flex-1 bg-[var(--border)]" /><span className={`flex size-7 items-center justify-center ${step === 2 ? 'bg-[var(--navy)] text-white' : 'bg-white text-[var(--muted)]'}`}>2</span><span>Events & times</span></div>}

      {error && <p role="alert" className="flex items-start gap-2 border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800"><CircleAlert size={17} className="mt-0.5 shrink-0" />{error}</p>}

      {step === 1 && <section className="space-y-6 bg-white p-5 sm:p-7">
        <div><h2 className="text-xl font-bold text-[var(--ink)]">Meet details</h2><p className="mt-1 text-sm text-[var(--muted)]">These details are saved once and shared by all event times from this meet.</p></div>
        <div>
          <label htmlFor="meet-catalog-select" className="text-xs font-semibold text-[var(--muted)]">Choose an official Games edition <span className="font-normal">(optional)</span></label>
          <select id="meet-catalog-select" value={meet.catalogMeetId ?? ''} onChange={event => selectCatalogMeet(event.target.value)} disabled={catalogLoading} className="mt-1.5 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)] disabled:opacity-60">
            <option value="">Other meet — enter details manually</option>
            {(['World Transplant Games', 'National Transplant Games'] as const).map(category => {
              const editions = meetCatalog.filter(entry => entry.category === category);
              return editions.length ? <optgroup key={category} label={category}>{editions.map(entry => <option key={entry.id} value={entry.id}>{entry.name}{entry.host_city ? ` — ${entry.host_city}${entry.host_country ? `, ${entry.host_country}` : ''}` : entry.host_country ? ` — ${entry.host_country}` : ''}{entry.status === 'date_unconfirmed' ? ' · dates to be confirmed' : ''}</option>)}</optgroup> : null;
            })}
          </select>
          {catalogLoading && <p className="mt-1 text-xs text-[var(--muted)]">Loading official Games…</p>}
          {catalogError && <p role="status" className="mt-1 text-xs text-amber-800">{catalogError}</p>}
          {selectedCatalogMeet?.end_date && <p className="mt-1 text-xs text-[var(--muted)]">Games edition: {selectedCatalogMeet.meet_date} to {selectedCatalogMeet.end_date}{selectedCatalogMeet.source_url ? <> · <a href={selectedCatalogMeet.source_url} target="_blank" rel="noreferrer" className="text-[var(--blue)] underline">Official source</a></> : null}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-[var(--muted)] sm:col-span-2">Meet name<input required readOnly={Boolean(selectedCatalogMeet)} value={meet.name} onChange={event => setMeet(current => ({ ...current, name: event.target.value }))} placeholder="e.g. National Swimming Championships" className="mt-1.5 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)] read-only:text-[var(--muted)]" /></label>
          <label className="text-xs font-semibold text-[var(--muted)]">Meet date<input required type="date" readOnly={Boolean(selectedCatalogMeet?.meet_date)} value={meet.meetDate} onChange={event => setMeet(current => ({ ...current, meetDate: event.target.value, openingCeremonyDate: current.isWorldTransplantGames && !current.openingCeremonyDate ? event.target.value : current.openingCeremonyDate }))} className="mt-1.5 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)] read-only:text-[var(--muted)]" /></label>
          <label className="text-xs font-semibold text-[var(--muted)]">Course<select value={meet.course} onChange={event => setMeet(current => ({ ...current, course: event.target.value as Course }))} className="mt-1.5 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)]">{COURSES.map(course => <option key={course} value={course}>{course}</option>)}</select></label>
          <label className="text-xs font-semibold text-[var(--muted)] sm:col-span-2">Location<input required readOnly={Boolean(selectedCatalogMeet && meet.location)} value={meet.location} onChange={event => setMeet(current => ({ ...current, location: event.target.value }))} placeholder="City, country" className="mt-1.5 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)] read-only:text-[var(--muted)]" /></label>
          {!selectedCatalogMeet && <label className="flex cursor-pointer items-start gap-3 border border-[var(--border)] p-3 sm:col-span-2">
            <input type="checkbox" checked={meet.isWorldTransplantGames} onChange={event => setMeet(current => ({ ...current, isWorldTransplantGames: event.target.checked, openingCeremonyDate: event.target.checked ? current.openingCeremonyDate || current.meetDate : '' }))} className="mt-0.5 size-4 accent-[var(--blue)]" />
            <span><span className="block text-sm font-semibold text-[var(--ink)]">This is a World Transplant Games meet</span><span className="mt-0.5 block text-xs leading-relaxed text-[var(--muted)]">Only WTG results can be marked as world-record candidates.</span></span>
          </label>}
          {selectedCatalogMeet && <div className="border border-[var(--border)] p-3 sm:col-span-2"><p className="text-sm font-semibold text-[var(--ink)]">{selectedCatalogMeet.category}</p><p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">This result will be linked to the official Games edition in the meet directory.</p></div>}
          {meet.isWorldTransplantGames && <label className="text-xs font-semibold text-[var(--muted)] sm:col-span-2">Opening Ceremony date <span className="font-normal">(used to calculate age group)</span><input required type="date" value={meet.openingCeremonyDate} onChange={event => setMeet(current => ({ ...current, openingCeremonyDate: event.target.value }))} className="mt-1.5 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)]" /></label>}
        </div>

        <div className="border-t border-[var(--border)] pt-5">
          <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-bold text-[var(--ink)]">Swimmer</h3><p className="mt-1 text-xs text-[var(--muted)]">Choose yourself or a child/dependent managed by your account.</p></div><Link to="/profile" className="text-xs font-semibold text-[var(--blue)] hover:underline">Manage swimmers</Link></div>
          {profilesLoading ? <div role="status" aria-label="Loading swimmer profiles" className="max-w-xl space-y-2 py-3"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-11 w-full" /></div> : swimmers.length ? <>
            <select value={swimmerId} onChange={event => setSwimmerId(event.target.value)} className="w-full max-w-xl border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)]">{swimmers.map(swimmer => <option key={swimmer.id} value={swimmer.id}>{swimmer.firstName} {swimmer.lastName}{swimmer.isAccountHolder ? ' (me)' : ''}</option>)}</select>
            {meet.isWorldTransplantGames && selectedSwimmer && !selectedSwimmer.clubId && !selectedSwimmer.clubRequestPending && <p role="alert" className="mt-3 max-w-xl border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900">WTG participation requires a club. Select a listed club or submit a club request under Profile → Account → My swimmers. <Link to="/profile" className="font-semibold underline">Manage swimmer profiles</Link></p>}
            {meet.isWorldTransplantGames && selectedSwimmer?.clubRequestPending && <p role="status" className="mt-2 max-w-xl border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900">Club request pending review. These results will be submitted under {selectedSwimmer.clubName} while the request is reviewed.</p>}
            {meet.isWorldTransplantGames && selectedSwimmer?.clubId && <p className="mt-2 text-xs text-[var(--muted)]">Representing {selectedSwimmer.clubName || 'their current club'} at this World Transplant Games meet.</p>}
            {!meet.isWorldTransplantGames && selectedSwimmer?.clubName && <p className="mt-2 text-xs text-[var(--muted)]">Current club: {selectedSwimmer.clubName}. Country representation remains {selectedSwimmer.country}.</p>}
          </> : <div className="border-l-2 border-[var(--accent)] bg-[var(--paper)] p-4"><p className="text-sm font-semibold text-[var(--ink)]">Add a swimmer profile first</p><p className="mt-1 text-sm text-[var(--muted)]">Add your own or a child’s profile in Profile → Account → My swimmers. Date of birth is kept private.</p><Link to="/profile" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--blue)]">Open Profile <ArrowRight size={14} /></Link></div>}
        </div>

        <button type="button" onClick={() => void continueToEvents()} disabled={!meetIsValid || !selectedSwimmer || !wtgClubValid || loadingExisting || profilesLoading} className="inline-flex w-full items-center justify-center gap-2 bg-[var(--navy)] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-50">{loadingExisting ? 'Checking existing results…' : 'Continue to events'} <ArrowRight size={16} /></button>
      </section>}

      {step === 2 && selectedSwimmer && <section className="space-y-6 bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-[var(--ink)]">Events and times</h2><p className="mt-1 text-sm text-[var(--muted)]">{selectedSwimmer.firstName} {selectedSwimmer.lastName} · {meet.name} · {meet.course}</p></div><button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--blue)]"><ArrowLeft size={14} /> Edit meet</button></div>

        {existingResults.length > 0 && <div className="border-l-2 border-[var(--blue)] bg-[var(--ice)] px-4 py-3 text-sm text-[var(--ink)]"><strong>Existing meet results found.</strong> Choose an event below to review and edit its saved time. Saving updates that result instead of creating a duplicate.</div>}

        <div className="space-y-4">
          {entries.map(entry => {
            const prior = existingByEvent.get(entry.event);
            const duplicateInForm = entries.some(other => other.id !== entry.id && other.event === entry.event);
            return <div key={entry.id} className="grid gap-3 border-b border-[var(--border)] pb-4 sm:grid-cols-[minmax(0,1fr)_200px_auto] sm:items-end">
              <label className="text-xs font-semibold text-[var(--muted)]">Event<select required value={entry.event} onChange={event => updateEntry(entry.id, { event: event.target.value })} className="mt-1.5 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)]"><option value="">Select an event</option>{RESULT_EVENTS.map(option => <option key={option} value={option} disabled={entries.some(other => other.id !== entry.id && other.event === option)}>{option}</option>)}</select>{duplicateInForm && <span className="mt-1 block text-xs text-red-700">This event is already in the list.</span>}{prior && <span className="mt-1 block text-xs font-medium text-[var(--blue)]">A time is already saved: {prior.time}. Edit it below if this is the correct event.</span>}</label>
              <label className="text-xs font-semibold text-[var(--muted)]">Time<input required value={entry.time} onChange={event => updateEntry(entry.id, { time: event.target.value })} placeholder="e.g. 58.42 or 1:02.44" className="mt-1.5 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 font-mono text-sm text-[var(--ink)]" />{entry.time && !TIME_PATTERN.test(entry.time.trim()) && <span className="mt-1 block text-xs text-red-700">Use seconds (58.42) or minutes:seconds (1:02.44).</span>}</label>
              <button type="button" disabled={entries.length === 1} onClick={() => setEntries(current => current.filter(item => item.id !== entry.id))} aria-label="Remove event" className="inline-flex h-10 items-center justify-center border border-[var(--border)] px-3 text-[var(--muted)] hover:border-red-300 hover:text-red-700 disabled:opacity-30"><Trash2 size={15} /></button>
            </div>;
          })}
        </div>

        <button type="button" onClick={() => setEntries(current => [...current, newEntry()])} disabled={entries.length >= RESULT_EVENTS.length} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--blue)] hover:underline disabled:opacity-40"><Plus size={16} /> Add another event</button>

        <div className="border-t border-[var(--border)] pt-5"><p className="text-xs leading-relaxed text-[var(--muted)]">PTS use the 2026 World Aquatics base time for each event, gender, and course. Junior 25m events use the matching World Transplant Games age-group record when available. Dates of birth remain private. Results display as swimmer-submitted, and WTG record candidates remain pending verification.</p></div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button type="button" onClick={() => setStep(1)} className="inline-flex items-center justify-center gap-2 border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--paper)]"><ArrowLeft size={15} /> Back</button><button type="button" onClick={() => void submitResults()} disabled={!entriesAreValid || saving} className="inline-flex items-center justify-center gap-2 px-0 py-3 text-sm font-semibold text-[var(--blue)] transition-colors hover:text-[var(--accent-dark)] disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving results…' : `Submit ${entries.length} ${entries.length === 1 ? 'result' : 'results'}`} <ArrowRight size={16} /></button></div>
      </section>}

      {step === 3 && <section className="bg-white p-5 sm:p-7">
        <div className="mx-auto max-w-2xl text-center"><span className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--ice)] text-[var(--blue)]"><Check size={25} /></span><p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-[var(--blue)]">Saved</p><h2 className="mt-2 text-2xl font-extrabold text-[var(--ink)]">Results submitted</h2><p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">Your results now appear as swimmer-submitted. A result faster than a WTG record is marked as a record candidate until verified.</p></div>
        <div className="mx-auto mt-6 max-w-3xl divide-y divide-[var(--border)] border-y border-[var(--border)]">{savedResults.map(result => <div key={result.id} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"><div><p className="font-semibold text-[var(--ink)]">{result.event}</p><p className="mt-0.5 text-xs text-[var(--muted)]">{result.age_group} · {meet.course} · {result.status === 'verified' ? 'Verified' : 'Swimmer-submitted'}</p></div><span className="font-mono text-lg font-bold text-[var(--blue)]">{result.time}</span><div className="flex flex-wrap items-center gap-2">{result.points !== null && <span className="bg-[var(--ice)] px-2 py-1 font-mono text-xs font-bold text-[var(--navy)]">{result.points.toLocaleString()} PTS</span>}{result.record_candidate && <span className="inline-flex items-center gap-1 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800"><Trophy size={13} /> Record candidate · pending verification</span>}{result.points === null && <span className="text-xs text-[var(--muted)]">PTS unavailable for this category</span>}</div></div>)}</div>
        <div className="mt-6 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => navigate('/')} className="border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--paper)]">Back to dashboard</button><button type="button" onClick={() => { setStep(1); setMeet({ catalogMeetId: null, name: '', meetDate: '', location: '', course: 'LCM', isWorldTransplantGames: false, openingCeremonyDate: '' }); setEntries([newEntry()]); setExistingResults([]); setSavedResults([]); setError(''); }} className="bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--blue)]">Submit another meet</button></div>
      </section>}
    </div>
  </main>;
}
