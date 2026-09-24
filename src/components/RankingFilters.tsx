import type { AgeGroup, Course, Event, Gender } from '../types';
import { EVENTS } from '../types';
import FilterSelect from './FilterSelect';

interface RankingFiltersProps {
  ageGroup: AgeGroup;
  gender: Gender;
  event: Event;
  course: Course;
  onChange: (filters: { ageGroup: AgeGroup; gender: Gender; event: Event; course: Course }) => void;
  light?: boolean;
}

const AGE_GROUPS = ['18-29', '30-39', '40-49', '50-59', '60-69', '70-79'];

export default function RankingFilters({ ageGroup, gender, event, course, onChange, light = false }: RankingFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4">
      <FilterSelect
        label="Age Group"
        value={ageGroup}
        options={AGE_GROUPS}
        onChange={v => onChange({ ageGroup: v as AgeGroup, gender, event, course })}
        light={light}
      />
      <FilterSelect
        label="Gender"
        value={gender}
        options={['Men', 'Women']}
        onChange={v => onChange({ ageGroup, gender: v as Gender, event, course })}
        light={light}
      />
      <FilterSelect
        label="Event"
        value={event}
        options={[...EVENTS]}
        onChange={v => onChange({ ageGroup, gender, event: v as Event, course })}
        light={light}
      />
      <FilterSelect
        label="Course"
        value={course}
        options={['LCM', 'SCM']}
        onChange={v => onChange({ ageGroup, gender, event, course: v as Course })}
        light={light}
      />
    </div>
  );
}
