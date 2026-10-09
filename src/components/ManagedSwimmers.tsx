import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { countries } from '../data/countries';
import { TRANSPLANT_TYPES, type Gender, type TransplantType } from '../types';
import { loadClubRecords } from '../lib/clubs';
import { supabase } from '../lib/supabase';
import { deleteManagedSwimmer, loadClaimableSwimmerProfiles, loadManagedSwimmers, saveManagedSwimmer, type PublicSwimmerProfile, type SwimmerProfile, type SwimmerProfileDraft } from '../lib/swimmerSubmissions';
import { isClaimEvidenceSufficient } from '../lib/adminImports';
import { describeSupabaseError } from '../lib/supabase';
import { Skeleton } from './Skeleton';

type SwimmerFormValues = Omit<SwimmerProfileDraft, 'id'>;
const MINOR_AGE_GROUPS = ['Under 18', '5 and under', '6-8', '9-11', '12-14', '15-17'];

const emptyForm = (isAccountHolder: boolean): SwimmerFormValues => ({
  firstName: '', lastName: '', dateOfBirth: '', gender: 'Women', transplantType: 'Kidney', country: '', countryCode: '', clubName: '', clubId: '', isAccountHolder,
});

function formFromProfile(profile: SwimmerProfile): SwimmerProfileDraft {
  return { ...profile };
}

export default function ManagedSwimmers() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<SwimmerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [availableClubs, setAvailableClubs] = useState<Array<{ id: string; name: string; country: string }>>([]);
  const [requestClubFor, setRequestClubFor] = useState<string | null>(null);
  const [clubRequest, setClubRequest] = useState({ name: '', country: '', city: '' });
  const [clubRequestSaving, setClubRequestSaving] = useState(false);
  const [holderForm, setHolderForm] = useState<SwimmerFormValues>(() => ({
    ...emptyForm(true),
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    dateOfBirth: user?.dateOfBirth ?? '',
    gender: (user?.gender === 'Men' ? 'Men' : 'Women') as Gender,
    transplantType: (user?.transplantType as TransplantType) || 'Kidney',
    country: user?.country ?? '',
    countryCode: user?.countryCode ?? '',
    clubName: user?.club ?? '',
    clubId: user?.clubId ?? '',
  }));
  const [childForm, setChildForm] = useState<SwimmerFormValues>(() => emptyForm(false));
  const [childFormOpen, setChildFormOpen] = useState(false);
  const isOver17 = Boolean(user?.ageGroup && !MINOR_AGE_GROUPS.includes(user.ageGroup));
  const [dependentsVisible, setDependentsVisible] = useState(() => !isOver17);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [claimProfiles, setClaimProfiles] = useState<PublicSwimmerProfile[]>([]);
  const [claimSearch, setClaimSearch] = useState('');
  const [claimSelected, setClaimSelected] = useState<PublicSwimmerProfile | null>(null);
  const [claimEvidence, setClaimEvidence] = useState('');
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimSaving, setClaimSaving] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [createOwnProfile, setCreateOwnProfile] = useState(false);
  const holder = useMemo(() => profiles.find(profile => profile.isAccountHolder), [profiles]);
  const claimMatches = useMemo(() => {
    const query = claimSearch.trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (query.length < 2) return [];
    const tokens = query.split(/\s+/).filter(Boolean);
    const distance = (left: string, right: string) => {
      const row = Array.from({ length: right.length + 1 }, (_, index) => index);
      for (let i = 1; i <= left.length; i += 1) {
        let diagonal = row[0]; row[0] = i;
        for (let j = 1; j <= right.length; j += 1) {
          const above = row[j];
          row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
          diagonal = above;
        }
      }
      return row[right.length];
    };
    const normalize = (value: string) => value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return claimProfiles.map(profile => {
      const first = normalize(profile.first_name);
      const last = normalize(profile.last_name);
      const full = `${first} ${last}`;
      const fields = [first, last, full, normalize(profile.country ?? ''), normalize(profile.club_name ?? '')];
      const score = tokens.reduce((total, token) => {
        const exact = fields.some(field => field.includes(token));
        if (exact) return total + 3;
        const close = [first, last].some(field => field.split(/\s+/).some(word => token.length >= 4 && distance(token, word) <= 1));
        return total + (close ? 1 : 0);
      }, 0);
      return { profile, score };
    }).filter(match => match.score >= tokens.length * 2)
      .sort((left, right) => right.score - left.score || left.profile.last_name.localeCompare(right.profile.last_name) || left.profile.first_name.localeCompare(right.profile.first_name))
      .slice(0, 10).map(match => match.profile);
  }, [claimProfiles, claimSearch]);

  useEffect(() => {
    if (holder || user?.accountRole === 'parent_guardian' || user?.registrantRelationship || !supabase) return;
    const db = supabase;
    let cancelled = false;
    setClaimLoading(true);
    Promise.all([
      loadClaimableSwimmerProfiles(),
      db.auth.getUser().then(({ data, error: authError }) => {
        if (authError) throw authError;
        if (!data.user) return null;
        return db.from('profile_claims').select('status').eq('claimant_id', data.user.id).in('status', ['pending', 'approved', 'disputed']).order('created_at', { ascending: false }).limit(1).maybeSingle();
      }),
    ]).then(([directory, claimResult]) => {
      if (claimResult?.error) throw claimResult.error;
      if (!cancelled) {
        setClaimProfiles(directory);
        setClaimStatus(claimResult?.data?.status ?? null);
      }
    }).catch(reason => { if (!cancelled) setClaimError(describeSupabaseError(reason)); })
      .finally(() => { if (!cancelled) setClaimLoading(false); });
    return () => { cancelled = true; };
  }, [holder, user?.accountRole, user?.registrantRelationship]);

  const submitClaim = async () => {
    if (!supabase || !claimSelected) return;
    setClaimSaving(true); setClaimError('');
    try {
      const { error: submitError } = await supabase.rpc('submit_profile_claim', { p_swimmer_profile_id: claimSelected.id, p_evidence: claimEvidence, p_evidence_file_path: null });
      if (submitError) throw submitError;
      setClaimStatus('pending'); setClaimSelected(null); setClaimEvidence('');
    } catch (reason) { setClaimError(describeSupabaseError(reason)); }
    finally { setClaimSaving(false); }
  };

  useEffect(() => {
    loadClubRecords().then(records => {
      setAvailableClubs(records.map(club => ({ id: club.id, name: club.name, country: club.country })));
    }).catch(() => setAvailableClubs([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadManagedSwimmers().then(async loadedItems => {
      let items = loadedItems;
      const managesSignupSwimmer = user?.accountRole === 'parent_guardian' || !!user?.registrantRelationship;
      if (managesSignupSwimmer && user?.dateOfBirth && user.firstName && user.lastName) {
        const existingSignupSwimmer = items.some(profile =>
          !profile.isAccountHolder
          && profile.firstName.toLowerCase() === user.firstName.toLowerCase()
          && profile.lastName.toLowerCase() === user.lastName.toLowerCase()
          && profile.dateOfBirth === user.dateOfBirth,
        );
        if (!existingSignupSwimmer) {
          const profile = await saveManagedSwimmer({
            firstName: user.firstName,
            lastName: user.lastName,
            dateOfBirth: user.dateOfBirth,
            gender: (user.gender === 'Men' ? 'Men' : 'Women') as Gender,
            transplantType: (user.transplantType as TransplantType) || 'Kidney',
            country: user.country ?? '',
            countryCode: user.countryCode ?? '',
            clubName: user.club ?? '',
            clubId: user.clubId ?? '',
            isAccountHolder: false,
          });
          items = [...items, profile];
        }
      }
      if (!cancelled) {
        setProfiles(items);
        const savedHolder = items.find(profile => profile.isAccountHolder);
        if (savedHolder) setHolderForm(formFromProfile(savedHolder));
      }
    }).catch(reason => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load swimmer profiles.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const onCountryChange = (value: string, isHolder: boolean) => {
    const country = countries.find(item => item.code === value);
    const updater = isHolder ? setHolderForm : setChildForm;
    updater(current => ({ ...current, country: country?.name ?? '', countryCode: country?.code ?? '' }));
  };

  const submitClubRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!supabase || !user) {
      setError('Sign in to request a club listing.');
      return;
    }
    if (availableClubs.some(club => club.name.trim().toLocaleLowerCase() === clubRequest.name.trim().toLocaleLowerCase() && club.country.trim().toLocaleLowerCase() === clubRequest.country.trim().toLocaleLowerCase())) {
      setError('That club is already in the directory. Select it from the Club list instead.');
      return;
    }
    const isHolderRequest = requestClubFor === 'holder';
    const isNewChildRequest = requestClubFor === 'child';
    const targetProfile = isHolderRequest ? holder : isNewChildRequest ? undefined : profiles.find(profile => profile.id === requestClubFor);
    const targetDraft = isHolderRequest ? holderForm : childForm;
    if (!isHolderRequest && !isNewChildRequest && !targetProfile) {
      setError('Choose a swimmer profile before requesting its club.');
      return;
    }
    if (!targetDraft.firstName.trim() || !targetDraft.lastName.trim() || !targetDraft.dateOfBirth || !targetDraft.country) {
      setError('Complete the swimmer profile details first. This links the club request to the swimmer so WTG results can be submitted.');
      return;
    }
    setClubRequestSaving(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const account = authData.user;
      if (!account?.email) throw new Error('Your account email could not be found.');
      const { data: existingRequest, error: lookupError } = await supabase.from('club_requests').select('id').eq('requested_by', account.id).ilike('name', clubRequest.name.trim()).eq('country', clubRequest.country).in('status', ['pending', 'reviewed']).maybeSingle();
      if (lookupError) throw lookupError;
      if (!existingRequest) {
        const { error: requestError } = await supabase.from('club_requests').insert({
          name: clubRequest.name.trim(),
          country: clubRequest.country,
          city: clubRequest.city.trim(),
          contact_email: account.email,
          contact_name: `${user.firstName} ${user.lastName}`.trim() || account.email,
          requested_by: account.id,
        });
        if (requestError) throw requestError;
      }
      const linkedProfile = await saveManagedSwimmer({ ...targetDraft, id: targetProfile?.id, clubId: '', clubName: clubRequest.name.trim() });
      linkedProfile.clubRequestPending = true;
      setProfiles(current => targetProfile
        ? current.map(profile => profile.id === linkedProfile.id ? linkedProfile : profile)
        : [...current, linkedProfile]);
      if (linkedProfile.isAccountHolder) {
        setHolderForm(formFromProfile(linkedProfile));
        const { error: metadataError } = await supabase.auth.updateUser({ data: { club: linkedProfile.clubName, club_id: null } });
        if (metadataError) throw metadataError;
      } else {
        setChildForm(emptyForm(false));
        setChildFormOpen(false);
        setEditingId(null);
      }
      setRequestClubFor(null);
      setClubRequest({ name: '', country: '', city: '' });
      setMessage(`Club request submitted and linked to ${linkedProfile.firstName} ${linkedProfile.lastName}. You can submit WTG results for this swimmer while the request is reviewed.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not submit the club request.');
    } finally {
      setClubRequestSaving(false);
    }
  };

  const save = async (form: SwimmerFormValues, id?: string) => {
    setError('');
    setMessage('');
    if (!form.firstName.trim() || !form.lastName.trim() || !form.dateOfBirth || !form.country) {
      setError('Complete the swimmer name, date of birth, gender, transplant type, and country.');
      return;
    }
    setSaving(true);
    try {
      const profile = await saveManagedSwimmer({ ...form, id });
      setProfiles(current => id ? current.map(item => item.id === id ? profile : item) : [...current, profile]);
      if (profile.isAccountHolder) {
        setHolderForm(formFromProfile(profile));
        if (supabase) {
          const { error: accountError } = await supabase.auth.updateUser({ data: { club: profile.clubName || null, club_id: profile.clubId || null } });
          if (accountError) throw accountError;
        }
      }
      if (id) setEditingId(null);
      else {
        setChildForm(emptyForm(false));
        setChildFormOpen(false);
      }
      setMessage('Swimmer profile saved. Date of birth is kept private.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the swimmer profile.');
    } finally { setSaving(false); }
  };

  const remove = async (profile: SwimmerProfile) => {
    if (!window.confirm(`Remove ${profile.firstName} ${profile.lastName} from your swimmer profiles? Their submitted meet results will remain.`)) return;
    setError('');
    try {
      await deleteManagedSwimmer(profile.id);
      setProfiles(current => current.filter(item => item.id !== profile.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not remove the swimmer profile.');
    }
  };

  const fields = (form: SwimmerFormValues, setForm: (updater: (current: SwimmerFormValues) => SwimmerFormValues) => void, id: string) => <>
  <div className="grid gap-3 sm:grid-cols-2">
    <label className="text-xs font-semibold text-[var(--muted)]">First name<input required autoComplete="given-name" value={form.firstName} onChange={event => setForm(current => ({ ...current, firstName: event.target.value }))} className="mt-1.5 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)]" /></label>
    <label className="text-xs font-semibold text-[var(--muted)]">Last name<input required autoComplete="family-name" value={form.lastName} onChange={event => setForm(current => ({ ...current, lastName: event.target.value }))} className="mt-1.5 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)]" /></label>
    <label className="text-xs font-semibold text-[var(--muted)]">Date of birth <span className="font-normal">(private)</span><input required type="date" max={new Date().toISOString().slice(0, 10)} value={form.dateOfBirth} onChange={event => setForm(current => ({ ...current, dateOfBirth: event.target.value }))} className="mt-1.5 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)]" /></label>
    <label className="text-xs font-semibold text-[var(--muted)]">Gender<select required value={form.gender} onChange={event => setForm(current => ({ ...current, gender: event.target.value as Gender }))} className="mt-1.5 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)]"><option value="Men">Men</option><option value="Women">Women</option></select></label>
    <label className="text-xs font-semibold text-[var(--muted)]">Transplant type<select required value={form.transplantType} onChange={event => setForm(current => ({ ...current, transplantType: event.target.value as TransplantType }))} className="mt-1.5 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)]">{TRANSPLANT_TYPES.map(type => <option key={`${id}-${type}`} value={type}>{type}</option>)}</select></label>
    <label className="text-xs font-semibold text-[var(--muted)]">Country<select required value={form.countryCode} onChange={event => onCountryChange(event.target.value, form.isAccountHolder)} className="mt-1.5 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)]"><option value="">Select country</option>{countries.map(country => <option key={`${id}-${country.code}`} value={country.code}>{country.name}</option>)}</select></label>
    <label className="text-xs font-semibold text-[var(--muted)]">Club <span className="font-normal">(optional)</span><select value={requestClubFor === id ? '__request__' : form.clubId} onChange={event => { if (event.target.value === '__request__') { setRequestClubFor(id); setClubRequest({ name: '', country: form.country, city: '' }); return; } setRequestClubFor(null); const club = availableClubs.find(item => item.id === event.target.value); setForm(current => ({ ...current, clubName: club?.name ?? '', clubId: club?.id ?? '' })); }} className="mt-1.5 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)]"><option value="">No club selected</option>{availableClubs.map(club => <option key={`${id}-club-${club.id}`} value={club.id}>{club.name} · {club.country}</option>)}<option value="__request__">My club isn’t listed — request it</option></select></label>
  </div>
  {requestClubFor === id && <form onSubmit={event => void submitClubRequest(event)} className="mt-4 border-l-2 border-[var(--accent)] bg-[var(--paper)] p-4">
    <h4 className="text-sm font-semibold text-[var(--ink)]">Request a club listing</h4>
    <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">After review, an approved club is added to the shared directory and appears in club selectors across the site.</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-3">
      <label className="text-xs font-semibold text-[var(--muted)]">Club name<input required value={clubRequest.name} onChange={event => setClubRequest(current => ({ ...current, name: event.target.value }))} className="mt-1.5 w-full border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--ink)]" /></label>
      <label className="text-xs font-semibold text-[var(--muted)]">Country<select required value={clubRequest.country} onChange={event => setClubRequest(current => ({ ...current, country: event.target.value }))} className="mt-1.5 w-full border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--ink)]"><option value="">Select country</option>{countries.map(country => <option key={`${id}-request-${country.code}`} value={country.name}>{country.name}</option>)}</select></label>
      <label className="text-xs font-semibold text-[var(--muted)]">City / town<input required value={clubRequest.city} onChange={event => setClubRequest(current => ({ ...current, city: event.target.value }))} className="mt-1.5 w-full border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--ink)]" /></label>
    </div>
    <div className="mt-3 flex gap-3"><button type="submit" disabled={clubRequestSaving} className="bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--blue)] disabled:opacity-60">{clubRequestSaving ? 'Submitting…' : 'Submit club request'}</button><button type="button" onClick={() => setRequestClubFor(null)} className="text-sm font-semibold text-[var(--muted)]">Cancel</button></div>
  </form>}
  </>;

  return <section className="bg-white">
    <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 sm:px-6">
      <div><h2 className="text-lg font-bold tracking-tight text-[var(--ink)]">My swimmers</h2><p className="mt-1 text-xs text-[var(--muted)]">Manage your own details and swimmers you care for.</p></div>
    </div>
    <div className="space-y-6 p-5 sm:p-6">
      {loading ? <div role="status" aria-label="Loading swimmer profiles" className="space-y-4"><Skeleton className="h-5 w-2/5" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : <>
        {user?.accountRole !== 'parent_guardian' && !user?.registrantRelationship && <div className="border-b border-[var(--border)] pb-6">
          <h3 className="mb-3 font-semibold text-[var(--ink)]">My swimmer profile</h3>
          {!holder && claimStatus && <div role="status" className="mb-4 border border-[var(--border)] bg-[var(--paper)] p-4 text-sm text-[var(--ink)]"><p className="font-semibold">{claimStatus === 'approved' ? 'Your profile claim was approved.' : claimStatus === 'disputed' ? 'Your profile claim needs further review.' : 'Your profile claim is being reviewed.'}</p><p className="mt-1 text-[var(--muted)]">We’ll link the existing swimmer profile to your account after review. The imported results will stay with it.</p></div>}
          {!holder && !claimStatus && <div className="mb-4 border border-[var(--border)] bg-[var(--paper)] p-4">
            <h4 className="font-semibold text-[var(--ink)]">Already have results in Transplant Aquatics?</h4>
            <p className="mt-1 text-sm text-[var(--muted)]">Search for your existing swimmer profile first. A name match won’t claim it automatically; an admin reviews every request.</p>
            {!createOwnProfile && <>
              <label className="relative mt-3 block"><Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" /><input value={claimSearch} onChange={event => { setClaimSearch(event.target.value); setClaimSelected(null); }} placeholder="Search first and last name, country or club" className="w-full border border-[var(--border)] bg-white py-2.5 pl-9 pr-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-dark)]" /></label>
              {claimLoading ? <p className="mt-3 text-sm text-[var(--muted)]">Looking for profiles…</p> : claimSearch.trim().length >= 2 && <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{claimMatches.length ? claimMatches.map(profile => <button type="button" key={profile.id} onClick={() => setClaimSelected(profile)} className={`flex w-full items-center justify-between gap-3 border bg-white p-3 text-left ${claimSelected?.id === profile.id ? 'border-[var(--accent-dark)]' : 'border-[var(--border)]'}`}><span><span className="block text-sm font-semibold text-[var(--ink)]">{profile.first_name} {profile.last_name}</span><span className="mt-0.5 block text-xs text-[var(--muted)]">{[profile.country, profile.club_name, profile.transplant_type].filter(Boolean).join(' · ') || 'More details not available'}</span></span><span className="text-xs font-semibold text-[var(--blue)]">{claimSelected?.id === profile.id ? <Check size={16} /> : 'This is me'}</span></button>) : <p className="py-2 text-sm text-[var(--muted)]">No close matches. You can create a new swimmer profile below.</p>}</div>}
              {claimSelected && <div className="mt-3 border-l-2 border-[var(--accent)] bg-white p-3"><p className="text-sm font-semibold text-[var(--ink)]">Request this profile</p><p className="mt-1 text-xs text-[var(--muted)]">Tell the reviewers how they can confirm it’s yours. Include a meet, team, club, or other useful detail. Please don’t enter sensitive documents here.</p><textarea rows={3} value={claimEvidence} onChange={event => setClaimEvidence(event.target.value)} placeholder="At least 20 characters of supporting detail" className="mt-3 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)]" /><button type="button" disabled={claimSaving || !isClaimEvidenceSufficient(claimEvidence)} onClick={() => void submitClaim()} className="mt-3 bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{claimSaving ? 'Submitting…' : 'Submit for review'}</button></div>}
              <button type="button" onClick={() => { setCreateOwnProfile(true); setClaimSelected(null); }} className="mt-3 text-sm font-semibold text-[var(--blue)] hover:underline">I’m new to Transplant Aquatics →</button>
            </>}
            {createOwnProfile && <button type="button" onClick={() => setCreateOwnProfile(false)} className="text-sm font-semibold text-[var(--blue)] hover:underline">← Search existing profiles</button>}
            {claimError && <p role="alert" className="mt-3 text-sm text-red-700">{claimError}</p>}
          </div>}
          {(holder || !claimStatus && createOwnProfile) && <>{fields(holderForm, setHolderForm, 'holder')}
          <div className="mt-4 flex flex-wrap items-center gap-4"><button type="button" disabled={saving} onClick={() => void save(holderForm, holder?.id)} className="bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--blue)] disabled:opacity-60">{saving ? 'Saving…' : holder ? 'Save my details' : 'Create my swimmer profile'}</button>{holder && <Link to={`/athletes/${holder.id}`} className="text-sm font-semibold text-[var(--blue)] hover:underline">View athlete profile</Link>}</div></>}
        </div>}
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="font-semibold text-[var(--ink)]">{user?.accountRole === 'parent_guardian' || user?.registrantRelationship ? 'Swimmers managed by this account' : 'Children and dependents'}</h3>{(user?.accountRole === 'parent_guardian' || user?.registrantRelationship) && <p className="mt-1 text-xs text-[var(--muted)]">Your Join registration has been added as a swimmer profile.</p>}</div>
            <button type="button" role="switch" aria-checked={dependentsVisible} aria-controls="dependent-profiles" aria-label={dependentsVisible ? 'Hide children and dependents' : 'Show children and dependents'} onClick={() => setDependentsVisible(visible => !visible)} className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
              <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${dependentsVisible ? 'bg-[var(--blue)]' : 'bg-neutral-300'}`}><span className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${dependentsVisible ? 'translate-x-6' : 'translate-x-1'}`} /></span>
            </button>
          </div>
          <div id="dependent-profiles" hidden={!dependentsVisible}>
          <div className="mb-3 flex justify-end"><button type="button" onClick={() => { setChildFormOpen(open => !open); setEditingId(null); }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--blue)] hover:underline"><Plus size={15} /> Add swimmer</button></div>
          {profiles.filter(profile => !profile.isAccountHolder).length ? <div className="divide-y divide-[var(--border)]">
            {profiles.filter(profile => !profile.isAccountHolder).map(profile => <div key={profile.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div><p className="font-semibold text-[var(--ink)]">{profile.firstName} {profile.lastName}</p><p className="mt-0.5 text-xs text-[var(--muted)]">{profile.country} · DOB private</p><Link to={`/athletes/${profile.id}`} className="mt-1 inline-block text-xs font-semibold text-[var(--blue)] hover:underline">View athlete profile</Link></div>
              <div className="flex gap-3"><button type="button" onClick={() => { setEditingId(profile.id); setChildForm(formFromProfile(profile)); setChildFormOpen(false); }} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--blue)]"><Pencil size={13} /> Edit</button><button type="button" onClick={() => void remove(profile)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-700"><Trash2 size={13} /> Remove</button></div>
              {editingId === profile.id && <div className="w-full border-l-2 border-[var(--accent)] pl-4">{fields(childForm, setChildForm, profile.id)}<div className="mt-3 flex gap-3"><button type="button" disabled={saving} onClick={() => void save(childForm, profile.id)} className="bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Save changes</button><button type="button" onClick={() => setEditingId(null)} className="text-sm font-semibold text-[var(--muted)]">Cancel</button></div></div>}
            </div>)}
          </div> : <p className="text-sm text-[var(--muted)]">No child or dependent profiles yet.</p>}
          {childFormOpen && <div className="mt-4 border-l-2 border-[var(--accent)] pl-4"><h4 className="mb-3 text-sm font-semibold text-[var(--ink)]">Add a swimmer</h4>{fields(childForm, updater => setChildForm(updater), 'child')}<button type="button" disabled={saving} onClick={() => void save(childForm)} className="mt-4 bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--blue)] disabled:opacity-60">{saving ? 'Saving…' : 'Save swimmer'}</button></div>}
          </div>
        </div>
      </>}
      {error && <p role="alert" className="border-l-2 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    </div>
  </section>;
}
