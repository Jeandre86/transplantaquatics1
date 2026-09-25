import worldRecordsJson from '../../wtg_records.json';
import type { Record as WorldRecord } from '../types';

const countryNames: { [country: string]: string } = {
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
const genderNames: { [sex: string]: string } = {
  men: 'Men',
  women: 'Women',
  boys: 'Boys',
  girls: 'Girls',
  mixed: 'Mixed',
};

function formatCategory(category: string) {
  return category.split('_').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
}

export const recordSource = worldRecordsJson.source;

export const records: WorldRecord[] = worldRecordsJson.records.map((sourceRecord, index) => ({
  id: `wtg-record-${index + 1}`,
  event: sourceRecord.event,
  course: 'LCM',
  ageGroup: sourceRecord.age_group ?? 'Open relay',
  gender: genderNames[sourceRecord.sex] ?? sourceRecord.sex,
  category: formatCategory(sourceRecord.category),
  time: sourceRecord.time,
  athleteName: Array.isArray(sourceRecord.name) ? sourceRecord.name.join(', ') : sourceRecord.name,
  country: countryNames[sourceRecord.country] ?? sourceRecord.country,
  meet: sourceRecord.site,
  games: sourceRecord.site,
}));

function siteYear(record: WorldRecord) {
  return Number(record.meet.match(/\d{4}$/)?.[0] ?? 0);
}

export const latestRecords = [...records].sort((a, b) => siteYear(b) - siteYear(a));
