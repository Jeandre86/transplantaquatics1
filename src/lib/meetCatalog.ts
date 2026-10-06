import { supabase } from './supabase';
import { loadCached } from './requestCache';

export type MeetCatalogCategory = 'World Transplant Games' | 'National Transplant Games';

export interface MeetCatalogEdition {
  id: string;
  category: MeetCatalogCategory;
  category_order: number;
  series_id: string;
  series_name: string;
  name: string;
  year: number;
  host_city: string | null;
  host_country: string | null;
  meet_date: string | null;
  end_date: string | null;
  status: 'completed' | 'in_progress' | 'upcoming' | 'cancelled' | 'date_unconfirmed';
  source_url: string | null;
}

export function loadMeetCatalog(): Promise<MeetCatalogEdition[]> {
  return loadCached('meet-catalog', async () => {
  if (!supabase) throw new Error('Supabase is not configured.');

  const { data, error } = await supabase
    .from('meet_catalog')
    .select('id,category,category_order,series_id,series_name,name,year,host_city,host_country,meet_date,end_date,status,source_url')
    .order('category_order')
    .order('year', { ascending: false })
    .order('name');

  if (error) throw error;
  return (data ?? []) as MeetCatalogEdition[];
  });
}
