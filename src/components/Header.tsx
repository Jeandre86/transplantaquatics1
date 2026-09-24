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
            {/* "Press / to search" hint — desktop only */}
            <span
              className="hidden lg:inline-flex items-center gap-1 mono text-xs select-none pointer-events-none"
              style={{ color: 'var(--muted-on-dark)' }}
            >
              Press
              <kbd
                className="mono text-xs px-1 py-0.5 rounded"
                style={{
                  backgroundColor: 'var(--navy-light)',
                  color: 'var(--muted-on-dark)',
                  border: '1px solid var(--graphite)',
                  lineHeight: 1,
                }}
              >
                /
              </kbd>
              to search
            </span>
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
                  {auth.user.avatarInitials}
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

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="absolute right-0 top-0 h-full w-72 flex flex-col"
            style={{ backgroundColor: 'var(--navy)', borderLeft: '1px solid var(--navy-light)' }}
          >
            <div
              className="flex items-center justify-between px-5 h-14"
              style={{ borderBottom: '1px solid var(--navy-light)' }}
            >
              <Logo size="sm" light />
              <button
                onClick={() => setMobileOpen(false)}
                className="w-8 h-8 flex items-center justify-center"
                style={{ color: 'rgba(255,255,255,0.6)' }}
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex flex-col py-4">
              {NAV_LINKS.map(l => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === '/'}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `px-5 py-3 text-base font-medium border-l-2 transition-colors ${
                      isActive ? 'border-l-accent text-white' : 'border-transparent text-white/60 hover:text-white'
                    }`
                  }
                  style={({ isActive }) => isActive ? { borderLeftColor: 'var(--accent)' } : {}}
                >
                  {l.label}
                </NavLink>
              ))}
              <div
                className="px-5 pt-4 mt-2"
                style={{ borderTop: '1px solid var(--navy-light)' }}
              >
                {auth.isLoggedIn && auth.user ? (
                  <>
                    {/* Logged-in mobile: avatar row + links */}
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-9 h-9 flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: 'var(--navy-light)' }}
                      >
                        {auth.user.avatarInitials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white leading-snug">{auth.user.firstName} {auth.user.lastName}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--muted-on-dark)' }}>{auth.user.email}</p>
                      </div>
                    </div>
                    <Link
                      to="/profile"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium mb-2 transition-colors"
                      style={{ color: 'var(--ice)', border: '1px solid var(--navy-light)' }}
                    >
                      <User size={15} />
                      My Profile
                    </Link>
                    <button
                      onClick={() => { setMobileOpen(false); handleSignOut(); }}
                      className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium transition-colors"
                      style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-center w-full px-4 py-3 text-sm font-medium gap-2 mb-3 transition-colors"
                      style={{ color: 'var(--ice)', borderColor: 'var(--navy-light)', border: '1px solid var(--navy-light)' }}
                    >
                      <User size={16} />
                      Sign In / Register
                    </Link>
                    <Link
                      to="/join"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-center w-full px-4 py-3 text-sm font-bold uppercase tracking-wider text-black"
                      style={{ backgroundColor: 'var(--accent)', fontFamily: "'Manrope', sans-serif" }}
                    >
                      Join Transplant Aquatics
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
