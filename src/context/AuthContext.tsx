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

// ── Sesión local (solo para recordar quién está logueado en este dispositivo) ──
const getStoredSession = (): Profile | null => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
};
const saveStoredSession = (profile: Profile) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
};
const clearStoredSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

// ── Helpers para compatibilidad con el resto del código ──────────────────────
// Estos leen/escriben en Supabase pero mantienen la misma interfaz que antes
// para que LoginPage y otros archivos no se rompan.
export const getStoredUsers = (): Profile[] => {
  // Retorna vacío — ahora los usuarios viven en Supabase
  // Se usa solo como fallback en código legacy
  try { return JSON.parse(localStorage.getItem('optica_users') || '[]'); }
  catch { return []; }
};
export const saveStoredUsers = (users: Profile[]) => {
  // Mantiene compatibilidad pero también guarda en localStorage como cache
  localStorage.setItem('optica_users', JSON.stringify(users));
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [devMode, setDevMode] = useState(false);

  // Al iniciar: verificar sesión guardada y validar contra Supabase
  useEffect(() => {
    async function restoreSession() {
      const session = getStoredSession();
      if (!session) { setLoading(false); return; }

      // Verificar que el usuario sigue existiendo en Supabase
      const { data } = await supabase
        .from('optica_users')
        .select('*')
        .eq('id', session.id)
        .single();

      if (data) {
        setProfile(data as Profile);
        saveStoredSession(data as Profile);
      } else {
        // Ya no existe en Supabase, limpiar sesión
        clearStoredSession();
      }
      setLoading(false);
    }
    restoreSession();
  }, []);

  // ── Login: busca el usuario en Supabase ──────────────────────────────────
  async function signIn(email: string, password: string): Promise<{ error: Error | null }> {
    // Primero intentar en Supabase
    const { data, error } = await supabase
      .from('optica_users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('password', password)
      .single();

    if (data && !error) {
      saveStoredSession(data as Profile);
      setProfile(data as Profile);
      return { error: null };
    }

    // Fallback: intentar en localStorage (para migración)
    const localUsers = getStoredUsers();
    const found = localUsers.find(
      u => u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password
    );
    if (found) {
      // Migrar este usuario a Supabase automáticamente
      await supabase.from('optica_users').upsert({
        id:         found.id,
        full_name:  found.full_name,
        email:      found.email.toLowerCase(),
        password:   found.password,
        role:       found.role,
        branch_id:  found.branch_id,
        avatar_url: found.avatar_url || '',
        created_at: found.created_at,
      });
      saveStoredSession(found);
      setProfile(found);
      return { error: null };
    }

    return { error: new Error('Correo o contraseña incorrectos.') };
  }

  // ── Logout ───────────────────────────────────────────────────────────────
  async function signOut(): Promise<void> {
    setDevMode(false);
    clearStoredSession();
    setProfile(null);
  }

  // ── Dev mode (solo para desarrollo, ya lo quitaste del login) ───────────
  function enterDevMode() {
    const devProfile: Profile = {
      id: 'dev-mode-id', full_name: 'Modo Desarrollo', role: 'admin',
      branch_id: null, avatar_url: '', created_at: new Date().toISOString(),
      email: 'dev@optica.com', password: '',
    };
    setDevMode(true);
    setProfile(devProfile);
    setLoading(false);
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
