import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Logo from './Logo';

type SocialLinks = Partial<Record<'facebook' | 'instagram' | 'x', string>>;
const SOCIAL_LABELS = [
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'x', label: 'X (Twitter)' },
] as const;

export default function Footer() {
  const [socials, setSocials] = useState<SocialLinks>({});

  useEffect(() => {
    let active = true;
    const loadSocialLinks = async () => {
      if (!supabase) return;
      const { data, error } = await supabase.rpc('get_public_social_links');
      if (active && !error && data && typeof data === 'object') setSocials(data as SocialLinks);
    };
    void loadSocialLinks();
    return () => { active = false; };
  }, []);

  const activeSocials = SOCIAL_LABELS.filter(({ key }) => Boolean(socials[key]));

  return (
    <footer style={{ backgroundColor: 'var(--navy)', borderTop: '1px solid var(--navy-light)' }}>
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className={`grid grid-cols-1 gap-10 sm:grid-cols-2 ${activeSocials.length ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
          {/* Brand */}
          <div className="md:col-span-1">
            <Logo size="md" light />
            <p className="mt-4 text-sm leading-relaxed max-w-xs" style={{ color: 'var(--muted-on-dark)' }}>
              A global home for transplant aquatics.
            </p>
            <p className="mt-4 text-sm font-semibold" style={{ color: 'var(--accent)', fontFamily: "'Manrope', sans-serif" }}>
              Different journeys. Same water.
            </p>
          </div>

          {/* Explore */}
          <div>
            <div className="mb-4 text-sm font-semibold text-white">Explore</div>
            <ul className="space-y-2">
              {[
                { to: '/rankings',  label: 'Rankings' },
                { to: '/athletes',  label: 'Athletes' },
                { to: '/results',   label: 'Results' },
                { to: '/records',   label: 'Records' },
                /*{ to: '/calendar',  label: 'Calendar' },
                { to: '/games',     label: 'WTG Hub' },*/
              ].map(l => (
                <li key={l.to}>
                  <Link to={l.to} className="-ml-1.5 inline-flex rounded-sm px-1.5 py-1 text-sm text-white transition-colors hover:text-[#00c2d7]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Discover */}
          <div>
            <div className="mb-4 text-sm font-semibold text-white">Discover</div>
            <ul className="space-y-2">
              {[
                { to: '/countries',          label: 'Countries' },
                { to: '/rankings/transplant-type', label: 'Rank by transplant type' },
                { to: '/clubs',              label: 'Clubs' },
                { to: '/calendar',           label: 'Meet calendar' },
                /*{ to: '/compare',            label: 'Compare Athletes' },*/
                { to: '/from-the-pool-deck', label: 'News' },
                /*{ to: '/search',             label: 'Search' },*/
              ].map(l => (
                <li key={l.to}>
                  <Link to={l.to} className="-ml-1.5 inline-flex rounded-sm px-1.5 py-1 text-sm text-white transition-colors hover:text-[#00c2d7]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Transplant Aquatics */}
          <div>
            <div className="mb-4 text-sm font-semibold text-white">Take part</div>
            <ul className="space-y-2">
              {[
                { to: '/join',    label: 'Join' },
                { to: '/login',   label: 'Sign in' },
                { to: '/claim',   label: 'Claim your account' },
                { to: '/submit',  label: 'Submit a result' },
              ].map((l, i) => (
                <li key={i}>
                  <Link to={l.to} className="-ml-1.5 inline-flex rounded-sm px-1.5 py-1 text-sm text-white transition-colors hover:text-[#00c2d7]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {activeSocials.length > 0 && <div>
            <div className="mb-4 text-sm font-semibold text-white">Follow</div>
            <ul className="space-y-2">
              {activeSocials.map(({ key, label }) => <li key={key}>
                <a href={socials[key]} target="_blank" rel="noopener noreferrer" className="inline-flex text-sm text-white/70 underline decoration-transparent underline-offset-4 transition-colors hover:text-white hover:decoration-white/50">{label}</a>
              </li>)}
            </ul>
          </div>}
        </div>

        {/* Bottom bar */}
        <div
          className="mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3"
          style={{ borderTop: '1px solid var(--navy-light)' }}
        >
          <p className="font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
            Copyright © 2026 Transplant Aquatics All rights reserved.
          </p>
          <p className="font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
            Different journeys. Same water.
          </p>
        </div>
      </div>
    </footer>
  );
}
