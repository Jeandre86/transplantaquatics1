import type { Ranking } from '../types';
import type { Record as WorldRecord } from '../types';
import { records as importedRecords } from '../data/records';
import { pointsFromBaseTime } from './worldAquaticsPoints';
import { timeToSeconds } from './utils';

export type PointBasis = 'TA record' | 'Provisional verified swim';

export interface TransplantPointInput {
  ageGroup: string;
  gender: string;
  event: string;
  course: string;
  time: string;
  transplantType?: string | null;
  status?: string;
}

interface PointBaseline {
  seconds: number;
  basis: PointBasis;
}

type BaselineMap = Map<string, PointBaseline>;

function normalizedAgeGroup(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase().replace(/\s*[-–—]\s*/g, '–').replace(/\s+/g, ' ') ?? '';
  if (normalized.includes('5') && normalized.includes('under')) return '5 and under';
  if (normalized === '80 and over' || normalized === '80 and above') return '80+';
  return normalized.replace(/ years?$/, '');
}

function normalizedGender(value: string | null | undefined): string {
  const gender = value?.trim().toLowerCase();
  if (gender === 'men' || gender === 'male' || gender === 'boys' || gender === 'boy') return 'men';
  if (gender === 'women' || gender === 'female' || gender === 'girls' || gender === 'girl') return 'women';
  return '';
}

function normalizedEvent(value: string | null | undefined): string {
  const event = value?.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!event) return '';
  const match = event.match(/^(\d+)\s*m?\s*(freestyle|free|backstroke|back|breaststroke|breast|butterfly|fly|individual medley|medley|im)$/);
  if (!match) return event;
  const stroke = /^(free|freestyle)$/.test(match[2]) ? 'freestyle'
    : /^(back|backstroke)$/.test(match[2]) ? 'backstroke'
      : /^(breast|breaststroke)$/.test(match[2]) ? 'breaststroke'
        : /^(fly|butterfly)$/.test(match[2]) ? 'butterfly' : 'individual medley';
  return `${match[1]}m ${stroke}`;
}

function isDonor(value: string | null | undefined): boolean {
  const category = value?.trim().toLowerCase();
  return category === 'donor' || category === 'living donor';
}

function baselineKey(input: Pick<TransplantPointInput, 'ageGroup' | 'gender' | 'event' | 'course' | 'transplantType'>): string {
  return [normalizedAgeGroup(input.ageGroup), normalizedGender(input.gender), normalizedEvent(input.event), input.course.trim().toUpperCase(), isDonor(input.transplantType) ? 'donor' : 'athlete'].join('|');
}

function validSeconds(time: string): number | null {
  const seconds = timeToSeconds(time);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

export function buildTransplantPointBaselines(records: WorldRecord[], swims: TransplantPointInput[]): BaselineMap {
  const baselines: BaselineMap = new Map();
  const officialKeys = new Set<string>();

  records.forEach(record => {
    const seconds = validSeconds(record.time);
    if (!seconds || !record.ageGroup || !record.gender || !record.course) return;
    const input = { ageGroup: record.ageGroup, gender: record.gender, event: record.event, course: record.course, transplantType: record.category };
    const gender = normalizedGender(input.gender);
    if (!gender) return;
    const key = baselineKey(input);
    officialKeys.add(key);
    const current = baselines.get(key);
    if (!current || seconds < current.seconds) baselines.set(key, { seconds, basis: 'TA record' });
  });

  swims.forEach(swim => {
    if (swim.status?.toLowerCase() !== 'verified') return;
    const key = baselineKey(swim);
    if (!key.split('|').slice(0, 4).every(Boolean) || officialKeys.has(key)) return;
    const seconds = validSeconds(swim.time);
    if (!seconds) return;
    const current = baselines.get(key);
    if (!current || seconds < current.seconds) baselines.set(key, { seconds, basis: 'Provisional verified swim' });
  });

  return baselines;
}

export function scoreTransplantSwim(input: TransplantPointInput, baselines: BaselineMap): { points: number | null; basis: PointBasis | null; baselineSeconds: number | null } {
  const baseline = baselines.get(baselineKey(input));
  return {
    points: baseline ? pointsFromBaseTime(baseline.seconds, input.time) : null,
    basis: baseline?.basis ?? null,
    baselineSeconds: baseline?.seconds ?? null,
  };
}

/** Use Transplant Aquatics age-group records; verified swims provide provisional baselines when no record exists. */
export function getTransplantPoints(swim: Pick<Ranking, 'ageGroup' | 'gender' | 'event' | 'course' | 'time'> & Partial<Pick<Ranking, 'points'>>): number | null {
  if (swim.points !== null && swim.points !== undefined) return swim.points;
  return scoreTransplantSwim(swim, buildTransplantPointBaselines(importedRecords, [])).points;
}
