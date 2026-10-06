import type { Ranking } from '../types';
import { loadPublicSwimmerDirectory, loadPublicSubmittedResults } from './swimmerSubmissions';
import { timeToSeconds } from './utils';

export async function loadDatabaseRankings(): Promise<Ranking[]> {
  const [profiles, submittedResults] = await Promise.all([
    loadPublicSwimmerDirectory(),
    loadPublicSubmittedResults(),
  ]);
  const profileById = new Map(profiles.map(profile => [profile.id, profile]));

  const personalBests = new Map<string, Omit<Ranking, 'rank'>>();
  submittedResults.forEach(result => {
    if (!result.swimmer_id || !result.submitted_meets?.course) return;
    const profile = profileById.get(result.swimmer_id);
    if (!profile) return;

    const athleteName = [profile.first_name, profile.last_name]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(' ') || 'Unknown swimmer';
    const swim: Omit<Ranking, 'rank'> = {
      athleteId: profile.id,
      athleteName,
      country: profile.country ?? '',
      countryCode: profile.country_code ?? '',
      ageGroup: result.age_group as Ranking['ageGroup'],
      gender: profile.gender,
      event: result.event as Ranking['event'],
      course: result.submitted_meets.course as Ranking['course'],
      time: result.time,
      transplantType: profile.transplant_type,
      date: result.submitted_meets.meet_date ?? result.created_at,
      points: result.points,
    };
    const key = [swim.athleteId, swim.event, swim.gender, swim.course, swim.ageGroup].join('|');
    const current = personalBests.get(key);
    if (!current || timeToSeconds(swim.time) < timeToSeconds(current.time)) personalBests.set(key, swim);
  });

  return [...personalBests.values()]
    .sort((a, b) => {
      return timeToSeconds(a.time) - timeToSeconds(b.time)
        || String(a.athleteName ?? '').localeCompare(String(b.athleteName ?? ''));
    })
    .map((swim, index) => ({ ...swim, rank: index + 1 }));
}
