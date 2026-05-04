import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export type UserRole = 'admin' | 'vendedora' | 'laboratorio' | 'gerente';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  branch_id: string | null;
  avatar_url: string;
  created_at: string;
  email: string;
  password: string;
}

type AuthContextType = {
  user: Profile | null;
  session: Profile | null;
  profile: Profile | null;
  loading: boolean;
  devMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  enterDevMode: () => void;
};

const SESSION_KEY = 'optica_session';

const getStoredSession = (): Profile | null => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
};
const saveStoredSession = (p: Profile) => localStorage.setItem(SESSION_KEY, JSON.stringify(p));
const clearStoredSession = () => localStorage.removeItem(SESSION_KEY);

export const getStoredUsers = (): Profile[] => {
  try { return JSON.parse(localStorage.getItem('optica_users') || '[]'); }
  catch { return []; }
};
export const saveStoredUsers = (users: Profile[]) => localStorage.setItem('optica_users', JSON.stringify(users));

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [devMode, setDevMode] = useState(false);

  useEffect(() => {
    async function restore() {
      const session = getStoredSession();
      if (!session) { setLoading(false); return; }
      const { data } = await supabase.from('optica_users').select('*').eq('id', session.id).single();
      if (data) { setProfile(data as Profile); saveStoredSession(data as Profile); }
      else clearStoredSession();
      setLoading(false);
    }
    restore();
  }, []);

  async function signIn(email: string, password: string): Promise<{ error: Error | null }> {
    const { data, error } = await supabase.from('optica_users').select('*')
      .eq('email', email.toLowerCase().trim()).eq('password', password).single();
    if (data && !error) { saveStoredSession(data as Profile); setProfile(data as Profile); return { error: null }; }
    const local = getStoredUsers().find(u => u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password);
    if (local) { await supabase.from('optica_users').upsert({ id: local.id, full_name: local.full_name, email: local.email.toLowerCase(), password: local.password, role: local.role, branch_id: local.branch_id, avatar_url: local.avatar_url || '', created_at: local.created_at }); saveStoredSession(local); setProfile(local); return { error: null }; }
    return { error: new Error('Correo o contraseña incorrectos.') };
  }

  async function signOut(): Promise<void> { setDevMode(false); clearStoredSession(); setProfile(null); }

  function enterDevMode() {
    const dev: Profile = { id: 'dev-mode-id', full_name: 'Modo Desarrollo', role: 'admin', branch_id: null, avatar_url: '', created_at: new Date().toISOString(), email: 'dev@optica.com', password: '' };
    setDevMode(true); setProfile(dev); setLoading(false);
  }

  return (
    <AuthContext.Provider value={{ user: profile, session: profile, profile, loading, devMode, signIn, signOut, enterDevMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
