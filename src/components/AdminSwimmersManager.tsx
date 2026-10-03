import { useMemo, useState } from 'react';
import { Download, Pencil, Search, Trash2, Upload, X } from 'lucide-react';
import { describeSupabaseError, supabase } from '../lib/supabase';
import { countries } from '../data/countries';
import EmptyState from './EmptyState';

type Swimmer = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  country: string | null;
  country_code: string | null;
  gender: string | null;
  transplant_type: string | null;
  club_name: string | null;
  account_id: string | null;
  is_claimed: boolean;
  source_key: string | null;
  source_keys: string[];
  identity_review_required: boolean;
};

type ArchiveProfile = { id: string; source_key_aliases?: string[]; result_count?: number; identity_review_required?: boolean };
type ArchiveFile = {
  swimmers?: ArchiveProfile[];
  identity_review?: Array<{ swimmer_ids?: string[]; [key: string]: unknown }>;
  summary?: Record<string, number>;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

const fieldClass = 'w-full border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';

export default function AdminSwimmersManager({ swimmers, canManage, onChanged }: { swimmers: Record<string, unknown>[]; canManage: boolean; onChanged: () => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('All');
  const [genderFilter, setGenderFilter] = useState('All');
  const [transplantFilter, setTransplantFilter] = useState('All');
  const [accountFilter, setAccountFilter] = useState('All');
  const [editing, setEditing] = useState<Swimmer | null>(null);
  const [draft, setDraft] = useState({ first_name: '', last_name: '', date_of_birth: '', country: '', country_code: '', gender: '', transplant_type: '' });
  const [deleting, setDeleting] = useState<Swimmer | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkConfirmation, setBulkConfirmation] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmation, setConfirmation] = useState('');
  const [archive, setArchive] = useState<ArchiveFile | null>(null);
  const [archiveName, setArchiveName] = useState('');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const rows = swimmers as unknown as Swimmer[];
  const countriesInList = useMemo(() => [...new Set(rows.map(swimmer => swimmer.country?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b)), [rows]);
  const transplantTypesInList = useMemo(() => [...new Set(rows.map(swimmer => swimmer.transplant_type?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b)), [rows]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter(swimmer => {
      const matchesSearch = !needle || [swimmer.first_name, swimmer.last_name, swimmer.country, swimmer.country_code, swimmer.gender, swimmer.transplant_type, swimmer.club_name, swimmer.source_key, ...(swimmer.source_keys ?? [])].some(value => String(value ?? '').toLowerCase().includes(needle));
      const isClaimed = Boolean(swimmer.account_id || swimmer.is_claimed);
      return matchesSearch
        && (countryFilter === 'All' || (countryFilter === '' ? !swimmer.country?.trim() : swimmer.country === countryFilter))
        && (genderFilter === 'All' || (genderFilter === '' ? !swimmer.gender : swimmer.gender === genderFilter))
        && (transplantFilter === 'All' || (transplantFilter === '' ? !swimmer.transplant_type : swimmer.transplant_type === transplantFilter))
        && (accountFilter === 'All' || (accountFilter === 'Claimed' ? isClaimed : !isClaimed));
    });
  }, [rows, query, countryFilter, genderFilter, transplantFilter, accountFilter]);

  const filtersActive = Boolean(query.trim()) || countryFilter !== 'All' || genderFilter !== 'All' || transplantFilter !== 'All' || accountFilter !== 'All';
  const clearFilters = () => { setQuery(''); setCountryFilter('All'); setGenderFilter('All'); setTransplantFilter('All'); setAccountFilter('All'); };
  const selectedSwimmers = rows.filter(swimmer => selectedIds.has(swimmer.id));
  const selectedDeletable = selectedSwimmers.filter(swimmer => !swimmer.account_id && !swimmer.is_claimed);
  const visibleDeletable = filtered.filter(swimmer => !swimmer.account_id && !swimmer.is_claimed);
  const allVisibleSelected = visibleDeletable.length > 0 && visibleDeletable.every(swimmer => selectedIds.has(swimmer.id));

  const toggleVisibleSelection = (checked: boolean) => {
    setSelectedIds(current => {
      const next = new Set(current);
      visibleDeletable.forEach(swimmer => checked ? next.add(swimmer.id) : next.delete(swimmer.id));
      return next;
    });
  };

  const toggleSwimmerSelection = (swimmerId: string, checked: boolean) => {
    setSelectedIds(current => {
      const next = new Set(current);
      if (checked) next.add(swimmerId);
      else next.delete(swimmerId);
      return next;
    });
  };

  const openEdit = (swimmer: Swimmer) => {
    setEditing(swimmer);
    setDraft({ first_name: swimmer.first_name ?? '', last_name: swimmer.last_name ?? '', date_of_birth: swimmer.date_of_birth ?? '', country: swimmer.country ?? '', country_code: swimmer.country_code ?? '', gender: swimmer.gender ?? '', transplant_type: swimmer.transplant_type ?? '' });
    setError('');
  };

  const saveEdit = async () => {
    if (!supabase || !editing) return;
    setBusyId(editing.id); setError('');
    try {
      const { error: saveError } = await supabase.rpc('admin_update_swimmer_profile', {
        p_swimmer_id: editing.id,
        p_first_name: draft.first_name.trim(),
        p_last_name: draft.last_name.trim(),
        p_date_of_birth: draft.date_of_birth || null,
        p_country: draft.country.trim() || null,
        p_country_code: draft.country_code.trim().toUpperCase() || null,
        p_gender: draft.gender || null,
        p_transplant_type: draft.transplant_type.trim() || null,
      });
      if (saveError) throw saveError;
      setEditing(null);
      await onChanged();
    } catch (reason) { setError(describeSupabaseError(reason)); }
    finally { setBusyId(''); }
  };

  const readArchive = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      const parsed = JSON.parse(await file.text()) as ArchiveFile;
      if (!Array.isArray(parsed.swimmers)) throw new Error('This file does not contain a swimmers array.');
      setArchive(parsed); setArchiveName(file.name);
    } catch (reason) { setError(reason instanceof Error ? reason.message : describeSupabaseError(reason)); setArchive(null); setArchiveName(''); }
  };

  const downloadUpdatedArchive = (source: ArchiveFile, deletedKeys: string[]) => {
    const keySet = new Set(deletedKeys);
    const kept = (source.swimmers ?? []).filter(profile => !keySet.has(profile.id) && !(profile.source_key_aliases ?? []).some(key => keySet.has(key)));
    const reviews = (source.identity_review ?? []).map(review => ({ ...review, swimmer_ids: (review.swimmer_ids ?? []).filter(id => !keySet.has(id)) })).filter(review => (review.swimmer_ids ?? []).length > 1);
    const metadata = { ...(source.metadata ?? {}) };
    const consolidation = metadata.identity_consolidation;
    if (consolidation && typeof consolidation === 'object') {
      metadata.identity_consolidation = { ...(consolidation as Record<string, unknown>), review_required_profiles: kept.filter(profile => profile.identity_review_required).length };
    }
    const next: ArchiveFile = {
      ...source,
      swimmers: kept,
      identity_review: reviews,
      summary: { ...(source.summary ?? {}), swimmers: kept.length, individual_results: kept.reduce((sum, profile) => sum + (profile.result_count ?? 0), 0), identity_reviews: reviews.length },
      metadata: { ...metadata, generated_at: new Date().toISOString() },
    };
    const blob = new Blob([`${JSON.stringify(next, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'swimmers-updated.json'; anchor.click(); URL.revokeObjectURL(url);
    setArchive(next); setArchiveName('swimmers-updated.json');
  };

  const removeSwimmer = async () => {
    if (!supabase || !deleting) return;
    setBusyId(deleting.id); setError('');
    try {
      const { data, error: deleteError } = await supabase.rpc('admin_delete_swimmer_profile', { p_swimmer_id: deleting.id, p_confirmation_name: confirmation.trim() });
      if (deleteError) throw deleteError;
      const deletedKeys = Array.isArray(data?.source_keys) ? data.source_keys.map(String) : [deleting.source_key, ...(deleting.source_keys ?? [])].filter((key): key is string => Boolean(key));
      if (archive) downloadUpdatedArchive(archive, deletedKeys);
      setDeleting(null); setConfirmation('');
      await onChanged();
    } catch (reason) { setError(describeSupabaseError(reason)); }
    finally { setBusyId(''); }
  };

  const removeSelectedSwimmers = async () => {
    if (!supabase || !selectedDeletable.length || bulkConfirmation.trim().toUpperCase() !== 'DELETE') return;
    setBusyId('bulk'); setError('');
    const deletedKeys: string[] = [];
    const failures: string[] = [];
    let deletedCount = 0;
    try {
      for (const swimmer of selectedDeletable) {
        const fullName = `${swimmer.first_name} ${swimmer.last_name}`.trim();
        const { data, error: deleteError } = await supabase.rpc('admin_delete_swimmer_profile', {
          p_swimmer_id: swimmer.id,
          p_confirmation_name: fullName,
        });
        if (deleteError) {
          failures.push(`${fullName}: ${describeSupabaseError(deleteError)}`);
          continue;
        }
        const sourceKeys = Array.isArray(data?.source_keys) ? data.source_keys.map(String) : [];
        deletedKeys.push(...sourceKeys);
        deletedCount += 1;
      }

      if (deletedCount > 0) {
        if (archive && deletedKeys.length) downloadUpdatedArchive(archive, deletedKeys);
        setSelectedIds(current => {
          const next = new Set(current);
          selectedDeletable.forEach(swimmer => next.delete(swimmer.id));
          return next;
        });
        await onChanged();
      }

      setBulkDeleting(false);
      setBulkConfirmation('');
      if (failures.length) {
        setError(`${deletedCount} profile${deletedCount === 1 ? '' : 's'} deleted. ${failures.join(' ')}`);
      } else {
        setError('');
      }
    } catch (reason) {
      setError(deletedCount ? `${deletedCount} profile${deletedCount === 1 ? '' : 's'} deleted before the operation stopped. ${describeSupabaseError(reason)}` : describeSupabaseError(reason));
    } finally { setBusyId(''); }
  };

  return <section className="border p-5" style={{ border: '1px solid var(--navy-light)', backgroundColor: 'var(--navy-mid)' }}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="font-bold text-white">Swimmer and donor profiles</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-white/55">Search, correct, or remove unclaimed profiles. Age groups remain attached to each result.</p></div>
      <label className="inline-flex cursor-pointer items-center gap-2 border border-[var(--navy-light)] px-3 py-2 text-xs font-semibold text-white hover:border-[var(--accent)]"><Upload size={14} />Load archive JSON<input type="file" accept="application/json,.json" className="sr-only" onChange={event => void readArchive(event.target.files?.[0])} /></label>
    </div>
    <p className="mt-3 text-xs text-white/45">{archive ? `${archiveName} loaded. Deleting a profile will download an updated JSON for you to replace in the project.` : 'Load swimmers.json to download a cleaned copy whenever a profile is deleted. Database exclusions also prevent deleted archive profiles from returning on future imports.'}</p>
    {!canManage && <p className="mt-2 text-xs text-amber-200/80">This account has view-only access here, or the swimmer management migration is not available yet.</p>}
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <label className="relative sm:col-span-2 lg:col-span-1"><span className="sr-only">Search swimmers</span><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search swimmers…" className={`${fieldClass} pl-9`} /></label>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Country<select value={countryFilter} onChange={event => setCountryFilter(event.target.value)} className={`${fieldClass} mt-1 block`}><option value="All">All countries</option>{countriesInList.map(country => <option key={country} value={country}>{country}</option>)}<option value="">Not recorded</option></select></label>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Gender<select value={genderFilter} onChange={event => setGenderFilter(event.target.value)} className={`${fieldClass} mt-1 block`}><option value="All">All genders</option><option value="Men">Men</option><option value="Women">Women</option><option value="">Not recorded</option></select></label>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Transplant type<select value={transplantFilter} onChange={event => setTransplantFilter(event.target.value)} className={`${fieldClass} mt-1 block`}><option value="All">All types</option>{transplantTypesInList.map(type => <option key={type} value={type}>{type}</option>)}<option value="">Not recorded</option></select></label>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Profile status<select value={accountFilter} onChange={event => setAccountFilter(event.target.value)} className={`${fieldClass} mt-1 block`}><option value="All">All profiles</option><option value="Claimed">Claimed</option><option value="Unclaimed">Unclaimed</option></select></label>
    </div>
    {filtersActive && <button type="button" onClick={clearFilters} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline"><X size={13} />Clear filters</button>}
    {selectedIds.size > 0 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-3 sm:px-4"><p className="text-sm text-white"><strong>{selectedIds.size}</strong> selected{selectedDeletable.length !== selectedIds.size && <span className="ml-1 text-xs text-white/50">· {selectedDeletable.length} can be deleted</span>}</p><div className="flex flex-wrap items-center gap-3"><button type="button" onClick={() => setSelectedIds(new Set())} disabled={Boolean(busyId)} className="text-xs font-semibold text-white/60 hover:text-white disabled:opacity-40">Clear selection</button><button type="button" onClick={() => { setBulkDeleting(true); setBulkConfirmation(''); setError(''); }} disabled={!canManage || !selectedDeletable.length || Boolean(busyId)} className="inline-flex items-center gap-1.5 bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Trash2 size={13} />Delete selected ({selectedDeletable.length})</button></div></div>}
    {error && <p role="alert" className="mt-4 border border-red-300/20 bg-red-950/20 p-3 text-sm text-red-200">{error}</p>}
    {!filtered.length ? <div className="mt-5"><EmptyState title={rows.length ? 'No swimmers match' : 'No swimmers yet'} subtitle={rows.length ? 'Try changing or clearing your search and filters.' : 'Swimmer and donor profiles will appear here.'} onDark /></div> : <>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-white/40">{filtered.length.toLocaleString()} of {rows.length.toLocaleString()} profiles</p>
      <div className="ta-table-scroll mt-2"><table className="w-full min-w-[1000px] text-left text-sm"><thead><tr className="border-b border-[var(--navy-light)] text-[10px] uppercase tracking-widest text-white/50"><th className="w-10 px-3 py-3"><input type="checkbox" aria-label="Select all visible unclaimed swimmers" checked={allVisibleSelected} onChange={event => toggleVisibleSelection(event.target.checked)} disabled={!canManage || !visibleDeletable.length || Boolean(busyId)} className="accent-[var(--accent)]" /></th>{['Swimmer','Country','Gender','Transplant type','Date of birth','Account','Review','Actions'].map(label => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{filtered.map(swimmer => <tr key={swimmer.id} className="border-b border-[var(--navy-light)] last:border-0">
        <td className="px-3 py-3"><input type="checkbox" aria-label={`Select ${swimmer.first_name} ${swimmer.last_name}`} checked={selectedIds.has(swimmer.id)} onChange={event => toggleSwimmerSelection(swimmer.id, event.target.checked)} disabled={!canManage || Boolean(swimmer.account_id) || Boolean(swimmer.is_claimed) || Boolean(busyId)} className="accent-[var(--accent)]" /></td>
        <td className="px-3 py-3"><p className="font-semibold text-white">{swimmer.first_name} {swimmer.last_name}</p><p className="mt-1 max-w-56 truncate font-mono text-[9px] text-white/35" title={swimmer.source_key ?? ''}>{swimmer.source_key ?? 'Account profile'}</p></td>
        <td className="px-3 py-3 text-white/70">{swimmer.country || '—'}{swimmer.country_code ? <span className="ml-1 font-mono text-[10px] text-white/40">{swimmer.country_code}</span> : ''}</td>
        <td className="px-3 py-3 text-white/70">{swimmer.gender || '—'}</td><td className="px-3 py-3 text-white/70">{swimmer.transplant_type || '—'}</td><td className="px-3 py-3 text-white/70">{swimmer.date_of_birth || '—'}</td>
        <td className="px-3 py-3 text-white/70">{swimmer.account_id ? 'Linked' : 'Unclaimed'}</td><td className="px-3 py-3 text-white/70">{swimmer.identity_review_required ? 'Review' : '—'}</td>
        <td className="px-3 py-3"><div className="flex items-center gap-3"><button type="button" disabled={!canManage || Boolean(busyId)} onClick={() => openEdit(swimmer)} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] disabled:opacity-40"><Pencil size={13} />Edit</button><button type="button" disabled={!canManage || Boolean(swimmer.account_id) || Boolean(swimmer.is_claimed) || Boolean(busyId)} onClick={() => { setDeleting(swimmer); setConfirmation(''); setError(''); }} title={swimmer.account_id || swimmer.is_claimed ? 'Claimed profiles cannot be deleted here.' : 'Delete unclaimed profile'} className="inline-flex items-center gap-1 text-xs font-semibold text-red-200 disabled:opacity-35"><Trash2 size={13} />Delete</button></div></td>
      </tr>)}</tbody></table></div>
    </>}

    {editing && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-swimmer-title"><div className="max-h-[90vh] w-full max-w-2xl overflow-auto border border-[var(--navy-light)] bg-[var(--navy-mid)] p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><h3 id="edit-swimmer-title" className="text-lg font-bold text-white">Edit swimmer</h3><p className="mt-1 text-sm text-white/50">Update the profile fields used by the athlete directory.</p></div><button type="button" onClick={() => setEditing(null)} aria-label="Close editor" className="p-1 text-white/60 hover:text-white"><X size={18} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-xs text-white/60">First name<input className={`${fieldClass} mt-1`} value={draft.first_name} onChange={event => setDraft({ ...draft, first_name: event.target.value })} /></label><label className="text-xs text-white/60">Last name<input className={`${fieldClass} mt-1`} value={draft.last_name} onChange={event => setDraft({ ...draft, last_name: event.target.value })} /></label>
      <label className="text-xs text-white/60">Date of birth<input type="date" className={`${fieldClass} mt-1`} value={draft.date_of_birth} onChange={event => setDraft({ ...draft, date_of_birth: event.target.value })} /></label><label className="text-xs text-white/60">Country<select className={`${fieldClass} mt-1`} value={draft.country} onChange={event => {
        const selected = countries.find(country => country.name === event.target.value);
        setDraft(current => ({ ...current, country: event.target.value, country_code: selected?.code ?? '' }));
      }}><option value="">Select country</option>{draft.country && !countries.some(country => country.name === draft.country) && <option value={draft.country}>{draft.country} (current)</option>}{countries.map(country => <option key={country.code} value={country.name}>{country.flag} {country.name}</option>)}</select></label>
      <label className="text-xs text-white/60">Country code<input maxLength={3} readOnly aria-readonly="true" className={`${fieldClass} mt-1 opacity-75`} value={draft.country_code} placeholder="Select a country" /></label><label className="text-xs text-white/60">Gender<select className={`${fieldClass} mt-1`} value={draft.gender} onChange={event => setDraft({ ...draft, gender: event.target.value })}><option value="">Not set</option><option value="Men">Men</option><option value="Women">Women</option></select></label>
      <label className="text-xs text-white/60 sm:col-span-2">Transplant type<input className={`${fieldClass} mt-1`} value={draft.transplant_type} onChange={event => setDraft({ ...draft, transplant_type: event.target.value })} /></label>
    </div><div className="mt-6 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className="border border-[var(--navy-light)] px-4 py-2 text-sm text-white/70">Cancel</button><button type="button" disabled={Boolean(busyId) || !draft.first_name.trim() || !draft.last_name.trim()} onClick={() => void saveEdit()} className="bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--navy)] disabled:opacity-40">{busyId ? 'Saving…' : 'Save swimmer'}</button></div></div></div>}

    {deleting && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-swimmer-title"><div className="w-full max-w-lg border border-red-300/30 bg-[var(--navy-mid)] p-5 sm:p-6"><h3 id="delete-swimmer-title" className="text-lg font-bold text-white">Delete {deleting.first_name} {deleting.last_name}?</h3><p className="mt-2 text-sm leading-6 text-white/60">This removes the unclaimed profile from the athlete directory. Historical results remain in meet results without a profile link. The source keys will be excluded from future archive imports.</p>{archive && <p className="mt-2 flex items-center gap-2 text-xs text-[var(--accent)]"><Download size={13} />A cleaned swimmers.json download will start after deletion.</p>}<label className="mt-4 block text-xs text-white/60">Type <strong className="text-white">{deleting.first_name} {deleting.last_name}</strong> to confirm<input autoComplete="off" className={`${fieldClass} mt-2`} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDeleting(null)} className="border border-[var(--navy-light)] px-4 py-2 text-sm text-white/70">Cancel</button><button type="button" disabled={Boolean(busyId) || confirmation.trim().toLowerCase() !== `${deleting.first_name} ${deleting.last_name}`.trim().toLowerCase()} onClick={() => void removeSwimmer()} className="bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{busyId ? 'Deleting…' : 'Delete swimmer'}</button></div></div></div>}
    {bulkDeleting && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="bulk-delete-swimmers-title"><div className="max-h-[90vh] w-full max-w-xl overflow-auto border border-red-300/30 bg-[var(--navy-mid)] p-5 sm:p-6"><h3 id="bulk-delete-swimmers-title" className="text-lg font-bold text-white">Delete {selectedDeletable.length} selected profiles?</h3><p className="mt-2 text-sm leading-6 text-white/60">This removes the selected unclaimed profiles. Their historical results remain without a profile link, and their archive source keys are excluded from future imports. Claimed profiles are excluded.</p>{archive && <p className="mt-2 flex items-center gap-2 text-xs text-[var(--accent)]"><Download size={13} />A cleaned swimmers.json download will start after deletion.</p>}<div className="mt-4 max-h-40 overflow-auto border border-[var(--navy-light)] p-3 text-sm text-white/75">{selectedDeletable.map(swimmer => <p key={swimmer.id}>{swimmer.first_name} {swimmer.last_name}</p>)}</div><label className="mt-4 block text-xs text-white/60">Type <strong className="text-white">DELETE</strong> to confirm<input autoComplete="off" className={`${fieldClass} mt-2`} value={bulkConfirmation} onChange={event => setBulkConfirmation(event.target.value)} /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setBulkDeleting(false)} disabled={Boolean(busyId)} className="border border-[var(--navy-light)] px-4 py-2 text-sm text-white/70 disabled:opacity-40">Cancel</button><button type="button" disabled={Boolean(busyId) || bulkConfirmation.trim().toUpperCase() !== 'DELETE'} onClick={() => void removeSelectedSwimmers()} className="bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{busyId === 'bulk' ? 'Deleting…' : `Delete ${selectedDeletable.length} profiles`}</button></div></div></div>}
  </section>;
}
