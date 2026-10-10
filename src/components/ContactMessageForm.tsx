import { useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Send } from 'lucide-react';
import { describeSupabaseError, supabase } from '../lib/supabase';

const inputClass = 'mt-2 w-full border border-[var(--border)] bg-white px-3 py-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent-dark)] focus:ring-2 focus:ring-[var(--accent)]/30';

export default function ContactMessageForm() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', company: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    // Quietly discard bot submissions caught by the honeypot.
    if (form.company.trim()) { setSent(true); return; }
    if (!supabase) { setError('The contact form is temporarily unavailable. Please try again later.'); return; }

    setBusy(true);
    try {
      const { error: submitError } = await supabase.from('contact_messages').insert({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject,
        message: form.message.trim(),
      });
      if (submitError) {
        setError(submitError.code === '42P01' || submitError.code === 'PGRST205'
          ? 'The contact form is being set up. Please try again later.'
          : describeSupabaseError(submitError));
        return;
      }
      setSent(true);
      setForm({ name: '', email: '', subject: '', message: '', company: '' });
    } catch (reason) {
      setError(describeSupabaseError(reason));
    } finally {
      setBusy(false);
    }
  };

  if (sent) return <div role="status" className="border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
    <CheckCircle2 size={24} className="text-emerald-700" aria-hidden="true" />
    <h2 className="mt-4 text-xl font-bold text-[var(--ink)]">Thanks for getting in touch.</h2>
    <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">Your message has been sent to the Transplant Aquatics team.</p>
    <button type="button" onClick={() => setSent(false)} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-dark)] hover:underline">Send another message<ArrowRight size={14} /></button>
  </div>;

  return <form onSubmit={event => void submit(event)} className="border border-[var(--border)] bg-white p-5 sm:p-7">
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-semibold text-[var(--ink)]">Your name
        <input required minLength={2} maxLength={120} autoComplete="name" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} className={inputClass} />
      </label>
      <label className="text-sm font-semibold text-[var(--ink)]">Email address
        <input required type="email" maxLength={320} autoComplete="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} className={inputClass} />
      </label>
      <label className="text-sm font-semibold text-[var(--ink)] sm:col-span-2">What is your message about?
        <select required value={form.subject} onChange={event => setForm(current => ({ ...current, subject: event.target.value }))} className={inputClass}>
          <option value="">Choose a topic</option>
          <option value="General enquiry">General enquiry</option>
          <option value="Partnership">Partnership</option>
          <option value="Club">Club</option>
          <option value="Results or profile">Results or profile</option>
          <option value="Media">Media</option>
          <option value="Other">Other</option>
        </select>
      </label>
      <label className="text-sm font-semibold text-[var(--ink)] sm:col-span-2">Message
        <textarea required minLength={10} maxLength={5000} rows={7} value={form.message} onChange={event => setForm(current => ({ ...current, message: event.target.value }))} className={`${inputClass} resize-y`} />
        <span className="mt-1 block text-xs font-normal text-[var(--muted)]">Please don’t include medical or other sensitive personal information.</span>
      </label>
      <label aria-hidden="true" className="pointer-events-none absolute -left-[10000px] h-px w-px overflow-hidden" tabIndex={-1}>Company<input tabIndex={-1} autoComplete="off" value={form.company} onChange={event => setForm(current => ({ ...current, company: event.target.value }))} /></label>
    </div>
    {error && <p role="alert" className="mt-4 border border-red-200 bg-red-50 p-3 text-sm leading-relaxed text-red-800">{error}</p>}
    <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] pt-5">
      <p className="max-w-md text-xs leading-relaxed text-[var(--muted)]">Your details will only be used to respond to this enquiry.</p>
      <button type="submit" disabled={busy} className="inline-flex items-center gap-2 bg-[var(--navy)] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--accent-dark)] disabled:cursor-wait disabled:opacity-60"><Send size={15} />{busy ? 'Sending…' : 'Send message'}</button>
    </div>
  </form>;
}
