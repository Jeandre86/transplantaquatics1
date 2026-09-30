import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, ClipboardList, FileUp, Pencil, RotateCcw } from 'lucide-react';
import EmptyState from './EmptyState';
import { describeSupabaseError, supabase } from '../lib/supabase';

export type AdminMeet = { id: string; catalog_key: string; category: string; category_order: number; series_id: string; series_name: string; name: string; year: number; edition_number: number | null; host_city: string | null; host_country: string | null; meet_date: string | null; end_date: string | null; status: string; source_url: string | null };
type MeetForm = Omit<AdminMeet, 'id' | 'category_order'>;
type OfficialResult = { id: string; batch_id: string; swimmer_name: string; country: string | null; event: string; age_group: string | null; gender: string | null; course: string | null; time_original: string | null; placing: string | null; race_status: string; is_relay: boolean; round_name: string | null; published_at: string };
type SubmittedResult = { id: string; swimmer_name: string; country: string; gender: string; transplant_type: string; event: string; time: string; age_group: string; points: number | null; status: string; record_candidate: boolean; created_at: string };
type Batch = { id: string; file_name: string | null; status: string; created_at: string; stage_count: number; published_count: number };
const blankMeet: MeetForm = { catalog_key: '', category: 'National Transplant Games', series_id: '', series_name: '', name: '', year: new Date().getFullYear(), edition_number: null, host_city: '', host_country: '', meet_date: '', end_date: '', status: 'upcoming', source_url: '' };
function slugify(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function AdminMeetsManager({ meets, cardStyle, inputClass, onError, onNotice, onRefresh, onAddResults, onOpenBatch }: {
  meets: AdminMeet[]; cardStyle: React.CSSProperties; inputClass: string; onError: (value: string) => void; onNotice: (value: string) => void;
  onRefresh: () => void; onAddResults: (meetId: string) => void; onOpenBatch: (batchId: string) => void;
}) {
  const [form, setForm] = useState<MeetForm>(blankMeet);
  const [editingId, setEditingId] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedMeet, setSelectedMeet] = useState<AdminMeet | null>(null);
  const [officialRows, setOfficialRows] = useState<OfficialResult[]>([]);
  const [submittedRows, setSubmittedRows] = useState<SubmittedResult[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => meets.filter(meet => (categoryFilter === 'all' || meet.category === categoryFilter) && `${meet.name} ${meet.series_name} ${meet.host_city ?? ''} ${meet.host_country ?? ''} ${meet.year}`.toLowerCase().includes(search.toLowerCase())), [meets, search, categoryFilter]);
  const set = <K extends keyof MeetForm>(key: K, value: MeetForm[K]) => setForm(current => ({ ...current, [key]: value }));
  const reset = () => { setEditingId(''); setForm(blankMeet); };

  const editMeet = (meet: AdminMeet) => {
    setEditingId(meet.id);
    setForm({ catalog_key: meet.catalog_key, category: meet.category, series_id: meet.series_id, series_name: meet.series_name, name: meet.name, year: meet.year, edition_number: meet.edition_number, host_city: meet.host_city ?? '', host_country: meet.host_country ?? '', meet_date: meet.meet_date ?? '', end_date: meet.end_date ?? '', status: meet.status, source_url: meet.source_url ?? '' });
  };

  const saveMeet = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    const seriesId = slugify(form.series_id || form.series_name);
    const key = form.catalog_key || `${seriesId}:edition:${form.year}`;
    setBusy(true); onError(''); onNotice('');
    try {
      const { error } = await supabase.rpc('admin_save_meet', {
        p_meet_id: editingId || null, p_catalog_key: key, p_category: form.category, p_series_id: seriesId,
        p_series_name: form.series_name, p_name: form.name, p_year: Number(form.year), p_edition_number: form.edition_number,
        p_host_city: form.host_city || null, p_host_country: form.host_country || null, p_meet_date: form.meet_date || null,
        p_end_date: form.end_date || null, p_status: form.status, p_source_url: form.source_url || null,
      });
      if (error) throw error;
      onNotice(editingId ? 'Meet updated.' : 'Meet added to the public calendar.');
      reset(); onRefresh();
    } catch (reason) { onError(describeSupabaseError(reason)); }
    finally { setBusy(false); }
  };

  const manageResults = useCallback(async (meet: AdminMeet) => {
    if (!supabase) return;
    setSelectedMeet(meet); setResultsLoading(true); setOfficialRows([]); setSubmittedRows([]); setBatches([]); onError('');
    try {
      const [officialResponse, submittedMeetResponse, batchResponse] = await Promise.all([
        supabase.from('imported_official_performances').select('id,batch_id,swimmer_name,country,event,age_group,gender,course,time_original,placing,race_status,is_relay,round_name,published_at').eq('meet_catalog_id', meet.id).order('published_at', { ascending: false }).limit(2000),
        supabase.from('submitted_meets').select('id').eq('catalog_meet_id', meet.id),
        supabase.from('admin_import_batches').select('id,file_name,status,created_at,stage_count,published_count').eq('meet_catalog_id', meet.id).order('created_at', { ascending: false }).limit(100),
      ]);
      if (officialResponse.error) throw officialResponse.error;
      if (submittedMeetResponse.error) throw submittedMeetResponse.error;
      if (batchResponse.error) throw batchResponse.error;
      setOfficialRows((officialResponse.data ?? []) as OfficialResult[]);
      setBatches((batchResponse.data ?? []) as Batch[]);
      const submittedMeetIds = (submittedMeetResponse.data ?? []).map(row => row.id);
      if (submittedMeetIds.length) {
        const { data, error } = await supabase.from('swimmer_results').select('id,swimmer_name,country,gender,transplant_type,event,time,age_group,points,status,record_candidate,created_at').in('meet_id', submittedMeetIds).order('created_at', { ascending: false }).limit(2000);
        if (error) throw error;
        setSubmittedRows((data ?? []) as SubmittedResult[]);
      }
    } catch (reason) { onError(describeSupabaseError(reason)); }
    finally { setResultsLoading(false); }
  }, [onError]);

  useEffect(() => {
    if (selectedMeet) {
      const current = meets.find(meet => meet.id === selectedMeet.id);
      if (current) setSelectedMeet(current);
    }
  }, [meets, selectedMeet]);

  const setResultStatus = async (result: SubmittedResult, status: 'verified' | 'rejected' | 'swimmer_submitted') => {
    if (!supabase || !selectedMeet) return;
    setBusy(true); onError(''); onNotice('');
    try {
      const { error } = await supabase.rpc('admin_set_submitted_result_status', { p_result_id: result.id, p_status: status, p_note: null });
      if (error) throw error;
      onNotice(`Result marked ${status.replaceAll('_', ' ')}.`);
      await manageResults(selectedMeet);
    } catch (reason) { onError(describeSupabaseError(reason)); }
    finally { setBusy(false); }
  };

  return <div className="space-y-6">
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(290px,0.72fr)_minmax(0,1.28fr)]">
      <form onSubmit={event => void saveMeet(event)} className="border p-5 sm:p-6" style={cardStyle}>
        <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">Meet catalogue</p><h2 className="mt-1 text-lg font-bold text-white">{editingId ? 'Edit meet' : 'Add a meet'}</h2></div>{editingId && <button type="button" onClick={reset} className="text-xs text-white/55 hover:text-white">Cancel edit</button>}</div>
        <div className="mt-5 space-y-3">
          <label className="block text-xs font-semibold text-white/70">Category<select value={form.category} onChange={event => set('category', event.target.value)} className={`${inputClass} mt-1.5`}><option>World Transplant Games</option><option>National Transplant Games</option></select></label>
          <label className="block text-xs font-semibold text-white/70">Meet name<input required value={form.name} onChange={event => set('name', event.target.value)} className={`${inputClass} mt-1.5`} placeholder="e.g. World Transplant Games 2027" /></label>
          <div className="grid grid-cols-2 gap-3"><label className="block text-xs font-semibold text-white/70">Series name<input required value={form.series_name} onChange={event => set('series_name', event.target.value)} className={`${inputClass} mt-1.5`} placeholder="Transplant Games" /></label><label className="block text-xs font-semibold text-white/70">Series ID<input value={form.series_id} onChange={event => set('series_id', event.target.value)} className={`${inputClass} mt-1.5 font-mono text-xs`} placeholder="Generated from series" /></label></div>
          <div className="grid grid-cols-2 gap-3"><label className="block text-xs font-semibold text-white/70">Year<input required type="number" min="1900" max="2200" value={form.year} onChange={event => set('year', Number(event.target.value))} className={`${inputClass} mt-1.5`} /></label><label className="block text-xs font-semibold text-white/70">Edition number<input type="number" min="1" value={form.edition_number ?? ''} onChange={event => set('edition_number', event.target.value ? Number(event.target.value) : null)} className={`${inputClass} mt-1.5`} placeholder="Optional" /></label></div>
          <div className="grid grid-cols-2 gap-3"><label className="block text-xs font-semibold text-white/70">Host city<input value={form.host_city ?? ''} onChange={event => set('host_city', event.target.value)} className={`${inputClass} mt-1.5`} /></label><label className="block text-xs font-semibold text-white/70">Host country<input value={form.host_country ?? ''} onChange={event => set('host_country', event.target.value)} className={`${inputClass} mt-1.5`} /></label></div>
          <div className="grid grid-cols-2 gap-3"><label className="block text-xs font-semibold text-white/70">Start date<input type="date" value={form.meet_date ?? ''} onChange={event => set('meet_date', event.target.value)} className={`${inputClass} mt-1.5`} /></label><label className="block text-xs font-semibold text-white/70">End date<input type="date" min={form.meet_date ?? undefined} value={form.end_date ?? ''} onChange={event => set('end_date', event.target.value)} className={`${inputClass} mt-1.5`} /></label></div>
          <label className="block text-xs font-semibold text-white/70">Status<select value={form.status} onChange={event => set('status', event.target.value)} className={`${inputClass} mt-1.5`}>{['upcoming','in_progress','completed','date_unconfirmed','cancelled'].map(status => <option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></label>
          <label className="block text-xs font-semibold text-white/70">Official source URL<input type="url" value={form.source_url ?? ''} onChange={event => set('source_url', event.target.value)} className={`${inputClass} mt-1.5`} placeholder="https://…" /></label>
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--navy)] disabled:opacity-40"><CalendarPlus size={15} />{busy ? 'Saving…' : editingId ? 'Save meet' : 'Add meet'}</button>
        </div>
      </form>
      <section className="border p-5 sm:p-6" style={cardStyle}>
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">Calendar entries</p><h2 className="mt-1 text-lg font-bold text-white">Meets</h2><p className="mt-1 text-sm text-white/50">Manage event details or open results for a meet.</p></div><span className="font-mono text-xs text-white/45">{filtered.length} meets</span></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]"><input aria-label="Search meets" value={search} onChange={event => setSearch(event.target.value)} className={inputClass} placeholder="Search meet, city or country" /><select aria-label="Filter meet category" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className={inputClass}><option value="all">All categories</option><option>World Transplant Games</option><option>National Transplant Games</option></select></div>
        {filtered.length ? <div className="mt-4 divide-y divide-[var(--navy-light)]">{filtered.map(meet => <article key={meet.id} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-2"><div className="min-w-0"><p className="font-semibold text-white">{meet.name}</p><p className="mt-1 text-xs text-white/50">{meet.category} · {meet.host_city || 'City not set'}{meet.host_country ? `, ${meet.host_country}` : ''} · {meet.year}</p><p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-white/40">{meet.status.replaceAll('_',' ')} · {meet.meet_date ?? 'Dates TBC'}{meet.end_date ? ` – ${meet.end_date}` : ''}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => editMeet(meet)} className="inline-flex items-center gap-1.5 border border-[var(--navy-light)] px-3 py-2 text-xs text-white/70 hover:text-[var(--accent)]"><Pencil size={13} /> Edit</button><button type="button" onClick={() => void manageResults(meet)} className="inline-flex items-center gap-1.5 border border-[var(--navy-light)] px-3 py-2 text-xs text-white/70 hover:text-[var(--accent)]"><ClipboardList size={13} /> Results</button><button type="button" onClick={() => onAddResults(meet.id)} className="inline-flex items-center gap-1.5 border border-[var(--accent)]/40 px-3 py-2 text-xs text-[var(--accent)] hover:border-[var(--accent)]"><FileUp size={13} /> Add results</button></div></article>)}</div> : <div className="mt-5"><EmptyState title="No meets found" subtitle={meets.length ? 'Try another search or category.' : 'Add your first meet to start building the calendar.'} onDark /></div>}
        <LinkCalendar />
      </section>
    </div>

    {selectedMeet && <section className="border p-5 sm:p-6" style={cardStyle}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">Meet results</p><h2 className="mt-1 text-xl font-bold text-white">{selectedMeet.name}</h2><p className="mt-1 text-sm text-white/50">Official results are sourced through reviewed import batches. Swimmer-submitted results can be verified or rejected here.</p></div><button type="button" onClick={() => setSelectedMeet(null)} className="text-sm text-white/55 hover:text-white">Close results</button></div>
      {resultsLoading ? <p className="py-10 text-center text-sm text-white/50">Loading results…</p> : <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
        <div className="border border-[var(--navy-light)] p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-bold text-white">Official imported results</h3><span className="font-mono text-xs text-white/45">{officialRows.length}</span></div>
          {batches.length > 0 && <div className="mt-3 space-y-2">{batches.map(batch => <div key={batch.id} className="flex flex-wrap items-center justify-between gap-2 border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2"><span className="min-w-0"><span className="block truncate text-xs text-white">{batch.file_name || 'Results import'}</span><span className="mt-1 block font-mono text-[9px] uppercase text-white/40">{batch.status} · {batch.stage_count} rows</span></span><button type="button" onClick={() => onOpenBatch(batch.id)} className="text-xs font-bold text-[var(--accent)]">Manage batch →</button></div>)}</div>}
          {officialRows.length ? <div className="mt-4 max-h-[520px] overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-[var(--navy-mid)] text-[9px] uppercase tracking-widest text-white/45"><tr>{['Swimmer','Event','Time','Age','Gender','Course','Place','Round'].map(label => <th key={label} className="px-2 py-2">{label}</th>)}</tr></thead><tbody>{officialRows.map(row => <tr key={row.id} className="border-t border-[var(--navy-light)]"><td className="px-2 py-2 text-white">{row.swimmer_name}<span className="block text-white/40">{row.country ?? '—'}</span></td><td className="px-2 py-2 text-white/75">{row.event}</td><td className="px-2 py-2 font-mono text-[var(--accent)]">{row.time_original ?? row.race_status}</td><td className="px-2 py-2 text-white/65">{row.age_group ?? '—'}</td><td className="px-2 py-2 text-white/65">{row.gender ?? '—'}</td><td className="px-2 py-2 text-white/65">{row.course ?? '—'}</td><td className="px-2 py-2 text-white/65">{row.placing ?? '—'}</td><td className="px-2 py-2 text-white/65">{row.round_name ?? '—'}</td></tr>)}</tbody></table></div> : <div className="mt-4"><EmptyState title="No official results yet" subtitle="Use Add results to import, review and publish this meet’s results." onDark /></div>}
        </div>
        <div className="border border-[var(--navy-light)] p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-bold text-white">Swimmer-submitted results</h3><span className="font-mono text-xs text-white/45">{submittedRows.length}</span></div>
          {submittedRows.length ? <div className="mt-4 max-h-[520px] space-y-2 overflow-auto">{submittedRows.map(result => <article key={result.id} className="border border-[var(--navy-light)] bg-[var(--navy)] p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-white">{result.swimmer_name} <span className="font-normal text-white/45">· {result.country}</span></p><p className="mt-1 text-xs text-[var(--accent)]">{result.event} · {result.age_group} · {result.gender}</p><p className="mt-1 font-mono text-xs text-white/70">{result.time} · {result.points ?? 'No points'} pts · {result.transplant_type}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-white/40">{result.status.replaceAll('_',' ')}{result.record_candidate ? ' · record candidate' : ''}</p></div><div className="flex flex-wrap gap-2">{result.status !== 'verified' && <button type="button" disabled={busy} onClick={() => void setResultStatus(result,'verified')} className="border border-emerald-400/35 px-2.5 py-2 text-xs text-emerald-200 disabled:opacity-40">Verify</button>}{result.status !== 'rejected' && <button type="button" disabled={busy} onClick={() => void setResultStatus(result,'rejected')} className="border border-red-300/30 px-2.5 py-2 text-xs text-red-200 disabled:opacity-40">Reject</button>}{result.status !== 'swimmer_submitted' && <button type="button" disabled={busy} onClick={() => void setResultStatus(result,'swimmer_submitted')} title="Return this result to pending verification" className="inline-flex items-center gap-1 border border-[var(--navy-light)] px-2.5 py-2 text-xs text-white/60 disabled:opacity-40"><RotateCcw size={12} /> Reset</button>}</div></div></article>)}</div> : <div className="mt-4"><EmptyState title="No swimmer-submitted results" subtitle="Results submitted for this meet will appear here." onDark /></div>}
        </div>
      </div>}
    </section>}
  </div>;
}

function LinkCalendar() {
  return <p className="mt-4 text-xs text-white/45">New meet entries appear on the public calendar when saved.</p>;
}
