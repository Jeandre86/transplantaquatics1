export type TransplantType = 'Kidney' | 'Liver' | 'Heart' | 'Lung' | 'Pancreas' | 'Bone Marrow';
export type AgeGroup = '18-29' | '30-39' | '40-49' | '50-59' | '60-69' | '70-79';
export type Course = 'LCM' | 'SCM';
export type Gender = 'Men' | 'Women';
export type VerificationStatus = 'Verified' | 'Pending' | 'Unverified';
export type Discipline = 'Freestyle' | 'Backstroke' | 'Breaststroke' | 'Butterfly' | 'Individual Medley';

export const TRANSPLANT_TYPES: TransplantType[] = ['Kidney', 'Liver', 'Heart', 'Lung', 'Pancreas', 'Bone Marrow'];
export const AGE_GROUPS: AgeGroup[] = ['18-29', '30-39', '40-49', '50-59', '60-69', '70-79'];
export const COURSES: Course[] = ['LCM', 'SCM'];
export const GENDERS: Gender[] = ['Men', 'Women'];

export const EVENTS = [
  '50m Freestyle', '100m Freestyle', '200m Freestyle', '400m Freestyle', '800m Freestyle', '1500m Freestyle',
  '50m Backstroke', '100m Backstroke', '200m Backstroke',
  '50m Breaststroke', '100m Breaststroke', '200m Breaststroke',
  '50m Butterfly', '100m Butterfly', '200m Butterfly',
  '200m Individual Medley', '400m Individual Medley',
] as const;
export type Event = typeof EVENTS[number];

export interface SocialProfile {
  instagram?: string;
  facebook?: string;
  x?: string;
  website?: string;
}

export interface PersonalBest {
  event: Event;
  course: Course;
  time: string;
  date: string;
  meet: string;
  verified: VerificationStatus;
}

export interface Result {
  id: string;
  event: Event;
  course: Course;
  time: string;
  date: string;
  meet: string;
  ageGroup: AgeGroup;
  gender: Gender;
  verified: VerificationStatus;
  isPB: boolean;
  isSB: boolean;
  athleteId: string;
}

export interface Medal {
  competition: string;
  year: number;
  color: 'Gold' | 'Silver' | 'Bronze';
  event: Event;
}

export interface Coach {
  name: string;
  club: string;
  country: string;
}

export interface DonorTribute {
  name: string;
  message?: string;
}

export interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
  country: string;
  countryCode: string;
  dateOfBirth: string;
  gender: Gender;
  ageGroup: AgeGroup;
  transplantType: TransplantType;
  transplantYear?: number;
  club?: string;
  coach?: string;
  discipline: Discipline;
  bio?: string;
  personalBests: PersonalBest[];
  medals: Medal[];
  social?: SocialProfile;
  avatarInitials?: string;
  ranking?: number;
  donorTribute?: DonorTribute;
}

export interface Record {
  id: string;
  event: string;
  course: Course;
  ageGroup: string;
  gender: string;
  category?: string;
  time: string;
  athleteId?: string;
  athleteName: string;
  country: string;
  date?: string;
  meet: string;
  games?: string;
  history?: { time: string; athleteName: string; country: string; date: string; meet: string }[];
}

export interface Country {
  code: string;
  name: string;
  flag: string;
  athletes: number;
  results: number;
  records: number;
  topEvent?: string;
  topAthlete?: string;
}

export interface Meet {
  id: string;
  name: string;
  location: string;
  date: string;
  course: Course;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  author: string;
  date: string;
  readTime: number;
  featured?: boolean;
  access?: 'free' | 'member';
  friendLinkToken?: string;
  coverImage?: string;
  tags?: string[];
}

export interface Ranking {
  rank: number;
  athleteId: string;
  athleteName: string;
  country: string;
  countryCode: string;
  ageGroup: AgeGroup;
  gender: Gender;
  event: Event;
  course: Course;
  time: string;
  transplantType: TransplantType;
  date: string;
}
