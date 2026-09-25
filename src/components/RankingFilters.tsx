import { EVENTS } from '../types';
import FilterSelect from './FilterSelect';

interface RankingFiltersProps {
  ageGroup: string;
  gender: string;
  event: string;
  course: string;
  onChange: (filters: { ageGroup: string; gender: string; event: string; course: string }) => void;
  dark?: boolean;
}

const AGE_GROUPS = ['18-29', '30-39', '40-49', '50-59', '60-69', '70-79'];

export default function RankingFilters({ ageGroup, gender, event, course, onChange, dark = false }: RankingFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <FilterSelect
        label="Age Group"
        value={ageGroup}
        options={['All', ...AGE_GROUPS]}
        onChange={v => onChange({ ageGroup: v, gender, event, course })}
        dark={dark}
      />
      <FilterSelect
        label="Gender"
        value={gender}
        options={['All', 'Men', 'Women']}
        onChange={v => onChange({ ageGroup, gender: v, event, course })}
        dark={dark}
      />
      <FilterSelect
        label="Event"
        value={event}
        options={['All', ...EVENTS]}
        onChange={v => onChange({ ageGroup, gender, event: v, course })}
        dark={dark}
      />
      <FilterSelect
        label="Course"
        value={course}
        options={['All', 'LCM', 'SCM']}
        onChange={v => onChange({ ageGroup, gender, event, course: v })}
        dark={dark}
      />
    </div>
  );
}
