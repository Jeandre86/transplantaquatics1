import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ExternalLink, Globe, ArrowLeft, Play, Heart, X, ArrowRight, Share2 } from 'lucide-react';
import { athletes } from '../data/athletes';
import { results } from '../data/results';
import { rankings } from '../data/rankings';
import { getFlagEmoji, getAgeFromDOB, formatDate } from '../lib/utils';
import TransplantBadge from '../components/TransplantBadge';
import PersonalBestTable from '../components/PersonalBestTable';
import ResultsTable from '../components/ResultsTable';
import MedalDisplay from '../components/MedalDisplay';
import ProgressionChart from '../components/ProgressionChart';
import SeasonProgressionTable from '../components/SeasonProgressionTable';
import EmptyState from '../components/EmptyState';
import Eyebrow from '../components/Eyebrow';
import type { Event, Course } from '../types';

// ─── Mock video data ──────────────────────────────────────────────────────────
const MOCK_VIDEOS = [
  { id: 1, title: 'World Transplant Games 2025 — 100m Freestyle Final', duration: '2:14', date: '2025-04-15' },
  { id: 2, title: 'Race Analysis: Sub-60 Breakdown', duration: '8:45', date: '2025-05-01' },
  { id: 3, title: 'Training Session — Club Pool', duration: '12:30', date: '2025-03-22' },
];

type Tab = 'Overview' | 'Results' | 'Medals' | 'Media';

export default function AthleteProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab]                   = useState<Tab>('Overview');
  const [claimOpen, setClaimOpen]       = useState(false);
  const [claimEmail, setClaimEmail]     = useState('');
  const [claimMessage, setClaimMessage] = useState('');
  const [claimSent, setClaimSent]       = useState(false);
  const [shareOpen, setShareOpen]       = useState(false);

  const athlete = athletes.find(a => a.id === id);

  if (!athlete) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20">
        <EmptyState
          title="Athlete not found"
          subtitle="This athlete profile does not exist or has been removed."
        />
        <div className="text-center mt-6">
          <Link to="/athletes" className="font-mono text-sm text-neutral-500 hover:text-black underline">
            ← Back to Athletes
          </Link>
        </div>
      </div>
    );
  }

  const flag           = getFlagEmoji(athlete.countryCode);
  const age            = getAgeFromDOB(athlete.dateOfBirth);
  const athleteResults = results.filter(r => r.athleteId === athlete.id);
  const ranking        = rankings.find(r => r.athleteId === athlete.id);
  const bestPB         = athlete.personalBests[0];
  const progressionEvent: Event  = bestPB?.event  ?? '100m Freestyle';
  const progressionCourse: Course = bestPB?.course ?? 'LCM';

  // ─── Performance percentile ────────────────────────────────────────────────
  const rankingGroup = rankings.filter(
    r => r.ageGroup === athlete.ageGroup && r.gender === athlete.gender && r.event === '100m Freestyle' && r.course === 'LCM'
  );
  const totalInGroup = rankingGroup.length || 20;
  const myRank       = ranking?.rank ?? athlete.ranking ?? totalInGroup;
  const percentile   = Math.max(1, Math.ceil((myRank / totalInGroup) * 100));
  const percentileLabel = `Top ${percentile}% in ${athlete.ageGroup} ${athlete.gender} 100m Freestyle`;

  const TABS: Tab[] = ['Overview', 'Results', 'Medals', 'Media'];

  return (
    <div style={{ backgroundColor: 'var(--surface)' }}>
      {/* Hero header — black */}
      <div style={{ backgroundColor: "var(--navy)" }} className="text-white">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <Link
            to="/athletes"
            className="inline-flex items-center gap-1.5 font-mono text-xs mb-6 transition-colors hover:opacity-80"
            style={{ color: 'var(--muted-on-dark)' }}
          >
            <ArrowLeft size={12} /> All Athletes
          </Link>

          <div className="flex flex-col md:flex-row md:items-end gap-6">
            {/* Avatar */}
            <div
              className="w-20 h-20 flex items-center justify-center font-mono font-black text-2xl text-white flex-shrink-0"
              style={{ backgroundColor: 'var(--navy-light)' }}
            >
              {athlete.avatarInitials || `${athlete.firstName[0]}${athlete.lastName[0]}`}
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <TransplantBadge type={athlete.transplantType} onDark />
                <span
                  className="font-mono text-xs px-2 py-0.5"
                  style={{ backgroundColor: 'var(--navy-light)', color: 'var(--muted-on-dark)' }}
                >
                  {athlete.ageGroup}
                </span>
                {ranking && (
                  <span
                    className="font-mono text-xs px-2 py-0.5 font-bold"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--navy)' }}
                  >
                    #{ranking.rank} World Ranking
                  </span>
                )}
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none" style={{ color: 'var(--ink-on-dark)' }}>
                {athlete.firstName} {athlete.lastName}
              </h1>
              <div className="mt-2 font-mono text-base" style={{ color: 'var(--muted-on-dark)' }}>
                {flag} {athlete.country}
                {athlete.club && <span className="ml-4" style={{ color: 'var(--muted-on-dark)', opacity: 0.6 }}>· {athlete.club}</span>}
              </div>
            </div>

            {/* Top PB + Share */}
            {bestPB && (
              <div className="text-right shrink-0">
                <Eyebrow onDark className="mb-1">Best time</Eyebrow>
                <div className="font-mono font-black text-3xl" style={{ color: 'var(--accent)' }}>
                  {bestPB.time}
                </div>
                <div className="font-mono text-xs mt-1" style={{ color: 'var(--muted-on-dark)' }}>
                  {bestPB.event} · {bestPB.course}
                </div>
                <button
                  onClick={() => setShareOpen(true)}
                  className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 transition-colors"
                  style={{ background: 'var(--navy-light)', color: 'var(--aqua)', border: '1px solid var(--navy-light)' }}
                >
                  <Share2 size={11} /> Share PB
                </button>
              </div>
            )}
          </div>

          {/* Social */}
          {athlete.social && (
            <div className="mt-6 flex items-center gap-4">
              {athlete.social.instagram && (
                <a href={`https://instagram.com/${athlete.social.instagram}`} target="_blank" rel="noreferrer"
                  className="font-mono text-xs uppercase tracking-wider transition-opacity hover:opacity-100"
                  style={{ color: 'var(--muted-on-dark)', opacity: 0.7 }}>
                  Instagram <ExternalLink size={10} className="inline" />
                </a>
              )}
              {athlete.social.x && (
                <a href={`https://x.com/${athlete.social.x}`} target="_blank" rel="noreferrer"
                  className="font-mono text-xs uppercase tracking-wider transition-opacity hover:opacity-100"
                  style={{ color: 'var(--muted-on-dark)', opacity: 0.7 }}>
                  X <ExternalLink size={10} className="inline" />
                </a>
              )}
              {athlete.social.facebook && (
                <a href={`https://facebook.com/${athlete.social.facebook}`} target="_blank" rel="noreferrer"
                  className="font-mono text-xs uppercase tracking-wider transition-opacity hover:opacity-100"
                  style={{ color: 'var(--muted-on-dark)', opacity: 0.7 }}>
                  Facebook <ExternalLink size={10} className="inline" />
                </a>
              )}
              {athlete.social.website && (
                <a href={athlete.social.website} target="_blank" rel="noreferrer"
                  className="transition-opacity hover:opacity-100"
                  style={{ color: 'var(--muted-on-dark)', opacity: 0.7 }}>
                  <Globe size={16} />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex gap-0" style={{ borderTop: '1px solid var(--navy-light)' }}>
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="font-mono text-xs tracking-widest uppercase px-5 py-3.5 border-b-2 transition-colors"
              style={{
                color: tab === t ? 'var(--ink-on-dark)' : 'var(--muted-on-dark)',
                borderBottomColor: tab === t ? 'var(--accent)' : 'transparent',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Claim Banner */}
      <div
        className="w-full px-4 py-3 flex items-center justify-between"
        style={{ background: 'var(--navy-mid)' }}
      >
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <span className="font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
            This is a public profile — not all data may be up to date.
          </span>
          <button
            onClick={() => setClaimOpen(true)}
            className="inline-flex items-center gap-1.5 font-mono text-xs transition-opacity hover:opacity-80"
            style={{ color: 'var(--aqua)' }}
          >
            Is this you? Claim this profile <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-10">

        {tab === 'Overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Main column */}
            <div className="lg:col-span-2 space-y-10">
              {athlete.bio && (
                <div>
                  <Eyebrow className="mb-3">Athlete Story</Eyebrow>
                  <p className="text-base leading-relaxed" style={{ color: 'var(--muted)' }}>{athlete.bio}</p>
                </div>
              )}

              <div>
                <Eyebrow className="mb-4">Personal Bests</Eyebrow>
                <PersonalBestTable
                  pbs={athlete.personalBests}
                  gender={athlete.gender}
                  ageGroup={athlete.ageGroup}
                />
              </div>

              {bestPB && (
                <div>
                  <Eyebrow className="mb-4">Progression — {progressionEvent} ({progressionCourse})</Eyebrow>
                  <ProgressionChart
                    pbs={athlete.personalBests}
                    event={progressionEvent}
                    course={progressionCourse}
                  />
                </div>
              )}

              {athleteResults.length > 0 && (
                <div>
                  <Eyebrow className="mb-4">Season Progression</Eyebrow>
                  <SeasonProgressionTable results={athleteResults} />
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Athlete Info */}
              <div style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
                <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                  <Eyebrow>Athlete Info</Eyebrow>
                </div>
                <dl>
                  {[
                    { label: 'Date of Birth', value: formatDate(athlete.dateOfBirth) },
                    { label: 'Age',            value: `${age}` },
                    { label: 'Gender',         value: athlete.gender },
                    { label: 'Age Group',      value: athlete.ageGroup },
                    { label: 'Nationality',    value: `${flag} ${athlete.country}` },
                    { label: 'Transplant',     value: athlete.transplantType },
                    ...(athlete.transplantYear ? [{ label: 'Transplant Year', value: `${athlete.transplantYear}` }] : []),
                    ...(athlete.club   ? [{ label: 'Club',  value: athlete.club   }] : []),
                    ...(athlete.coach  ? [{ label: 'Coach', value: athlete.coach  }] : []),
                    { label: 'Discipline', value: athlete.discipline },
                  ].map(row => (
                    <div key={row.label} className="flex items-start gap-4 px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                      <dt className="font-mono text-xs w-28 shrink-0 pt-0.5 uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                        {row.label}
                      </dt>
                      <dd className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Performance Percentile */}
              <div className="p-5 rounded" style={{ background: 'var(--navy-mid)' }}>
                <p className="font-mono text-xs tracking-widest uppercase mb-3" style={{ color: 'var(--muted-on-dark)' }}>
                  Performance Rank
                </p>
                <p className="font-mono text-sm font-semibold mb-3" style={{ color: 'var(--ink-on-dark)' }}>
                  {percentileLabel}
                </p>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--navy-light)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${100 - percentile}%`, background: 'var(--accent)' }}
                  />
                </div>
                <p className="font-mono text-xs mt-2" style={{ color: 'var(--muted-on-dark)' }}>
                  Rank #{myRank} of {totalInGroup} athletes
                </p>
              </div>

              {/* Donor Tribute */}
              {athlete.donorTribute ? (
                <div className="p-5 rounded" style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Heart size={14} style={{ color: 'var(--accent)' }} fill="var(--accent)" />
                    <p className="font-mono text-xs tracking-widest uppercase" style={{ color: 'var(--muted-on-dark)' }}>
                      In Honour Of
                    </p>
                  </div>
                  <p className="font-semibold text-sm mb-1" style={{ color: 'var(--ink-on-dark)' }}>
                    {athlete.donorTribute.name}
                  </p>
                  {athlete.donorTribute.message && (
                    <p className="text-xs leading-relaxed italic" style={{ color: 'var(--muted-on-dark)' }}>
                      "{athlete.donorTribute.message}"
                    </p>
                  )}
                </div>
              ) : (
                <div
                  className="p-5 rounded"
                  style={{
                    background: 'var(--navy-mid)',
                    border: '1px dashed var(--navy-light)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Heart size={13} style={{ color: 'var(--navy-light)' }} />
                    <p className="font-mono text-xs tracking-widest uppercase" style={{ color: 'var(--muted-on-dark)' }}>
                      Donor Acknowledgement
                    </p>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--muted-on-dark)' }}>
                    Add a tribute to honour your donor.{' '}
                    <span className="underline cursor-pointer" style={{ color: 'var(--aqua)' }}>
                      Claim this profile
                    </span>{' '}
                    to add one.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'Results' && (
          <div>
            <Eyebrow className="mb-6">
              {athleteResults.length} result{athleteResults.length !== 1 ? 's' : ''} recorded
            </Eyebrow>
            {athleteResults.length > 0 ? (
              <ResultsTable results={athleteResults} />
            ) : (
              <EmptyState
                title="No results yet"
                subtitle="Results for this athlete have not been added yet."
              />
            )}
          </div>
        )}

        {tab === 'Medals' && (
          <div className="max-w-2xl">
            <MedalDisplay medals={athlete.medals} />
          </div>
        )}

        {tab === 'Media' && (
          <div>
            <Eyebrow className="mb-6">Race Footage &amp; Media</Eyebrow>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {MOCK_VIDEOS.map(v => (
                <div
                  key={v.id}
                  className="rounded overflow-hidden cursor-pointer group"
                  style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)' }}
                >
                  {/* Thumbnail */}
                  <div
                    className="relative flex items-center justify-center"
                    style={{ height: 160, background: 'var(--navy)' }}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                      style={{ background: 'var(--accent)' }}
                    >
                      <Play size={20} fill="var(--black)" color="var(--black)" style={{ marginLeft: 2 }} />
                    </div>
                    <span
                      className="absolute bottom-2 right-2 font-mono text-xs px-1.5 py-0.5"
                      style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--ink-on-dark)' }}
                    >
                      {v.duration}
                    </span>
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <p className="text-sm font-medium leading-snug" style={{ color: 'var(--ink-on-dark)' }}>
                      {v.title}
                    </p>
                    <p className="font-mono text-xs mt-1" style={{ color: 'var(--muted-on-dark)' }}>
                      {formatDate(v.date)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Submit CTA */}
            <div
              className="mt-8 p-6 rounded text-center"
              style={{ background: 'var(--navy-mid)', border: '1px dashed var(--navy-light)' }}
            >
              <p className="font-mono text-xs tracking-widest uppercase mb-2" style={{ color: 'var(--muted-on-dark)' }}>
                Have race footage?
              </p>
              <p className="text-sm mb-4" style={{ color: 'var(--ink-on-dark)' }}>
                Race footage coming soon — submit your race video to be featured on this profile.
              </p>
              <button
                className="font-mono text-xs px-4 py-2 transition-opacity hover:opacity-80"
                style={{ background: 'var(--accent)', color: 'var(--black)' }}
              >
                Submit Race Video
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Claim Profile Modal ─────────────────────────────────────────────── */}
      {claimOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(1,4,16,0.85)' }}
          onClick={e => { if (e.target === e.currentTarget) setClaimOpen(false); }}
        >
          <div
            className="w-full max-w-md rounded p-6 relative"
            style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)' }}
          >
            <button
              onClick={() => setClaimOpen(false)}
              className="absolute top-4 right-4 transition-opacity hover:opacity-70"
              style={{ color: 'var(--muted-on-dark)' }}
            >
              <X size={16} />
            </button>

            {claimSent ? (
              <div className="text-center py-6">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'var(--accent)' }}
                >
                  <span className="text-black font-black text-lg">✓</span>
                </div>
                <h3 className="font-black text-lg mb-2" style={{ color: 'var(--ink-on-dark)' }}>Request Sent</h3>
                <p className="text-sm" style={{ color: 'var(--muted-on-dark)' }}>
                  Your request has been sent. We'll verify within 48 hours.
                </p>
              </div>
            ) : (
              <>
                <h3 className="font-black text-lg mb-1" style={{ color: 'var(--ink-on-dark)' }}>
                  Claim This Profile
                </h3>
                <p className="text-xs mb-6" style={{ color: 'var(--muted-on-dark)' }}>
                  If this is your profile, we'll verify your identity and grant you access to edit your data.
                </p>

                <label className="block mb-4">
                  <span className="font-mono text-xs tracking-widest uppercase block mb-1.5" style={{ color: 'var(--muted-on-dark)' }}>
                    Your Email
                  </span>
                  <input
                    type="email"
                    value={claimEmail}
                    onChange={e => setClaimEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 text-sm outline-none"
                    style={{
                      background: 'var(--navy)',
                      border: '1px solid var(--navy-light)',
                      color: 'var(--ink-on-dark)',
                    }}
                  />
                </label>

                <label className="block mb-6">
                  <span className="font-mono text-xs tracking-widest uppercase block mb-1.5" style={{ color: 'var(--muted-on-dark)' }}>
                    Message (optional)
                  </span>
                  <textarea
                    rows={3}
                    value={claimMessage}
                    onChange={e => setClaimMessage(e.target.value)}
                    placeholder="Tell us something that confirms your identity…"
                    className="w-full px-3 py-2 text-sm outline-none resize-none"
                    style={{
                      background: 'var(--navy)',
                      border: '1px solid var(--navy-light)',
                      color: 'var(--ink-on-dark)',
                    }}
                  />
                </label>

                <button
                  disabled={!claimEmail}
                  onClick={() => setClaimSent(true)}
                  className="w-full font-mono text-xs tracking-widest uppercase py-2.5 transition-opacity disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: 'var(--black)' }}
                >
                  Send Claim Request
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Share PB Modal ──────────────────────────────────────────────────── */}
      {shareOpen && bestPB && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(1,4,16,0.90)' }}
          onClick={e => { if (e.target === e.currentTarget) setShareOpen(false); }}
        >
          <div
            className="w-full max-w-sm relative"
            style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)' }}
          >
            <button
              onClick={() => setShareOpen(false)}
              className="absolute top-3 right-3 transition-opacity hover:opacity-70 z-10"
              style={{ color: 'var(--muted-on-dark)' }}
            >
              <X size={16} />
            </button>

            {/* Preview Card */}
            <div
              id="share-card"
              className="p-8"
              style={{ background: 'var(--navy)' }}
            >
              <p className="font-mono text-xs tracking-widest uppercase mb-6" style={{ color: 'var(--muted-on-dark)' }}>
                Personal Best
              </p>
              <h2
                className="display text-2xl font-black uppercase tracking-tight leading-none mb-1"
                style={{ color: 'var(--ink-on-dark)' }}
              >
                {athlete.firstName} {athlete.lastName}
              </h2>
              <p className="font-mono text-xs mb-6" style={{ color: 'var(--muted-on-dark)' }}>
                {flag} {athlete.country} · {athlete.ageGroup} · {athlete.transplantType}
              </p>

              <div
                className="display font-black leading-none mb-2"
                style={{ fontSize: 52, color: 'var(--accent)' }}
              >
                {bestPB.time}
              </div>
              <p className="font-mono text-sm" style={{ color: 'var(--muted-on-dark)' }}>
                {bestPB.event} · {bestPB.course}
              </p>
              <p className="font-mono text-xs mt-1" style={{ color: 'var(--muted-on-dark)' }}>
                {formatDate(bestPB.date)} · {bestPB.meet}
              </p>

              <div className="flex items-end justify-between mt-8">
                <p
                  className="font-mono text-xs italic"
                  style={{ color: 'var(--muted-on-dark)' }}
                >
                  Every Second Counts.
                </p>
                <p
                  className="display font-black text-xs uppercase tracking-widest"
                  style={{ color: 'var(--accent)' }}
                >
                  Split Second
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--navy-light)' }}>
              <p className="font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
                Screenshot the card above to share.
              </p>
              <button
                onClick={() => setShareOpen(false)}
                className="font-mono text-xs px-4 py-2 transition-opacity hover:opacity-80"
                style={{ background: 'var(--navy-light)', color: 'var(--muted-on-dark)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
