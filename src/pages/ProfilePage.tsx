import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit2, LogOut, CheckCircle2, ArrowRight, User, Mail, Globe, Heart, Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ResultsTable from '../components/ResultsTable';
import { results } from '../data/results';
import { getFlagEmoji, getTransplantColor } from '../lib/utils';
import type { Result } from '../types';

/* ── Mock results for the logged-in user ───────────────────────────────────── */
const MOCK_RESULTS: Result[] = [
  ...results.filter(r => r.athleteId === 'emma-wilson'),
  {
    id: 'em001', athleteId: 'emma-wilson', event: '200m Backstroke', course: 'LCM',
    time: '2:34.88', date: '2025-04-17', meet: 'World Transplant Games 2025',
    ageGroup: '30-39', gender: 'Women', verified: 'Verified', isPB: true, isSB: true,
  },
  {
    id: 'em002', athleteId: 'emma-wilson', event: '50m Backstroke', course: 'LCM',
    time: '34.22', date: '2025-04-15', meet: 'World Transplant Games 2025',
    ageGroup: '30-39', gender: 'Women', verified: 'Verified', isPB: true, isSB: true,
  },
  {
    id: 'em003', athleteId: 'emma-wilson', event: '100m Freestyle', course: 'LCM',
    time: '1:05.11', date: '2024-10-12', meet: 'Australian Transplant Games',
    ageGroup: '30-39', gender: 'Women', verified: 'Verified', isPB: false, isSB: false,
  },
  {
    id: 'em004', athleteId: 'emma-wilson', event: '100m Backstroke', course: 'SCM',
    time: '1:09.44', date: '2024-11-20', meet: 'National Transplant Championships',
    ageGroup: '30-39', gender: 'Women', verified: 'Pending', isPB: false, isSB: false,
  },
  {
    id: 'em005', athleteId: 'emma-wilson', event: '200m Individual Medley', course: 'LCM',
    time: '2:41.09', date: '2024-04-08', meet: 'Oceania Transplant Open',
    ageGroup: '30-39', gender: 'Women', verified: 'Verified', isPB: false, isSB: false,
  },
  {
    id: 'em006', athleteId: 'emma-wilson', event: '50m Freestyle', course: 'SCM',
    time: '31.08', date: '2025-01-11', meet: 'Sydney Masters Invitational',
    ageGroup: '30-39', gender: 'Women', verified: 'Verified', isPB: false, isSB: true,
  },
];

const MOCK_PBS = [
  { event: '100m Backstroke', course: 'LCM', time: '1:11.22', meet: 'World Transplant Games 2025' },
  { event: '200m Backstroke', course: 'LCM', time: '2:34.88', meet: 'World Transplant Games 2025' },
  { event: '50m Backstroke',  course: 'LCM', time: '34.22',   meet: 'World Transplant Games 2025' },
  { event: '100m Backstroke', course: 'SCM', time: '1:09.44', meet: 'National Transplant Championships' },
];

/* ── Stat tile ─────────────────────────────────────────────────────────────── */
function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div
      className="flex-1 py-5 px-4 text-center"
      style={{ backgroundColor: 'var(--navy-mid)', border: '1px solid var(--navy-light)' }}
    >
      <div className="font-black font-mono text-3xl leading-none" style={{ color: 'var(--accent)' }}>
        {value}
      </div>
      <div className="mt-1.5 font-mono text-xs tracking-widest uppercase" style={{ color: 'var(--muted-on-dark)' }}>
        {label}
      </div>
    </div>
  );
}

/* ── Editable field (dark theme) ───────────────────────────────────────────── */
function EditField({
  label, icon: Icon, value, onChange, type = 'text', placeholder
}: {
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted-on-dark)' }}>
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-on-dark)' }} />
        )}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors"
          style={{
            backgroundColor: 'var(--navy)',
            border: '1px solid var(--navy-light)',
            paddingLeft: Icon ? '2.25rem' : '0.75rem',
            paddingRight: '0.75rem',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--aqua)')}
          onBlur={e => (e.target.style.borderColor = 'var(--navy-light)')}
        />
      </div>
    </div>
  );
}

/* ── Countries lookup ──────────────────────────────────────────────────────── */
const COUNTRY_NAMES: Record<string, string> = {
  AU: 'Australia', BR: 'Brazil', CA: 'Canada', CN: 'China', DE: 'Germany',
  ES: 'Spain', FR: 'France', GB: 'United Kingdom', IN: 'India', IT: 'Italy',
  JP: 'Japan', MX: 'Mexico', NL: 'Netherlands', NZ: 'New Zealand', PL: 'Poland',
  PT: 'Portugal', US: 'United States', ZA: 'South Africa', SE: 'Sweden', NO: 'Norway',
};

/* ── Profile Page ──────────────────────────────────────────────────────────── */
export default function ProfilePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);

  // Redirect unauthenticated visitors
  useEffect(() => {
    if (!auth.isLoggedIn) {
      navigate('/login', { replace: true });
    }
  }, [auth.isLoggedIn, navigate]);

  const user = auth.user;
  if (!user) return null;

  // Local edit state seeded from auth user
  const [editFirst, setEditFirst] = useState(user.firstName);
  const [editLast,  setEditLast]  = useState(user.lastName);
  const [editEmail, setEditEmail] = useState(user.email);
  const [editCountry, setEditCountry] = useState(user.countryCode || '');
  const [editTransplant, setEditTransplant] = useState(user.transplantType || '');
  const [editClub, setEditClub] = useState('Sydney Aquatic Club');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSignOut = () => {
    auth.logout();
    navigate('/');
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') auth.updateAvatar(reader.result);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  // Profile completeness based on filled fields
  const filledFields = [
    editFirst, editLast, editEmail, editCountry, editTransplant, editClub,
  ].filter(v => v.trim() !== '').length;
  const completeness = Math.round((filledFields / 6) * 100);

  const flag = user.countryCode ? getFlagEmoji(user.countryCode) : '';
  const transplantColor = user.transplantType ? getTransplantColor(user.transplantType) : 'var(--muted-on-dark)';
  const countryName = COUNTRY_NAMES[user.countryCode || ''] || user.countryCode || '';

  return (
    <div className="min-h-screen pt-14" style={{ backgroundColor: 'var(--navy)' }}>

      {/* ── Hero banner ─────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ backgroundColor: 'var(--navy-mid)', borderBottom: '1px solid var(--navy-light)' }}
      >
        {/* Accent stripe */}
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: 'var(--accent)' }} />

        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex flex-col sm:flex-row sm:items-end gap-6 justify-between">
            <div className="flex items-center gap-5">
              {/* Avatar */}
              <button
                type="button"
                onClick={() => avatarInput.current?.click()}
                className="w-16 h-16 flex-shrink-0 overflow-hidden flex items-center justify-center text-xl font-bold text-white"
                style={{ backgroundColor: 'var(--navy-light)', border: '2px solid var(--accent)' }}
                aria-label="Upload profile photo"
              >
                {user.avatarUrl ? <img src={user.avatarUrl} alt={`${user.firstName} ${user.lastName}`} className="h-full w-full object-cover" /> : user.avatarInitials}
              </button>
              <input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

              <div>
                {/* Label */}
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1 h-4" style={{ backgroundColor: 'var(--accent)' }} />
                  <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--muted-on-dark)' }}>
                    Athlete Profile
                  </span>
                </div>

                {/* Name */}
                <h1 className="display text-3xl md:text-4xl text-white leading-none">
                  {user.firstName} {user.lastName}
                </h1>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  {user.transplantType && (
                    <span className="flex items-center gap-1.5 font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
                      <span
                        className="inline-block rounded-full flex-shrink-0"
                        style={{ width: 8, height: 8, backgroundColor: transplantColor }}
                      />
                      {user.transplantType} Transplant
                    </span>
                  )}
                  {flag && (
                    <span className="flex items-center gap-1.5 font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
                      <span className="text-base leading-none">{flag}</span>
                      {countryName}
                    </span>
                  )}
                  <span className="font-mono text-xs px-2 py-0.5" style={{ color: 'var(--aqua)', border: '1px solid var(--aqua)', opacity: 0.7 }}>
                    Verified Athlete
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 sm:flex-shrink-0">
              {saved && (
                <span className="flex items-center gap-1.5 font-mono text-xs" style={{ color: 'var(--accent)' }}>
                  <CheckCircle2 size={13} /> Saved
                </span>
              )}
              <button
                onClick={() => setEditing(e => !e)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors"
                style={{
                  color: editing ? 'var(--navy)' : 'var(--ice)',
                  backgroundColor: editing ? 'var(--accent)' : 'transparent',
                  border: '1px solid var(--navy-light)',
                }}
                onMouseEnter={e => { if (!editing) e.currentTarget.style.borderColor = 'var(--muted-on-dark)'; }}
                onMouseLeave={e => { if (!editing) e.currentTarget.style.borderColor = 'var(--navy-light)'; }}
              >
                <Edit2 size={14} />
                {editing ? 'Editing' : 'Edit Profile'}
              </button>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors"
                style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#ef4444')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)')}
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats row ───────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex gap-px mt-0" style={{ borderBottom: '1px solid var(--navy-light)' }}>
          <StatTile value="#12"  label="World Ranking" />
          <StatTile value="4"    label="Personal Bests" />
          <StatTile value="18"   label="Results" />
          <StatTile value="3"    label="Meets" />
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Completeness bar */}
        <div className="mb-8 p-4" style={{ backgroundColor: 'var(--navy-mid)', border: '1px solid var(--navy-light)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--muted-on-dark)' }}>Profile completeness</span>
            <span className="font-mono text-xs font-bold" style={{ color: completeness >= 80 ? 'var(--accent)' : 'var(--aqua)' }}>
              {completeness}%
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--navy-light)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${completeness}%`, backgroundColor: completeness >= 80 ? 'var(--accent)' : 'var(--aqua)' }}
            />
          </div>
          {completeness < 100 && (
            <p className="mt-2 text-xs" style={{ color: 'var(--muted-on-dark)' }}>
              Add your country, transplant type, and club to complete your athlete profile.
            </p>
          )}
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Left column — Personal details */}
          <div className="lg:col-span-2 space-y-6">
            <div
              className="p-6"
              style={{ backgroundColor: 'var(--navy-mid)', border: '1px solid var(--navy-light)' }}
            >
              <div className="flex items-center justify-between mb-5" style={{ borderBottom: '1px solid var(--navy-light)', paddingBottom: '1rem' }}>
                <h2 className="display text-sm text-white">Personal Details</h2>
                {editing && (
                  <span className="font-mono text-xs px-2 py-0.5" style={{ color: 'var(--aqua)', border: '1px solid var(--aqua)', opacity: 0.8 }}>
                    Editing
                  </span>
                )}
              </div>

              {editing ? (
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <EditField label="First name" icon={User} value={editFirst} onChange={setEditFirst} placeholder="Emma" />
                    <EditField label="Last name" value={editLast} onChange={setEditLast} placeholder="Wilson" />
                  </div>
                  <EditField label="Email" icon={Mail} type="email" value={editEmail} onChange={setEditEmail} placeholder="emma@example.com" />
                  <EditField label="Club / team" value={editClub} onChange={setEditClub} placeholder="City Aquatics Club" />
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted-on-dark)' }}>
                      Country
                    </label>
                    <div className="relative">
                      <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" style={{ color: 'var(--muted-on-dark)' }} />
                      <select
                        value={editCountry}
                        onChange={e => setEditCountry(e.target.value)}
                        className="w-full py-2.5 text-sm text-white outline-none appearance-none transition-colors"
                        style={{
                          backgroundColor: 'var(--navy)',
                          border: '1px solid var(--navy-light)',
                          paddingLeft: '2.25rem',
                          paddingRight: '2rem',
                        }}
                        onFocus={e => (e.target.style.borderColor = 'var(--aqua)')}
                        onBlur={e => (e.target.style.borderColor = 'var(--navy-light)')}
                      >
                        <option value="" disabled style={{ backgroundColor: '#010410' }}>Select country…</option>
                        {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
                          <option key={code} value={code} style={{ backgroundColor: '#010410', color: 'white' }}>{name}</option>
                        ))}
                      </select>
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs" style={{ color: 'var(--muted-on-dark)' }}>▾</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted-on-dark)' }}>
                      <Heart size={12} className="inline mr-1" style={{ color: 'var(--accent)' }} />
                      Transplant type
                    </label>
                    <div className="relative">
                      <select
                        value={editTransplant}
                        onChange={e => setEditTransplant(e.target.value)}
                        className="w-full py-2.5 text-sm text-white outline-none appearance-none transition-colors"
                        style={{
                          backgroundColor: 'var(--navy)',
                          border: '1px solid var(--navy-light)',
                          paddingLeft: '0.75rem',
                          paddingRight: '2rem',
                        }}
                        onFocus={e => (e.target.style.borderColor = 'var(--aqua)')}
                        onBlur={e => (e.target.style.borderColor = 'var(--navy-light)')}
                      >
                        <option value="" disabled style={{ backgroundColor: '#010410' }}>Select type…</option>
                        {['Kidney', 'Liver', 'Heart', 'Lung', 'Pancreas', 'Bone Marrow'].map(t => (
                          <option key={t} value={t} style={{ backgroundColor: '#010410', color: 'white' }}>{t}</option>
                        ))}
                      </select>
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs" style={{ color: 'var(--muted-on-dark)' }}>▾</span>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 text-sm font-bold uppercase tracking-wider text-black flex items-center justify-center gap-2 transition-opacity hover:opacity-85"
                    style={{ backgroundColor: 'var(--accent)', fontFamily: "'Manrope', sans-serif" }}
                  >
                    Save Changes <ArrowRight size={14} />
                  </button>
                </form>
              ) : (
                <dl className="space-y-4">
                  {[
                    { icon: User,    label: 'Full name',       value: `${user.firstName} ${user.lastName}` },
                    { icon: Mail,    label: 'Email',           value: user.email },
                    { icon: Globe,   label: 'Country',         value: countryName ? `${flag} ${countryName}` : '—' },
                    { icon: Heart,   label: 'Transplant type', value: user.transplantType || '—' },
                    { icon: Trophy,  label: 'Club / team',     value: editClub || '—' },
                  ].map(row => (
                    <div key={row.label}>
                      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest mb-0.5" style={{ color: 'var(--muted-on-dark)' }}>
                        <row.icon size={11} style={{ color: 'var(--muted-on-dark)' }} />
                        {row.label}
                      </dt>
                      <dd className="text-sm pl-4" style={{ color: 'var(--ice)' }}>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            {/* My PBs */}
            <div
              className="p-6"
              style={{ backgroundColor: 'var(--navy-mid)', border: '1px solid var(--navy-light)' }}
            >
              <h2 className="display text-sm text-white mb-5" style={{ borderBottom: '1px solid var(--navy-light)', paddingBottom: '1rem' }}>
                My PBs
              </h2>
              <div className="space-y-3">
                {MOCK_PBS.map((pb, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2.5 px-3"
                    style={{ backgroundColor: 'var(--navy)', border: '1px solid var(--navy-light)' }}
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{pb.event}</p>
                      <p className="font-mono text-xs mt-0.5" style={{ color: 'var(--muted-on-dark)' }}>
                        {pb.course} · {pb.meet}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm" style={{ color: 'var(--accent)' }}>{pb.time}</span>
                      <span className="font-mono text-xs px-1.5 py-0.5" style={{ backgroundColor: 'var(--navy-light)', color: 'var(--accent)' }}>PB</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column — Results */}
          <div className="lg:col-span-3">
            <div
              className="p-6"
              style={{ backgroundColor: 'var(--navy-mid)', border: '1px solid var(--navy-light)' }}
            >
              <h2 className="display text-sm text-white mb-5" style={{ borderBottom: '1px solid var(--navy-light)', paddingBottom: '1rem' }}>
                My Results
              </h2>
              <ResultsTable results={MOCK_RESULTS} dark />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
