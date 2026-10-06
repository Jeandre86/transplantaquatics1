import { AGE_GROUPS, type AgeGroup, type Gender } from '../types';
import { records } from '../data/records';
import { timeToSeconds } from './utils';
import { getWorldAquaticsPoints, pointsFromBaseTime } from './worldAquaticsPoints';

export const COMPETITION_AGE_GROUPS: readonly AgeGroup[] = AGE_GROUPS;

function ageOnDate(dateOfBirth: string, onDate: string): number | null {
  if (!dateOfBirth || !onDate) return null;
  const [birthYear, birthMonth, birthDay] = dateOfBirth.split('-').map(Number);
  const [year, month, day] = onDate.split('-').map(Number);
  if (![birthYear, birthMonth, birthDay, year, month, day].every(Number.isFinite)) return null;
  let age = year - birthYear;
  if (month < birthMonth || (month === birthMonth && day < birthDay)) age -= 1;
  return age >= 0 ? age : null;
}

export function getCompetitionAgeGroup(dateOfBirth: string, onDate: string): string | null {
  const age = ageOnDate(dateOfBirth, onDate);
  if (age === null) return null;
  if (age <= 5) return '5 and under';
  if (age <= 8) return '6–8';
  if (age <= 11) return '9–11';
  if (age <= 14) return '12–14';
  if (age <= 17) return '15–17';
  if (age <= 29) return '18–29';
  if (age <= 39) return '30–39';
  if (age <= 49) return '40–49';
  if (age <= 59) return '50–59';
  if (age <= 69) return '60–69';
  if (age <= 79) return '70–79';
  return '80+';
}

/** Convert legacy stored age labels to the canonical competition age groups. */
export function normalizeCompetitionAgeGroup(raw: string | null | undefined): AgeGroup | null {
  const value = raw?.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*[-–]\s*/g, '–');
  if (!value) return null;
  const aliases: Record<string, AgeGroup> = {
    '5 years and under': '5 and under', '5 and under': '5 and under', '5 years & under': '5 and under',
    '6–8 years': '6–8', '9–11 years': '9–11', '12–14 years': '12–14', '15–17 years': '15–17',
    '18–29 years': '18–29', '30–39 years': '30–39', '40–49 years': '40–49',
    '50–59 years': '50–59', '60–69 years': '60–69', '70–79 years': '70–79',
    '80 and over': '80+', '80+': '80+',
  };
  if (aliases[value]) return aliases[value];
  const canonical = AGE_GROUPS.find(group => group.toLowerCase() === value);
  if (canonical) return canonical;
  const singleAge = value.match(/^\d{1,3}$/);
  if (singleAge) return getCompetitionAgeGroupFromNumber(Number(value));
  const ageRange = value.match(/^(\d{1,3})–(\d{1,3})$/);
  if (ageRange) return getCompetitionAgeGroupFromNumber(Math.round((Number(ageRange[1]) + Number(ageRange[2])) / 2));
  return null;
}

function getCompetitionAgeGroupFromNumber(age: number): AgeGroup | null {
  if (!Number.isFinite(age) || age < 0) return null;
  if (age <= 5) return '5 and under';
  if (age <= 8) return '6–8';
  if (age <= 11) return '9–11';
  if (age <= 14) return '12–14';
  if (age <= 17) return '15–17';
  if (age <= 29) return '18–29';
  if (age <= 39) return '30–39';
  if (age <= 49) return '40–49';
  if (age <= 59) return '50–59';
  if (age <= 69) return '60–69';
  if (age <= 79) return '70–79';
  return '80+';
}

function normalizeRecordAgeGroup(ageGroup: string): string | null {
  return normalizeCompetitionAgeGroup(ageGroup);
}

function genderMatches(recordGender: string, gender: Gender, ageGroup: string): boolean {
  const value = recordGender.trim().toLowerCase();
  if (ageGroup === '5 and under' || ageGroup === '6–8' || ageGroup === '9–11' || ageGroup === '12–14' || ageGroup === '15–17') {
    return gender === 'Men' ? value === 'boys' || value === 'men' : value === 'girls' || value === 'women';
  }
  return gender === 'Men' ? value === 'men' : value === 'women';
}

export function getWorldRecordBaseline(ageGroup: string, gender: Gender, event: string, course: string): number | null {
  const baseTimes = records
    .filter(record => normalizeRecordAgeGroup(record.ageGroup) === ageGroup)
    .filter(record => genderMatches(record.gender, gender, ageGroup))
    .filter(record => record.event.toLowerCase() === event.toLowerCase())
    .filter(record => record.course === course || event.toLowerCase().startsWith('25m '))
    .map(record => timeToSeconds(record.time))
    .filter(time => Number.isFinite(time) && time > 0);
  return baseTimes.length ? Math.min(...baseTimes) : null;
}

export function getSubmissionPoints(input: { ageGroup: string; gender: Gender; event: string; course: string; time: string }): number | null {
  const points = getWorldAquaticsPoints(input);
  if (points !== null) return points;
  return pointsFromBaseTime(getWorldRecordBaseline(input.ageGroup, input.gender, input.event, input.course), input.time);
}

export function getAgeAtDate(dateOfBirth: string, onDate: string): number | null {
  return ageOnDate(dateOfBirth, onDate);
}
