import { useState } from 'react';
import { records } from '../data/records';
import { AGE_GROUPS, GENDERS, EVENTS, COURSES } from '../types';
import RecordCard from '../components/RecordCard';
import FilterSelect from '../components/FilterSelect';
import Eyebrow from '../components/Eyebrow';
import EmptyState from '../components/EmptyState';

const ALL = 'All';

export default function RecordsPage() {
  const [filterAgeGroup, setFilterAgeGroup] = useState(ALL);
  const [filterGender, setFilterGender] = useState(ALL);
  const [filterEvent, setFilterEvent] = useState(ALL);
  const [filterCourse, setFilterCourse] = useState(ALL);

  const filtered = records.filter(r => {
    if (filterAgeGroup !== ALL && r.ageGroup !== filterAgeGroup) return false;
    if (filterGender !== ALL && r.gender !== filterGender) return false;
    if (filterEvent !== ALL && r.event !== filterEvent) return false;
    if (filterCourse !== ALL && r.course !== filterCourse) return false;
    return true;
  });

  return (
    <div style={{ backgroundColor: 'var(--paper)' }}>
      <div style={{ backgroundColor: "var(--navy)" }} className="text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <Eyebrow light className="mb-3">World Records</Eyebrow>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-none">
            Make history.
          </h1>
          <p style={{ color: "var(--muted-on-dark)" }} className="mt-4 text-base max-w-xl">
            Official world records in transplant swimming, by age group, gender, event and course.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-8 flex flex-wrap gap-4">
          <FilterSelect label="Age Group" value={filterAgeGroup} options={[ALL, ...AGE_GROUPS]} onChange={setFilterAgeGroup} />
          <FilterSelect label="Gender" value={filterGender} options={[ALL, ...GENDERS]} onChange={setFilterGender} />
          <FilterSelect label="Event" value={filterEvent} options={[ALL, ...EVENTS]} onChange={setFilterEvent} />
          <FilterSelect label="Course" value={filterCourse} options={[ALL, ...COURSES]} onChange={setFilterCourse} />
        </div>

        <div className="font-mono text-xs text-neutral-400 mb-6">
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No records found" subtitle="Adjust your filters to see records." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(r => <RecordCard key={r.id} record={r} />)}
          </div>
        )}
      </div>
    </div>
  );
}
