import { createContext, useContext, useState, type ReactNode } from 'react';
import { getSavedAvatar, saveAvatar } from '../lib/avatars';

/* ── Types ─────────────────────────────────────────────────────────────────── */
export interface AuthUser {
  firstName: string;
  lastName: string;
  email: string;
  avatarInitials: string;
  avatarUrl?: string;
  transplantType?: string;
  countryCode?: string;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  countryCode?: string;
  transplantType?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  updateAvatar: (image: string) => void;
}

/* ── Context ───────────────────────────────────────────────────────────────── */
const AuthContext = createContext<AuthContextType | null>(null);

/* ── Provider ──────────────────────────────────────────────────────────────── */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  /**
   * Demo login — any non-empty email + password succeeds.
   * Always resolves to a mock Emma Wilson session.
   */
  const login = async (email: string, password: string): Promise<void> => {
    if (!email.trim() || !password.trim()) {
      throw new Error('Email and password are required.');
    }
    // Simulate async auth round-trip
    await Promise.resolve();
    setUser({
      firstName: 'Emma',
      lastName: 'Wilson',
      email,
      avatarInitials: 'EW',
      avatarUrl: getSavedAvatar('Emma', 'Wilson') ?? undefined,
      transplantType: 'Kidney',
      countryCode: 'AU',
    });
  };

  /**
   * Demo register — builds a mock user from registration data.
   */
  const register = async (data: RegisterData): Promise<void> => {
    if (!data.email.trim()) {
      throw new Error('Email is required.');
    }
    await Promise.resolve();
    const first = (data.firstName || 'E').trim();
    const last  = (data.lastName  || 'W').trim();
    const initials = `${first[0] ?? 'E'}${last[0] ?? 'W'}`.toUpperCase();
    setUser({
      firstName: first,
      lastName: last,
      email: data.email,
      avatarInitials: initials,
      avatarUrl: getSavedAvatar(first, last) ?? undefined,
      transplantType: data.transplantType,
      countryCode: data.countryCode,
    });
  };

  const logout = () => setUser(null);
  const updateAvatar = (image: string) => {
    setUser(current => {
      if (!current) return current;
      saveAvatar(current.firstName, current.lastName, image);
      return { ...current, avatarUrl: image };
    });
  };

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, login, register, logout, updateAvatar }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ── Hook ──────────────────────────────────────────────────────────────────── */
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
