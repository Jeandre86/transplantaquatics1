import { useState, useRef } from 'react';
import { EVENTS, COURSES } from '../types';
import Eyebrow from '../components/Eyebrow';

type Step = 1 | 2 | 3 | 4;

interface MeetDetails {
  meetName: string;
  date: string;
  location: string;
  course: string;
  level: string;
}

interface SwimDetails {
  athleteName: string;
  athleteId: string;
  event: string;
  time: string;
  heatType: string;
}

// Simple time format validator: MM:SS.ss or SS.ss
function isValidTime(t: string): boolean {
  return /^\d{1,2}:\d{2}\.\d{2}$/.test(t) || /^\d{1,2}\.\d{2}$/.test(t);
}

// Generate a reference number
function genRef(): string {
  return 'SS-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

const LEVEL_OPTIONS = ['Local', 'National', 'International', 'World Transplant Games', 'Other'];

const inputClass = `w-full px-4 py-3 border font-mono text-sm outline-none transition-colors`;
const inputStyle = {
  backgroundColor: 'var(--navy)',
  borderColor: 'var(--navy-light)',
  color: 'var(--ink-on-dark)',
};

const labelClass = 'block font-mono text-xs uppercase tracking-widest mb-1.5';
const labelStyle = { color: 'var(--muted-on-dark)' };

export default function SubmitResultPage() {
  const [step, setStep] = useState<Step>(1);
  const [meet, setMeet] = useState<MeetDetails>({
    meetName: '', date: '', location: '', course: 'LCM', level: 'Local',
  });
  const [swim, setSwim] = useState<SwimDetails>({
    athleteName: '', athleteId: '', event: '100m Freestyle', time: '', heatType: 'Final',
  });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [declared, setDeclared] = useState(false);
  const [timeError, setTimeError] = useState('');
  const [refNumber] = useState(genRef);
  const fileRef = useRef<HTMLInputElement>(null);

  // Field focus highlight
  const [focusedField, setFocusedField] = useState<string | null>(null);

  function fieldStyle(name: string) {
    return {
      ...inputStyle,
      borderColor: focusedField === name ? 'var(--accent)' : 'var(--navy-light)',
    };
  }

  function validateTime(value: string) {
    setSwim(s => ({ ...s, time: value }));
    if (value && !isValidTime(value)) {
      setTimeError('Use format MM:SS.ss (e.g. 1:02.44) or SS.ss (e.g. 28.92)');
    } else {
      setTimeError('');
    }
  }

  function canProceedStep1() {
    return meet.meetName.trim() && meet.date && meet.location.trim() && meet.course && meet.level;
  }

  function canProceedStep2() {
    return swim.athleteName.trim() && swim.event && swim.time && !timeError;
  }

  function canProceedStep3() {
    return proofFile !== null && declared;
  }

  const STEPS = [
    { n: 1, label: 'Meet' },
    { n: 2, label: 'Swim' },
    { n: 3, label: 'Verify' },
    { n: 4, label: 'Done' },
  ];

  return (
    <div style={{ backgroundColor: 'var(--navy)', minHeight: '100vh' }}>
      {/* Header */}
      <section
        className="border-b"
        style={{
          backgroundColor: 'var(--navy-mid)',
          borderColor: 'var(--navy-light)',
          backgroundImage:
            'repeating-linear-gradient(-55deg, transparent, transparent 18px, rgba(255,255,255,0.015) 18px, rgba(255,255,255,0.015) 19px)',
        }}
      >
        <div className="max-w-2xl mx-auto px-6 py-14">
          <Eyebrow color="accent" className="mb-4">Submit</Eyebrow>
          <h1
            className="display text-4xl md:text-5xl font-black uppercase leading-tight tracking-tight"
            style={{ color: 'var(--ink-on-dark)' }}
          >
            Submit a Result
          </h1>
          <p className="mt-3 font-mono text-sm" style={{ color: 'var(--muted-on-dark)' }}>
            All results are reviewed before publishing. Verification takes 1–3 business days.
          </p>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-6 py-10 pb-20">

        {/* Progress bar */}
        {step < 4 && (
          <div className="mb-10">
            {/* Step labels */}
            <div className="flex justify-between mb-3">
              {STEPS.map(s => (
                <div key={s.n} className="flex flex-col items-center gap-1">
                  <div
                    className="w-7 h-7 flex items-center justify-center font-mono font-bold text-xs border transition-colors"
                    style={{
                      backgroundColor: step >= s.n ? 'var(--accent)' : 'transparent',
                      borderColor: step >= s.n ? 'var(--accent)' : 'var(--navy-light)',
                      color: step >= s.n ? 'var(--navy)' : 'var(--muted-on-dark)',
                    }}
                  >
                    {s.n}
                  </div>
                  <span className="font-mono text-xs uppercase tracking-widest" style={{ color: step === s.n ? 'var(--accent)' : 'var(--muted-on-dark)' }}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
            {/* Bar */}
            <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--navy-light)' }}>
              <div
                className="h-full transition-all duration-500"
                style={{
                  backgroundColor: 'var(--accent)',
                  width: `${((step - 1) / 3) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Step 1 — Meet details */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="font-bold text-xl" style={{ color: 'var(--ink-on-dark)' }}>Step 1 — Meet Details</h2>

            <div>
              <label className={labelClass} style={labelStyle}>Meet Name *</label>
              <input
                type="text"
                className={inputClass}
                style={fieldStyle('meetName')}
                value={meet.meetName}
                onChange={e => setMeet(m => ({ ...m, meetName: e.target.value }))}
                onFocus={() => setFocusedField('meetName')}
                onBlur={() => setFocusedField(null)}
                placeholder="e.g. World Transplant Games 2028"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} style={labelStyle}>Date *</label>
                <input
                  type="date"
                  className={inputClass}
                  style={fieldStyle('date')}
                  value={meet.date}
                  onChange={e => setMeet(m => ({ ...m, date: e.target.value }))}
                  onFocus={() => setFocusedField('date')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Course *</label>
                <select
                  className={inputClass + ' cursor-pointer'}
                  style={fieldStyle('course')}
                  value={meet.course}
                  onChange={e => setMeet(m => ({ ...m, course: e.target.value }))}
                >
                  {COURSES.map(c => <option key={c} value={c}>{c} — {c === 'LCM' ? 'Long Course (50m)' : 'Short Course (25m)'}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>Location *</label>
              <input
                type="text"
                className={inputClass}
                style={fieldStyle('location')}
                value={meet.location}
                onChange={e => setMeet(m => ({ ...m, location: e.target.value }))}
                onFocus={() => setFocusedField('location')}
                onBlur={() => setFocusedField(null)}
                placeholder="City, Country"
              />
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>Competition Level *</label>
              <select
                className={inputClass + ' cursor-pointer'}
                style={fieldStyle('level')}
                value={meet.level}
                onChange={e => setMeet(m => ({ ...m, level: e.target.value }))}
              >
                {LEVEL_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <button
              onClick={() => canProceedStep1() && setStep(2)}
              disabled={!canProceedStep1()}
              className="w-full py-3.5 font-mono text-sm uppercase tracking-widest font-bold transition-opacity"
              style={{
                backgroundColor: canProceedStep1() ? 'var(--accent)' : 'var(--navy-light)',
                color: canProceedStep1() ? 'var(--navy)' : 'var(--muted-on-dark)',
                cursor: canProceedStep1() ? 'pointer' : 'not-allowed',
              }}
            >
              Continue to Swim Details →
            </button>
          </div>
        )}

        {/* Step 2 — Swim details */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="font-bold text-xl" style={{ color: 'var(--ink-on-dark)' }}>Step 2 — Swim Details</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} style={labelStyle}>Athlete Name *</label>
                <input
                  type="text"
                  className={inputClass}
                  style={fieldStyle('athleteName')}
                  value={swim.athleteName}
                  onChange={e => setSwim(s => ({ ...s, athleteName: e.target.value }))}
                  onFocus={() => setFocusedField('athleteName')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Athlete ID (optional)</label>
                <input
                  type="text"
                  className={inputClass}
                  style={fieldStyle('athleteId')}
                  value={swim.athleteId}
                  onChange={e => setSwim(s => ({ ...s, athleteId: e.target.value }))}
                  onFocus={() => setFocusedField('athleteId')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="e.g. michael-van-der-berg"
                />
              </div>
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>Event *</label>
              <select
                className={inputClass + ' cursor-pointer'}
                style={fieldStyle('event')}
                value={swim.event}
                onChange={e => setSwim(s => ({ ...s, event: e.target.value }))}
              >
                {EVENTS.map(ev => <option key={ev} value={ev}>{ev}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} style={labelStyle}>Time (MM:SS.ss) *</label>
                <input
                  type="text"
                  className={inputClass}
                  style={{ ...fieldStyle('time'), borderColor: timeError ? '#ef4444' : (focusedField === 'time' ? 'var(--accent)' : 'var(--navy-light)') }}
                  value={swim.time}
                  onChange={e => validateTime(e.target.value)}
                  onFocus={() => setFocusedField('time')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="e.g. 1:02.44"
                />
                {timeError && (
                  <p className="mt-1 font-mono text-xs" style={{ color: '#ef4444' }}>
                    {timeError}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Heat / Final</label>
                <select
                  className={inputClass + ' cursor-pointer'}
                  style={fieldStyle('heatType')}
                  value={swim.heatType}
                  onChange={e => setSwim(s => ({ ...s, heatType: e.target.value }))}
                >
                  {['Heat', 'Semi-Final', 'Final'].map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3.5 font-mono text-sm uppercase tracking-widest border"
                style={{ borderColor: 'var(--navy-light)', color: 'var(--muted-on-dark)' }}
              >
                ← Back
              </button>
              <button
                onClick={() => canProceedStep2() && setStep(3)}
                disabled={!canProceedStep2()}
                className="flex-1 py-3.5 font-mono text-sm uppercase tracking-widest font-bold transition-opacity"
                style={{
                  backgroundColor: canProceedStep2() ? 'var(--accent)' : 'var(--navy-light)',
                  color: canProceedStep2() ? 'var(--navy)' : 'var(--muted-on-dark)',
                  cursor: canProceedStep2() ? 'pointer' : 'not-allowed',
                }}
              >
                Continue to Verification →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Verification */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="font-bold text-xl" style={{ color: 'var(--ink-on-dark)' }}>Step 3 — Verification</h2>

            {/* Review summary */}
            <div
              className="border p-5 space-y-3"
              style={{ borderColor: 'var(--navy-light)', backgroundColor: 'var(--navy-mid)' }}
            >
              <Eyebrow light className="mb-1">Summary</Eyebrow>
              {[
                { label: 'Meet', value: meet.meetName },
                { label: 'Date', value: meet.date },
                { label: 'Location', value: meet.location },
                { label: 'Course', value: meet.course },
                { label: 'Athlete', value: swim.athleteName },
                { label: 'Event', value: swim.event },
                { label: 'Time', value: swim.time },
                { label: 'Round', value: swim.heatType },
              ].map(row => (
                <div key={row.label} className="flex items-baseline justify-between gap-4">
                  <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--muted-on-dark)' }}>
                    {row.label}
                  </span>
                  <span className="font-mono text-sm font-bold text-right" style={{ color: 'var(--ink-on-dark)' }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {/* File upload */}
            <div>
              <label className={labelClass} style={labelStyle}>Upload Proof *</label>
              <p className="font-mono text-xs mb-3" style={{ color: 'var(--muted-on-dark)' }}>
                Accepted: screenshot from meet management system, results sheet, or official PDF. Max 10 MB.
              </p>
              <div
                className="border-2 border-dashed p-8 text-center cursor-pointer transition-colors"
                style={{
                  borderColor: proofFile ? 'var(--accent)' : 'var(--navy-light)',
                  backgroundColor: proofFile ? 'rgba(199,243,104,0.04)' : 'transparent',
                }}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) setProofFile(file);
                }}
              >
                {proofFile ? (
                  <div>
                    <div className="font-mono font-bold text-sm" style={{ color: 'var(--accent)' }}>
                      {proofFile.name}
                    </div>
                    <div className="font-mono text-xs mt-1" style={{ color: 'var(--muted-on-dark)' }}>
                      {(proofFile.size / 1024).toFixed(1)} KB · Click to replace
                    </div>
                  </div>
                ) : (
                  <div>
                    <svg className="mx-auto mb-3" width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ color: 'var(--muted-on-dark)' }}>
                      <path d="M16 22V10M10 16l6-6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <rect x="4" y="4" width="24" height="24" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    <p className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--muted-on-dark)' }}>
                      Click to upload or drag & drop
                    </p>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="sr-only"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) setProofFile(file);
                }}
              />
            </div>

            {/* Declaration */}
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={declared}
                  onChange={e => setDeclared(e.target.checked)}
                />
                <div
                  className="w-5 h-5 border flex items-center justify-center transition-colors"
                  style={{
                    borderColor: declared ? 'var(--accent)' : 'var(--navy-light)',
                    backgroundColor: declared ? 'var(--accent)' : 'transparent',
                  }}
                >
                  {declared && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="var(--navy)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="font-mono text-xs leading-relaxed" style={{ color: 'var(--muted-on-dark)' }}>
                I confirm that this result is accurate and was achieved at a sanctioned meet. I understand that false submissions may result in removal from the platform.
              </span>
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3.5 font-mono text-sm uppercase tracking-widest border"
                style={{ borderColor: 'var(--navy-light)', color: 'var(--muted-on-dark)' }}
              >
                ← Back
              </button>
              <button
                onClick={() => canProceedStep3() && setStep(4)}
                disabled={!canProceedStep3()}
                className="flex-1 py-3.5 font-mono text-sm uppercase tracking-widest font-bold"
                style={{
                  backgroundColor: canProceedStep3() ? 'var(--accent)' : 'var(--navy-light)',
                  color: canProceedStep3() ? 'var(--navy)' : 'var(--muted-on-dark)',
                  cursor: canProceedStep3() ? 'pointer' : 'not-allowed',
                }}
              >
                Submit Result →
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Success */}
        {step === 4 && (
          <div className="flex flex-col items-center text-center py-8">
            <div
              className="w-20 h-20 border-2 flex items-center justify-center mb-8"
              style={{ borderColor: 'var(--accent)' }}
            >
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <path d="M6 18l8 8L30 10" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <Eyebrow color="accent" className="mb-3">Submitted</Eyebrow>

            <h2
              className="display text-3xl md:text-4xl font-black uppercase leading-tight"
              style={{ color: 'var(--ink-on-dark)' }}
            >
              Result submitted for verification
            </h2>

            <p className="mt-4 font-mono text-sm max-w-md" style={{ color: 'var(--muted-on-dark)' }}>
              Your result has been received and is now under review. You'll be notified once it's verified and published.
            </p>

            <div
              className="mt-8 border px-8 py-5 text-center"
              style={{ borderColor: 'var(--navy-light)', backgroundColor: 'var(--navy-mid)' }}
            >
              <div className="font-mono text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--muted-on-dark)' }}>
                Reference Number
              </div>
              <div className="font-mono font-black text-2xl" style={{ color: 'var(--accent)' }}>
                {refNumber}
              </div>
              <div className="mt-2 font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
                Status: <span style={{ color: '#F5C542' }}>Pending</span>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => { setStep(1); setMeet({ meetName: '', date: '', location: '', course: 'LCM', level: 'Local' }); setSwim({ athleteName: '', athleteId: '', event: '100m Freestyle', time: '', heatType: 'Final' }); setProofFile(null); setDeclared(false); }}
                className="px-6 py-3 font-mono text-xs uppercase tracking-widest border"
                style={{ borderColor: 'var(--navy-light)', color: 'var(--muted-on-dark)' }}
              >
                Submit Another
              </button>
              <a
                href="/results"
                className="px-6 py-3 font-mono text-xs uppercase tracking-widest"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--navy)', fontWeight: 700 }}
              >
                View Results
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
