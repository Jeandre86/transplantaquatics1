import { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Search, Menu, X, User } from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../contexts/AuthContext';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/rankings', label: 'Rankings' },
  { to: '/athletes', label: 'Athletes' },
  { to: '/results', label: 'Results' },
  { to: '/records', label: 'Records' },
  { to: '/countries', label: 'Countries' },
  { to: '/from-the-pool-deck', label: 'From the Pool Deck' },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const auth = useAuth();
  const navigate = useNavigate();

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
          <nav className="hidden lg:flex items-center gap-1">
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
          </nav>

          {/* Right */}
          <div className="flex items-center gap-2">
            <Link
              to="/search"
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
                  className="w-8 h-8 flex items-center justify-center text-xs font-bold text-white transition-opacity hover:opacity-80 flex-shrink-0"
                  style={{ backgroundColor: 'var(--navy-light)' }}
                  aria-label="Open user menu"
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
                    <Link
                      to="/results"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
                      style={{ color: 'var(--ice)' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--navy-light)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--muted-on-dark)', flexShrink: 0 }}>
                        <rect x="1" y="3" width="12" height="1.2" rx="0.6" fill="currentColor"/>
                        <rect x="1" y="6.4" width="12" height="1.2" rx="0.6" fill="currentColor"/>
                        <rect x="1" y="9.8" width="8" height="1.2" rx="0.6" fill="currentColor"/>
                      </svg>
                      My Results
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
                className="w-8 h-8 flex items-center justify-center transition-colors"
                style={{ color: 'rgba(255,255,255,0.5)' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
              >
                <User size={18} />
              </Link>
            )}

            <Link
              to="/join"
              className="hidden sm:flex items-center px-4 py-2 text-sm font-bold uppercase tracking-wider text-black transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--accent)', fontFamily: "'Manrope', sans-serif" }}
            >
              Join
            </Link>
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden w-8 h-8 flex items-center justify-center"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Full-screen mobile menu */}
      {mobileOpen && (
        <div
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
          <nav className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-10 text-center">
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
            <div className="mt-5 flex w-full max-w-xs flex-col items-center gap-3 border-t px-5 pt-6" style={{ borderColor: 'var(--navy-light)' }}>
              {auth.isLoggedIn && auth.user ? (
                <>
                  <div className="mb-2 flex flex-col items-center gap-2 text-center">
                    <div
                      className="flex size-10 items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: 'var(--navy-light)' }}
                    >
                      {auth.user.avatarInitials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white leading-snug">{auth.user.firstName} {auth.user.lastName}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--muted-on-dark)' }}>{auth.user.email}</p>
                    </div>
                  </div>
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
                    Sign up
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
