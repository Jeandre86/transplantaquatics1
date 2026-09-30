import type { Record as WorldRecord } from '../types';
import { supabase } from './supabase';

interface WorldRecordRow {
  id: string;
  athlete_id: string | null;
  country_code: string | null;
  event: string;
  age_group: string | null;
  time: string;
  athlete_name: string;
  country: string;
  games: string;
  gender: string;
  category: string;
  course: string;
}

interface ConfirmedWtgRecordRow {
  id: string;
  baseline_record_id: string | null;
  swimmer_id: string | null;
  country_code: string | null;
  event: string;
  age_group: string;
  gender: string;
  competition_category: string;
  course: string;
  holder_name: string;
  time_ms: number;
  country: string | null;
  meet_name: string | null;
  meet_year: number | null;
  confirmed_at: string;
}

const countryNames: Record<string, string> = {
  'GB&NI': 'Great Britain & Northern Ireland',
  USA: 'United States',
  'GREAT BRITAIN': 'Great Britain',
  GERMANY: 'Germany',
  AUSTRALIA: 'Australia',
  CANADA: 'Canada',
  BRAZIL: 'Brazil',
  HUNGARY: 'Hungary',
  NETHERLANDS: 'Netherlands',
  'SOUTH AFRICA': 'South Africa',
  MEXICO: 'Mexico',
  FINLAND: 'Finland',
  JAPAN: 'Japan',
  FRANCE: 'France',
  ITALY: 'Italy',
  RSA: 'South Africa',
  PORTUGAL: 'Portugal',
  UK: 'United Kingdom',
  GREECE: 'Greece',
  ISRAEL: 'Israel',
  IRELAND: 'Ireland',
  SPAIN: 'Spain',
  'NORTHERN IRELAND': 'Northern Ireland',
};

const genderNames: Record<string, string> = {
  men: 'Men',
  women: 'Women',
  boys: 'Boys',
  girls: 'Girls',
  mixed: 'Mixed',
};

function formatCategory(category: string) {
  return category.split('_').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
}

export async function loadWorldRecords(): Promise<WorldRecord[]> {
  if (!supabase) throw new Error('Supabase is not configured. Add the project URL and publishable key to .env.local.');

  const { data, error } = await supabase
    .from('world_records')
    .select('id,athlete_id,country_code,event,age_group,time,athlete_name,country,games,gender,category,course')
    .order('event')
    .order('age_group');

  if (error) throw error;

  const records: WorldRecord[] = ((data ?? []) as WorldRecordRow[]).map(row => ({
    id: row.id,
    athleteId: row.athlete_id ?? undefined,
    countryCode: row.country_code ?? undefined,
    event: row.event,
    course: row.course as WorldRecord['course'],
    ageGroup: row.age_group ?? 'Open relay',
    gender: genderNames[row.gender] ?? row.gender,
    category: formatCategory(row.category),
    time: row.time,
    athleteName: row.athlete_name,
    country: countryNames[row.country] ?? row.country,
    meet: row.games,
    games: row.games,
  }));

  const {data:confirmedData,error:confirmedError}=await supabase.from('wtg_record_history')
    .select('id,baseline_record_id,swimmer_id,country_code,event,age_group,gender,competition_category,course,holder_name,time_ms,country,meet_name,meet_year,confirmed_at')
    .is('superseded_at',null).order('confirmed_at',{ascending:false});
  if(confirmedError)throw confirmedError;
  const confirmed=(confirmedData??[]) as ConfirmedWtgRecordRow[];
  const byBaseline=new Map<string,ConfirmedWtgRecordRow[]>();
  for(const row of confirmed){if(!row.baseline_record_id)continue;const group=byBaseline.get(row.baseline_record_id)??[];group.push(row);byBaseline.set(row.baseline_record_id,group);}
  for(const [baselineId,holders] of byBaseline){
    const baseline=records.find(record=>record.id===baselineId);if(!baseline)continue;
    const latest=holders[0];
    const candidateTime=formatTime(latest.time_ms);
    const equalHolders=holders.filter(holder=>holder.time_ms===latest.time_ms);
    const stillJoint=baseline.time===candidateTime;
    const names=[...new Set([...(stillJoint?[baseline.athleteName]:[]),...equalHolders.map(holder=>holder.holder_name)])];
    const history=stillJoint?[{time:baseline.time,athleteName:baseline.athleteName,country:baseline.country,date:baseline.date??'',meet:baseline.meet}]:[];
    for(const holder of equalHolders)history.push({time:candidateTime,athleteName:holder.holder_name,country:holder.country??'',date:holder.confirmed_at,meet:holder.meet_name??holder.meet_year?.toString()??''});
    const index=records.findIndex(record=>record.id===baselineId);
    records[index]={...baseline,id:baselineId,athleteId:latest.swimmer_id??undefined,countryCode:latest.country_code??undefined,event:latest.event,ageGroup:latest.age_group,gender:genderNames[latest.gender.toLowerCase()]??latest.gender,category:formatCategory(latest.competition_category),course:latest.course as WorldRecord['course'],time:candidateTime,athleteName:[...new Set(names)].join(' / '),country:countryNames[latest.country??'']??latest.country??baseline.country,date:latest.confirmed_at,meet:latest.meet_name??baseline.meet,games:latest.meet_name??baseline.games,history};
  }
  return records;
}

function formatTime(milliseconds:number){
  const totalSeconds=Math.floor(milliseconds/1000);const minutes=Math.floor(totalSeconds/60);const seconds=totalSeconds%60;const hundredths=Math.round((milliseconds%1000)/10);
  return minutes?`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(hundredths).padStart(2,'0')}`:`${seconds}.${String(hundredths).padStart(2,'0')}`;
}
