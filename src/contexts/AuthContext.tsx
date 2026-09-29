import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { getSavedAvatar, getSavedBanner, getSavedSocials, saveAvatar, saveBanner, saveSocials, type SocialLinks } from '../lib/avatars';
import { hasSupabaseConfig, supabase } from '../lib/supabase';
import { getCompetitionAgeGroup } from '../lib/competitionAge';

export interface AuthUser {
  firstName: string;
  lastName: string;
  email: string;
  avatarInitials: string;
  avatarUrl?: string;
  bannerUrl?: string;
  socials?: SocialLinks;
  dateOfBirth?: string;
  registrantRelationship?: 'parent' | 'guardian' | 'coach';
  accountRole?: 'swimmer' | 'parent_guardian' | 'coach';
  transplantType?: string;
  countryCode?: string;
  country?: string;
  ageGroup?: string;
  gender?: string;
  club?: string;
  clubName?: string;
  clubId?: string;
  primaryEvent?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateAvatar: (image: string) => void;
  updateBanner: (image: string) => void;
  updateSocials: (socials: SocialLinks) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function toAuthUser(user: SupabaseUser): AuthUser {
  const metadata = user.user_metadata ?? {};
  const firstName = String(metadata.first_name ?? metadata.firstName ?? '');
  const lastName = String(metadata.last_name ?? metadata.lastName ?? '');
  const email = user.email ?? '';
  const dateOfBirth = String(metadata.date_of_birth ?? metadata.dateOfBirth ?? '');
  const registrantRelationship = ['parent', 'guardian', 'coach'].includes(String(metadata.registrant_relationship))
    ? metadata.registrant_relationship as AuthUser['registrantRelationship']
    : undefined;
  const avatarInitials = `${firstName[0] ?? email[0] ?? 'A'}${lastName[0] ?? ''}`.toUpperCase();

  return {
    firstName,
    lastName,
    email,
    avatarInitials,
    avatarUrl: getSavedAvatar(firstName, lastName) ?? undefined,
    bannerUrl: getSavedBanner(firstName, lastName) ?? undefined,
    socials: getSavedSocials(firstName, lastName),
    dateOfBirth: dateOfBirth || undefined,
    registrantRelationship,
    accountRole: ['swimmer', 'parent_guardian', 'coach'].includes(String(metadata.account_role)) ? metadata.account_role as AuthUser['accountRole'] : 'swimmer',
    transplantType: metadata.transplant_type ?? metadata.transplantType,
    countryCode: metadata.country_code ?? metadata.countryCode,
    country: metadata.country,
    ageGroup: (dateOfBirth ? getCompetitionAgeGroup(dateOfBirth, new Date().toISOString().slice(0, 10)) : null) ?? metadata.age_group ?? metadata.ageGroup,
    gender: metadata.gender,
    club: metadata.club,
    clubName: metadata.club,
    clubId: metadata.club_id ? String(metadata.club_id) : undefined,
    primaryEvent: metadata.primary_event ?? metadata.primaryEvent,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(hasSupabaseConfig);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? toAuthUser(session.user) : null);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? toAuthUser(session.user) : null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    if (!email.trim() || !password.trim()) {
      throw new Error('Email and password are required.');
    }
    if (!supabase || !hasSupabaseConfig) {
      throw new Error('Authentication is not configured yet. Add the Supabase project URL and public key to .env.local.');
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const logout = () => {
    setUser(null);
    if (supabase) void supabase.auth.signOut();
  };

  const updateAvatar = (image: string) => {
    setUser(current => {
      if (!current) return current;
      saveAvatar(current.firstName, current.lastName, image);
      return { ...current, avatarUrl: image };
    });
  };

  const updateBanner = (image: string) => {
    setUser(current => {
      if (!current) return current;
      saveBanner(current.firstName, current.lastName, image);
      return { ...current, bannerUrl: image };
    });
  };

  const updateSocials = (socials: SocialLinks) => {
    setUser(current => {
      if (!current) return current;
      saveSocials(current.firstName, current.lastName, socials);
      return { ...current, socials };
    });
  };

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, isLoading, login, logout, updateAvatar, updateBanner, updateSocials }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
