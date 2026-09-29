import { useEffect, useState } from 'react';
import { loadFastestByTransplantType, type FastestTransplantSwim } from '../lib/fastestByTransplantType';
import { describeSupabaseError } from '../lib/supabase';

export function useFastestByTransplantType() {
  const [swims, setSwims] = useState<FastestTransplantSwim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadFastestByTransplantType()
      .then(rows => { if (active) setSwims(rows); })
      .catch(reason => { if (active) setError(describeSupabaseError(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { swims, loading, error };
}
