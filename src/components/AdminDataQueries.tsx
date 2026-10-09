import { useState, type CSSProperties, type FormEvent } from 'react';
import { Check, Database, GitMerge, Pencil, Search, X } from 'lucide-react';
import { loadPublicSwimmerDirectory, loadPublicSubmittedResults, type PublicSwimmerProfile, type SubmittedSwimmerResult } from '../lib/swimmerSubmissions';
import { normalizeRankingEvent } from '../lib/databaseRankings';
import { normalizeCountryCode, timeToSeconds } from '../lib/utils';
import { describeSupabaseError, supabase } from '../lib/supabase';
import { clearCachedRequest } from '../lib/requestCache';
import { resolveTransplantMedals, type ResolvedTransplantMedal } from '../lib/transplantMedals';
import { countries } from '../data/countries';
import { GENDERS, TRANSPLANT_TYPES } from '../types';

type QueryResult = {
  title: string;
  columns: string[];
  rows: string[][];
  note: string;
  duplicateProfiles?: PublicSwimmerProfile[];
  editableProfiles?: Array<PublicSwimmerProfile | null>;
  mergeCandidates?: PublicSwimmerProfile[];
};

type QueryField = 'gender' | 'swimmer' | 'country' | 'event' | 'age_group' | 'course' | 'meet' | 'year' | 'status' | 'medal' | 'time' | 'placing' | 'points' | 'transplant_type' | 'club' | 'profile_id';
type QueryRule = { id: number; field: QueryField; operator: 'is' | 'is_not' | 'contains' | 'is_empty' | 'is_not_empty' | 'is_duplicate' | 'invalid_format' | 'greater_than' | 'less_than' | 'at_least' | 'at_most'; join?: 'AND' | 'OR'; value: string };
type QueryGroup = { id: number; logic: 'AND' | 'OR'; rules: QueryRule[] };
export type DataQualityQueryPreset = 'missing_age_group' | 'invalid_time_format';
type MedalRow = { result_id: string; medal: string; competition: string; year: number; swimmer_id: string };
const queryFields: { key: QueryField; label: string }[] = [
  { key: 'gender', label: 'Gender' }, { key: 'swimmer', label: 'Swimmer name' }, { key: 'country', label: 'Country' },
  { key: 'event', label: 'Event' }, { key: 'age_group', label: 'Age group' }, { key: 'course', label: 'Course' },
  { key: 'meet', label: 'Meet' }, { key: 'year', label: 'Meet year' }, { key: 'status', label: 'Result status' }, { key: 'medal', label: 'Medal' },
  { key: 'time', label: 'Time' }, { key: 'placing', label: 'Placing' }, { key: 'points', label: 'Points' },
  { key: 'transplant_type', label: 'Transplant type' }, { key: 'club', label: 'Club' }, { key: 'profile_id', label: 'Profile ID' },
];

function fieldValue(rule: QueryRule, result: SubmittedSwimmerResult, medalByResult: Map<string, ResolvedTransplantMedal>, profileById: Map<string, PublicSwimmerProfile>): string {
  const profile = result.athlete_id || result.swimmer_id ? profileById.get(result.athlete_id ?? result.swimmer_id ?? '') : undefined;
  const medal = medalByResult.get(result.id);
  switch (rule.field) {
    case 'gender': return result.gender ?? profile?.gender ?? '';
    case 'swimmer': return profile ? `${profile.first_name} ${profile.last_name}` : result.swimmer_name ?? '';
    case 'country': return profile?.country ?? result.country ?? '';
    case 'event': return result.event ?? '';
    case 'age_group': return result.age_group ?? '';
    case 'course': return result.course ?? result.submitted_meets?.course ?? '';
    case 'meet': return result.submitted_meets?.name ?? '';
    case 'year': return String(meetYear(result) ?? '');
    case 'status': return result.status ?? '';
    case 'medal': return medal?.color ?? '';
    case 'time': return result.time ?? '';
    case 'placing': return result.placing == null ? '' : String(result.placing);
    case 'points': return result.points == null ? '' : String(result.points);
    case 'transplant_type': return profile?.transplant_type ?? result.transplant_type ?? '';
    case 'club': return profile?.club_name ?? result.represented_club_name ?? '';
    case 'profile_id': return result.athlete_id ?? result.swimmer_id ?? '';
  }
}

function matchesRule(rule: QueryRule, result: SubmittedSwimmerResult, medalByResult: Map<string, ResolvedTransplantMedal>, profileById: Map<string, PublicSwimmerProfile>): boolean {
  const actual = fieldValue(rule, result, medalByResult, profileById).trim().toLocaleLowerCase();
  if (rule.operator === 'is_empty') return actual.length === 0;
  if (rule.operator === 'is_not_empty') return actual.length > 0;
  if (rule.operator === 'invalid_format') {
    const time = fieldValue(rule, result, medalByResult, profileById).trim();
    if (!/^\d+(?::\d{1,2})?(?:\.\d{1,3})?$/.test(time)) return true;
    return time.includes(':') && Number(time.split(':')[1]) >= 60;
  }
  const expected = rule.value.trim().toLocaleLowerCase();
  if (!expected) return true;
  if (rule.operator === 'is_not') return actual !== expected;
  if (rule.operator === 'contains') return actual.includes(expected);
  if (['greater_than','less_than','at_least','at_most'].includes(rule.operator)) {
    const toNumber = (value: string) => rule.field === 'time' ? timeToSeconds(value) : Number(value);
    const left = toNumber(fieldValue(rule, result, medalByResult, profileById));
    const right = toNumber(rule.value);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    if (rule.operator === 'greater_than') return left > right;
    if (rule.operator === 'less_than') return left < right;
    if (rule.operator === 'at_least') return left >= right;
    return left <= right;
  }
  return actual === expected;
}

function profileFieldValue(rule: QueryRule, profile: PublicSwimmerProfile): string {
  switch (rule.field) {
    case 'swimmer': return `${profile.first_name} ${profile.last_name}`;
    case 'country': return profile.country ?? '';
    case 'gender': return profile.gender ?? '';
    case 'transplant_type': return profile.transplant_type ?? '';
    case 'club': return profile.club_name ?? '';
    case 'profile_id': return profile.id;
    default: return '';
  }
}

function matchesProfileRule(rule: QueryRule, profile: PublicSwimmerProfile, duplicateNames: Set<string>): boolean {
  const actualText = profileFieldValue(rule, profile).trim();
  if (rule.operator === 'is_duplicate') return duplicateNames.has(actualText.replace(/\s+/g, ' ').toLocaleLowerCase());
  if (rule.operator === 'is_empty') return !actualText;
  if (rule.operator === 'is_not_empty') return Boolean(actualText);
  const actual = actualText.toLocaleLowerCase();
  const expected = rule.value.trim().toLocaleLowerCase();
  if (!expected) return true;
  if (rule.operator === 'is_not') return actual !== expected;
  if (rule.operator === 'contains') return actual.includes(expected);
  return actual === expected;
}

const examples = [
  'Show me the best times for the 50 freestyle in 2025',
  'Show me all swimmers with the same names',
];

function meetYear(result: SubmittedSwimmerResult): number | null {
  const year = Number(result.submitted_meets?.meet_year);
  if (Number.isInteger(year) && year > 0) return year;
  const dateYear = result.submitted_meets?.meet_date?.slice(0, 4);
  return dateYear && /^\d{4}$/.test(dateYear) ? Number(dateYear) : null;
}

function fastestTimes(query: string, results: SubmittedSwimmerResult[], profiles: PublicSwimmerProfile[]): QueryResult {
  const yearMatch = query.match(/\b(19|20)\d{2}\b/);
  const eventText = query.match(/\b(\d{2,4})\s*m?\s*(freestyle|free|backstroke|back|breaststroke|breast|butterfly|fly|individual medley|im)\b/i)?.[0];
  const event = eventText ? normalizeRankingEvent(eventText) : null;
  if (!yearMatch || !event) {
    throw new Error('Include an event and year, for example: “Show me the best times for the 50 freestyle in 2025”.');
  }

  const profileById = new Map(profiles.map(profile => [profile.id, profile]));
  const bestBySwimmer = new Map<string, SubmittedSwimmerResult>();
  results.filter(result => normalizeRankingEvent(result.event) === event && meetYear(result) === Number(yearMatch[0]))
    .forEach(result => {
      const swimmerKey = result.swimmer_id ?? `${result.swimmer_name.trim().toLocaleLowerCase()}|${result.country_code ?? result.country}`;
      const current = bestBySwimmer.get(swimmerKey);
      if (!current || timeToSeconds(result.time) < timeToSeconds(current.time)) bestBySwimmer.set(swimmerKey, result);
    });

  const rows = [...bestBySwimmer.values()]
    .sort((a, b) => timeToSeconds(a.time) - timeToSeconds(b.time))
    .map(result => {
      const profile = result.swimmer_id ? profileById.get(result.swimmer_id) : undefined;
      const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || result.swimmer_name || 'Unknown swimmer';
      return [name, profile?.country ?? result.country ?? '—', result.time, result.age_group ?? '—', result.submitted_meets?.name ?? 'Meet not listed', result.status.replaceAll('_', ' ')];
    });

  return {
    title: `Best ${event} times · ${yearMatch[0]}`,
    columns: ['Swimmer', 'Country', 'Time', 'Age group', 'Meet', 'Status'],
    rows,
    note: `${rows.length} swimmer${rows.length === 1 ? '' : 's'} with a public, non-rejected result. Where a swimmer had multiple swims, only their fastest time is shown.`,
  };
}

function duplicateNames(profiles: PublicSwimmerProfile[]): QueryResult {
  const grouped = new Map<string, PublicSwimmerProfile[]>();
  profiles.forEach(profile => {
    const name = `${profile.first_name} ${profile.last_name}`.trim().replace(/\s+/g, ' ');
    if (!name) return;
    const key = name.toLocaleLowerCase();
    grouped.set(key, [...(grouped.get(key) ?? []), profile]);
  });
  const duplicates = [...grouped.values()].filter(group => group.length > 1)
    .sort((a, b) => `${a[0].first_name} ${a[0].last_name}`.localeCompare(`${b[0].first_name} ${b[0].last_name}`, undefined, { sensitivity: 'base' }));
  const rows = duplicates.flatMap(group => group.map(profile => [
    `${profile.first_name} ${profile.last_name}`,
    profile.country ?? '—',
    profile.gender ?? '—',
    profile.transplant_type ?? '—',
    profile.id,
  ]));
  return {
    title: 'Swimmers with matching names',
    columns: ['Name', 'Country', 'Gender', 'Transplant type', 'Profile ID'],
    rows,
    note: `${duplicates.length} repeated name${duplicates.length === 1 ? '' : 's'} found across ${rows.length} profiles. Names are matched without regard to capitalization.`,
    duplicateProfiles: duplicates.flat(),
    mergeCandidates: profiles,
  };
}

function runNaturalLanguageQuery(query: string, results: SubmittedSwimmerResult[], profiles: PublicSwimmerProfile[]): QueryResult {
  const normalized = query.toLocaleLowerCase();
  if (/(same names?|duplicate names?|matching names?)/.test(normalized)) return duplicateNames(profiles);
  if (/(best|fastest|quickest).*(time|swim)|\btime\b/.test(normalized)) return fastestTimes(query, results, profiles);
  throw new Error('I don’t recognize that query yet. Try one of the examples below.');
}

export default function AdminDataQueries({ cardStyle, canMerge = false, swimmers = [], preset }: { cardStyle: CSSProperties; canMerge?: boolean; swimmers?: Record<string, unknown>[]; preset?: DataQualityQueryPreset | null }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [primaryProfileId, setPrimaryProfileId] = useState('');
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeConfirmation, setMergeConfirmation] = useState('');
  const [notice, setNotice] = useState('');
  const [queryGroups, setQueryGroups] = useState<QueryGroup[]>(() => preset === 'missing_age_group'
    ? [{ id: Date.now(), logic: 'AND', rules: [{ id: Date.now() + 1, field: 'age_group', operator: 'is_empty', value: '' }] }]
    : preset === 'invalid_time_format'
      ? [{ id: Date.now(), logic: 'AND', rules: [{ id: Date.now() + 1, field: 'time', operator: 'invalid_format', value: '' }] }]
      : [{ id: 1, logic: 'AND', rules: [{ id: 1, field: 'gender', operator: 'is', value: 'Men' }] }]);
  const [groupedMedals, setGroupedMedals] = useState(true);
  const [maxRows, setMaxRows] = useState(25);
  const [queryScope] = useState<'results' | 'profiles'>('results');
  const [editingProfile, setEditingProfile] = useState<PublicSwimmerProfile | null>(null);
  const [profileDraft, setProfileDraft] = useState({ first_name: '', last_name: '', date_of_birth: '', country: '', country_code: '', gender: '', transplant_type: '', club_name: '' });
  const scopedFields = queryScope === 'profiles'
    ? queryFields.filter(field => ['gender','swimmer','country','transplant_type','club','profile_id'].includes(field.key))
    : queryFields.filter(field => !['transplant_type','club','profile_id'].includes(field.key));

  const addRule = (groupId: number) => setQueryGroups(groups => groups.map(group => group.id === groupId
    ? { ...group, rules: [...group.rules, { id: Date.now(), field: queryScope === 'profiles' ? 'country' : 'event', operator: 'is', value: '' }] }
    : group));

  const runRuleQuery = async () => {
    setBusy(true); setError(''); setNotice(''); setResult(null);
    setSelectedProfileIds([]); setPrimaryProfileId(''); setMergeConfirmation('');
    try {
      if (!supabase) throw new Error('Supabase is not configured.');
      const profiles = await loadPublicSwimmerDirectory();
      const combineGroups = (predicate: (rule: QueryRule) => boolean) => queryGroups.every(group => group.rules.reduce((combined, rule, index) => {
        const current = predicate(rule);
        if (index === 0) return current;
        return rule.join === 'OR' ? combined || current : combined && current;
      }, false));
      const conditions = queryGroups.flatMap(group => group.rules.filter(rule => ['is_empty','is_not_empty','is_duplicate','invalid_format'].includes(rule.operator) || rule.value.trim()).map(rule => `${queryFields.find(field => field.key === rule.field)?.label} ${rule.operator === 'invalid_format' ? 'has invalid format' : rule.operator.replaceAll('_',' ')}${rule.value.trim()?` “${rule.value.trim()}”`:''}`));
      if (queryScope === 'profiles') {
        const nameCounts = new Map<string, number>();
        profiles.forEach(profile => {
          const name = `${profile.first_name} ${profile.last_name}`.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
          if (name) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
        });
        const duplicateNames = new Set([...nameCounts].filter(([, count]) => count > 1).map(([name]) => name));
        const matchedProfiles = profiles.filter(profile => combineGroups(rule => matchesProfileRule(rule, profile, duplicateNames)));
        const rows = matchedProfiles.map(profile => [`${profile.first_name} ${profile.last_name}`, profile.country || '—', profile.gender || '—', profile.transplant_type || '—', profile.club_name || '—', profile.id]);
        setResult({ title: 'Matching swimmer profiles', columns: ['Swimmer', 'Country', 'Gender', 'Transplant type', 'Club', 'Profile ID'], rows, editableProfiles: matchedProfiles, note: `${rows.length} profiles matched${conditions.length?`. Filters: ${conditions.join('; ')}.`:'.'}` });
        return;
      }
      const [results, medalResponse] = await Promise.all([
        loadPublicSubmittedResults(),
        supabase.from('transplant_medals').select('result_id,swimmer_id,medal,competition,year'),
      ]);
      if (medalResponse.error) throw medalResponse.error;
      const medals = (medalResponse.data ?? []) as MedalRow[];
      const medalByResult = resolveTransplantMedals(results, medals);
      const profileById = new Map(profiles.map(profile => [profile.id, profile]));
      const groupsMatch = (row: SubmittedSwimmerResult) => combineGroups(rule => matchesRule(rule, row, medalByResult, profileById));
      const matches = results.filter(groupsMatch);
      if (groupedMedals) {
        const totals = new Map<string, { profile?: PublicSwimmerProfile; name: string; country: string; medals: number }>();
        matches.forEach(linkedResult => {
          const medal = medalByResult.get(linkedResult.id);
          if (!medal) return;
          const profileId = linkedResult.athlete_id ?? linkedResult.swimmer_id ?? medal.swimmer_id;
          const profile = profileId ? profileById.get(profileId) : undefined;
          const key = profileId || linkedResult.swimmer_name || linkedResult.id;
          const current = totals.get(key) ?? { profile, name: profile ? `${profile.first_name} ${profile.last_name}` : linkedResult.swimmer_name || 'Unknown swimmer', country: profile?.country ?? linkedResult.country ?? '—', medals: 0 };
          current.medals += 1;
          totals.set(key, current);
        });
        const rankedTotals = [...totals.entries()].sort(([,a],[,b]) => b.medals - a.medals || a.name.localeCompare(b.name)).slice(0, Math.max(1, maxRows));
        const rows = rankedTotals.map(([profileId,row]) => [row.name, row.country, String(row.medals), profileId]);
        setResult({ title: 'Medals by swimmer', columns: ['Swimmer', 'Country', 'Medals', 'Profile ID'], rows, editableProfiles: rankedTotals.map(([, row]) => row.profile ?? null), note: `${conditions.length ? `Filters: ${conditions.join('; ')}. ` : ''}Counted official medal records plus WTG results placed 1st–3rd when a medal record is missing. Medals are assigned to the canonical result profile (athlete_id, then swimmer_id), matching athlete profile results. Showing up to ${Math.max(1, maxRows)} swimmers.` });
      } else {
        const matchedProfiles: Array<PublicSwimmerProfile | null> = [];
        const rows = matches.map(row => {
          const profile = profileById.get(row.athlete_id ?? row.swimmer_id ?? '') ?? null;
          matchedProfiles.push(profile);
          const medal = medalByResult.get(row.id);
          return [profile ? `${profile.first_name} ${profile.last_name}` : row.swimmer_name, row.gender ?? profile?.gender ?? '—', row.event, row.time, row.age_group ?? '—', medal?.color ?? '—', row.submitted_meets?.name ?? '—', String(meetYear(row) ?? '—'), row.status.replaceAll('_', ' ')];
        });
        setResult({ title: 'Matching results', columns: ['Swimmer', 'Gender', 'Event', 'Time', 'Age group', 'Medal', 'Meet', 'Year', 'Status'], rows, editableProfiles: matchedProfiles, note: `${rows.length} results matched. ${conditions.length ? `Filters: ${conditions.join('; ')}.` : 'No filters applied.'}` });
      }
    } catch (reason) { setError(describeSupabaseError(reason)); }
    finally { setBusy(false); }
  };

  const loadQueryResult = async (question: string) => {
    setBusy(true); setError(''); setNotice(''); setResult(null);
    setSelectedProfileIds([]); setPrimaryProfileId(''); setMergeConfirmation('');
    try {
      const [results, profiles] = await Promise.all([loadPublicSubmittedResults(), loadPublicSwimmerDirectory()]);
      setResult(runNaturalLanguageQuery(question.trim(), results, profiles));
    } catch (reason) {
      setError(reason instanceof Error && (reason.message.startsWith('Include an event') || reason.message.startsWith('I don’t recognize'))
        ? reason.message
        : describeSupabaseError(reason));
    } finally { setBusy(false); }
  };

  const run = (event: FormEvent) => {
    event.preventDefault();
    if (query.trim()) void loadQueryResult(query);
  };

  const toggleProfile = (profileId: string, selected: boolean) => {
    const next = selected
      ? selectedProfileIds.includes(profileId) ? selectedProfileIds : [...selectedProfileIds, profileId]
      : selectedProfileIds.filter(id => id !== profileId);
    setSelectedProfileIds(next);
    if (selected && !primaryProfileId) setPrimaryProfileId(profileId);
    if (!selected && primaryProfileId === profileId) setPrimaryProfileId(next[0] ?? '');
  };

  const mergeProfiles = async () => {
    if (!supabase || !canMerge || selectedProfileIds.length < 2 || !selectedProfileIds.includes(primaryProfileId) || mergeConfirmation.trim().toUpperCase() !== 'MERGE') return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { error: mergeError } = await supabase.rpc('admin_merge_swimmer_profiles', {
        p_swimmer_ids: selectedProfileIds,
        p_primary_swimmer_id: primaryProfileId,
      });
      if (mergeError) throw mergeError;
      clearCachedRequest('public-swimmer-directory');
      clearCachedRequest('public-submitted-results');
      clearCachedRequest('fastest-transplant-swims');
      await loadQueryResult(query);
      setNotice(`${selectedProfileIds.length} profiles merged into the selected primary profile.`);
    } catch (reason) {
      setError(describeSupabaseError(reason));
      setBusy(false);
    }
  };

  const beginProfileEdit = async (profile: PublicSwimmerProfile) => {
    setError('');
    let adminProfile = swimmers.find(row => row.id === profile.id);
    if (!adminProfile && supabase) {
      setBusy(true);
      try {
        const { data, error: loadError } = await supabase.rpc('admin_list_swimmer_profiles').eq('id', profile.id).maybeSingle();
        if (loadError) throw loadError;
        adminProfile = data as Record<string, unknown> | null ?? undefined;
      } catch (reason) {
        setError(describeSupabaseError(reason));
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    setEditingProfile(profile);
    setProfileDraft({ first_name: profile.first_name ?? '', last_name: profile.last_name ?? '', date_of_birth: String(adminProfile?.date_of_birth ?? '').slice(0, 10), country: profile.country ?? '', country_code: profile.country_code ?? '', gender: profile.gender ?? '', transplant_type: profile.transplant_type ?? '', club_name: profile.club_name ?? '' });
  };

  const saveProfileEdit = async () => {
    if (!supabase || !canMerge || !editingProfile) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { data, error: saveError } = await supabase.rpc('admin_update_swimmer_profile', {
        p_swimmer_id: editingProfile.id,
        p_first_name: profileDraft.first_name.trim(),
        p_last_name: profileDraft.last_name.trim(),
        p_date_of_birth: profileDraft.date_of_birth || null,
        p_country: profileDraft.country.trim() || null,
        p_country_code: normalizeCountryCode(profileDraft.country, profileDraft.country_code) || null,
        p_gender: profileDraft.gender || null,
        p_transplant_type: profileDraft.transplant_type.trim() || null,
        p_club_name: profileDraft.club_name.trim() || null,
      });
      if (saveError) throw saveError;
      if (String(data ?? '').slice(0, 10) !== (profileDraft.date_of_birth || '')) throw new Error('The database did not confirm the date of birth.');
      clearCachedRequest('public-swimmer-directory');
      clearCachedRequest('public-submitted-results');
      setEditingProfile(null);
      await runRuleQuery();
      setNotice('Swimmer profile updated. Query results refreshed.');
    } catch (reason) { setError(describeSupabaseError(reason)); setBusy(false); }
  };

  const selectedProfiles = (result?.mergeCandidates ?? []).filter(profile => selectedProfileIds.includes(profile.id));
  const matchingMergeProfiles = (result?.mergeCandidates ?? []).filter(profile => {
    if (!mergeSearch.trim()) return false;
    const search = mergeSearch.trim().toLocaleLowerCase();
    return `${profile.first_name} ${profile.last_name} ${profile.country ?? ''} ${profile.id}`.toLocaleLowerCase().includes(search);
  }).slice(0, 25);

  return <div className="space-y-5">
    <div className="border p-5 sm:p-6" style={cardStyle}>
      <div className="flex items-start gap-3"><Database size={19} className="mt-0.5 text-[var(--accent)]" /><div><h2 className="text-lg font-bold text-white">Ask the data</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-white/55">Ask a plain-language question about public swimmer profiles and results. Review matching profiles here and merge duplicates when you have merge permission.</p></div></div>
      <form onSubmit={run} className="mt-5">
        <label htmlFor="admin-data-query" className="mb-2 block text-xs font-semibold text-white/60">Your question</label>
        <div className="flex flex-col gap-2 sm:flex-row"><input id="admin-data-query" value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. Show me the best times for the 50 freestyle in 2025" className="min-w-0 flex-1 border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-[var(--accent)]" /><button type="submit" disabled={busy || !query.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--accent)] px-4 text-sm font-bold text-[var(--navy)] disabled:opacity-50"><Search size={15} />{busy ? 'Searching…' : 'Run query'}</button></div>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">{examples.map(example => <button key={example} type="button" onClick={() => setQuery(example)} className="border border-[var(--navy-light)] px-3 py-2 text-left text-xs text-white/65 transition-colors hover:border-[var(--accent)] hover:text-white">{example}</button>)}</div>
      <section className="mt-6 border-t border-[var(--navy-light)] pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-bold text-white">Build a database query</h3><p className="mt-1 text-xs text-white/50">Start with one condition. Add AND/OR between later conditions; groups combine with AND.</p></div><button type="button" onClick={()=>{setQueryGroups([{id:Date.now(),logic:'AND',rules:[queryScope==='profiles'?{id:Date.now()+1,field:'country',operator:'is_empty',value:''}:{id:Date.now()+1,field:'gender',operator:'is',value:'Men'}]}]);setGroupedMedals(queryScope==='results');setMaxRows(25);}} className="text-xs font-semibold text-[var(--accent)] hover:underline">Reset</button></div>
        <div className="mt-4 space-y-3">
          {queryGroups.map((group, groupIndex)=><div key={group.id} className="border border-[var(--navy-light)] p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-white/50">{groupIndex===0?'Conditions':'Condition group · groups combine with AND'}</p>{groupIndex>0&&<button type="button" onClick={()=>setQueryGroups(groups=>groups.filter(item=>item.id!==group.id))} className="text-xs text-red-200/75 hover:text-red-100">Remove group</button>}</div>
            <div className="space-y-2">{group.rules.map((rule, ruleIndex)=><div key={rule.id} className="grid gap-2 sm:grid-cols-[auto_minmax(125px,1fr)_minmax(105px,0.8fr)_minmax(150px,1.2fr)_auto]">
              <div>{ruleIndex>0&&<select aria-label="Join rule with" value={rule.join??'AND'} onChange={event=>setQueryGroups(groups=>groups.map(item=>item.id===group.id?{...item,rules:item.rules.map(existing=>existing.id===rule.id?{...existing,join:event.target.value as 'AND'|'OR'}:existing)}:item))} className="h-full min-w-16 border border-[var(--navy-light)] bg-[var(--navy)] px-2 text-xs font-bold text-white"><option value="AND">AND</option><option value="OR">OR</option></select>}</div>
              <select aria-label="Query field" value={rule.field} onChange={event=>setQueryGroups(groups=>groups.map(item=>item.id===group.id?{...item,rules:item.rules.map(existing=>existing.id===rule.id?{...existing,field:event.target.value as QueryField,value:'',operator:'is'}:existing)}:item))} className="border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2.5 text-sm text-white">{scopedFields.map(field=><option key={field.key} value={field.key}>{field.label}</option>)}</select>
              <select aria-label="Query operator" value={rule.operator} onChange={event=>setQueryGroups(groups=>groups.map(item=>item.id===group.id?{...item,rules:item.rules.map(existing=>existing.id===rule.id?{...existing,operator:event.target.value as QueryRule['operator']}:existing)}:item))} className="border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2.5 text-sm text-white"><option value="is">is</option><option value="is_not">is not</option><option value="contains">contains</option><option value="is_empty">is empty</option><option value="is_not_empty">is not empty</option>{queryScope==='profiles'&&rule.field==='swimmer'&&<option value="is_duplicate">is duplicate</option>}{queryScope==='results'&&rule.field==='time'&&<option value="invalid_format">has invalid format</option>}{queryScope==='results'&&['time','year','placing','points'].includes(rule.field)&&<><option value="greater_than">greater than</option><option value="less_than">less than</option><option value="at_least">greater than or equal to</option><option value="at_most">less than or equal to</option></>}</select>
              {['is_empty','is_not_empty','is_duplicate','invalid_format'].includes(rule.operator)?<div className="flex items-center border border-[var(--navy-light)] px-3 py-2.5 text-sm text-white/40">No value needed</div>:rule.field==='gender'||rule.field==='medal'||rule.field==='status'||rule.field==='course'?<select aria-label="Query value" value={rule.value} onChange={event=>setQueryGroups(groups=>groups.map(item=>item.id===group.id?{...item,rules:item.rules.map(existing=>existing.id===rule.id?{...existing,value:event.target.value}:existing)}:item))} className="border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2.5 text-sm text-white"><option value="">Choose a value</option>{(rule.field==='gender'?['Men','Women']:rule.field==='medal'?['Gold','Silver','Bronze']:rule.field==='status'?['verified','swimmer_submitted','imported_unverified']:['LCM','SCM','SCY']).map(value=><option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}</select>:<input aria-label="Query value" value={rule.value} onChange={event=>setQueryGroups(groups=>groups.map(item=>item.id===group.id?{...item,rules:item.rules.map(existing=>existing.id===rule.id?{...existing,value:event.target.value}:existing)}:item))} placeholder={rule.field==='year'?'e.g. 2025':`Enter ${scopedFields.find(field=>field.key===rule.field)?.label.toLowerCase()}`} className="min-w-0 border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2.5 text-sm text-white placeholder:text-white/35" />}
              <button type="button" aria-label="Remove rule" disabled={group.rules.length===1} onClick={()=>setQueryGroups(groups=>groups.map(item=>item.id===group.id?{...item,rules:item.rules.filter(existing=>existing.id!==rule.id)}:item))} className="border border-[var(--navy-light)] px-3 text-white/60 hover:border-red-300/50 hover:text-red-200 disabled:opacity-30">×</button>
            </div>)}</div>
            <button type="button" onClick={()=>addRule(group.id)} className="mt-3 border border-[var(--navy-light)] px-3 py-1.5 text-xs font-semibold text-white/70 hover:border-[var(--accent)]">+ Add rule</button>
          </div>)}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={()=>setQueryGroups(groups=>[...groups,{id:Date.now(),logic:'AND',rules:[{id:Date.now()+1,field:queryScope==='profiles'?'country':'meet',operator:'is',value:''}]}])} className="border border-[var(--navy-light)] px-3 py-2 text-xs font-semibold text-white/70 hover:border-[var(--accent)]">+ Add group</button>
          {queryScope==='results'&&<div className="flex flex-wrap items-center gap-4"><label className="flex items-center gap-2 text-xs text-white/65"><input type="checkbox" checked={groupedMedals} onChange={event=>setGroupedMedals(event.target.checked)} className="accent-[var(--accent)]" />Summarise by swimmer and count medals</label>{groupedMedals&&<label className="flex items-center gap-2 text-xs text-white/65">Maximum rows<input type="number" min="1" max="500" value={maxRows} onChange={event=>setMaxRows(Math.min(500,Math.max(1,Number(event.target.value)||1)))} className="w-20 border border-[var(--navy-light)] bg-[var(--navy)] px-2 py-1.5 text-white" /></label>}</div>}
        </div>
        <div className="mt-4 flex justify-end"><button type="button" onClick={()=>void runRuleQuery()} disabled={busy} className="inline-flex min-h-10 items-center justify-center gap-2 bg-[var(--accent)] px-4 text-sm font-bold text-[var(--navy)] disabled:opacity-50"><Search size={15}/>{busy?'Querying database…':'Apply query'}</button></div>
        <p className="mt-3 text-[11px] leading-5 text-white/40">{queryScope==='profiles'?'Profile queries search swimmer_profiles and include blank countries.':'Queries use public, non-rejected swim results and linked medal records.'} This builder applies filters to records returned by the existing data access layer; it does not execute arbitrary SQL.</p>
      </section>
      {error && <p role="alert" className="mt-4 border border-red-300/30 bg-red-950/20 p-3 text-sm text-red-200">{error}</p>}
      {notice && <p role="status" className="mt-4 border border-emerald-300/30 bg-emerald-950/20 p-3 text-sm text-emerald-100">{notice}</p>}
    </div>
    {result && <div className="border p-5 sm:p-6" style={cardStyle}><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="text-lg font-bold text-white">{result.title}</h2><span className="font-mono text-xs text-white/45">{result.rows.length.toLocaleString()} rows</span></div><p className="mt-1 text-xs text-white/50">{result.note}</p>{result.mergeCandidates && <section className="mt-4 border-y border-[var(--navy-light)] py-4"><div className="flex flex-wrap items-end gap-3"><label className="min-w-56 flex-1 text-xs text-white/60">Find spelling variants or other profiles<input value={mergeSearch} onChange={event => setMergeSearch(event.target.value)} placeholder="Search by name, country or profile ID" className="mt-1 block w-full border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]" /></label><label className="min-w-44 flex-1 text-xs text-white/60">Type <strong className="text-white">MERGE</strong> to confirm<input autoComplete="off" value={mergeConfirmation} onChange={event => setMergeConfirmation(event.target.value)} className="mt-1 block w-full border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]" /></label><button type="button" onClick={() => void mergeProfiles()} disabled={busy || !canMerge || selectedProfileIds.length < 2 || !selectedProfileIds.includes(primaryProfileId) || mergeConfirmation.trim().toUpperCase() !== 'MERGE'} className="inline-flex min-h-10 items-center justify-center gap-2 bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--navy)] disabled:opacity-40"><GitMerge size={15} />{busy ? 'Merging…' : `Merge ${selectedProfileIds.length} profiles`}</button></div><p className="mt-2 text-xs text-white/45">Select profiles in the matching names below, then choose “Keep” for the primary profile. {selectedProfileIds.length} selected.</p>{!canMerge && <p className="mt-2 text-xs text-amber-200/75">Your account does not have the merge swimmers permission. You can select profiles, but merging is disabled.</p>}</section>}{result.rows.length ? <div className="ta-table-scroll mt-2"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b border-[var(--navy-light)] text-[10px] uppercase tracking-widest text-white/45">{result.duplicateProfiles && <><th className="px-3 py-3">Select</th><th className="px-3 py-3">Keep</th></>}{result.columns.map(column => <th key={column} className="whitespace-nowrap px-3 py-3">{column}</th>)}{result.editableProfiles && canMerge && <th className="px-3 py-3 text-right">Actions</th>}</tr></thead><tbody>{result.rows.map((row, index) => { const profile = result.duplicateProfiles?.[index]; const editableProfile = result.editableProfiles?.[index]; const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() : row[0]; return <><tr key={`${row.join('|')}-${index}`} className="border-b border-[var(--navy-light)] last:border-0">{profile && <><td className="px-3 py-3"><input type="checkbox" aria-label={`Select ${name}`} checked={selectedProfileIds.includes(profile.id)} disabled={busy} onChange={event => toggleProfile(profile.id, event.target.checked)} className="accent-[var(--accent)]" /></td><td className="px-3 py-3"><input type="radio" name="data-query-merge-primary" aria-label={`Keep ${name} as the primary profile`} checked={primaryProfileId === profile.id} disabled={busy || !selectedProfileIds.includes(profile.id)} onChange={() => setPrimaryProfileId(profile.id)} className="accent-[var(--accent)]" /></td></>}{row.map((value, cell) => <td key={`${result.columns[cell]}-${index}`} className="max-w-72 truncate px-3 py-3 text-white/75" title={value}>{value}</td>)}{editableProfile && canMerge && <td className="px-3 py-2 text-right"><button type="button" onClick={() => editingProfile?.id === editableProfile.id ? setEditingProfile(null) : beginProfileEdit(editableProfile)} className="inline-flex min-h-9 items-center gap-2 border border-[var(--navy-light)] px-3 text-xs font-semibold text-white hover:border-[var(--accent)]"><Pencil size={13}/>Edit</button></td>}</tr>{editableProfile && editingProfile?.id === editableProfile.id && <tr key={`edit-${editableProfile.id}`} className="border-b border-[var(--navy-light)]"><td colSpan={result.columns.length + 1} className="bg-[var(--navy-mid)] p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{([['first_name','First name'],['last_name','Last name'],['date_of_birth','Date of birth'],['country','Country'],['gender','Gender'],['transplant_type','Transplant type'],['club_name','Club']] as const).map(([key,label])=><label key={key} className="text-xs text-white/60">{label}{key==='country'?<select value={profileDraft.country} onChange={event=>{const selected=countries.find(country=>country.name===event.target.value);setProfileDraft(current=>({...current,country:event.target.value,country_code:selected?.code??''}));}} className="mt-1 block w-full border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--accent)]"><option value="">No country</option>{profileDraft.country&&!countries.some(country=>country.name===profileDraft.country)&&<option value={profileDraft.country}>{profileDraft.country}</option>}{countries.map(country=><option key={country.code} value={country.name}>{country.flag} {country.name}</option>)}</select>:key==='gender'?<select value={profileDraft.gender} onChange={event=>setProfileDraft(current=>({...current,gender:event.target.value}))} className="mt-1 block w-full border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--accent)]"><option value="">Not specified</option>{GENDERS.map(value=><option key={value} value={value}>{value}</option>)}</select>:key==='transplant_type'?<select value={profileDraft.transplant_type} onChange={event=>setProfileDraft(current=>({...current,transplant_type:event.target.value}))} className="mt-1 block w-full border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--accent)]"><option value="">Not specified</option>{TRANSPLANT_TYPES.map(value=><option key={value} value={value}>{value}</option>)}</select>:<input type={key==='date_of_birth'?'date':'text'} value={profileDraft[key]} onChange={event=>setProfileDraft(current=>({...current,[key]:event.target.value}))} className="mt-1 block w-full border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--accent)]" />}</label>)}</div><div className="mt-3 flex flex-wrap justify-end gap-2"><button type="button" onClick={()=>setEditingProfile(null)} disabled={busy} className="inline-flex min-h-9 items-center gap-2 border border-[var(--navy-light)] px-3 text-xs font-semibold text-white/70"><X size={13}/>Cancel</button><button type="button" onClick={()=>void saveProfileEdit()} disabled={busy||!profileDraft.first_name.trim()||!profileDraft.last_name.trim()} className="inline-flex min-h-9 items-center gap-2 bg-[var(--accent)] px-3 text-xs font-bold text-[var(--navy)] disabled:opacity-40"><Check size={13}/>{busy?'Saving…':'Save changes'}</button></div></td></tr>}</>; })}</tbody></table></div> : <p className="mt-4 border border-[var(--navy-light)] p-5 text-center text-sm text-white/55">No matching records were found.</p>}
      {result.mergeCandidates ? <section className="mt-6 border-t border-[var(--navy-light)] pt-5"><div className="flex items-start gap-3"><GitMerge size={17} className="mt-0.5 text-[var(--accent)]" /><div><h3 className="text-sm font-bold text-white">Merge selected profiles</h3><p className="mt-1 max-w-3xl text-xs leading-5 text-white/50">Select the profiles you have confirmed belong to one swimmer, then choose which profile ID to keep. Names do not need to match exactly when you select profiles. Results across all age groups, medals, claims, verified record links and source identifiers are transferred. Different times for the same meet, event and age group are preserved as separate results; exact duplicates are combined.</p></div></div>
        {!canMerge && <p className="mt-3 text-xs text-amber-200/75">Your account does not have the merge swimmers permission.</p>}
        <label className="mt-4 block text-xs text-white/60">Find swimmer profiles to merge, including spelling variants<input value={mergeSearch} onChange={event => setMergeSearch(event.target.value)} placeholder="Search by name, country or profile ID" className="mt-1 block w-full border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]" /></label>
        <div className="ta-table-scroll mt-3"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b border-[var(--navy-light)] text-[10px] uppercase tracking-widest text-white/45"><th className="px-3 py-3">Select</th><th className="px-3 py-3">Keep</th><th className="px-3 py-3">Swimmer</th><th className="px-3 py-3">Country</th><th className="px-3 py-3">Profile ID</th></tr></thead><tbody>{selectedProfiles.map(profile => { const name = `${profile.first_name} ${profile.last_name}`.trim(); return <tr key={`selected-${profile.id}`} className="border-b border-[var(--navy-light)] last:border-0"><td className="px-3 py-3"><input type="checkbox" aria-label={`Remove ${name} from selection`} checked disabled={busy} onChange={() => toggleProfile(profile.id, false)} className="accent-[var(--accent)]" /></td><td className="px-3 py-3"><input type="radio" name="data-query-merge-primary" aria-label={`Keep ${name} as the primary profile`} checked={primaryProfileId === profile.id} disabled={busy} onChange={() => setPrimaryProfileId(profile.id)} className="accent-[var(--accent)]" /></td><td className="px-3 py-3 font-semibold text-white/80">{name}</td><td className="px-3 py-3 text-white/65">{profile.country ?? '—'}</td><td className="px-3 py-3 font-mono text-[10px] text-white/45">{profile.id}</td></tr>; })}{matchingMergeProfiles.filter(profile => !selectedProfileIds.includes(profile.id)).map(profile => { const name = `${profile.first_name} ${profile.last_name}`.trim(); return <tr key={profile.id} className="border-b border-[var(--navy-light)] last:border-0"><td className="px-3 py-3"><input type="checkbox" aria-label={`Select ${name}`} checked={false} disabled={busy} onChange={event => toggleProfile(profile.id, event.target.checked)} className="accent-[var(--accent)]" /></td><td className="px-3 py-3"><input type="radio" name="data-query-merge-primary" aria-label={`Keep ${name} as the primary profile`} checked={false} disabled={busy || !selectedProfileIds.includes(profile.id)} onChange={() => setPrimaryProfileId(profile.id)} className="accent-[var(--accent)]" /></td><td className="px-3 py-3 font-semibold text-white/80">{name}</td><td className="px-3 py-3 text-white/65">{profile.country ?? '—'}</td><td className="px-3 py-3 font-mono text-[10px] text-white/45">{profile.id}</td></tr>; })}</tbody></table></div>
        {canMerge && <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><label className="text-xs text-white/60">Type <strong className="text-white">MERGE</strong> to confirm<input autoComplete="off" value={mergeConfirmation} onChange={event => setMergeConfirmation(event.target.value)} className="mt-1 block w-full border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]" /></label><button type="button" onClick={() => void mergeProfiles()} disabled={busy || selectedProfileIds.length < 2 || !selectedProfileIds.includes(primaryProfileId) || mergeConfirmation.trim().toUpperCase() !== 'MERGE'} className="inline-flex min-h-10 items-center justify-center gap-2 bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--navy)] disabled:opacity-40"><GitMerge size={15} />{busy ? 'Merging…' : `Merge ${selectedProfileIds.length} profiles`}</button></div>}
      </section> : null}</div>}
  </div>;
}
