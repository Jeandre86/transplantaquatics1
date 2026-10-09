import { useEffect, useId, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export type AdPlacement = 'article_inline' | 'article_sidebar' | 'news_feed';
type Ad = { id: string; advertiser_name: string; campaign_name: string; image_url: string; destination_url: string; placement: AdPlacement };

export default function AdSlot({ placement, compact = false }: { placement: AdPlacement; compact?: boolean }) {
  const [ad, setAd] = useState<Ad | null>(null);
  const gradientId = useId();

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

  return <aside aria-label="Transplant Aquatics promotion" className="overflow-hidden border border-[#00c2d7]/30">
    <Link to="/" aria-label="Discover Transplant Aquatics" className={`group relative flex overflow-hidden bg-[#062034] text-white ${placement === 'article_sidebar' ? 'min-h-[240px] flex-col justify-end p-5' : compact ? 'min-h-[118px] items-center px-5 py-4 sm:px-8' : 'min-h-[148px] items-center px-5 py-5 sm:px-9'}`}>
      <svg aria-hidden="true" viewBox="0 0 1200 220" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-90">
        <defs><linearGradient id={gradientId} x1="0" x2="1"><stop stopColor="#078c94" /><stop offset=".53" stopColor="#0b526f" /><stop offset="1" stopColor="#092542" /></linearGradient></defs>
        <rect width="1200" height="220" fill={`url(#${gradientId})`} />
        <path d="M0 135 C150 60 255 205 405 124 S650 55 785 125 1025 198 1200 100 V220 H0Z" fill="#00aeb2" opacity=".75" />
        <path d="M0 176 C155 102 250 220 420 154 S665 97 815 164 1050 214 1200 145 V220 H0Z" fill="#0b2749" opacity=".92" />
        <path d="M0 0 H1200 V28 C1040 72 970 4 812 38 S560 82 405 35 130 64 0 22Z" fill="#79dce0" opacity=".24" />
        <path d="M880 44h260M1010 57h180" stroke="#ff654f" strokeWidth="8" opacity=".9" />
        <circle cx="1020" cy="100" r="4" fill="#ff654f" /><circle cx="1052" cy="113" r="3" fill="#ff654f" />
      </svg>
      <div className={`relative z-10 flex w-full ${placement === 'article_sidebar' ? 'flex-col items-start gap-5' : 'items-center gap-4 sm:gap-6'}`}>
        <div className="flex shrink-0 items-center gap-2.5">
          <span aria-hidden="true" className="grid h-9 w-9 grid-cols-2 gap-1"><i className="skew-x-[-18deg] bg-[#00c2d7]" /><i className="skew-x-[-18deg] bg-white" /><i className="skew-x-[-18deg] bg-white" /><i className="skew-x-[-18deg] bg-[#00c2d7]" /></span>
          <span className="max-w-[92px] font-mono text-[9px] font-bold uppercase leading-tight tracking-[0.12em] text-white sm:max-w-none sm:text-[10px]">Transplant<br className="sm:hidden" /> Aquatics</span>
        </div>
        <div className="min-w-0 flex-1 border-l border-white/30 pl-4 sm:pl-6">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-[#8ce9e8]">A community in every lane</p>
          <h2 className="mt-1 text-lg font-black uppercase leading-[1.05] tracking-tight text-white sm:text-2xl">Stronger together.<br className="hidden sm:block" /> Every swim matters.</h2>
          <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-white/85 transition-colors group-hover:text-[#8ce9e8]">Discover Transplant Aquatics <ArrowUpRight size={13} /></span>
        </div>
      </div>
      <span className="absolute right-2 top-2 rounded bg-black/55 px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-white/80">Our community</span>
    </Link>
  </aside>;
}
