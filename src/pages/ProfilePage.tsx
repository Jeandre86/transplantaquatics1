import SortableTable from '../components/SortableTable';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, Camera, MapPin, Medal, Music2, Settings2, Timer, ShieldCheck, Eye, EyeOff, MoreVertical } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getFlagEmoji } from '../lib/utils';
import { athletes } from '../data/athletes';
import { clubs } from '../data/clubs';
import { results } from '../data/results';
import { EVENTS, type Event } from '../types';
import type { SocialLinks } from '../lib/avatars';
import { athleteGoalsErrorMessage, createAthleteGoal, loadAthleteGoals, removeAthleteGoal, setAthleteGoalVisibility, type AthleteGoal, type GoalCourse } from '../lib/athleteGoals';
import { loadMySwimmerEventRankings, type SwimmerEventRanking } from '../lib/databaseRankings';
import { loadMyAccountResults, type SubmittedSwimmerResult } from '../lib/swimmerSubmissions';
import { describeSupabaseError, supabase } from '../lib/supabase';
import ManagedSwimmers from '../components/ManagedSwimmers';
import { Skeleton, SkeletonTable } from '../components/Skeleton';

type ProfileTab = 'overview' | 'times' | 'goals' | 'rankings' | 'account';

function parseTime(time: string): number {
  const parts = time.trim().split(':').map(Number);
  if (!parts.length || parts.length > 2 || parts.some(part => !Number.isFinite(part))) return 0;
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
}

const STROKES = ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'Individual Medley', 'Open Water'];
const SOCIAL_FIELDS: { key: keyof SocialLinks; label: string; baseUrl: string }[] = [
  { key: 'facebook', label: 'Facebook', baseUrl: 'https://facebook.com/' },
  { key: 'instagram', label: 'Instagram', baseUrl: 'https://instagram.com/' },
  { key: 'tiktok', label: 'TikTok', baseUrl: 'https://tiktok.com/@' },
];

function socialHref(platform: keyof SocialLinks, value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = SOCIAL_FIELDS.find(field => field.key === platform)?.baseUrl ?? '';
  return `${base}${trimmed.replace(/^@/, '')}`;
}

function strokeForEvent(event: string): string | null {
  const normalized = event.toLocaleLowerCase().replace(/^\s*\d+\s*m(?:etres?)?\s*/i, '').trim();
  if (/\b(freestyle|free)\b/.test(normalized)) return 'Freestyle';
  if (/\b(backstroke|back)\b/.test(normalized)) return 'Backstroke';
  if (/\b(breaststroke|breast)\b/.test(normalized)) return 'Breaststroke';
  if (/\b(butterfly|fly)\b/.test(normalized)) return 'Butterfly';
  if (/\b(individual medley|im)\b/.test(normalized)) return 'Individual Medley';
  return null;
}

function validTimeSeconds(time: string): number | null {
  const value = time.trim();
  const minuteTime = /^(\d+):([0-5]?\d)(?:\.(\d{1,2}))?$/.exec(value);
  if (minuteTime) return Number(minuteTime[1]) * 60 + Number(`${minuteTime[2]}.${minuteTime[3] ?? '0'}`);
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function relativeCreatedAt(value: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'Created less than a minute ago';
  if (minutes < 60) return `Created ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Created ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `Created ${days} day${days === 1 ? '' : 's'} ago`;
}

function formatGoalGap(seconds: number): string {
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const remainder = (seconds % 60).toFixed(2).padStart(5, '0');
    return `${minutes}:${remainder} to goal`;
  }
  return `${seconds.toFixed(2)}s to goal`;
}

function ProfilePanel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-white">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 sm:px-6">
        <h2 className="text-lg font-bold tracking-tight text-[var(--ink)]">{title}</h2>
        {action}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

export default function ProfilePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [socialDraft, setSocialDraft] = useState<SocialLinks>({});
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [goals, setGoals] = useState<AthleteGoal[]>([]);
  const [databaseResults, setDatabaseResults] = useState<SubmittedSwimmerResult[]>([]);
  const [databaseResultsLoading, setDatabaseResultsLoading] = useState(true);
  const [databaseResultsError, setDatabaseResultsError] = useState(false);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [goalError, setGoalError] = useState('');
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [removingGoalId, setRemovingGoalId] = useState<string | null>(null);
  const [goalMenuId, setGoalMenuId] = useState<string | null>(null);
  const [visibilitySavingId, setVisibilitySavingId] = useState<string | null>(null);
  const [goalEvent, setGoalEvent] = useState<Event | ''>('');
  const [goalCourse, setGoalCourse] = useState<GoalCourse>('LCM');
  const [goalPublic, setGoalPublic] = useState(false);
  const [goalTime, setGoalTime] = useState('');
  const [profileRankings, setProfileRankings] = useState<SwimmerEventRanking[]>([]);
  const [profileRankingsLoading, setProfileRankingsLoading] = useState(true);
  const [profileRankingsError, setProfileRankingsError] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [emailError, setEmailError] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closePassword, setClosePassword] = useState('');
  const [closeConfirmation, setCloseConfirmation] = useState('');
  const [closeSaving, setCloseSaving] = useState(false);
  const [closeError, setCloseError] = useState('');

  useEffect(() => {
    if (!auth.isLoading && !auth.isLoggedIn) navigate('/login', { replace: true });
  }, [auth.isLoading, auth.isLoggedIn, navigate]);

  useEffect(() => {
    setSocialDraft(auth.user?.socials ?? {});
  }, [auth.user?.email, auth.user?.socials]);

  useEffect(() => {
    setAccountEmail(auth.user?.email ?? '');
  }, [auth.user?.email]);

  useEffect(() => {
    let cancelled = false;
    if (!auth.isLoggedIn) {
      setGoals([]);
      setGoalsLoading(false);
      return () => { cancelled = true; };
    }

    setGoalsLoading(true);
    setGoalError('');
    loadAthleteGoals().then(savedGoals => {
      if (!cancelled) setGoals(savedGoals);
    }).catch(error => {
      if (!cancelled) setGoalError(athleteGoalsErrorMessage(error));
    }).finally(() => {
      if (!cancelled) setGoalsLoading(false);
    });

    return () => { cancelled = true; };
  }, [auth.isLoggedIn]);

  useEffect(() => {
    let cancelled = false;
    if (!auth.isLoggedIn) {
      setProfileRankings([]);
      setProfileRankingsLoading(false);
      setProfileRankingsError('');
      return () => { cancelled = true; };
    }
    if (databaseResultsLoading) {
      setProfileRankingsLoading(true);
      return () => { cancelled = true; };
    }

    const fullName = `${auth.user?.firstName ?? ''} ${auth.user?.lastName ?? ''}`.trim().toLocaleLowerCase();
    const profileResult = databaseResults
      .filter(result => result.swimmer_name.trim().toLocaleLowerCase() === fullName && result.status !== 'rejected')
      .reduce((counts, result) => {
        const id = result.swimmer_id ?? result.athlete_id;
        if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
        return counts;
      }, new Map<string, number>());
    const swimmerId = [...profileResult.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!swimmerId) {
      setProfileRankings([]);
      setProfileRankingsLoading(false);
      setProfileRankingsError('');
      return () => { cancelled = true; };
    }

    setProfileRankingsLoading(true);
    setProfileRankingsError('');
    loadMySwimmerEventRankings(swimmerId).then(rows => {
      if (!cancelled) setProfileRankings(rows);
    }).catch(error => {
      if (!cancelled) {
        setProfileRankings([]);
        setProfileRankingsError(describeSupabaseError(error));
      }
    }).finally(() => {
      if (!cancelled) setProfileRankingsLoading(false);
    });
    return () => { cancelled = true; };
  }, [auth.isLoggedIn, auth.user?.firstName, auth.user?.lastName, databaseResults, databaseResultsLoading]);

  useEffect(() => {
    let cancelled = false;
    if (!auth.isLoggedIn) {
      setDatabaseResults([]);
      setDatabaseResultsError(false);
      setDatabaseResultsLoading(false);
      return () => { cancelled = true; };
    }
    setDatabaseResultsLoading(true);
    setDatabaseResultsError(false);
    loadMyAccountResults().then(items => {
      if (!cancelled) setDatabaseResults(items);
    }).catch(() => {
      if (!cancelled) {
        setDatabaseResults([]);
        setDatabaseResultsError(true);
      }
    }).finally(() => {
      if (!cancelled) setDatabaseResultsLoading(false);
    });
    return () => { cancelled = true; };
  }, [auth.isLoggedIn]);

  const user = auth.user;
  const athlete = useMemo(() => {
    if (!user) return undefined;
    const fullName = `${user.firstName} ${user.lastName}`.trim().toLocaleLowerCase();
    return athletes.find(entry => `${entry.firstName} ${entry.lastName}`.trim().toLocaleLowerCase() === fullName);
  }, [user]);

  if (auth.isLoading || !user) return null;

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  const flag = user.countryCode ? getFlagEmoji(user.countryCode) : '';
  const country = user.country || user.countryCode || 'Country not added';
  const profileClub = user.club
    ? clubs.find(club => club.name.trim().toLocaleLowerCase() === user.club?.trim().toLocaleLowerCase())
    : undefined;
  const clubSlug = user.club?.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ?? '';
  const allAthleteResults = athlete ? results
    .filter(result => result.athleteId === athlete.id)
    .sort((a, b) => b.date.localeCompare(a.date)) : [];
  const athleteResults = allAthleteResults.slice(0, 6);
  const normalizedName = name.trim().toLocaleLowerCase();
  const swimmerDatabaseResults = databaseResults.filter(result => result.swimmer_name.trim().toLocaleLowerCase() === normalizedName && result.status !== 'rejected');
  const profileResults = [...swimmerDatabaseResults].sort((a, b) => {
    const dateA = a.submitted_meets?.meet_date ?? a.created_at;
    const dateB = b.submitted_meets?.meet_date ?? b.created_at;
    return dateB.localeCompare(dateA);
  });
  const bestTimesByStroke = swimmerDatabaseResults.reduce((best, result) => {
    if (result.is_relay) return best;
    const stroke = strokeForEvent(result.event);
    const seconds = validTimeSeconds(result.time);
    if (!stroke || seconds === null) return best;
    const current = best.get(stroke);
    if (!current || seconds < current.seconds) {
      best.set(stroke, { result, seconds });
    }
    return best;
  }, new Map<string, { result: SubmittedSwimmerResult; seconds: number }>());
  const swimEvents = swimmerDatabaseResults.length
    ? swimmerDatabaseResults.map(result => result.event)
    : user.primaryEvent ? [user.primaryEvent] : [];
  const specialtyCounts = new Map<string, number>();
  swimEvents.forEach(event => {
    const stroke = strokeForEvent(event);
    if (stroke) specialtyCounts.set(stroke, (specialtyCounts.get(stroke) ?? 0) + 1);
  });
  const specialties = [...specialtyCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxSpecialtyCount = Math.max(...specialtyCounts.values(), 1);
  const chartAxes = [
    { key: 'Freestyle', label: 'Free' },
    { key: 'Backstroke', label: 'Back' },
    { key: 'Breaststroke', label: 'Breast' },
    { key: 'Butterfly', label: 'Fly' },
    { key: 'Individual Medley', label: 'IM' },
  ];
  const chartCenter = { x: 120, y: 91 };
  const chartRadius = 56;
  const chartAngle = (index: number) => (-90 + index * 72) * Math.PI / 180;
  const chartPoint = (index: number, scale: number) => {
    const angle = chartAngle(index);
    return `${(chartCenter.x + Math.cos(angle) * chartRadius * scale).toFixed(1)},${(chartCenter.y + Math.sin(angle) * chartRadius * scale).toFixed(1)}`;
  };
  const specialtyPolygon = chartAxes.map((axis, index) => chartPoint(index, (specialtyCounts.get(axis.key) ?? 0) / maxSpecialtyCount)).join(' ');
  const sprintCount = swimEvents.filter(event => Number(event.match(/^(\d+)m/i)?.[1] ?? 0) <= 100).length;
  const distanceCount = swimEvents.filter(event => Number(event.match(/^(\d+)m/i)?.[1] ?? 0) >= 200).length;
  const distanceRatio = sprintCount + distanceCount ? distanceCount / (sprintCount + distanceCount) : 0.5;

  const saveSocialProfiles = () => {
    const socials = Object.fromEntries(SOCIAL_FIELDS.map(({ key }) => [key, socialDraft[key]?.trim() ?? '']).filter(([, value]) => value)) as SocialLinks;
    auth.updateSocials(socials);
    setSavedMessage('Social links saved');
    window.setTimeout(() => setSavedMessage(''), 2500);
  };

  const addGoal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!goalEvent) {
      setGoalError('Select an event before creating a goal.');
      return;
    }
    if (parseTime(goalTime) <= 0) {
      setGoalError('Enter a valid target time, such as 58.50 or 1:02.50.');
      return;
    }
    setGoalSaving(true);
    setGoalError('');
    try {
      const goal = await createAthleteGoal({ event: goalEvent, course: goalCourse, targetTime: goalTime.trim(), isPublic: goalPublic });
      setGoals(current => [goal, ...current]);
      setGoalTime('');
      setGoalEvent('');
      setGoalPublic(false);
      setGoalFormOpen(false);
    } catch (error) {
      setGoalError(athleteGoalsErrorMessage(error));
    } finally {
      setGoalSaving(false);
    }
  };

  const deleteGoal = async (id: string) => {
    setRemovingGoalId(id);
    setGoalError('');
    try {
      await removeAthleteGoal(id);
      setGoals(current => current.filter(goal => goal.id !== id));
    } catch (error) {
      setGoalError(athleteGoalsErrorMessage(error));
    } finally {
      setRemovingGoalId(null);
    }
  };

  const toggleGoalVisibility = async (goal: AthleteGoal) => {
    setVisibilitySavingId(goal.id);
    setGoalError('');
    try {
      await setAthleteGoalVisibility(goal.id, !goal.isPublic);
      setGoals(current => current.map(item => item.id === goal.id ? { ...item, isPublic: !goal.isPublic } : item));
    } catch (error) {
      setGoalError(athleteGoalsErrorMessage(error));
    } finally {
      setVisibilitySavingId(null);
    }
  };

  const updateEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailError('');
    setEmailMessage('');
    if (!supabase) {
      setEmailError('Account services are not configured.');
      return;
    }
    const nextEmail = accountEmail.trim();
    if (!nextEmail || nextEmail.toLowerCase() === user.email.toLowerCase()) {
      setEmailError('Enter a different email address.');
      return;
    }
    setEmailSaving(true);
    const { error } = await supabase.auth.updateUser({ email: nextEmail });
    setEmailSaving(false);
    if (error) setEmailError(error.message);
    else setEmailMessage('Check your new inbox to confirm the email change. Your email will update after confirmation.');
  };

  const updatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    if (!supabase) {
      setPasswordError('Account services are not configured.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Your new password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('The new password and confirmation do not match.');
      return;
    }
    setPasswordSaving(true);
    const { error: verificationError } = await supabase.auth.signInWithPassword({ email: user.email, password: oldPassword });
    if (verificationError) {
      setPasswordSaving(false);
      setPasswordError('The old password is incorrect.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) setPasswordError(error.message);
    else {
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage('Your password has been updated.');
    }
  };

  const closeAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCloseError('');
    if (closeConfirmation !== 'CLOSE') {
      setCloseError('Type CLOSE to confirm account deletion.');
      return;
    }
    if (!supabase) {
      setCloseError('Account services are not configured.');
      return;
    }
    setCloseSaving(true);
    const { error: verificationError } = await supabase.auth.signInWithPassword({ email: user.email, password: closePassword });
    if (verificationError) {
      setCloseSaving(false);
      setCloseError('The password is incorrect.');
      return;
    }
    const { error } = await supabase.functions.invoke('close-account', { method: 'POST' });
    setCloseSaving(false);
    if (error) {
      setCloseError(error.message.includes('Failed to send a request') || error.message.includes('404')
        ? 'Account closure is not enabled yet. Deploy the close-account Supabase Edge Function described in supabase/SETUP.md.'
        : error.message);
      return;
    }
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  };

  const readImage = (event: React.ChangeEvent<HTMLInputElement>, onSave: (image: string) => void, label: string) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onSave(reader.result);
        setSavedMessage(`${label} updated`);
        window.setTimeout(() => setSavedMessage(''), 2500);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <main className="min-h-[70vh] bg-[var(--paper)]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-9">
        <section className="overflow-hidden bg-white shadow-sm">
          {user.bannerUrl ? (
            <div className="relative h-44 bg-cover bg-center sm:h-56" style={{ backgroundImage: `url("${user.bannerUrl}")` }}>
              {manageOpen && <button type="button" onClick={() => bannerInput.current?.click()} className="absolute right-4 top-4 inline-flex items-center gap-2 border border-white/40 bg-[var(--navy)]/80 px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--navy)]"><Camera size={14} /> Change banner</button>}
            </div>
          ) : manageOpen ? (
            <button type="button" onClick={() => bannerInput.current?.click()} className="flex h-24 w-full items-center justify-center gap-2 border-b border-dashed border-[var(--border)] bg-[var(--paper)] text-sm font-semibold text-[var(--blue)] transition-colors hover:bg-[var(--ice)]"><Camera size={16} /> Upload a profile banner</button>
          ) : null}
          <input ref={bannerInput} type="file" accept="image/*" className="hidden" onChange={event => readImage(event, auth.updateBanner, 'Banner image')} />

          <div className="relative px-5 pb-0 sm:px-7">
            <div className="flex flex-col gap-3 sm:min-h-24 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-end gap-4 sm:gap-5">
                <div className={`relative ${user.bannerUrl ? '-mt-12 sm:-mt-14' : 'mt-4'} size-24 shrink-0 sm:size-28`}>
                  <button
                    type="button"
                    onClick={() => manageOpen && avatarInput.current?.click()}
                    className={`flex size-full items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[var(--ice)] text-2xl font-bold text-[var(--navy)] ${manageOpen ? 'cursor-pointer' : 'cursor-default'}`}
                    aria-label={manageOpen ? 'Change profile photo' : undefined}
                  >
                    {user.avatarUrl ? <img src={user.avatarUrl} alt={`${name} profile`} className="h-full w-full object-cover" /> : user.avatarInitials}
                  </button>
                  {manageOpen && <button type="button" onClick={() => avatarInput.current?.click()} aria-label="Change profile photo" className="absolute bottom-0 right-0 z-10 flex size-8 items-center justify-center rounded-full border-2 border-white bg-[var(--accent)] text-[var(--navy)] shadow-md hover:bg-[var(--accent-dark)]"><Camera size={15} /></button>}
                </div>
                <input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={event => readImage(event, auth.updateAvatar, 'Profile photo')} />
                <div className="min-w-0 pb-1 pt-2 sm:pt-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h1 className="text-2xl font-extrabold tracking-tight text-[var(--ink)] sm:text-3xl">{name}</h1>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--muted)]">
                    <span className="inline-flex items-center gap-1.5"><MapPin size={13} />{country}</span>
                    {user.club && <><span aria-hidden="true">·</span><Link to={`/clubs/${user.clubId ?? profileClub?.id ?? clubSlug}`} state={{ fromProfile: true, clubName: user.club }} className="font-semibold text-[var(--blue)] hover:text-[var(--accent-dark)] hover:underline">{user.club}</Link></>}
                    {user.transplantType && <><span aria-hidden="true">·</span><span>{user.transplantType} transplant</span></>}
                    {flag && <span className="text-base" aria-label={country}>{flag}</span>}
                    {SOCIAL_FIELDS.some(({ key }) => socialHref(key, user.socials?.[key])) && <div className="flex items-center gap-1" aria-label="Social media profiles">
                      {SOCIAL_FIELDS.map(({ key, label }) => {
                        const href = socialHref(key, user.socials?.[key]);
                        if (!href) return null;
                        return <a key={key} href={href} target="_blank" rel="noreferrer" aria-label={`${name} on ${label}`} title={label} className="flex size-7 items-center justify-center text-[var(--muted)] transition-colors hover:bg-[var(--ice)] hover:text-[var(--blue)]">{key === 'facebook' ? <span className="font-bold text-lg leading-none">f</span> : key === 'instagram' ? <span className="text-xl leading-none">◎</span> : <Music2 size={17} />}</a>;
                      })}
                    </div>}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 pb-3 sm:pb-0">
                {savedMessage && <span role="status" className="text-xs font-semibold text-[var(--accent-dark)]">{savedMessage}</span>}
                <button type="button" onClick={() => setManageOpen(open => !open)} className="inline-flex items-center gap-2 border border-[var(--blue)] px-4 py-2 text-sm font-semibold text-[var(--blue)] transition-colors hover:bg-[var(--ice)]">
                  <Settings2 size={15} /> {manageOpen ? 'Done' : 'Manage'}
                </button>
                {manageOpen && (
                  <button type="button" onClick={() => avatarInput.current?.click()} className="inline-flex items-center gap-2 border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--paper)] sm:hidden">
                    <Camera size={15} /> Change photo
                  </button>
                )}
              </div>
            </div>

            <nav aria-label="Profile sections" className="mt-3 flex gap-1 overflow-x-auto border-t border-[var(--border)]">
              {([
                ['overview', 'Overview'], ['times', 'Times'], ['goals', 'Goals'], ['rankings', 'Rankings'], ['account', 'Account'],
              ] as [ProfileTab, string][]).map(([tab, label]) => (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)} aria-current={activeTab === tab ? 'page' : undefined} className={`shrink-0 border-b-2 px-4 py-3 text-sm transition-colors ${activeTab === tab ? 'border-[var(--blue)] font-semibold text-[var(--blue)]' : 'border-transparent text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]'}`}>
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </section>

        {manageOpen && (
          <div className="mt-4 space-y-4 border-l-2 border-[var(--accent)] bg-white px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
              <Camera size={16} className="text-[var(--blue)]" /> Customize your profile images:
              <button type="button" onClick={() => bannerInput.current?.click()} className="font-semibold text-[var(--blue)] hover:underline">Upload banner</button>
              <button type="button" onClick={() => avatarInput.current?.click()} className="font-semibold text-[var(--blue)] hover:underline">Upload profile photo</button>
            </div>
            <div className="border-t border-[var(--border)] pt-4">
              <p className="mb-3 text-sm font-semibold text-[var(--ink)]">Social media</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {SOCIAL_FIELDS.map(({ key, label }) => (
                  <label key={key} className="block">
                    <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">{label}</span>
                    <input
                      type="text"
                      value={socialDraft[key] ?? ''}
                      onChange={event => setSocialDraft(current => ({ ...current, [key]: event.target.value }))}
                      placeholder="Profile URL or @username"
                      className="w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--blue)]"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" onClick={saveSocialProfiles} className="bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--blue)]">Save social links</button>
                {savedMessage && <span role="status" className="text-xs font-semibold text-[var(--accent-dark)]">{savedMessage}</span>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'overview' && <div id="overview" className="mt-6 grid gap-5 lg:grid-cols-[minmax(250px,0.85fr)_minmax(0,2fr)]">
          <div className="space-y-5">
            <ProfilePanel title="Specialty">
              <div className="mx-auto max-w-xs">
                <svg viewBox="0 0 240 190" role="img" aria-label={specialties.length ? `Swim specialties: ${specialties.map(([stroke]) => stroke).join(', ')}` : 'No swim specialties recorded yet'} className="mx-auto w-full max-w-[270px]">
                  {[1, 0.8, 0.6, 0.4, 0.2].map(scale => (
                    <polygon key={scale} points={chartAxes.map((_, index) => chartPoint(index, scale)).join(' ')} fill="none" stroke="#e5e7eb" strokeWidth="1" />
                  ))}
                  {chartAxes.map((axis, index) => {
                    const labels: { x: number; y: number; anchor: 'middle' | 'start' | 'end' }[] = [
                      { x: 120, y: 15, anchor: 'middle' },
                      { x: 195, y: 67, anchor: 'start' },
                      { x: 172, y: 170, anchor: 'start' },
                      { x: 68, y: 170, anchor: 'end' },
                      { x: 45, y: 67, anchor: 'end' },
                    ];
                    const label = labels[index];
                    return <g key={axis.key}><line x1={chartCenter.x} y1={chartCenter.y} x2={chartPoint(index, 1).split(',')[0]} y2={chartPoint(index, 1).split(',')[1]} stroke="#e5e7eb" strokeWidth="1" /><text x={label.x} y={label.y} textAnchor={label.anchor} className="fill-[var(--ink)] text-[13px]">{axis.label}</text></g>;
                  })}
                  {specialties.length > 0 && <polygon points={specialtyPolygon} fill="#cf003d" fillOpacity="0.85" stroke="#cf003d" strokeWidth="1.5" className="specialty-chart-shape" />}
                </svg>
                <div className="mt-1">
                  <div className="relative h-[2px] bg-gradient-to-r from-[#d0003f] to-[#2347e8]">
                    <span className="absolute -top-1.5 size-3 rounded-full border-2 border-white bg-[var(--navy)] shadow transition-[left] duration-700 ease-out" style={{ left: `calc(${distanceRatio * 100}% - 6px)` }} />
                  </div>
                  <div className="mt-1.5 flex justify-between text-xs text-[var(--muted)]"><span>Sprint</span><span>Distance</span></div>
                </div>
                <p className="mt-4 text-center text-xs leading-relaxed text-[var(--muted)]">
                  {databaseResultsLoading ? 'Loading your swim data…' : specialties.length ? `Automatically based on ${swimmerDatabaseResults.length ? 'your submitted results' : 'your selected primary event'}.` : 'Your swim profile will appear here when events are added.'}
                </p>
              </div>
            </ProfilePanel>

            <ProfilePanel title="Athlete details">
              <dl className="space-y-3">
                {[
                  ['Gender', user.gender], ['Age group', user.ageGroup], ['Transplant type', user.transplantType], ['Club', user.club], ['Primary event', user.primaryEvent],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 border-b border-[var(--border)] pb-2 last:border-0 last:pb-0">
                    <dt className="text-xs text-[var(--muted)]">{label}</dt><dd className="text-right text-xs font-semibold text-[var(--ink)]">{value || 'Not added'}</dd>
                  </div>
                ))}
              </dl>
            </ProfilePanel>

            <ProfilePanel title="Goals" action={<button type="button" onClick={() => setActiveTab('goals')} className="text-xs font-semibold text-[var(--blue)] hover:underline">Manage</button>}>
              {goalsLoading ? <div className="space-y-3"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-2 w-full" /><Skeleton className="h-4 w-1/2" /></div> : goals.length ? <div className="space-y-3">
                {goals.slice(0, 2).map(goal => {
                  const currentBest = swimmerDatabaseResults.filter(result => result.event === goal.event && result.submitted_meets?.course === goal.course).sort((a, b) => parseTime(a.time) - parseTime(b.time))[0];
                  const targetSeconds = parseTime(goal.targetTime);
                  const currentSeconds = currentBest ? parseTime(currentBest.time) : 0;
                  const progress = currentSeconds && targetSeconds ? Math.min(100, Math.round((targetSeconds / currentSeconds) * 100)) : 0;
                  const achieved = currentSeconds > 0 && currentSeconds <= targetSeconds;
                  return <div key={goal.id}>
                    <div className="flex items-baseline justify-between gap-2"><p className="truncate text-xs font-semibold text-[var(--ink)]">{goal.event} · {goal.course}</p><p className="shrink-0 font-mono text-xs font-bold text-[var(--blue)]">{goal.targetTime}</p></div>
                    <div className="mt-1.5 h-1.5 bg-[var(--paper)]"><div className="h-full bg-[var(--accent)]" style={{ width: `${progress}%` }} /></div>
                    <p className="mt-1 text-[10px] text-[var(--muted)]">{achieved ? 'Goal reached' : currentBest ? `${progress}% · PB ${currentBest.time}` : 'No progress yet'}</p>
                  </div>;
                })}
                {goals.length > 2 && <button type="button" onClick={() => setActiveTab('goals')} className="text-xs font-semibold text-[var(--blue)] hover:underline">View all {goals.length} goals</button>}
              </div> : <div id="goals" className="flex items-center gap-3 text-sm text-[var(--muted)]"><CalendarDays size={18} className="shrink-0 text-[var(--blue)]" />You haven’t set a swim goal yet.</div>}
              {goalError && <p className="mt-3 text-xs text-[var(--muted)]">Goal data is temporarily unavailable.</p>}
            </ProfilePanel>
          </div>

          <div className="space-y-5">
            <ProfilePanel title="Latest Results" action={<Link to="/results" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--blue)] hover:underline">See all</Link>}>
              <div id="latest-results" className="mb-4 flex items-center gap-3 border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5">
                <span className="text-xl">{flag || '🏊'}</span>
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--ink)]">{athleteResults[0]?.meet || 'Your meet results'}</p><p className="text-xs text-[var(--muted)]">{athleteResults[0]?.date || 'Personal results'}</p></div>
                <Medal size={16} className="ml-auto shrink-0 text-[var(--accent-dark)]" />
              </div>
              {athleteResults.length ? (
                <div className="ta-table-scroll">
                  <SortableTable><table className="w-full border-collapse text-left">
                    <thead><tr className="ta-table-header"><th className="px-3 py-3 font-mono text-[10px] uppercase tracking-widest">Event</th><th className="px-3 py-3 text-right font-mono text-[10px] uppercase tracking-widest">Time</th><th className="px-3 py-3 font-mono text-[10px] uppercase tracking-widest">Course</th><th className="px-3 py-3 font-mono text-[10px] uppercase tracking-widest">Meet</th></tr></thead>
                    <tbody>{athleteResults.map(result => (
                      <tr key={result.id} className="ta-table-row">
                        <td className="px-3 py-3 text-sm font-semibold text-[var(--ink)]">{result.event || '—'}</td>
                        <td className="px-3 py-3 text-right font-mono text-sm font-bold text-[var(--blue)]">{result.time || '—'}</td>
                        <td className="px-3 py-3 font-mono text-xs text-[var(--muted)]">{result.course || '—'}</td>
                        <td className="max-w-40 truncate px-3 py-3 text-xs text-[var(--muted)]">{result.meet || '—'}</td>
                      </tr>
                    ))}</tbody>
                  </table></SortableTable>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="font-semibold text-[var(--ink)]">Your results will appear here</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">When your swims are linked to this account, you’ll see times grouped by meet and event.</p>
                </div>
              )}
            </ProfilePanel>

            <ProfilePanel title="Rankings" action={<Link to="/rankings" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--blue)] hover:underline">Explore</Link>}>
              {profileRankingsLoading ? <p className="text-sm text-[var(--muted)]">Loading your world and club positions…</p> : profileRankingsError ? <p role="status" className="text-sm text-[var(--muted)]">Your rankings are temporarily unavailable.</p> : profileRankings.length ? <div className="space-y-2">
                {profileRankings.slice(0, 3).map(row => <div key={`${row.event}-${row.ageGroup}-${row.course}-${row.season}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[var(--border)] pb-2 text-sm last:border-0 last:pb-0">
                  <span className="font-semibold text-[var(--ink)]">{row.event} · {row.course} · {row.season}</span>
                  <span className="text-xs text-[var(--muted)]">World #{row.worldRank}{row.clubRank ? ` · ${row.clubName || user.club || 'Club'} #${row.clubRank}` : ''}</span>
                </div>)}
                <button type="button" onClick={() => setActiveTab('rankings')} className="pt-1 text-xs font-semibold text-[var(--blue)] hover:underline">View all stroke rankings</button>
              </div> : <p className="text-sm leading-relaxed text-[var(--muted)]">Your club and world positions will appear when your results are linked to your swimmer profile.</p>}
            </ProfilePanel>
          </div>
        </div>}

        {activeTab === 'times' && (
          <div className="mt-6 space-y-5">
            <ProfilePanel title="Best times by stroke" action={<span className="font-mono text-xs text-[var(--muted)]">From {swimmerDatabaseResults.length} swims</span>}>
              {databaseResultsLoading ? <p className="py-5 text-sm text-[var(--muted)]">Loading your results…</p> : databaseResultsError ? <p role="status" className="py-5 text-sm text-[var(--muted)]">Your results could not be loaded. Try refreshing the page.</p> : bestTimesByStroke.size ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {STROKES.slice(0, 5).map(stroke => {
                  const best = bestTimesByStroke.get(stroke);
                  return <article key={stroke} className="border border-[var(--border)] bg-[var(--paper)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{stroke}</p>
                    {best ? <>
                      <p className="mt-2 font-mono text-2xl font-bold text-[var(--blue)]">{best.result.time}</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{best.result.event}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{[best.result.course || best.result.submitted_meets?.course || 'Course not recorded', best.result.submitted_meets?.name, best.result.submitted_meets?.meet_date].filter(Boolean).join(' · ')}</p>
                    </> : <p className="mt-3 text-sm text-[var(--muted)]">No result yet</p>}
                  </article>;
                })}
              </div> : <p className="py-5 text-sm text-[var(--muted)]">Your stroke bests will appear when results are linked to your profile.</p>}
            </ProfilePanel>

            <ProfilePanel title="All results" action={<span className="font-mono text-xs text-[var(--muted)]">{profileResults.length} swims</span>}>
              {databaseResultsLoading ? <SkeletonTable rows={5} columns={5} /> : databaseResultsError ? <p role="status" className="py-5 text-sm text-[var(--muted)]">Your results could not be loaded. Try refreshing the page.</p> : profileResults.length ? <div className="ta-table-scroll">
                <SortableTable><table className="w-full border-collapse text-left">
                  <thead><tr className="ta-table-header"><th className="px-3 py-3 font-mono text-[10px] uppercase tracking-widest">Event</th><th className="px-3 py-3 text-right font-mono text-[10px] uppercase tracking-widest">Time</th><th className="px-3 py-3 font-mono text-[10px] uppercase tracking-widest">Course</th><th className="px-3 py-3 font-mono text-[10px] uppercase tracking-widest">Date</th><th className="px-3 py-3 font-mono text-[10px] uppercase tracking-widest">Meet</th></tr></thead>
                  <tbody>{profileResults.map(result => <tr key={result.id} className="ta-table-row"><td className="px-3 py-3 text-sm font-semibold text-[var(--ink)]">{result.event || '—'}</td><td className="px-3 py-3 text-right font-mono text-sm font-bold text-[var(--blue)]">{result.time || '—'}</td><td className="px-3 py-3 font-mono text-xs text-[var(--muted)]">{result.course || result.submitted_meets?.course || '—'}</td><td className="px-3 py-3 text-xs text-[var(--muted)]">{result.submitted_meets?.meet_date || result.created_at.slice(0, 10) || '—'}</td><td className="max-w-56 truncate px-3 py-3 text-xs text-[var(--muted)]">{result.submitted_meets?.name || '—'}</td></tr>)}</tbody>
                </table></SortableTable>
              </div> : <div className="py-12 text-center"><Timer size={24} className="mx-auto text-[var(--blue)]" /><p className="mt-3 font-semibold text-[var(--ink)]">No swims linked yet</p><p className="mt-1 text-sm text-[var(--muted)]">Once your results are connected to your account, your times will appear here.</p></div>}
            </ProfilePanel>
          </div>
        )}

        {activeTab === 'goals' && (
          <div className="mt-6 space-y-5">
            <ProfilePanel title="Personal swim goals" action={<button type="button" onClick={() => { setGoalError(''); setGoalFormOpen(true); }} className="inline-flex items-center gap-2 bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--blue)]">Set goal</button>}>
              <p className="mb-5 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">Set a target time and track progress against your results.</p>
              {goalError && <p role="alert" className="mt-4 border-l-2 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-800">{goalError}</p>}
              {goalsLoading ? <SkeletonTable rows={4} columns={2} /> : goals.length ? <div className="grid gap-4 sm:grid-cols-2">{goals.map(goal => {
                const currentBest = swimmerDatabaseResults.filter(result => result.event === goal.event && result.submitted_meets?.course === goal.course).sort((a, b) => parseTime(a.time) - parseTime(b.time))[0];
                const targetSeconds = parseTime(goal.targetTime);
                const currentSeconds = currentBest ? parseTime(currentBest.time) : 0;
                const progress = currentSeconds && targetSeconds ? Math.min(100, Math.round((targetSeconds / currentSeconds) * 100)) : 0;
                const achieved = currentSeconds > 0 && currentSeconds <= targetSeconds;
                return <article key={goal.id} className="relative rounded-lg border border-[var(--border)] bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <h3 className="text-sm font-semibold text-[var(--ink)]">{goal.event}</h3>
                      <span className="bg-neutral-100 px-2 py-1 text-[10px] font-bold text-neutral-700">{goal.course}</span>
                      {!currentBest && <span className="bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-neutral-500">No progress yet</span>}
                      {achieved && <span className="bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-800">Goal reached</span>}
                    </div>
                    <div className="relative flex shrink-0 items-center gap-1">
                      <button type="button" disabled={visibilitySavingId === goal.id} onClick={() => void toggleGoalVisibility(goal)} aria-label={goal.isPublic ? 'Make goal private' : 'Make goal public'} title={goal.isPublic ? 'Public goal' : 'Private goal'} className="p-1 text-[var(--muted)] hover:text-[var(--blue)] disabled:opacity-50">{goal.isPublic ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                      <button type="button" onClick={() => setGoalMenuId(current => current === goal.id ? null : goal.id)} aria-label="Goal options" aria-expanded={goalMenuId === goal.id} className="p-1 text-[var(--muted)] hover:text-[var(--ink)]"><MoreVertical size={17} /></button>
                      {goalMenuId === goal.id && <div className="absolute right-0 top-8 z-10 min-w-32 border border-[var(--border)] bg-white p-1 shadow-lg"><button type="button" disabled={removingGoalId === goal.id} onClick={() => { setGoalMenuId(null); void deleteGoal(goal.id); }} className="w-full px-3 py-2 text-left text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">{removingGoalId === goal.id ? 'Removing…' : 'Remove goal'}</button></div>}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div><p className="text-[var(--muted)]">Personal Best</p><p className="mt-1 font-mono font-bold text-[var(--ink)]">{currentBest?.time ?? 'NT'}</p></div>
                    <div className="text-right"><p className="text-[var(--muted)]">Goal</p><p className="mt-1 font-mono font-bold text-[var(--ink)]">{goal.targetTime}</p></div>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-neutral-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} /></div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                    <p className="text-[var(--muted)]">{relativeCreatedAt(goal.createdAt)}</p>
                    <p className={`font-semibold ${achieved ? 'text-emerald-700' : 'text-red-600'}`}>{achieved ? 'Goal reached' : currentBest ? formatGoalGap(Math.max(0, currentSeconds - targetSeconds)) : 'No PB yet'}</p>
                  </div>
                </article>;
              })}</div> : <div className="py-9 text-center"><p className="font-semibold text-[var(--ink)]">Your goals will show here</p><p className="mt-1 text-sm text-[var(--muted)]">Add a target time above to start tracking your progress.</p></div>}
            </ProfilePanel>
          </div>
        )}

        {goalFormOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setGoalFormOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="goal-form-title" className="w-full max-w-lg bg-white text-neutral-900 shadow-2xl">
            <header className="border-b border-neutral-200 px-6 py-5">
              <h2 id="goal-form-title" className="text-xl font-bold">Set Goal</h2>
              <p className="mt-1 text-sm text-neutral-500">Set a target time to track your progress and stay motivated</p>
            </header>
            <form onSubmit={addGoal}>
              <div className="space-y-4 px-6 py-5">
                {goalError && <p role="alert" className="border-l-2 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-800">{goalError}</p>}
                <label className="block text-sm font-semibold text-neutral-800">Event <span className="text-red-600">*</span>
                  <select required value={goalEvent} onChange={event => setGoalEvent(event.target.value as Event | '')} className="mt-1.5 w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900">
                    <option value="" disabled>Select event</option>{EVENTS.map(event => <option key={event} value={event}>{event}</option>)}
                  </select>
                </label>
                <fieldset>
                  <legend className="mb-1.5 text-sm font-semibold text-neutral-800">Course <span className="text-red-600">*</span></legend>
                  <div role="group" aria-label="Course" className="grid grid-cols-3 border border-blue-200">
                    {(['SCY', 'SCM', 'LCM'] as const).map(course => <button key={course} type="button" aria-pressed={goalCourse === course} onClick={() => setGoalCourse(course)} className={`px-3 py-2.5 text-sm font-semibold transition-colors ${goalCourse === course ? 'bg-[var(--navy)] text-white' : 'bg-white text-neutral-600 hover:bg-neutral-50'}`}>{course}</button>)}
                  </div>
                </fieldset>
                <label className="block text-sm font-semibold text-neutral-800">Goal time <span className="text-red-600">*</span>
                  <input required inputMode="decimal" value={goalTime} onChange={event => setGoalTime(event.target.value)} placeholder="e.g. 58.74 or 1:02.50" className="mt-1.5 w-full border border-neutral-300 bg-white px-3 py-2.5 text-right font-mono text-sm text-neutral-900 outline-none focus:border-[var(--blue)]" />
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                  <input type="checkbox" checked={goalPublic} onChange={event => setGoalPublic(event.target.checked)} className="mt-0.5 size-4 accent-[var(--blue)]" />
                  <span><span className="font-semibold text-neutral-800">Make this goal public</span><span className="mt-0.5 block text-xs text-neutral-500">Visible on your public athlete profile.</span></span>
                </label>
              </div>
              <footer className="flex justify-end gap-2 border-t border-neutral-200 px-6 py-4">
                <button type="button" onClick={() => setGoalFormOpen(false)} className="border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">Cancel</button>
                <button type="submit" disabled={goalSaving || !goalEvent || parseTime(goalTime) <= 0} className="bg-[var(--blue)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">{goalSaving ? 'Creating…' : 'Create'}</button>
              </footer>
            </form>
          </section>
        </div>}

        {activeTab === 'rankings' && (
          <div className="mt-6 space-y-5">
            <ProfilePanel title="World and club positions">
              <p className="mb-5 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">Positions compare your fastest time from each calendar year with swimmers in the same season, event, age group, gender, and course. Each season and distance is ranked separately.</p>
              {profileRankingsLoading ? <SkeletonTable rows={5} columns={8} /> : profileRankingsError ? <p role="status" className="border border-[var(--border)] bg-[var(--paper)] px-4 py-6 text-sm text-red-700">Rankings could not be loaded: {profileRankingsError}</p> : profileRankings.length ? <div className="ta-table-scroll"><SortableTable><table className="w-full border-collapse text-left">
                <thead><tr className="ta-table-header"><th className="px-3 py-3 font-mono text-[10px] uppercase tracking-widest">Season</th><th className="px-3 py-3 font-mono text-[10px] uppercase tracking-widest">Stroke</th><th className="px-3 py-3 font-mono text-[10px] uppercase tracking-widest">Event</th><th className="px-3 py-3 font-mono text-[10px] uppercase tracking-widest">Category</th><th className="px-3 py-3 text-right font-mono text-[10px] uppercase tracking-widest">Best time</th><th className="px-3 py-3 font-mono text-[10px] uppercase tracking-widest">Meet / date</th><th className="px-3 py-3 text-right font-mono text-[10px] uppercase tracking-widest">World</th><th className="px-3 py-3 text-right font-mono text-[10px] uppercase tracking-widest">Club</th></tr></thead>
                <tbody>{profileRankings.map(row => <tr key={`${row.event}-${row.ageGroup}-${row.gender}-${row.course}-${row.season}`} className="ta-table-row">
                  <td className="px-3 py-3 text-sm font-semibold text-[var(--ink)]">{row.season}</td>
                  <td className="px-3 py-3 text-sm font-semibold text-[var(--ink)]">{row.stroke}</td>
                  <td className="px-3 py-3 text-sm font-semibold text-[var(--ink)]">{row.event}</td>
                  <td className="px-3 py-3 text-xs text-[var(--muted)]">{row.gender} · {row.ageGroup} · {row.course}</td>
                  <td className="px-3 py-3 text-right font-mono text-sm font-bold text-[var(--navy)]">{row.time}</td>
                  <td className="px-3 py-3 text-xs text-[var(--muted)]">{row.meetName || 'Meet not recorded'}{row.date ? ` · ${row.date.slice(0, 10)}` : ''}</td>
                  <td className="px-3 py-3 text-right text-sm"><span className="font-mono font-bold text-[var(--blue)]">#{row.worldRank}</span><span className="ml-1 text-xs text-[var(--muted)]">of {row.worldSwimmerCount}</span></td>
                  <td className="px-3 py-3 text-right text-sm">{row.clubRank ? <><span className="font-mono font-bold text-[var(--blue)]">#{row.clubRank}</span><span className="ml-1 text-xs text-[var(--muted)]">of {row.clubSwimmerCount}</span></> : <span className="text-xs text-[var(--muted)]">{row.clubName || user.club ? 'Not ranked' : 'No club'}</span>}</td>
                </tr>)}</tbody>
              </table></SortableTable></div> : <div className="py-12 text-center"><p className="font-semibold text-[var(--ink)]">No event rankings yet</p><p className="mx-auto mt-1 max-w-xl text-sm text-[var(--muted)]">Rankings will appear once your results are linked to your swimmer profile and include a recognized course and age group.</p></div>}
            </ProfilePanel>
          </div>
        )}

        {activeTab === 'account' && (
          <div className="mt-6 space-y-5">
            <ManagedSwimmers />
            <ProfilePanel title="Email notifications">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-[var(--ink)]">Teams interested in you</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">Get an email when a team wants to connect with you.</p>
                </div>
                <label className="inline-flex cursor-not-allowed items-center gap-3 text-sm text-[var(--muted)]" title="This feature requires a varsity account">
                  <input type="checkbox" disabled className="size-4 accent-[var(--blue)]" />
                  Requires a varsity account
                </label>
              </div>
            </ProfilePanel>

            <ProfilePanel title="Email">
              <form onSubmit={event => void updateEmail(event)} className="max-w-2xl">
                <label className="block text-sm font-semibold text-[var(--ink)]">Update Email
                  <input type="email" autoComplete="email" required value={accountEmail} onChange={event => setAccountEmail(event.target.value)} className="mt-2 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 font-normal text-[var(--ink)] outline-none focus:border-[var(--blue)]" />
                </label>
                <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">We’ll send a confirmation link to your new email address.</p>
                {emailError && <p role="alert" className="mt-3 text-sm text-red-700">{emailError}</p>}
                {emailMessage && <p role="status" className="mt-3 text-sm text-emerald-700">{emailMessage}</p>}
                <button type="submit" disabled={emailSaving} className="mt-4 bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--blue)] disabled:opacity-60">{emailSaving ? 'Sending confirmation…' : 'Update email'}</button>
              </form>
            </ProfilePanel>

            <ProfilePanel title="Change password">
              <form onSubmit={event => void updatePassword(event)} className="max-w-2xl space-y-4">
                <label className="block text-sm font-semibold text-[var(--ink)]">Old password<input type="password" autoComplete="current-password" required value={oldPassword} onChange={event => setOldPassword(event.target.value)} className="mt-2 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 font-normal text-[var(--ink)] outline-none focus:border-[var(--blue)]" /></label>
                <label className="block text-sm font-semibold text-[var(--ink)]">New password<input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={event => setNewPassword(event.target.value)} className="mt-2 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 font-normal text-[var(--ink)] outline-none focus:border-[var(--blue)]" /></label>
                <p className="-mt-2 text-xs leading-relaxed text-[var(--muted)]">Your password needs to be at least 8 characters. Include multiple words and phrases to make it more secure.</p>
                <label className="block text-sm font-semibold text-[var(--ink)]">New password confirmation<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="mt-2 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 font-normal text-[var(--ink)] outline-none focus:border-[var(--blue)]" /></label>
                <p className="-mt-2 text-xs leading-relaxed text-[var(--muted)]">Enter the same password as before, for verification.</p>
                {passwordError && <p role="alert" className="text-sm text-red-700">{passwordError}</p>}
                {passwordMessage && <p role="status" className="text-sm text-emerald-700">{passwordMessage}</p>}
                <button type="submit" disabled={passwordSaving} className="bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--blue)] disabled:opacity-60">{passwordSaving ? 'Updating password…' : 'Change password'}</button>
              </form>
            </ProfilePanel>

            <ProfilePanel title="Close account">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-2xl">
                  <h3 className="font-semibold text-[var(--ink)]">Are you sure you want to close your account?</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">All public data like Meet Results will remain visible. Closing your account permanently removes your sign-in account.</p>
                </div>
                <button type="button" onClick={() => { setCloseDialogOpen(true); setCloseError(''); }} className="shrink-0 border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50">Close account</button>
              </div>
            </ProfilePanel>
          </div>
        )}
      </div>

      {closeDialogOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--navy)]/70 p-4" role="presentation">
        <section role="dialog" aria-modal="true" aria-labelledby="close-account-title" className="w-full max-w-lg bg-white p-6 shadow-2xl sm:p-8">
          <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-red-50 text-red-700"><ShieldCheck size={21} /></div>
          <h2 id="close-account-title" className="text-xl font-bold text-[var(--ink)]">Confirm account closure</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">This permanently closes your sign-in account. Public meet results will remain visible. Enter your password and type <strong className="text-[var(--ink)]">CLOSE</strong> to continue.</p>
          <form onSubmit={event => void closeAccount(event)} className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-[var(--ink)]">Password<input type="password" autoComplete="current-password" required value={closePassword} onChange={event => setClosePassword(event.target.value)} className="mt-2 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 font-normal outline-none focus:border-[var(--blue)]" /></label>
            <label className="block text-sm font-semibold text-[var(--ink)]">Type CLOSE to confirm<input required value={closeConfirmation} onChange={event => setCloseConfirmation(event.target.value)} className="mt-2 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 font-normal outline-none focus:border-red-500" /></label>
            {closeError && <p role="alert" className="text-sm text-red-700">{closeError}</p>}
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button type="button" disabled={closeSaving} onClick={() => setCloseDialogOpen(false)} className="border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--paper)]">Cancel</button>
              <button type="submit" disabled={closeSaving || closeConfirmation !== 'CLOSE'} className="bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">{closeSaving ? 'Closing account…' : 'Permanently close account'}</button>
            </div>
          </form>
        </section>
      </div>}
    </main>
  );
}
