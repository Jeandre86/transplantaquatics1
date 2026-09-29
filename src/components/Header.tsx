import { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Menu, X, User, ChevronDown, ArrowUpRight } from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../contexts/AuthContext';

const NAV_LINKS = [
  { to: '/rankings', label: 'Rankings' },
  { to: '/athletes', label: 'Athletes' },
  { to: '/results', label: 'Results' },
  { to: '/records', label: 'Records' },
  { to: '/countries', label: 'Countries' },
  { to: '/from-the-pool-deck', label: 'News' },
];

const ABOUT_LINKS = [
  { to: '/about/our-story', label: 'Our Story', detail: 'The people and purpose behind Transplant Aquatics.' },
  { to: '/about/what-we-do', label: 'What We Do', detail: 'How swimming brings transplant communities together.' },
  { to: '/about/transplant-swimming-and-the-games', label: 'Transplant Swimming and the Games', detail: 'Discover the sport and the Games.' },
  { to: '/about/community-and-clubs', label: 'Community and Clubs', detail: 'Find your place in the community.' },
  { to: '/about/partners', label: 'Partners', detail: 'The organisations helping us move forward.' },
  { to: '/about/contact-us', label: 'Contact Us', detail: 'Get in touch with the Transplant Aquatics team.' },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [mobileAboutOpen, setMobileAboutOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const aboutMenuRef = useRef<HTMLDivElement>(null);
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAboutActive = location.pathname.startsWith('/about');

  // Close dropdown on click-outside
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!aboutOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (aboutMenuRef.current && !aboutMenuRef.current.contains(event.target as Node)) setAboutOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAboutOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [aboutOpen]);

  useEffect(() => {
    setAboutOpen(false);
    setMobileOpen(false);
    setMobileAboutOpen(location.pathname.startsWith('/about'));
  }, [location.pathname]);

  const handleSignOut = () => {
    setDropdownOpen(false);
    auth.logout();
    navigate('/');
  };

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 h-14"
        style={{ backgroundColor: 'var(--navy)', borderBottom: '1px solid var(--navy-light)' }}
      >
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0">
            <Logo size="md" light />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
            {NAV_LINKS.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-accent'
                      : 'text-white/60 hover:text-white'
                  }`
                }
                style={({ isActive }) => isActive ? { color: 'var(--accent)' } : {}}
              >
                {l.label}
              </NavLink>
            ))}
            <div className="relative" ref={aboutMenuRef}>
              <button
                type="button"
                aria-expanded={aboutOpen}
                aria-controls="about-navigation-menu"
                aria-current={isAboutActive ? 'page' : undefined}
                onClick={() => setAboutOpen(open => !open)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium transition-colors ${isAboutActive ? 'text-[var(--accent)]' : 'text-white/70 hover:text-white'}`}
                onKeyDown={event => { if (event.key === 'ArrowDown') setAboutOpen(true); }}
              >
                About <ChevronDown size={14} className={`transition-transform ${aboutOpen ? 'rotate-180' : ''}`} />
              </button>
              {aboutOpen && (
                <div
                  id="about-navigation-menu"
                  role="region"
                  aria-label="About navigation"
                  onMouseLeave={() => setAboutOpen(false)}
                  className="absolute left-1/2 top-full z-50 mt-3 grid w-[min(760px,calc(100vw-2rem))] -translate-x-1/2 grid-cols-[1.2fr_0.8fr] overflow-hidden border shadow-2xl"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 p-6">
                    {ABOUT_LINKS.map(item => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setAboutOpen(false)}
                        className={({ isActive }) => `group border-l-2 px-3 py-3 transition-colors ${isActive ? 'border-[var(--accent)] bg-[var(--paper)]' : 'border-transparent hover:bg-[var(--paper)]'}`}
                      >
                        <span className="block text-sm font-bold text-[var(--ink)] group-hover:text-[var(--accent-dark)]">{item.label}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-[var(--muted)]">{item.detail}</span>
                      </NavLink>
                    ))}
                  </div>
                  <div className="relative flex min-h-72 flex-col justify-end overflow-hidden p-7 text-white" style={{ backgroundColor: 'var(--navy-mid)' }}>
                  <img src="/assets/aquatics-hero.png" alt="Transplant aquatics community" className="absolute inset-0 h-full w-full object-cover opacity-45" />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(7,26,43,.96), rgba(7,26,43,.05))' }} />
                    <div className="relative">
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--accent)]">Transplant Aquatics</p>
                      <p className="mt-2 text-2xl font-bold leading-tight">Different journeys.<br />Same water.</p>
                      <Link to="/about/our-story" onClick={() => setAboutOpen(false)} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white transition-colors hover:text-[var(--accent)]">
                        Get to know us <ArrowUpRight size={15} />
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* Right */}
          <div className="flex items-center gap-2">
            <Link
              to="/search"
              aria-label="Search"
              className="w-8 h-8 flex items-center justify-center transition-colors"
              style={{ color: 'rgba(255,255,255,0.5)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
            >
              <Search size={18} />
            </Link>
            {/* User area — avatar or login icon */}
            {auth.isLoggedIn && auth.user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(o => !o)}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white transition-opacity hover:opacity-80"
                  style={{ backgroundColor: 'var(--navy-light)' }}
                  aria-label="Open user menu"
                  aria-haspopup="menu"
                  aria-expanded={dropdownOpen}
                >
                  {auth.user.avatarUrl
                    ? <img src={auth.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                    : auth.user.avatarInitials}
                </button>

                {dropdownOpen && (
                  <div
                    className="absolute right-0 top-10 w-52 py-1 shadow-lg z-50"
                    style={{
                      backgroundColor: 'var(--navy-mid)',
                      border: '1px solid var(--navy-light)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    }}
                  >
                    {/* Non-clickable user info header */}
                    <div
                      className="px-4 py-3"
                      style={{ borderBottom: '1px solid var(--navy-light)' }}
                    >
                      <p className="text-sm font-semibold text-white leading-snug">
                        {auth.user.firstName} {auth.user.lastName}
                      </p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-on-dark)' }}>
                        {auth.user.email}
                      </p>
                    </div>

                    {/* Menu items */}
                    <Link
                      to="/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
                      style={{ color: 'var(--ice)' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--navy-light)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <User size={14} style={{ color: 'var(--muted-on-dark)' }} />
                      Dashboard
                    </Link>
                    <Link
                      to="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
                      style={{ color: 'var(--ice)' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--navy-light)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <User size={14} style={{ color: 'var(--muted-on-dark)' }} />
                      My Profile
                    </Link>
                    {/* Divider */}
                    <div style={{ borderTop: '1px solid var(--navy-light)', margin: '4px 0' }} />

                    {/* Sign Out */}
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-left transition-colors"
                      style={{ color: '#f87171' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--navy-light)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M5 2H2.5C2.22 2 2 2.22 2 2.5v9c0 .28.22.5.5.5H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                        <path d="M9 4.5L11.5 7 9 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M11.5 7H5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden sm:inline-flex items-center px-2 py-2 text-sm font-semibold text-white/70 transition-colors hover:text-white"
              >
                Sign in
              </Link>
            )}

            {!(auth.isLoggedIn && auth.user) && (
              <Link
                to="/join"
                className="hidden sm:flex items-center px-4 py-2 text-sm font-bold uppercase tracking-wider text-black transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'var(--accent)', fontFamily: "'Manrope', sans-serif" }}
              >
                Join
              </Link>
            )}
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden w-8 h-8 flex items-center justify-center"
              style={{ color: 'rgba(255,255,255,0.6)' }}
              aria-label="Open main menu"
              aria-expanded={mobileOpen}
              aria-controls="mobile-main-menu"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Full-screen mobile menu */}
      {mobileOpen && (
        <div
          id="mobile-main-menu"
          className="fixed inset-0 z-[60] flex min-h-screen flex-col overflow-y-auto"
          style={{ backgroundColor: 'var(--navy)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Main menu"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b px-5" style={{ borderColor: 'var(--navy-light)' }}>
            <Logo size="sm" light />
            <button
              onClick={() => setMobileOpen(false)}
              className="flex size-10 items-center justify-center text-white/70 transition-colors hover:text-[var(--lime)]"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
          <nav className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-10 text-center" aria-label="Main navigation">
            {NAV_LINKS.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `px-5 py-3 text-xl font-semibold transition-colors sm:text-2xl ${
                    isActive ? 'text-[var(--lime)]' : 'text-white/75 hover:text-[var(--lime)]'
                  }`
                }
                style={({ isActive }) => isActive ? { color: 'var(--lime)' } : {}}
              >
                {l.label}
              </NavLink>
            ))}
              <button
                type="button"
                aria-expanded={mobileAboutOpen}
                aria-controls="mobile-about-navigation-menu"
                onClick={() => setMobileAboutOpen(open => !open)}
                className={`flex items-center gap-2 px-5 py-3 text-xl font-semibold transition-colors sm:text-2xl ${isAboutActive ? 'text-[var(--accent)]' : 'text-white/75 hover:text-[var(--accent)]'}`}
              >
              About <ChevronDown size={18} className={`transition-transform ${mobileAboutOpen ? 'rotate-180' : ''}`} />
            </button>
            {mobileAboutOpen && (
              <div id="mobile-about-navigation-menu" className="flex w-full max-w-sm flex-col border-y py-2 text-left" style={{ borderColor: 'var(--navy-light)' }}>
                {ABOUT_LINKS.map(item => (
                  <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `border-l-2 px-4 py-2.5 transition-colors ${isActive ? 'border-[var(--accent)] bg-white/5 text-[var(--accent)]' : 'border-transparent text-white/75 hover:text-[var(--accent)]'}`}>
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-white/45">{item.detail}</span>
                  </NavLink>
                ))}
                <div className="relative mx-3 mt-2 flex min-h-28 items-end overflow-hidden p-4">
                  <img src="/assets/aquatics-hero.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
                  <p className="relative text-sm font-bold text-white">Different journeys. Same water.</p>
                </div>
              </div>
            )}
            <div className="mt-5 flex w-full max-w-xs flex-col items-center gap-3 border-t px-5 pt-6" style={{ borderColor: 'var(--navy-light)' }}>
              {auth.isLoggedIn && auth.user ? (
                <>
                  <div className="mb-2 flex flex-col items-center gap-2 text-center">
                    <div
                      className="flex size-10 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: 'var(--navy-light)' }}
                    >
                      {auth.user.avatarUrl
                        ? <img src={auth.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                        : auth.user.avatarInitials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white leading-snug">{auth.user.firstName} {auth.user.lastName}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--muted-on-dark)' }}>{auth.user.email}</p>
                    </div>
                  </div>
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="w-full px-4 py-3 text-sm font-semibold text-white/75 transition-colors hover:text-[var(--lime)]"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="w-full px-4 py-3 text-sm font-semibold text-white/75 transition-colors hover:text-[var(--lime)]"
                  >
                    My Profile
                  </Link>
                  <button
                    onClick={() => { setMobileOpen(false); handleSignOut(); }}
                    className="w-full px-4 py-3 text-sm font-semibold text-white/75 transition-colors hover:text-[var(--lime)]"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white/75 transition-colors hover:text-[var(--lime)]"
                  >
                    <User size={16} />
                    Sign in
                  </Link>
                  <Link
                    to="/join"
                    onClick={() => setMobileOpen(false)}
                    className="flex w-full items-center justify-center px-5 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--navy)] transition-colors hover:bg-[var(--lime)]"
                    style={{ backgroundColor: 'var(--accent)', fontFamily: "'Manrope', sans-serif" }}
                  >
                    Join
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
