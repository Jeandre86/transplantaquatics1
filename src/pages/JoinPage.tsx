import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { countries } from '../data/countries';
import { TRANSPLANT_TYPES, GENDERS, EVENTS } from '../types';
import Button from '../components/Button';
import Eyebrow from '../components/Eyebrow';
import { CheckCircle } from 'lucide-react';
import { hasSupabaseConfig, supabase } from '../lib/supabase';
import { getAgeAtDate, getCompetitionAgeGroup } from '../lib/competitionAge';

type JoinRole = 'swimmer' | 'parent_guardian' | 'coach';

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const clubClaimId = searchParams.get('clubClaim');
  const [submitted, setSubmitted] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [joinRole, setJoinRole] = useState<JoinRole>(() => clubClaimId ? 'coach' : 'swimmer');
  const [availableClubs, setAvailableClubs] = useState<Array<{ id: string; name: string; country: string }>>([]);
  const [requestClub, setRequestClub] = useState(false);
  const [clubRequest, setClubRequest] = useState({ name: '', country: '', city: '' });
  const [clubId, setClubId] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    dateOfBirth: '',
    registrantRelationship: '',
    country: '',
    transplantType: '',
    gender: '',
    club: '',
    primaryEvent: '',
  });

  useEffect(() => {
    if (!supabase) return;

    const activateIfConfirmed = (session: Session | null) => {
      if (!session?.user.email_confirmed_at) return;
      if (clubClaimId) {
        if (session.user.user_metadata?.account_role !== 'coach') {
          setError('This invitation is for a coach account. Sign out and use or create a coach account to accept it.');
          return;
        }
        navigate(`/coach/club?claimInvite=${encodeURIComponent(clubClaimId)}`, { replace: true });
        return;
      }
      setSubmitted(true);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      activateIfConfirmed(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      activateIfConfirmed(session);
    });

    return () => subscription.unsubscribe();
  }, [clubClaimId, navigate]);

  useEffect(() => {
    if (!supabase) { setAvailableClubs([]); return; }
    supabase.from('clubs').select('id, name, country').order('name').then(({ data }) => {
      const liveOptions = (data ?? []) as Array<{ id: string; name: string; country: string }>;
      setAvailableClubs(liveOptions);
    });
  }, []);

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const ageAtSignup = form.dateOfBirth ? getAgeAtDate(form.dateOfBirth, today) : null;
  const ageGroupAtSignup = form.dateOfBirth ? getCompetitionAgeGroup(form.dateOfBirth, today) : null;
  const needsResponsibleAdult = joinRole === 'swimmer' && ageAtSignup !== null && ageAtSignup < 17;
  const isSwimmerAccount = joinRole !== 'coach';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!hasSupabaseConfig || !supabase) {
      setError('Email verification is not connected yet. Add your Supabase Project URL and public key to .env.local, then try again.');
      return;
    }
    if (isSwimmerAccount && (!ageGroupAtSignup || ageAtSignup === null)) {
      setError('Enter a valid date of birth so we can calculate the swimmer’s age group.');
      return;
    }
    if (needsResponsibleAdult && !['parent', 'guardian', 'coach'].includes(form.registrantRelationship)) {
      setError('Select whether you are the swimmer’s parent, guardian, or coach.');
      return;
    }

    setLoading(true);
    try {
      const countryCode = countries.find(country => country.name === form.country)?.code;
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            first_name: form.firstName,
            last_name: form.lastName,
            account_role: needsResponsibleAdult ? 'parent_guardian' : joinRole,
            date_of_birth: isSwimmerAccount ? form.dateOfBirth : null,
            country: isSwimmerAccount ? form.country : null,
            country_code: isSwimmerAccount ? countryCode : null,
            transplant_type: isSwimmerAccount ? form.transplantType : null,
            age_group: isSwimmerAccount ? ageGroupAtSignup : null,
            registrant_relationship: needsResponsibleAdult ? form.registrantRelationship : (joinRole === 'parent_guardian' ? 'parent' : null),
            gender: isSwimmerAccount ? form.gender : null,
            club: isSwimmerAccount ? (requestClub ? clubRequest.name.trim() : form.club || null) : null,
            club_id: isSwimmerAccount ? (clubId || null) : null,
            primary_event: isSwimmerAccount ? form.primaryEvent : null,
          },
          emailRedirectTo: clubClaimId
            ? `${window.location.origin}/coach/club?claimInvite=${encodeURIComponent(clubClaimId)}`
            : `${window.location.origin}/join`,
        },
      });
      if (signupError) throw signupError;
      if (requestClub && !signupData.user) {
        setConfirmationSent(true);
        setNotice(`We sent a confirmation link to ${form.email}. Your account was created, but the club request could not be linked automatically. After activating your account, request the club under Profile → Account → My swimmers.`);
        return;
      }
      if (requestClub && signupData.user) {
        const { error: requestError } = await supabase.from('club_requests').insert({
          name: clubRequest.name.trim(), country: clubRequest.country, city: clubRequest.city.trim(),
          contact_email: form.email.trim(), contact_name: `${form.firstName} ${form.lastName}`.trim(),
          requested_by: signupData.user.id,
        });
        if (requestError) {
          setConfirmationSent(true);
          setNotice(`We sent a confirmation link to ${form.email}. Your account was created, but the club request could not be saved. After activating your account, request the club under Profile → Account → My swimmers.`);
          setError(requestError.message);
          return;
        }
      }
      setConfirmationSent(true);
      setNotice(`We sent a confirmation link to ${form.email}. Open it to activate your account.${requestClub ? ' Your club request is linked to your swimmer profile, so you can submit WTG results while it is reviewed.' : ''}`);
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : 'We could not start your registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setError('');
    setNotice('');
    if (!supabase) return;
    setLoading(true);
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: form.email });
    if (resendError) setError(resendError.message);
    else setNotice(`A new confirmation link was sent to ${form.email}.`);
    setLoading(false);
  };

  if (submitted) {
    return (
      <div style={{ backgroundColor: 'var(--paper)' }} className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <CheckCircle size={48} className="mx-auto mb-6" style={{ color: 'var(--accent)' }} />
          <h2 className="text-3xl font-black tracking-tight">Email verified.</h2>
          <p className="mt-4 text-neutral-600 text-base leading-relaxed">
            Your account is active and your athlete details have been saved securely.
          </p>
          <div className="mt-8 flex gap-3 justify-center">
            <Button variant="secondary" onClick={() => setSubmitted(false)}>Back</Button>
            <Button variant="primary" onClick={() => window.location.href = '/'}>Go to Homepage</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--paper)' }}>
      {/* Header */}
      <div style={{ backgroundColor: "var(--navy)" }} className="text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <Eyebrow light className="mb-3">Join Transplant Aquatics</Eyebrow>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-none">
            Your swim.
            <br />
            Your story.
          </h1>
          <p className="mt-5 text-neutral-400 text-base max-w-xl leading-relaxed">
            Join as a swimmer, parent or guardian, or coach and become part of the global transplant swimming community.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-16">
        {confirmationSent ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-neutral-900">Check your email</h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">Click the confirmation link in the email sent to <strong>{form.email}</strong>. You’ll return here after your account is activated.</p>
            </div>
            {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button type="button" onClick={resendCode} disabled={loading} className="w-full text-sm font-semibold text-neutral-700 underline underline-offset-4 disabled:opacity-50">
              {loading ? 'Sending…' : 'Resend confirmation email'}
            </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div>
          {clubClaimId && <p className="border-l-2 border-[var(--accent)] bg-white px-4 py-3 text-sm leading-relaxed text-neutral-700">You’ve been invited to join or claim a club. Create a coach account using the exact email address the invitation was sent to.</p>}
          <label className="mb-1.5 block font-mono text-xs uppercase tracking-widest text-neutral-500">I’m joining as *</label>
            <select required disabled={Boolean(clubClaimId)} value={joinRole} onChange={event => { setJoinRole(event.target.value as JoinRole); setRequestClub(false); setClubId(''); }} className="w-full appearance-none border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-1 focus:ring-black disabled:opacity-70" style={{ borderRadius: 0 }}>
              <option value="swimmer">Swimmer</option><option value="parent_guardian">Parent / Guardian</option><option value="coach">Coach</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs tracking-widest uppercase text-neutral-500 mb-1.5">
                {isSwimmerAccount ? 'Swimmer first name *' : 'Coach first name *'}
              </label>
              <input
                required
                type="text"
                value={form.firstName}
                onChange={e => update('firstName', e.target.value)}
                className="w-full border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
                style={{ borderRadius: 0 }}
              />
            </div>
            <div>
              <label className="block font-mono text-xs tracking-widest uppercase text-neutral-500 mb-1.5">
                {isSwimmerAccount ? 'Swimmer last name *' : 'Coach last name *'}
              </label>
              <input
                required
                type="text"
                value={form.lastName}
                onChange={e => update('lastName', e.target.value)}
                className="w-full border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
                style={{ borderRadius: 0 }}
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs tracking-widest uppercase text-neutral-500 mb-1.5">
              Email *
            </label>
            <input
              required
              type="email"
              value={form.email}
              onChange={e => update('email', e.target.value)}
              className="w-full border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
              style={{ borderRadius: 0 }}
            />
          </div>

          <div>
            <label className="block font-mono text-xs tracking-widest uppercase text-neutral-500 mb-1.5">{needsResponsibleAdult ? 'Registering adult’s password *' : 'Password *'}</label>
            <input
              required
              minLength={8}
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={e => update('password', e.target.value)}
              className="w-full border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
              style={{ borderRadius: 0 }}
            />
            <p className="mt-1 text-xs text-neutral-500">Use at least 8 characters. You’ll use this to sign in.</p>
          </div>

          {isSwimmerAccount && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs tracking-widest uppercase text-neutral-500 mb-1.5">
                Country *
              </label>
              <select
                required
                value={form.country}
                onChange={e => update('country', e.target.value)}
                className="w-full border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white appearance-none"
                style={{ borderRadius: 0 }}
              >
                <option value="">Select country</option>
                {countries.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-xs tracking-widest uppercase text-neutral-500 mb-1.5">
                Transplant Type *
              </label>
              <select
                required
                value={form.transplantType}
                onChange={e => update('transplantType', e.target.value)}
                className="w-full border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white appearance-none"
                style={{ borderRadius: 0 }}
              >
                <option value="">Select type</option>
                {TRANSPLANT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>}

          {isSwimmerAccount && <div>
            <label className="block font-mono text-xs tracking-widest uppercase text-neutral-500 mb-1.5">
              Date of birth * <span className="normal-case tracking-normal">(kept private; age group is calculated for each meet)</span>
            </label>
            <input
              required
              max={today}
              type="date"
              value={form.dateOfBirth}
              onChange={e => update('dateOfBirth', e.target.value)}
              className="w-full border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
              style={{ borderRadius: 0 }}
            />
            {ageAtSignup !== null && ageGroupAtSignup && <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-l-2 border-[var(--accent)] bg-white px-3 py-2 text-sm text-neutral-700">
              <span>Age at registration: <strong>{ageAtSignup}</strong></span>
              <span>Age group: <strong>{ageGroupAtSignup}</strong></span>
              <span className="text-xs text-neutral-500">Calculated from date of birth</span>
            </div>}
          </div>}

          {needsResponsibleAdult && <div className="border-l-2 border-[var(--accent)] bg-white p-4">
            <label htmlFor="registrant-relationship" className="block font-mono text-xs tracking-widest uppercase text-neutral-500 mb-1.5">
              Who is completing this registration? *
            </label>
            <select
              id="registrant-relationship"
              required
              value={form.registrantRelationship}
              onChange={e => update('registrantRelationship', e.target.value)}
              className="w-full border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white appearance-none"
              style={{ borderRadius: 0 }}
            >
              <option value="">Select your relationship to the swimmer</option>
              <option value="parent">Parent</option>
              <option value="guardian">Guardian</option>
              <option value="coach">Coach</option>
            </select>
            <p className="mt-2 text-xs leading-relaxed text-neutral-500">The swimmer’s details are listed above. Use the registering adult’s email address and password for this account.</p>
          </div>}

          {isSwimmerAccount && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs tracking-widest uppercase text-neutral-500 mb-1.5">
                Gender *
              </label>
              <select
                required
                value={form.gender}
                onChange={e => update('gender', e.target.value)}
                className="w-full border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white appearance-none"
                style={{ borderRadius: 0 }}
              >
                <option value="">Select gender</option>
                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>}

          {isSwimmerAccount && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs tracking-widest uppercase text-neutral-500 mb-1.5">
                Club (optional)
              </label>
              <select
                value={requestClub ? '__request__' : clubId}
                onChange={e => {
                  if (e.target.value === '__request__') { setRequestClub(true); setClubId(''); update('club', ''); }
                  else { setRequestClub(false); const selected = availableClubs.find(club => club.id === e.target.value); setClubId(selected?.id ?? ''); update('club', selected?.name ?? ''); }
                }}
                className="w-full border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
                style={{ borderRadius: 0 }}
              ><option value="">Choose a club (optional)</option>{availableClubs.map(club => <option key={club.id} value={club.id}>{club.name} · {club.country}</option>)}<option value="__request__">My club isn’t listed — request it</option></select>
            </div>
            <div>
              <label className="block font-mono text-xs tracking-widest uppercase text-neutral-500 mb-1.5">
                Primary Event *
              </label>
              <select
                required
                value={form.primaryEvent}
                onChange={e => update('primaryEvent', e.target.value)}
                className="w-full border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white appearance-none"
                style={{ borderRadius: 0 }}
              >
                <option value="">Select event</option>
                {EVENTS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>}

          {requestClub && isSwimmerAccount && <div className="grid grid-cols-1 gap-4 border-l-2 border-[var(--accent)] bg-white p-4 sm:grid-cols-3">
            <label className="text-xs font-semibold text-neutral-600">Club name *<input required value={clubRequest.name} onChange={event => setClubRequest(value => ({ ...value, name: event.target.value }))} className="mt-1.5 w-full border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900" /></label>
            <label className="text-xs font-semibold text-neutral-600">Country *<select required value={clubRequest.country} onChange={event => setClubRequest(value => ({ ...value, country: event.target.value }))} className="mt-1.5 w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900"><option value="">Select country</option>{countries.map(country => <option key={country.code} value={country.name}>{country.name}</option>)}</select></label>
            <label className="text-xs font-semibold text-neutral-600">City / town *<input required value={clubRequest.city} onChange={event => setClubRequest(value => ({ ...value, city: event.target.value }))} className="mt-1.5 w-full border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900" /></label>
            <p className="text-xs leading-relaxed text-neutral-500 sm:col-span-3">We’ll save this as a club listing request for the Transplant Aquatics team to review. You can continue without choosing a listed club.</p>
          </div>}

          <div className="pt-4">
            <Button type="submit" variant="primary" size="lg" className="w-full justify-center">
              {loading ? 'Sending verification email…' : 'Continue with email verification'}
            </Button>
            <p className="mt-3 text-xs text-neutral-500 text-center">We’ll email you a confirmation link before activating your account.</p>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
