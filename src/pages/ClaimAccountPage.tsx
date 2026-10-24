import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Search, ShieldCheck, UserRoundPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ClaimAccountWizard from '../components/ClaimAccountWizard';

const loginState = { from: { pathname: '/claim' } };

export default function ClaimAccountPage() {
  const auth = useAuth();

  return <div className="min-h-[70vh] bg-[var(--paper)]">
    <header className="ta-page-top">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Athlete account</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">Claim your athlete profile</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">Connect your account to the athlete profile and results already in the Transplant Aquatics database.</p>
      </div>
    </header>

    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <section aria-labelledby="claim-guide-title" className="border border-[var(--border)] bg-white p-5 sm:p-7">
        <h2 id="claim-guide-title" className="text-xl font-bold text-[var(--ink)]">What you’ll need</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">You can start whether you’re signed in or new to the site. To claim an existing athlete profile, you’ll need an account and details from a World Transplant Games swim listed in our results.</p>
        <ol className="mt-5 grid gap-4 md:grid-cols-3">
          <li className="flex items-start gap-3 border-t border-[var(--border)] pt-4">
            <span className="flex size-9 shrink-0 items-center justify-center bg-[var(--ice)] text-[var(--blue)]"><Search size={17} aria-hidden="true" /></span>
            <span><strong className="block text-sm text-[var(--ink)]">Find your profile</strong><span className="mt-1 block text-sm leading-relaxed text-[var(--muted)]">Search your name, country, or club in the athlete records.</span></span>
          </li>
          <li className="flex items-start gap-3 border-t border-[var(--border)] pt-4">
            <span className="flex size-9 shrink-0 items-center justify-center bg-[var(--ice)] text-[var(--blue)]"><CheckCircle2 size={17} aria-hidden="true" /></span>
            <span><strong className="block text-sm text-[var(--ink)]">Confirm a WTG swim</strong><span className="mt-1 block text-sm leading-relaxed text-[var(--muted)]">You’ll be asked to identify the stroke, event, and exact time shown in a verified result.</span></span>
          </li>
          <li className="flex items-start gap-3 border-t border-[var(--border)] pt-4">
            <span className="flex size-9 shrink-0 items-center justify-center bg-[var(--ice)] text-[var(--blue)]"><ShieldCheck size={17} aria-hidden="true" /></span>
            <span><strong className="block text-sm text-[var(--ink)]">Wait for review</strong><span className="mt-1 block text-sm leading-relaxed text-[var(--muted)]">An admin reviews each request before linking the profile and its results to your account.</span></span>
          </li>
        </ol>
        <p className="mt-5 border-l-2 border-[var(--accent)] bg-[var(--paper)] px-4 py-3 text-sm leading-relaxed text-[var(--muted)]"><strong className="text-[var(--ink)]">New to the sport or can’t find your name?</strong> Choose “I’m new or can’t find myself” in the flow. We’ll record you as a new member instead of asking you to claim a profile that isn’t there.</p>
      </section>

      {auth.isLoading ? <div role="status" className="border border-[var(--border)] bg-white p-5 text-sm text-[var(--muted)]">Checking your account…</div>
        : auth.user ? <ClaimAccountWizard standalone />
          : <section aria-labelledby="claim-sign-in-title" className="flex flex-col gap-4 border border-[var(--border)] bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center bg-[var(--ice)] text-[var(--blue)]"><UserRoundPlus size={18} aria-hidden="true" /></span><div><h2 id="claim-sign-in-title" className="font-bold text-[var(--ink)]">Sign in or create an account to begin</h2><p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">We’ll bring you back here after you sign in. If you need an account, create one first and verify your email.</p></div></div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Link to="/login" state={loginState} className="inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--blue)]">Sign in <ArrowRight size={15} aria-hidden="true" /></Link>
              <Link to="/join?returnTo=claim" className="inline-flex min-h-11 items-center justify-center border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:border-[var(--blue)] hover:text-[var(--blue)]">Create an account</Link>
            </div>
          </section>}
    </div>
  </div>;
}
