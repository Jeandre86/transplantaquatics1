import { Link } from 'react-router-dom';
import Logo from './Logo';

export default function Footer() {
  return (
    <footer style={{ backgroundColor: 'var(--navy)', borderTop: '1px solid var(--navy-light)' }}>
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <Logo size="md" light />
            <p className="mt-4 text-sm leading-relaxed max-w-xs" style={{ color: 'var(--muted-on-dark)' }}>
              The world of transplant swimming, one split at a time.
            </p>
            <p className="mt-4 font-bold uppercase tracking-wider text-xs" style={{ color: 'var(--accent)', fontFamily: "'League Spartan', sans-serif" }}>
              Every Second Counts.
            </p>
          </div>

          {/* Explore */}
          <div>
            <div className="font-mono text-xs tracking-widest uppercase mb-4" style={{ color: 'var(--muted-on-dark)' }}>Explore</div>
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
                  <Link to={l.to} className="text-sm transition-colors" style={{ color: 'var(--muted-on-dark)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Discover */}
          <div>
            <div className="font-mono text-xs tracking-widest uppercase mb-4" style={{ color: 'var(--muted-on-dark)' }}>Discover</div>
            <ul className="space-y-2">
              {[
                { to: '/countries',          label: 'Countries' },
                { to: '/clubs',              label: 'Clubs' },
                { to: '/compare',            label: 'Compare Athletes' },
                { to: '/from-the-pool-deck', label: 'From the Pool Deck' },
                { to: '/search',             label: 'Search' },
              ].map(l => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm transition-colors" style={{ color: 'var(--muted-on-dark)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Split Second */}
          <div>
            <div className="font-mono text-xs tracking-widest uppercase mb-4" style={{ color: 'var(--muted-on-dark)' }}>Split Second</div>
            <ul className="space-y-2">
              {[
                { to: '/join',    label: 'Join Split Second' },
                { to: '/login',   label: 'Sign In' },
                { to: '/submit',  label: 'Submit a Result' },
              ].map((l, i) => (
                <li key={i}>
                  <Link to={l.to} className="text-sm transition-colors" style={{ color: 'var(--muted-on-dark)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                  >
                    {l.label}
                  </Link>
                </li>
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
            Copyright © 2026 Split Second Inc. All rights reserved.
          </p>
          <p className="font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
            Demo platform — data is illustrative only.
          </p>
        </div>
      </div>
    </footer>
  );
}
