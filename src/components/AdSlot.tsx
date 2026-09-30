import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type AdPlacement = 'article_inline' | 'article_sidebar' | 'news_feed';
type Ad = { id: string; advertiser_name: string; campaign_name: string; image_url: string; destination_url: string; placement: AdPlacement };

export default function AdSlot({ placement, compact = false }: { placement: AdPlacement; compact?: boolean }) {
  const [ad, setAd] = useState<Ad | null>(null);

  useEffect(() => {
    let active = true;
    if (!supabase) return;
    void supabase.rpc('get_rotating_ad', { p_placement: placement }).then(({ data }) => {
      if (!active) return;
      const row = Array.isArray(data) ? data[0] : null;
      if (row) setAd(row as Ad);
    });
    return () => { active = false; };
  }, [placement]);

  if (ad) return <aside aria-label={`Advertisement from ${ad.advertiser_name}`} className="overflow-hidden border border-neutral-200 bg-white">
    <a href={ad.destination_url} target="_blank" rel="sponsored noopener noreferrer" onClick={() => { void supabase?.rpc('record_ad_click', { p_campaign_id: ad.id }); }} className="group block">
      <img src={ad.image_url} alt={`${ad.advertiser_name}: ${ad.campaign_name}`} className={`w-full object-cover ${compact ? 'max-h-52' : 'max-h-80'}`} loading="lazy" />
      <span className="flex items-center justify-between gap-3 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.15em] text-neutral-500 transition-colors group-hover:text-[#007d89]"><span>Advertisement · {ad.advertiser_name}</span><span>Visit</span></span>
    </a>
  </aside>;

  return <aside aria-label="Advertisement space" className={`flex flex-col items-center justify-center border border-dashed border-neutral-300 bg-white/60 text-center ${compact ? 'min-h-40 p-5' : 'min-h-64 p-8'}`}>
    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">Advertisement</span>
    <p className="mt-3 max-w-xs text-sm font-semibold text-neutral-600">Connect your brand with the transplant swimming community.</p>
    <span className="mt-2 font-mono text-[10px] uppercase tracking-wider text-neutral-400">Ad placement</span>
  </aside>;
}
