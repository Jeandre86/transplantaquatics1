import type { Ranking } from '../types';
import { getWorldRecordBaseline } from './competitionAge';
import { getWorldAquaticsPoints, pointsFromBaseTime } from './worldAquaticsPoints';

/** Use World Aquatics standards, falling back to a WTG age-group record for non-standard junior events such as 25m. */
export function getTransplantPoints(swim: Pick<Ranking, 'ageGroup' | 'gender' | 'event' | 'course' | 'time'> & Partial<Pick<Ranking, 'points'>>): number | null {
  if (swim.points !== null && swim.points !== undefined) return swim.points;
  const points = getWorldAquaticsPoints(swim);
  if (points !== null) return points;
  const wtgBaseline = getWorldRecordBaseline(swim.ageGroup, swim.gender, swim.event, swim.course);
  return pointsFromBaseTime(wtgBaseline, swim.time);
}
