import type { Ranking } from '../types';
import { loadPublicSwimmerDirectory, loadPublicSubmittedResults } from './swimmerSubmissions';
import { timeToSeconds } from './utils';
import { normalizeCompetitionAgeGroup } from './competitionAge';

function normalizeGender(value: string | null | undefined): Ranking['gender'] | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'men' || normalized === 'male' || normalized === 'boys') return 'Men';
  if (normalized === 'women' || normalized === 'woman' || normalized === 'female' || normalized === 'girls') return 'Women';
  return null;
}

function normalizeTransplantType(value: string | null | undefined): Ranking['transplantType'] | null {
  const normalized = value?.trim().toLowerCase().replace(/\s+transplant$/, '');
  if (!normalized) return null;
  if (normalized === 'kidney') return 'Kidney';
  if (normalized === 'liver') return 'Liver';
  if (normalized === 'heart') return 'Heart';
  if (normalized === 'lung') return 'Lung';
  if (normalized === 'pancreas') return 'Pancreas';
  if (normalized === 'bone marrow' || normalized === 'marrow') return 'Bone Marrow';
  if (normalized === 'donor' || normalized === 'living donor') return 'Donor';
  return null;
}

function normalizeCourse(value: string | null | undefined): Ranking['course'] | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'lcm' || normalized === 'long course') return 'LCM';
  if (normalized === 'scm' || normalized === 'short course') return 'SCM';
  return null;
}

export async function loadDatabaseRankings(): Promise<Ranking[]> {
  const [profiles, submittedResults] = await Promise.all([
    loadPublicSwimmerDirectory(),
    loadPublicSubmittedResults(),
  ]);
  const profileById = new Map(profiles.map(profile => [profile.id, profile]));

  const personalBests = new Map<string, Omit<Ranking, 'rank'>>();
  submittedResults.forEach(result => {
    if (!result.swimmer_id) return;
    const profile = profileById.get(result.swimmer_id);
    if (!profile) return;
    const gender = normalizeGender(profile.gender);
    const transplantType = normalizeTransplantType(profile.transplant_type);
    const course = normalizeCourse(result.course ?? result.submitted_meets?.course);
    if (!gender || !transplantType || !course) return;
    const ageGroup = normalizeCompetitionAgeGroup(result.age_group)
      ?? normalizeCompetitionAgeGroup(profile.age_group);
    if (!ageGroup) return;

    const athleteName = [profile.first_name, profile.last_name]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(' ') || 'Unknown swimmer';
    const swim: Omit<Ranking, 'rank'> = {
      athleteId: profile.id,
      athleteName,
      country: profile.country ?? '',
      countryCode: profile.country_code ?? '',
      ageGroup,
      gender,
      event: result.event as Ranking['event'],
      course,
      time: result.time,
      transplantType,
      date: result.submitted_meets?.meet_date ?? result.created_at,
      meetName: result.submitted_meets?.name,
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
