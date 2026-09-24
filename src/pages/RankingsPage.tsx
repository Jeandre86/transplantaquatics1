import { useState } from 'react';
import { rankings } from '../data/rankings';
import { TRANSPLANT_TYPES, type AgeGroup, type Gender, type Event, type Course } from '../types';
import RankingTable from '../components/RankingTable';
import RankingFilters from '../components/RankingFilters';
import Eyebrow from '../components/Eyebrow';
import { Link } from 'react-router-dom';
import { getFlagEmoji, getTransplantColor } from '../lib/utils';

export default function RankingsPage() {
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('40-49');
  const [gender, setGender] = useState<Gender>('Men');
  const [event, setEvent] = useState<Event>('100m Freestyle');
  const [course, setCourse] = useState<Course>('LCM');

  const filtered = rankings
    .filter(r => r.ageGroup === ageGroup && r.gender === gender && r.event === event && r.course === course)
    .sort((a, b) => a.rank - b.rank);

  return (
    <div>
      {/* Header */}
      <section style={{ backgroundColor: 'var(--navy)' }}>
        <div className="max-w-6xl mx-auto px-6 py-16">
          <Eyebrow color="accent" onDark>Official Rankings</Eyebrow>
          <h1 className="mt-4 font-bold text-5xl md:text-6xl" style={{ color: 'var(--ink-on-dark)' }}>World Rankings</h1>
          <p className="mt-4 max-w-2xl" style={{ color: 'var(--muted-on-dark)' }}>
            Official age-group rankings. Kidney, liver, heart, lung, pancreas and bone marrow transplant athletes compete together in the official ranking.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <span className="font-mono text-xs px-2 py-1 uppercase tracking-wider" style={{ backgroundColor: 'var(--navy-mid)', color: 'var(--muted-on-dark)' }}>
              Age Group → Gender → Event → Course
            </span>
          </div>
        </div>
      </section>

      {/* Filters + Table */}
      <section style={{ backgroundColor: 'var(--surface)' }}>
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="sticky top-14 z-10 py-4" style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
            <RankingFilters
              ageGroup={ageGroup} gender={gender} event={event} course={course}
              onChange={({ ageGroup: ag, gender: g, event: ev, course: co }) => {
                setAgeGroup(ag); setGender(g); setEvent(ev); setCourse(co);
              }}
            />
          </div>
          <div className="mt-6">
            {filtered.length > 0 ? (
              <RankingTable rankings={filtered} showExtras showVerified={false} />
            ) : (
              <div className="py-20 text-center">
                <p className="text-neutral-400 font-mono text-sm uppercase tracking-widest">No rankings available for this selection</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Fastest by Transplant Type — Discovery */}
      <section style={{ backgroundColor: 'var(--navy-mid)', borderTop: '1px solid var(--navy-light)' }}>
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="flex flex-col md:flex-row md:items-end gap-3 mb-8">
            <div>
              <Eyebrow>Discovery</Eyebrow>
              <h2 className="mt-2 font-bold text-3xl" style={{ color: 'var(--ink-on-dark)' }}>Fastest by Transplant Type</h2>
            </div>
            <span className="font-mono text-xs px-3 py-1 uppercase tracking-wider self-start" style={{ border: '1px solid var(--navy-light)', color: 'var(--muted-on-dark)' }}>
              Discovery view — not an official ranking category
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {TRANSPLANT_TYPES.map(type => {
              const fastest = rankings.find(r => r.transplantType === type);
              return (
                <div key={type} className="p-4" style={{ backgroundColor: 'var(--navy)', border: '1px solid var(--navy-light)' }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getTransplantColor(type) }} />
                    <span className="font-mono text-xs uppercase tracking-widest truncate" style={{ color: 'var(--muted-on-dark)' }}>{type}</span>
                  </div>
                  {fastest ? (
                    <>
                      <Link to={`/athletes/${fastest.athleteId}`} className="font-bold text-sm leading-tight hover:underline block" style={{ color: 'var(--ink-on-dark)' }}>
                        {fastest.athleteName}
                      </Link>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--muted-on-dark)' }}>{getFlagEmoji(fastest.countryCode)}</div>
                      <div className="font-mono font-bold mt-2 text-base" style={{ color: 'var(--accent)' }}>{fastest.time}</div>
                      <div className="font-mono text-xs mt-0.5" style={{ color: 'var(--muted-on-dark)' }}>{fastest.event}</div>
                    </>
                  ) : (
                    <div className="text-xs" style={{ color: 'var(--muted-on-dark)' }}>No data</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
