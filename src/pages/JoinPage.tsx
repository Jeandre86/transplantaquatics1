import { useState } from 'react';
import { countries } from '../data/countries';
import { TRANSPLANT_TYPES, AGE_GROUPS, GENDERS, EVENTS } from '../types';
import Button from '../components/Button';
import Eyebrow from '../components/Eyebrow';
import { CheckCircle } from 'lucide-react';

const STEPS = [
  { num: '01', label: 'Create your profile' },
  { num: '02', label: 'Add your results' },
  { num: '03', label: 'Get discovered' },
  { num: '04', label: 'Track your progress' },
];

export default function JoinPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    country: '',
    transplantType: '',
    ageGroup: '',
    gender: '',
    club: '',
    primaryEvent: '',
  });

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={{ backgroundColor: 'var(--paper)' }} className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <CheckCircle size={48} className="mx-auto mb-6" style={{ color: 'var(--accent)' }} />
          <h2 className="text-3xl font-black tracking-tight">Profile request received.</h2>
          <p className="mt-4 text-neutral-600 text-base leading-relaxed">
            Welcome to Split Second, {form.firstName}. Your athlete profile will be reviewed and activated shortly.
            We'll be in touch at {form.email}.
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
          <Eyebrow light className="mb-3">Join Split Second</Eyebrow>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-none">
            Your swim.
            <br />
            Your story.
          </h1>
          <p className="mt-5 text-neutral-400 text-base max-w-xl leading-relaxed">
            Create your athlete profile, add your results and become part of the global transplant swimming community.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STEPS.map(step => (
              <div key={step.num} className="flex items-start gap-3">
                <span
                  className="font-mono font-black text-xl shrink-0 leading-none"
                  style={{ color: 'var(--accent)' }}
                >
                  {step.num}
                </span>
                <span className="text-sm font-medium text-neutral-700 leading-tight">{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-16">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs tracking-widest uppercase text-neutral-500 mb-1.5">
                First Name *
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
                Last Name *
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs tracking-widest uppercase text-neutral-500 mb-1.5">
                Age Group *
              </label>
              <select
                required
                value={form.ageGroup}
                onChange={e => update('ageGroup', e.target.value)}
                className="w-full border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white appearance-none"
                style={{ borderRadius: 0 }}
              >
                <option value="">Select age group</option>
                {AGE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs tracking-widest uppercase text-neutral-500 mb-1.5">
                Club (optional)
              </label>
              <input
                type="text"
                value={form.club}
                onChange={e => update('club', e.target.value)}
                className="w-full border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
                style={{ borderRadius: 0 }}
              />
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
          </div>

          <div className="pt-4">
            <Button type="submit" variant="primary" size="lg" className="w-full justify-center">
              Create athlete profile
            </Button>
            <p className="mt-3 text-xs text-neutral-400 text-center font-mono">
              Demo only — no data will be submitted or stored.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
