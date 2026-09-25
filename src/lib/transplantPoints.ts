import type { Ranking } from '../types';
import { records } from '../data/records';
import { timeToSeconds } from './utils';

const recordTimeByCategory = new Map<string, number>();

for (const record of records) {
  const key = [record.ageGroup, record.gender, record.event, record.course].join('|');
  const time = timeToSeconds(record.time);
  const currentBest = recordTimeByCategory.get(key);
  if (Number.isFinite(time) && (!currentBest || time < currentBest)) {
    recordTimeByCategory.set(key, time);
  }
}

/** Score against the WTG record for the same age group, gender, event, and course. */
export function getTransplantPoints(swim: Pick<Ranking, 'ageGroup' | 'gender' | 'event' | 'course' | 'time'>): number | null {
  const key = [swim.ageGroup, swim.gender, swim.event, swim.course].join('|');
  const baseTime = recordTimeByCategory.get(key);
  const swimTime = timeToSeconds(swim.time);

  if (!baseTime || !Number.isFinite(swimTime) || swimTime <= 0) return null;
  return Math.trunc(1000 * (baseTime / swimTime) ** 3);
}
