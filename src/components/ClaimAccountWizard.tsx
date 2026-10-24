import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Search, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { describeSupabaseError, supabase } from '../lib/supabase';
import {
  loadClaimableSwimmerProfiles,
  loadPublicSwimmerResults,
  type PublicSwimmerProfile,
  type PublicSwimmerResult,
} from '../lib/swimmerSubmissions';

type ClaimStatus = 'pending' | 'approved' | 'disputed' | null;

function normalize(value: string) {
  return value.trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function strokeFromEvent(event: string) {
  const name = event.toLocaleLowerCase().replace(/^\s*\d+\s*m(?:etres?)?\s*/i, '').trim();
  if (/\b(freestyle|free)\b/.test(name)) return 'Freestyle';
  if (/\b(backstroke|back)\b/.test(name)) return 'Backstroke';
  if (/\b(breaststroke|breast)\b/.test(name)) return 'Breaststroke';
  if (/\b(butterfly|fly)\b/.test(name)) return 'Butterfly';
  if (/\b(individual medley|medley|im)\b/.test(name)) return 'Individual medley';
  return 'swimming';
}

function timeToSeconds(value: string): number | null {
  const time = value.trim();
  const minuteTime = /^(\d+):([0-5]?\d)(?:\.(\d{1,2}))?$/.exec(time);
  if (minuteTime) return Number(minuteTime[1]) * 60 + Number(`${minuteTime[2]}.${minuteTime[3] ?? '0'}`);
  if (!/^\d+(?:\.\d{1,2})?$/.test(time)) return null;
  const seconds = Number(time);
  return seconds > 0 && Number.isFinite(seconds) ? seconds : null;
}

export default function ClaimAccountWizard({ standalone = false }: { standalone?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<PublicSwimmerProfile[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PublicSwimmerProfile | null>(null);
  const [challenge, setChallenge] = useState<PublicSwimmerResult | null>(null);
  const [answer, setAnswer] = useState('');
  const [manualEvidence, setManualEvidence] = useState('');
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>(null);
  const [isNewMember, setIsNewMember] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!supabase || !user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [{ data: authData, error: authError }, claimableProfiles] = await Promise.all([
          supabase.auth.getUser(),
          loadClaimableSwimmerProfiles(),
        ]);
        if (authError) throw authError;
        const accountId = authData.user?.id;
        if (!accountId) throw new Error('Sign in again to check your profile claim.');
        try {
          setIsDismissed(window.localStorage.getItem(`ta_claim_prompt_dismissed:${accountId}`) === '1');
        } catch {
          setIsDismissed(false);
        }
        const [claimResult, onboardingResult] = await Promise.all([
          supabase.from('profile_claims')
            .select('status')
            .eq('claimant_id', accountId)
            .in('status', ['pending', 'approved', 'disputed'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from('member_onboarding')
            .select('status')
            .eq('account_id', accountId)
            .maybeSingle(),
        ]);
        if (claimResult.error) throw claimResult.error;
        if (onboardingResult.error) throw onboardingResult.error;
        if (cancelled) return;
        setProfiles(claimableProfiles);
        setClaimStatus((claimResult.data?.status as ClaimStatus) ?? null);
        setIsNewMember(onboardingResult.data?.status === 'new_member');
      } catch (reason) {
        if (!cancelled) setError(describeSupabaseError(reason));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.email]);

  const matches = useMemo(() => {
    const tokens = normalize(query).split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    return profiles.filter(profile => {
      const searchable = normalize(`${profile.first_name} ${profile.last_name} ${profile.country ?? ''} ${profile.club_name ?? ''}`);
      return tokens.every(token => searchable.includes(token));
    }).slice(0, 12);
  }, [profiles, query]);

  const startVerification = async (profile: PublicSwimmerProfile) => {
    if (!supabase) return;
    setSelected(profile);
    setChallenge(null);
    setAnswer('');
    setError('');
    setNotice('');
    setResultsLoading(true);
    try {
      const results = await loadPublicSwimmerResults(profile.id);
      const officialWtgResults = results
        .filter(result => (result.athlete_id ?? result.swimmer_id) === profile.id
          && result.is_world_transplant_games
          && result.status === 'verified')
        .sort((left, right) => (right.meet_year ?? 0) - (left.meet_year ?? 0) || left.event.localeCompare(right.event));
      if (officialWtgResults.length) {
        const picked = officialWtgResults[Math.floor(Math.random() * officialWtgResults.length)];
        setChallenge(picked);
      }
    } catch (reason) {
      setError(describeSupabaseError(reason));
    } finally {
      setResultsLoading(false);
    }
  };

  const submitClaim = async () => {
    if (!supabase || !selected || !challenge) return;
    const submittedSeconds = timeToSeconds(answer);
    if (submittedSeconds === null) {
      setError('Enter a valid swim time, such as 1:04.32 or 64.32.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { error: claimError } = await supabase.rpc('submit_verified_profile_claim', {
        p_swimmer_profile_id: selected.id,
        p_result_id: challenge.id,
        p_answer: answer.trim(),
      });
      if (claimError) throw claimError;
      setClaimStatus('pending');
      setNotice('Your WTG result matched. An admin will review the claim before linking this profile to your account.');
    } catch (reason) {
      setError(describeSupabaseError(reason));
    } finally {
      setSaving(false);
    }
  };

  const submitManualClaim = async () => {
    if (!supabase || !selected || manualEvidence.trim().length < 20) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { error: claimError } = await supabase.rpc('submit_profile_claim', {
        p_swimmer_profile_id: selected.id,
        p_evidence: manualEvidence.trim(),
        p_evidence_file_path: null,
      });
      if (claimError) throw claimError;
      setClaimStatus('pending');
      setNotice('Your request has been sent to an admin for review.');
    } catch (reason) {
      setError(describeSupabaseError(reason));
    } finally {
      setSaving(false);
    }
  };

  const markAsNewMember = async () => {
    if (!supabase) return;
    setSaving(true);
    setError('');
    try {
      const { error: onboardingError } = await supabase.rpc('mark_myself_as_new_member');
      if (onboardingError) throw onboardingError;
      setIsNewMember(true);
      if (!standalone) navigate('/profile?tab=account&new=1');
    } catch (reason) {
      setError(describeSupabaseError(reason));
    } finally {
      setSaving(false);
    }
  };

  const dismissClaimPrompt = async () => {
    if (!supabase) return;
    const { data: { user: account }, error: authError } = await supabase.auth.getUser();
    if (authError || !account) {
      setError(authError ? describeSupabaseError(authError) : 'Sign in again to dismiss this prompt.');
      return;
    }
    try {
      window.localStorage.setItem(`ta_claim_prompt_dismissed:${account.id}`, '1');
    } catch {
      // The current view can still be dismissed when browser storage is unavailable.
    }
    setIsDismissed(true);
  };

  if (loading || !user || (!standalone && (isDismissed || isNewMember || claimStatus === 'approved'))) return null;

  if (standalone && (isNewMember || claimStatus === 'approved')) {
    return <section className="border-l-4 border-emerald-600 bg-white p-5 shadow-sm sm:p-6" aria-live="polite">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-800">Athlete profile</p>
      <h2 className="mt-1 text-xl font-bold text-[var(--ink)]">{isNewMember ? 'Your new member profile is recorded' : 'Your athlete profile is linked'}</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{isNewMember ? 'We’ve let the admin team know that you’re new or could not find your existing profile.' : 'Your claimed athlete profile is linked to your account.'}</p>
    </section>;
  }

  if (claimStatus === 'pending' || claimStatus === 'disputed') {
    return <section aria-labelledby="claim-account-title" className="border-l-4 border-[var(--accent)] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 flex-1 items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center bg-[var(--paper)] text-[var(--blue)]"><ShieldCheck size={19} aria-hidden="true" /></span><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Athlete profile</p><h2 id="claim-account-title" className="mt-1 text-lg font-bold text-[var(--ink)]">Your claim is with the admin team</h2><p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">Your existing results will stay with the selected athlete profile. Once approved, it will be linked to this account and this section will disappear.</p></div></div>{!standalone && <button type="button" onClick={() => void dismissClaimPrompt()} className="inline-flex shrink-0 items-center justify-center border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:border-[var(--blue)] hover:text-[var(--blue)]">I already claimed my account</button>}</div>
    </section>;
  }

  return <section aria-labelledby="claim-account-title" className="border-l-4 border-[var(--blue)] bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--blue)]">Athlete profile</p>
        <h2 id="claim-account-title" className="mt-1 text-xl font-bold tracking-tight text-[var(--ink)]">First, find your athlete profile</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">Search the existing athlete records. If you find yourself, request the profile and an admin will review it. New to transplant swimming or not listed? Choose that option and we’ll mark you as a new member.</p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button type="button" disabled={saving || Boolean(claimStatus)} onClick={() => void markAsNewMember()} className="inline-flex items-center justify-center gap-2 bg-[var(--navy)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving…' : 'I’m new or can’t find myself'} <ArrowRight size={15} aria-hidden="true" /></button>
        {!standalone && <button type="button" onClick={() => void dismissClaimPrompt()} className="inline-flex items-center justify-center border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--ink)] hover:border-[var(--blue)] hover:text-[var(--blue)]">I already claimed my account</button>}
      </div>
    </div>

    {!selected ? <div className="mt-5">
      <label htmlFor="claim-athlete-search" className="mb-2 block text-sm font-semibold text-[var(--ink)]">Step 1 · Search athlete profiles</label>
      <div className="relative"><Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" /><input id="claim-athlete-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, country or club" className="w-full border border-[var(--border)] bg-[var(--paper)] py-3 pl-10 pr-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--blue)]" /></div>
      {query.trim().length >= 2 && <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
        {matches.length ? matches.map(profile => <button key={profile.id} type="button" onClick={() => void startVerification(profile)} className="flex w-full items-center justify-between gap-3 border border-[var(--border)] p-3 text-left transition-colors hover:border-[var(--blue)] hover:bg-[var(--paper)]"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-[var(--ink)]">{profile.first_name} {profile.last_name}</span><span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{[profile.country, profile.club_name, profile.transplant_type].filter(Boolean).join(' · ') || 'Athlete profile'}</span></span><span className="shrink-0 text-xs font-semibold text-[var(--blue)]">Select <ArrowRight size={13} className="ml-1 inline" aria-hidden="true" /></span></button>) : <p className="py-3 text-sm text-[var(--muted)]">No athlete profiles match that search. Try a shorter name or use “I’m new or can’t find myself” above.</p>}
      </div>}
    </div> : <div className="mt-5 border-t border-[var(--border)] pt-5">
      <button type="button" onClick={() => { setSelected(null); setChallenge(null); setAnswer(''); setError(''); }} className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--blue)] hover:underline"><ArrowLeft size={14} aria-hidden="true" /> Change athlete</button>
      <p className="text-sm font-semibold text-[var(--ink)]">Step 2 · Verify your result</p>
      <p className="mt-1 text-sm text-[var(--muted)]">Selected athlete: <strong className="text-[var(--ink)]">{selected.first_name} {selected.last_name}</strong></p>
      {resultsLoading ? <p className="mt-4 text-sm text-[var(--muted)]">Finding a verified World Transplant Games result…</p> : challenge ? <div className="mt-4 max-w-xl border border-[var(--border)] bg-[var(--paper)] p-4">
        <p className="text-xs font-mono uppercase tracking-wider text-[var(--muted)]">{challenge.meet_name}{challenge.meet_year ? ` · ${challenge.meet_year}` : ''}</p>
        <p className="mt-2 text-sm text-[var(--ink)]">What was your <strong>{strokeFromEvent(challenge.event)}</strong> time in the <strong>{challenge.event}</strong> event?</p>
        <label htmlFor="claim-swim-time" className="mt-3 block text-xs font-semibold text-[var(--muted)]">Your recorded time</label>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row"><input id="claim-swim-time" inputMode="decimal" autoComplete="off" value={answer} onChange={event => setAnswer(event.target.value)} placeholder="e.g. 1:04.32" className="min-w-0 flex-1 border border-[var(--border)] bg-white px-3 py-2.5 font-mono text-sm text-[var(--ink)] outline-none focus:border-[var(--blue)]" /><button type="button" disabled={saving || !answer.trim()} onClick={() => void submitClaim()} className="inline-flex items-center justify-center gap-2 bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Checking…' : 'Submit claim'} <ArrowRight size={15} aria-hidden="true" /></button></div>
        <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[var(--muted)]"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[var(--blue)]" aria-hidden="true" />A matching answer sends this request to an admin. The profile and its results are linked only after approval.</p>
      </div> : <div className="mt-4 max-w-xl border border-[var(--border)] bg-[var(--paper)] p-4"><p className="text-sm font-semibold text-[var(--ink)]">No verified WTG result is available for this athlete yet.</p><p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">You can ask an admin to review your claim manually, or choose the new member option if you are not listed.</p><label htmlFor="claim-manual-evidence" className="mt-3 block text-xs font-semibold text-[var(--muted)]">Tell us how we can confirm it’s you</label><textarea id="claim-manual-evidence" rows={3} value={manualEvidence} onChange={event => setManualEvidence(event.target.value)} placeholder="Add a meet, club or other useful detail (at least 20 characters)" className="mt-1 w-full border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--blue)]" /><button type="button" disabled={saving || manualEvidence.trim().length < 20} onClick={() => void submitManualClaim()} className="mt-3 bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Sending…' : 'Request manual review'}</button><button type="button" disabled={saving || Boolean(claimStatus)} onClick={() => void markAsNewMember()} className="ml-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--blue)] hover:underline disabled:opacity-50">I’m new or not listed <ArrowRight size={14} aria-hidden="true" /></button></div>}
    </div>}
    {notice && <p role="status" className="mt-4 border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">{notice}</p>}
    {error && <p role="alert" className="mt-4 border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">{error}</p>}
    {!profiles.length && !loading && !error && <p className="mt-4 text-sm text-[var(--muted)]">No unclaimed athlete profiles are available. If you’re new to the site, use the account profile setup to add your swimmer details.</p>}
  </section>;
}
