import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { countries } from '../data/countries';
import { TRANSPLANT_TYPES, type Gender, type TransplantType } from '../types';
import { loadClubRecords } from '../lib/clubs';
import { supabase } from '../lib/supabase';
import { deleteManagedSwimmer, loadManagedSwimmers, saveManagedSwimmer, type SwimmerProfile, type SwimmerProfileDraft } from '../lib/swimmerSubmissions';
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
  const holder = useMemo(() => profiles.find(profile => profile.isAccountHolder), [profiles]);

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
          {fields(holderForm, setHolderForm, 'holder')}
          <div className="mt-4 flex flex-wrap items-center gap-4"><button type="button" disabled={saving} onClick={() => void save(holderForm, holder?.id)} className="bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--blue)] disabled:opacity-60">{saving ? 'Saving…' : holder ? 'Save my details' : 'Create my swimmer profile'}</button>{holder && <Link to={`/athletes/${holder.id}`} className="text-sm font-semibold text-[var(--blue)] hover:underline">View athlete profile</Link>}</div>
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
