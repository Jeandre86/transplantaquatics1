export interface Club {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  memberCount: number;
  foundedYear: number;
  description: string;
  athleteIds: string[];
  city: string;
}

// Club listings are loaded from Supabase; no illustrative clubs remain.
export const clubs: Club[] = [];
