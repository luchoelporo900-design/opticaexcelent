import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// ============================================================
// TIPOS — misma estructura que antes para no romper otras páginas
// ============================================================
export type UserRole = 'admin' | 'vendedora';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  branch_id: string | null;  // nombre de sucursal o null
  avatar_url: string;
  created_at: string;
  email: string;
  password: string; // guardado en localStorage (app interna, sin internet)
}

type AuthContextType = {
  user: Profile | null;
  session: Profile | null; // alias de user, para compatibilidad
  profile: Profile | null;
  loading: boolean;
  devMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  enterDevMode: () => void;
};

// ============================================================
// LOCALSTORAGE HELPERS
// ============================================================
const USERS_KEY = 'optica_users';
const SESSION_KEY = 'optica_session';

export const getStoredUsers = (): Profile[] => {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }
  catch { return []; }
};

export const saveStoredUsers = (users: Profile[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

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

// ============================================================
// CONTEXTO
// ============================================================
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [devMode, setDevMode] = useState(false);

  useEffect(() => {
    const session = getStoredSession();
    if (session) {
      // Verificar que el usuario sigue existiendo
      const all = getStoredUsers();
      const valid = all.find(u => u.id === session.id);
      if (valid) setProfile(valid);
      else clearStoredSession();
    }
    setLoading(false);
  }, []);

  async function signIn(email: string, password: string): Promise<{ error: Error | null }> {
    const all = getStoredUsers();
    const found = all.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!found) {
      return { error: new Error('Correo o contraseña incorrectos.') };
    }
    saveStoredSession(found);
    setProfile(found);
    return { error: null };
  }

  async function signOut(): Promise<void> {
    setDevMode(false);
    clearStoredSession();
    setProfile(null);
  }

  function enterDevMode() {
    const devProfile: Profile = {
      id: 'dev-mode-id',
      full_name: 'Modo Desarrollo',
      role: 'admin',
      branch_id: 'Centro',
      avatar_url: '',
      created_at: new Date().toISOString(),
      email: 'dev@optica.com',
      password: '',
    };
    setDevMode(true);
    setProfile(devProfile);
    setLoading(false);
  }

  return (
    <AuthContext.Provider value={{
      user: profile,
      session: profile, // alias para compatibilidad
      profile,
      loading,
      devMode,
      signIn,
      signOut,
      enterDevMode,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
