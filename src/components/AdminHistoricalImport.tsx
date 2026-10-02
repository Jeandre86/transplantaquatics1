import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { supabase } from '../lib/supabase';

type SourceMeet = { meet_id: string; group: string; year: number; location?: string | null; course?: string | null };
type SourceResult = Record<string, unknown>;
type SourceSwimmer = { id: string; display_name: string; country?: string | null; country_code?: string | null; gender?: string | null; date_of_birth?: string | null; transplant_type?: string | null; results?: SourceResult[] };
type ExportData = { metadata?: Record<string, unknown>; swimmers?: SourceSwimmer[]; meets?: SourceMeet[]; relay_results?: unknown[]; summary?: Record<string, number> };
type Prepared = { profiles: Record<string, unknown>[]; meets: Record<string, unknown>[]; results: Record<string, unknown>[]; skipped: Record<string, number>; duplicatesRemoved: number; missing: Record<string, number>; medalCandidates: number; unparsedRows: number };
const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const placing = (value: unknown) => { const match = clean(value).match(/^\s*(\d+)/); return match ? Number(match[1]) : null; };
const validTime = (value: unknown, ms: unknown) => typeof ms === 'number' && Number.isFinite(ms) && ms > 0 && /^\d+(?::[0-5]\d)?(?:\.\d{1,2})?$/.test(clean(value));
const isFinal = (value: unknown) => /final/i.test(clean(value));
function prepare(data: ExportData): Prepared {
  const meets = (data.meets ?? []).map(meet => ({ source_meet_key: meet.meet_id, name: `${meet.group === 'WTG' ? 'World Transplant Games' : `${meet.group} Transplant Games`} ${meet.year}`, meet_year: meet.year, location: clean(meet.location) || null, course: clean(meet.course) || 'LCM', meet_date: null, is_world_transplant_games: meet.group === 'WTG' }));
  const profiles: Record<string, unknown>[] = [];
  const missing = { country: 0, gender: 0, transplant_type: 0 };
  const all: (SourceResult & { swimmer: SourceSwimmer })[] = [];
  const skipped = { non_ok: 0, relay: (data.relay_results ?? []).length, missing_time: 0, unsupported_meet: 0 };
  const knownMeets = new Map((data.meets ?? []).map(meet => [meet.meet_id, meet]));
  for (const swimmer of data.swimmers ?? []) {
    if (!clean(swimmer.country)) missing.country++;
    if (!clean(swimmer.gender)) missing.gender++;
    if (!clean(swimmer.transplant_type)) missing.transplant_type++;
    const parts = clean(swimmer.display_name).split(/\s+/).filter(Boolean);
    profiles.push({ source_key: swimmer.id, first_name: parts.slice(0, -1).join(' ') || parts[0] || 'Unknown', last_name: parts.length > 1 ? parts.at(-1) : 'Swimmer', country: clean(swimmer.country) || null, country_code: clean(swimmer.country_code) || null, gender: ['Men', 'Women'].includes(clean(swimmer.gender)) ? clean(swimmer.gender) : null, date_of_birth: clean(swimmer.date_of_birth) || null, transplant_type: clean(swimmer.transplant_type) || null });
    for (const result of swimmer.results ?? []) {
      if (result.is_relay) { skipped.relay++; continue; }
      if (clean(result.race_status) !== 'OK') { skipped.non_ok++; continue; }
      if (!validTime(result.time_original, result.time_ms)) { skipped.missing_time++; continue; }
      if (!knownMeets.has(clean(result.meet_id))) { skipped.unsupported_meet++; continue; }
      all.push({ ...result, swimmer });
    }
  }
  // One time per swimmer, meet, and event category. Prefer finals, then the
  // best placing, then the fastest valid time as agreed for this source set.
  const groups = new Map<string, typeof all>();
  for (const row of all) {
    const key = [row.swimmer.id, clean(row.meet_id), clean(row.event).toLowerCase(), clean(row.gender), clean(row.age_group), clean(row.course) || 'LCM'].join('|');
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const results: Record<string, unknown>[] = [];
  for (const rows of groups.values()) {
    rows.sort((a, b) => Number(isFinal(b.round)) - Number(isFinal(a.round)) || (placing(a.placing_original) ?? Infinity) - (placing(b.placing_original) ?? Infinity) || Number(a.time_ms) - Number(b.time_ms));
    const row = rows[0];
    const meet = knownMeets.get(clean(row.meet_id))!;
    const swimmer = row.swimmer;
    const pointsValue=clean(row.points_original);
    results.push({ swimmer_source_key: swimmer.id, meet_source_key: clean(row.meet_id), source_result_key: clean(row.id), swimmer_name: clean(row.swimmer_name_original) || clean(swimmer.display_name), country: clean(row.country) || clean(swimmer.country) || null, country_code: clean(row.country_code) || clean(swimmer.country_code) || null, gender: clean(row.gender) || clean(swimmer.gender) || null, transplant_type: clean(swimmer.transplant_type) || null, event: clean(row.event), time_original: clean(row.time_original), age_group: clean(row.age_group) || null, course: clean(row.course) || clean(meet.course) || 'LCM', placing: placing(row.placing_original), round_name: clean(row.round) || null, points: /^\d+$/.test(pointsValue) ? Number(pointsValue) : null, source_data: { source_references: row.source_references ?? [], source_event_category: row.category_original ?? null, time_ms: row.time_ms, points_original: row.points_original ?? null, imported_source_group: meet.group } });
  }
  const medalCandidates=results.filter(row=>row.source_data && (row.source_data as Record<string,unknown>).imported_source_group==='WTG' && Number(row.placing)>=1 && Number(row.placing)<=3).length;
  return { profiles, meets, results, skipped, duplicatesRemoved: all.length - results.length, missing, medalCandidates, unparsedRows: Array.isArray((data as Record<string,unknown>).unparsed_rows) ? ((data as Record<string,unknown>).unparsed_rows as unknown[]).length : 0 };
}

export default function AdminHistoricalImport({ cardStyle, onNotice, onError, onImported }: { cardStyle: React.CSSProperties; onNotice: (message: string) => void; onError: (message: string) => void; onImported: () => void }) {
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [history, setHistory] = useState<Record<string, unknown>[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const refreshHistory = useCallback(async (page = historyPage) => {
    if (!supabase) return;
    const from = page * 50;
    const { data, count, error } = await supabase.from('swimmer_results').select('id,swimmer_name,country,event,time,age_group,gender,course,placing,status,meet_id,source_result_key',{count:'exact'}).eq('status','imported_unverified').order('swimmer_name').range(from,from+49);
    if (error) { onError(error.message); return; }
    setHistory((data ?? []) as Record<string, unknown>[]); setHistoryCount(count ?? 0);
  }, [historyPage,onError]);
  useEffect(() => { void refreshHistory(); }, [refreshHistory]);
  const summary = useMemo(() => prepared ? Object.entries(prepared.skipped).map(([key, value]) => `${key.replaceAll('_',' ')}: ${value}`).join(' · ') : '', [prepared]);
  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as ExportData;
      if (!Array.isArray(parsed.swimmers) || !Array.isArray(parsed.meets)) throw new Error('This file is missing the swimmers or meets arrays.');
      setPrepared(prepare(parsed)); setFileName(file.name); onError('');
    } catch (error) { onError(error instanceof Error ? error.message : 'Could not read this JSON export.'); setPrepared(null); }
  };
  const importAll = async () => {
    if (!supabase || !prepared) return;
    setBusy(true); onError(''); onNotice('');
    try {
      setProgress('Saving meet records…');
      const meetResponse = await supabase.rpc('admin_import_historical_meets', { p_meets: prepared.meets });
      if (meetResponse.error) throw meetResponse.error;
      for (let start = 0; start < prepared.profiles.length; start += 60) {
        const end = Math.min(start + 60, prepared.profiles.length); setProgress(`Saving swimmer profiles ${end.toLocaleString()} / ${prepared.profiles.length.toLocaleString()}…`);
        const { error } = await supabase.rpc('admin_import_historical_swimmers', { p_swimmers: prepared.profiles.slice(start, end) }); if (error) throw error;
      }
      let imported = 0; let medalRows = 0;
      for (let start = 0; start < prepared.results.length; start += 80) {
        const end = Math.min(start + 80, prepared.results.length); setProgress(`Saving results ${end.toLocaleString()} / ${prepared.results.length.toLocaleString()}…`);
        const { data, error } = await supabase.rpc('admin_import_historical_results', { p_results: prepared.results.slice(start, end) }); if (error) throw error;
        imported += Number((data as { processed?: number } | null)?.processed ?? 0); medalRows += Number((data as { medals?: number } | null)?.medals ?? 0);
      }
      setProgress(''); onNotice(`Historical import completed. ${prepared.profiles.length.toLocaleString()} profiles processed; ${imported.toLocaleString()} unique results processed; ${medalRows.toLocaleString()} WTG medals recorded. ${prepared.duplicatesRemoved.toLocaleString()} duplicate rows excluded. Skips — ${summary}.`); setPrepared(null); setHistoryPage(0); await refreshHistory(0); onImported();
    } catch (error) { setProgress(''); onError(error instanceof Error ? error.message : 'Historical import failed. You can safely retry; source IDs make the operation repeatable.'); }
    finally { setBusy(false); }
  };
  return <section className="border p-5 sm:p-6" style={cardStyle}>
    <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">Bulk import · all meets</p><h2 className="mt-1 text-xl font-bold text-white">Import the historical swimmers archive</h2>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">This is a separate one-step bulk import; it does not use the single-meet selector below. Upload <code>swimmers.json</code> once to create unclaimed profiles, historical meet records, and eligible individual results as <strong className="text-white/80">imported and unverified</strong>. Missing details stay blank, non-OK swims and relays are excluded, unknown course defaults to LCM, and World Transplant Games places 1–3 are recorded as medal candidates.</p>
    <label className="mt-4 inline-flex cursor-pointer items-center border border-[var(--navy-light)] px-4 py-3 text-sm font-semibold text-white hover:border-[var(--accent)]">Choose swimmers.json<input type="file" accept="application/json,.json" className="sr-only" disabled={busy} onChange={event=>void onFile(event)} /></label>
    {prepared && <div className="mt-5 border border-[var(--navy-light)] bg-[var(--navy)] p-4"><p className="font-semibold text-white">Preview · {fileName}</p><div className="mt-3 grid gap-3 text-sm text-white/70 sm:grid-cols-2 lg:grid-cols-4"><p>{prepared.profiles.length.toLocaleString()} swimmer profiles<br/><span className="text-xs text-white/45">All start unclaimed</span></p><p>{prepared.meets.length} meet records<br/><span className="text-xs text-white/45">No artificial dates</span></p><p>{prepared.results.length.toLocaleString()} unique result rows<br/><span className="text-xs text-white/45">Unverified until reviewed</span></p><p>{prepared.medalCandidates.toLocaleString()} WTG medal candidates<br/><span className="text-xs text-white/45">Places 1–3 after deduplication</span></p></div><p className="mt-3 text-xs text-white/50">Skipped — {summary}. Relay rows: {prepared.skipped.relay}; unparsed source rows: {prepared.unparsedRows}. Missing profile details — {Object.entries(prepared.missing).map(([key,value])=>`${key.replaceAll('_',' ')} ${value}`).join(' · ')}. Duplicate resolution prefers a final round, then best place, then fastest time. Relay rows are excluded by policy.</p><button type="button" disabled={busy} onClick={()=>void importAll()} className="mt-4 bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--navy)] disabled:opacity-50">{busy ? progress || 'Importing…' : 'Import all historical data'}</button></div>}
    {progress && <p role="status" className="mt-3 text-sm text-[var(--accent)]">{progress}</p>}
    <div className="mt-6 border-t border-[var(--navy-light)] pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-white">Imported results awaiting review</h3><p className="mt-1 text-xs text-white/50">{historyCount.toLocaleString()} results are in the database as unverified. Review a page of 50 at a time.</p></div><div className="flex items-center gap-2"><button type="button" disabled={historyPage===0} onClick={()=>setHistoryPage(page=>Math.max(0,page-1))} className="border border-[var(--navy-light)] px-3 py-2 text-xs text-white disabled:opacity-40">Previous</button><span className="font-mono text-xs text-white/50">{historyCount ? historyPage+1 : 0} / {Math.max(1,Math.ceil(historyCount/50))}</span><button type="button" disabled={(historyPage+1)*50>=historyCount} onClick={()=>setHistoryPage(page=>page+1)} className="border border-[var(--navy-light)] px-3 py-2 text-xs text-white disabled:opacity-40">Next</button></div></div>
      {history.length>0&&<div className="ta-table-scroll mt-4"><table className="w-full text-left text-sm"><thead><tr className="border-b border-[var(--navy-light)] font-mono text-[10px] uppercase tracking-widest text-white/45">{['Swimmer','Event','Age','Gender','Course','Time','Place','Review'].map(label=><th key={label} className="whitespace-nowrap px-3 py-3">{label}</th>)}</tr></thead><tbody>{history.map(row=><tr key={String(row.id)} className="border-b border-[var(--navy-light)] last:border-0"><td className="whitespace-nowrap px-3 py-3 text-white">{String(row.swimmer_name)}<span className="block text-xs text-white/45">{String(row.country??'Country missing')}</span></td><td className="whitespace-nowrap px-3 py-3 text-white/75">{String(row.event)}</td><td className="px-3 py-3 text-white/60">{String(row.age_group??'—')}</td><td className="px-3 py-3 text-white/60">{String(row.gender??'—')}</td><td className="px-3 py-3 text-white/60">{String(row.course??'—')}</td><td className="whitespace-nowrap px-3 py-3 font-mono font-bold text-white">{String(row.time)}</td><td className="px-3 py-3 text-white/60">{String(row.placing??'—')}</td><td className="px-3 py-3 font-mono text-[10px] uppercase text-amber-200">{String(row.status).replaceAll('_',' ')}</td></tr>)}</tbody></table></div>}
    </div>
  </section>;
}
