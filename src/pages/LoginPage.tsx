import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, CheckCircle2, User, Mail, Lock, Calendar, Globe, Heart } from 'lucide-react';
import Logo from '../components/Logo';
import { TRANSPLANT_TYPES } from '../types';
import { useAuth } from '../contexts/AuthContext';

type Mode = 'signin' | 'register' | 'profile';

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  countryCode: string;
  transplantType: string;
  transplantYear: string;
  club: string;
  bio: string;
  websiteUrl: string;
  instagramHandle: string;
}

const COUNTRIES = [
  { code: 'AU', name: 'Australia' }, { code: 'BR', name: 'Brazil' }, { code: 'CA', name: 'Canada' },
  { code: 'CN', name: 'China' }, { code: 'DE', name: 'Germany' }, { code: 'ES', name: 'Spain' },
  { code: 'FR', name: 'France' }, { code: 'GB', name: 'United Kingdom' }, { code: 'IN', name: 'India' },
  { code: 'IT', name: 'Italy' }, { code: 'JP', name: 'Japan' }, { code: 'MX', name: 'Mexico' },
  { code: 'NL', name: 'Netherlands' }, { code: 'NZ', name: 'New Zealand' }, { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' }, { code: 'US', name: 'United States' }, { code: 'ZA', name: 'South Africa' },
  { code: 'SE', name: 'Sweden' }, { code: 'NO', name: 'Norway' },
];

const EMPTY_PROFILE: ProfileData = {
  firstName: '', lastName: '', email: '', dateOfBirth: '',
  countryCode: '', transplantType: '', transplantYear: '',
  club: '', bio: '', websiteUrl: '', instagramHandle: '',
};

function InputField({
  label, icon: Icon, type = 'text', value, onChange, placeholder, required, suffix
}: {
  label: string; icon?: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; suffix?: string;
}) {
  const [show, setShow] = useState(false);
  const inputType = type === 'password' ? (show ? 'text' : 'password') : type;
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-widest mb-2" style={{ color: 'var(--muted-on-dark)' }}>
        {label}{required && <span style={{ color: 'var(--accent)' }}> *</span>}
      </label>
      <div className="relative">
        {Icon && (
          <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-on-dark)' }} />
        )}
        <input
          type={inputType}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full py-3 text-sm text-white placeholder-white/30 outline-none transition-colors"
          style={{
            backgroundColor: 'var(--navy)',
            border: '1px solid var(--navy-light)',
            paddingLeft: Icon ? '2.5rem' : '0.875rem',
            paddingRight: type === 'password' ? '2.5rem' : suffix ? '3rem' : '0.875rem',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--aqua)')}
          onBlur={e => (e.target.style.borderColor = 'var(--navy-light)')}
        />
        {type === 'password' && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--muted-on-dark)' }}
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--muted-on-dark)' }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function SelectField({
  label, icon: Icon, value, onChange, options, placeholder
}: {
  label: string; icon?: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-widest mb-2" style={{ color: 'var(--muted-on-dark)' }}>
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" style={{ color: 'var(--muted-on-dark)' }} />
        )}
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full py-3 text-sm text-white outline-none appearance-none transition-colors"
          style={{
            backgroundColor: 'var(--navy)',
            border: '1px solid var(--navy-light)',
            paddingLeft: Icon ? '2.5rem' : '0.875rem',
            paddingRight: '2rem',
            color: value ? 'white' : 'rgba(255,255,255,0.3)',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--aqua)')}
          onBlur={e => (e.target.style.borderColor = 'var(--navy-light)')}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map(o => (
            <option key={o.value} value={o.value} style={{ backgroundColor: '#010410', color: 'white' }}>{o.label}</option>
          ))}
        </select>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs" style={{ color: 'var(--muted-on-dark)' }}>▾</span>
      </div>
    </div>
  );
}

/* ── Sign In form ─────────────────────────────────────────────────────────── */
function SignInForm({ onSwitch }: { onSwitch: (m: Mode) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await auth.login(email, password);
      navigate('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <InputField label="Email address" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
      <InputField label="Password" icon={Lock} type="password" value={password} onChange={setPassword} placeholder="••••••••" required />

      {error && (
        <p className="text-sm font-mono" style={{ color: '#ef4444' }}>{error}</p>
      )}

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--muted-on-dark)' }}>
          <input type="checkbox" className="w-3.5 h-3.5 accent-[var(--accent)]" />
          Remember me
        </label>
        <button type="button" className="text-sm transition-colors" style={{ color: 'var(--aqua)' }}>
          Forgot password?
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 text-sm font-bold uppercase tracking-wider text-black flex items-center justify-center gap-2 transition-opacity hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: 'var(--accent)', fontFamily: "'Manrope', sans-serif" }}
      >
        {loading ? 'Signing in…' : <><span>Sign In</span> <ArrowRight size={16} /></>}
      </button>

      <p className="text-center text-sm" style={{ color: 'var(--muted-on-dark)' }}>
        New to Transplant Aquatics?{' '}
        <button type="button" onClick={() => onSwitch('register')} className="font-semibold" style={{ color: 'var(--accent)' }}>
          Create an account
        </button>
      </p>
    </form>
  );
}

/* ── Register form ────────────────────────────────────────────────────────── */
function RegisterForm({ onSwitch }: { onSwitch: (m: Mode) => void }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await auth.register({ firstName, lastName, email, password });
      navigate('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <InputField label="First name" icon={User} value={firstName} onChange={setFirstName} placeholder="Emma" required />
        <InputField label="Last name" value={lastName} onChange={setLastName} placeholder="Wilson" required />
      </div>
      <InputField label="Email address" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
      <InputField label="Password" icon={Lock} type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" required />

      {error && (
        <p className="text-sm font-mono" style={{ color: '#ef4444' }}>{error}</p>
      )}

      <label className="flex items-start gap-3 text-sm cursor-pointer" style={{ color: 'var(--muted-on-dark)' }}>
        <input type="checkbox" className="mt-0.5 w-3.5 h-3.5 flex-shrink-0 accent-[var(--accent)]" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
        <span>
          I agree to the{' '}
          <span className="underline cursor-pointer" style={{ color: 'var(--aqua)' }}>Terms of Use</span>
          {' '}and{' '}
          <span className="underline cursor-pointer" style={{ color: 'var(--aqua)' }}>Privacy Policy</span>
        </span>
      </label>

      <button
        type="submit"
        disabled={!agreed || loading}
        className="w-full py-3.5 text-sm font-bold uppercase tracking-wider text-black flex items-center justify-center gap-2 transition-opacity hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ backgroundColor: 'var(--accent)', fontFamily: "'Manrope', sans-serif" }}
      >
        {loading ? 'Creating account…' : <><span>Create Account</span> <ArrowRight size={16} /></>}
      </button>

      <p className="text-center text-sm" style={{ color: 'var(--muted-on-dark)' }}>
        Already have an account?{' '}
        <button type="button" onClick={() => onSwitch('signin')} className="font-semibold" style={{ color: 'var(--accent)' }}>
          Sign in
        </button>
      </p>
    </form>
  );
}

/* ── Profile builder ──────────────────────────────────────────────────────── */
function ProfileBuilder() {
  const [data, setData] = useState<ProfileData>(EMPTY_PROFILE);
  const [saved, setSaved] = useState(false);

  const set = (key: keyof ProfileData) => (val: string) => setData(d => ({ ...d, [key]: val }));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const completeness = Math.round(
    (Object.values(data).filter(v => v.trim() !== '').length / Object.keys(data).length) * 100
  );

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* Profile completeness bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--muted-on-dark)' }}>Profile completeness</span>
          <span className="text-xs font-bold" style={{ color: completeness >= 80 ? 'var(--accent)' : 'var(--aqua)' }}>{completeness}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--navy-light)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${completeness}%`, backgroundColor: completeness >= 80 ? 'var(--accent)' : 'var(--aqua)' }}
          />
        </div>
      </div>

      {/* Personal info */}
      <section>
        <h3 className="display text-sm mb-5" style={{ color: 'var(--ice)' }}>Personal Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <InputField label="First name" icon={User} value={data.firstName} onChange={set('firstName')} placeholder="Emma" required />
          <InputField label="Last name" value={data.lastName} onChange={set('lastName')} placeholder="Wilson" required />
          <InputField label="Email" icon={Mail} type="email" value={data.email} onChange={set('email')} placeholder="emma@example.com" required />
          <InputField label="Date of birth" icon={Calendar} type="date" value={data.dateOfBirth} onChange={set('dateOfBirth')} />
          <SelectField
            label="Country"
            icon={Globe}
            value={data.countryCode}
            onChange={set('countryCode')}
            options={COUNTRIES.map(c => ({ value: c.code, label: `${c.name}` }))}
            placeholder="Select country…"
          />
          <InputField label="Club / team" value={data.club} onChange={set('club')} placeholder="City Aquatics Club" />
        </div>
      </section>

      {/* Transplant info */}
      <section>
        <div
          className="flex items-center gap-3 mb-5 pb-3"
          style={{ borderBottom: '1px solid var(--navy-light)' }}
        >
          <Heart size={16} style={{ color: 'var(--accent)' }} />
          <h3 className="display text-sm" style={{ color: 'var(--ice)' }}>Transplant Details</h3>
          <span className="ml-auto font-mono text-xs px-2 py-0.5" style={{ color: 'var(--muted-on-dark)', border: '1px solid var(--navy-light)' }}>
            Private by default
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <SelectField
            label="Transplant type"
            value={data.transplantType}
            onChange={set('transplantType')}
            options={TRANSPLANT_TYPES.map(t => ({ value: t, label: t }))}
            placeholder="Select type…"
          />
          <InputField
            label="Year of transplant"
            value={data.transplantYear}
            onChange={set('transplantYear')}
            placeholder="e.g. 2018"
            type="number"
            suffix="year"
          />
        </div>
      </section>

      {/* Bio & social */}
      <section>
        <h3 className="display text-sm mb-5" style={{ color: 'var(--ice)' }}>Bio & Socials</h3>
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-medium uppercase tracking-widest mb-2" style={{ color: 'var(--muted-on-dark)' }}>
              Athlete bio
            </label>
            <textarea
              rows={3}
              value={data.bio}
              onChange={e => set('bio')(e.target.value)}
              placeholder="Tell your story — your journey, your training, your goals…"
              className="w-full px-3 py-3 text-sm text-white placeholder-white/30 outline-none resize-none transition-colors"
              style={{ backgroundColor: 'var(--navy)', border: '1px solid var(--navy-light)' }}
              onFocus={e => (e.target.style.borderColor = 'var(--aqua)')}
              onBlur={e => (e.target.style.borderColor = 'var(--navy-light)')}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InputField label="Website URL" value={data.websiteUrl} onChange={set('websiteUrl')} placeholder="https://yoursite.com" />
            <InputField label="Instagram" value={data.instagramHandle} onChange={set('instagramHandle')} placeholder="@handle" />
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          className="flex items-center gap-2 px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-black transition-opacity hover:opacity-85"
          style={{ backgroundColor: 'var(--accent)', fontFamily: "'Manrope', sans-serif" }}
        >
          {saved ? <><CheckCircle2 size={16} /> Saved!</> : <>Save Profile <ArrowRight size={16} /></>}
        </button>
        <p className="text-xs" style={{ color: 'var(--muted-on-dark)' }}>
          Your profile is visible to other athletes once published.
        </p>
      </div>
    </form>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────────── */
export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin');
  const auth = useAuth();
  const navigate = useNavigate();

  // Redirect already-authenticated users straight to their profile
  useEffect(() => {
    if (auth.isLoggedIn) {
      navigate('/profile', { replace: true });
    }
  }, [auth.isLoggedIn, navigate]);

  const titles: Record<Mode, { heading: string; sub: string }> = {
    signin:   { heading: 'Sign In',          sub: 'Access your Transplant Aquatics profile.' },
    register: { heading: 'Create Account',   sub: 'Join the global transplant swimming community.' },
    profile:  { heading: 'Your Profile',     sub: 'Complete your athlete profile.' },
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--navy)' }}>
      {/* Top bar */}
      <div className="max-w-7xl mx-auto px-4 py-8 flex items-center justify-between">
        <Link to="/">
          <Logo size="md" light />
        </Link>
        {mode === 'profile' && (
          <Link to="/" className="font-mono text-xs uppercase tracking-wider transition-colors" style={{ color: 'var(--muted-on-dark)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-on-dark)')}
          >
            ← Back to site
          </Link>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-20">
        <div className={`mx-auto ${mode === 'profile' ? 'max-w-2xl' : 'max-w-md'}`}>

          {/* Panel */}
          <div
            className="p-8 md:p-10"
            style={{ backgroundColor: 'var(--navy-mid)', border: '1px solid var(--navy-light)' }}
          >
            {/* Header */}
            <div className="mb-8" style={{ borderBottom: '1px solid var(--navy-light)', paddingBottom: '1.5rem' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5" style={{ backgroundColor: 'var(--accent)' }} />
                <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--muted-on-dark)' }}>
                  {mode === 'profile' ? 'Athlete Portal' : 'Transplant Aquatics'}
                </span>
              </div>
              <h1 className="display text-3xl text-white">{titles[mode].heading}</h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--muted-on-dark)' }}>{titles[mode].sub}</p>
            </div>

            {/* Tab switcher (sign in / register only) */}
            {mode !== 'profile' && (
              <div className="flex mb-8" style={{ borderBottom: '1px solid var(--navy-light)' }}>
                {(['signin', 'register'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className="flex-1 pb-3 text-sm font-medium transition-colors"
                    style={{
                      color: mode === m ? 'var(--accent)' : 'var(--muted-on-dark)',
                      borderBottom: mode === m ? '2px solid var(--accent)' : '2px solid transparent',
                      marginBottom: '-1px',
                    }}
                  >
                    {m === 'signin' ? 'Sign In' : 'Register'}
                  </button>
                ))}
              </div>
            )}

            {/* Forms */}
            {mode === 'signin'   && <SignInForm onSwitch={setMode} />}
            {mode === 'register' && <RegisterForm onSwitch={setMode} />}
            {mode === 'profile'  && <ProfileBuilder />}
          </div>

          {/* Brand note */}
          <p className="mt-6 text-center font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
            Captured to 0.001s resolution. · © 2026 Transplant Aquatics
          </p>
        </div>
      </div>
    </div>
  );
}
