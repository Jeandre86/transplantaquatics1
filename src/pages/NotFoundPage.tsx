import { Link } from 'react-router-dom';

const speedLines = {
  backgroundImage:
    'repeating-linear-gradient(-55deg, transparent, transparent 18px, rgba(255,255,255,0.015) 18px, rgba(255,255,255,0.015) 19px)',
};

export default function NotFoundPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: 'var(--navy)', ...speedLines }}
    >
      <div className="max-w-lg w-full">
        {/* 404 */}
        <div
          className="display text-[clamp(6rem,20vw,12rem)] leading-none font-black uppercase tracking-tight"
          style={{ color: 'var(--accent)' }}
        >
          404
        </div>

        {/* Heading */}
        <h1
          className="mt-4 text-2xl md:text-3xl font-bold leading-tight"
          style={{ color: 'var(--ink-on-dark)' }}
        >
          This page doesn't exist.
        </h1>

        {/* Tagline */}
        <p
          className="mt-3 font-mono text-sm tracking-wider"
          style={{ color: 'var(--muted-on-dark)' }}
        >
          Every split matters. This one doesn't.
        </p>

        {/* Divider */}
        <div
          className="mx-auto mt-8 mb-8 h-px w-24"
          style={{ backgroundColor: 'var(--navy-light)' }}
        />

        {/* Navigation links */}
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="px-5 py-2.5 font-mono text-xs uppercase tracking-widest border transition-colors"
            style={{
              borderColor: 'var(--accent)',
              color: 'var(--accent)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'var(--accent)';
              (e.currentTarget as HTMLAnchorElement).style.color = 'var(--navy)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent)';
            }}
          >
            Home
          </Link>
          <Link
            to="/rankings"
            className="px-5 py-2.5 font-mono text-xs uppercase tracking-widest border transition-colors"
            style={{ borderColor: 'var(--navy-light)', color: 'var(--muted-on-dark)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--muted-on-dark)';
              (e.currentTarget as HTMLAnchorElement).style.color = 'var(--ink-on-dark)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--navy-light)';
              (e.currentTarget as HTMLAnchorElement).style.color = 'var(--muted-on-dark)';
            }}
          >
            Rankings
          </Link>
          <Link
            to="/athletes"
            className="px-5 py-2.5 font-mono text-xs uppercase tracking-widest border transition-colors"
            style={{ borderColor: 'var(--navy-light)', color: 'var(--muted-on-dark)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--muted-on-dark)';
              (e.currentTarget as HTMLAnchorElement).style.color = 'var(--ink-on-dark)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--navy-light)';
              (e.currentTarget as HTMLAnchorElement).style.color = 'var(--muted-on-dark)';
            }}
          >
            Athletes
          </Link>
        </div>
      </div>
    </div>
  );
}
