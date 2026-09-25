import { Link } from 'react-router-dom';
import Logo from './Logo';

export default function Footer() {
  return (
    <footer style={{ backgroundColor: 'var(--navy)', borderTop: '1px solid var(--navy-light)' }}>
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div className="md:col-span-1">
            <Logo size="md" light />
            <p className="mt-4 text-sm leading-relaxed max-w-xs" style={{ color: 'var(--muted-on-dark)' }}>
              A global home for transplant aquatics.
            </p>
            <p className="mt-4 font-bold uppercase tracking-wider text-xs" style={{ color: 'var(--accent)', fontFamily: "'Manrope', sans-serif" }}>
              Different journeys. Same water.
            </p>
          </div>

          {/* Explore */}
          <div>
            <div className="mb-4 font-mono text-sm font-semibold uppercase tracking-widest text-white">Explore</div>
            <ul className="space-y-2">
              {[
                { to: '/rankings',  label: 'Rankings' },
                { to: '/athletes',  label: 'Athletes' },
                { to: '/results',   label: 'Results' },
                { to: '/records',   label: 'Records' },
                { to: '/calendar',  label: 'Calendar' },
                { to: '/games',     label: 'WTG Hub' },
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
            <div className="mb-4 font-mono text-sm font-semibold uppercase tracking-widest text-white">Discover</div>
            <ul className="space-y-2">
              {[
                { to: '/countries',          label: 'Countries' },
                { to: '/clubs',              label: 'Clubs' },
                { to: '/compare',            label: 'Compare Athletes' },
                { to: '/from-the-pool-deck', label: 'From the Pool Deck' },
                { to: '/search',             label: 'Search' },
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
            <div className="mb-4 font-mono text-sm font-semibold uppercase tracking-widest text-white">Transplant Aquatics</div>
            <ul className="space-y-2">
              {[
                { to: '/join',    label: 'Join Transplant Aquatics' },
                { to: '/login',   label: 'Sign In' },
                { to: '/submit',  label: 'Submit a Result' },
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

          {/* Socials */}
          <div>
            <div className="mb-4 font-mono text-sm font-semibold uppercase tracking-widest text-white">Socials</div>
            <ul className="space-y-2">
              {['Facebook', 'Instagram', 'X'].map(name => (
                <li key={name} className="text-sm" style={{ color: 'var(--muted-on-dark)' }}>{name}</li>
              ))}
            </ul>
          </div>
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
            Demo platform — data is illustrative only.
          </p>
        </div>
      </div>
    </footer>
  );
}
