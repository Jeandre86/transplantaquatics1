import type { Event, Course, Gender, AgeGroup } from '../types';

/** Qualifying comparisons stay hidden until official standards are supplied. */
export default function TimeStandard(_props: { time: string; event: Event; course: Course; gender: Gender; ageGroup?: AgeGroup }) {
  return null;
}

export function getWTGStandardStr(_event: Event, _course: Course, _gender: Gender): undefined {
  return undefined;
}
