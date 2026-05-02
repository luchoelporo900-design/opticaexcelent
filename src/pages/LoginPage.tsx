import { useState, useEffect, FormEvent } from 'react';
import { Eye, EyeOff, Glasses, Zap, UserPlus, ChevronLeft, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const { signIn, enterDevMode } = useAuth();

  // ── Login state ──────────────────────────────────────────
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // ── Branches (loaded publicly) ───────────────────────────
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    supabase.from('branches').select('id, name').order('name')
      .then(({ data }) => { if (data) setBranches(data); });
  }, []);

  // ── Register state ───────────────────────────────────────
  const [view,        setView]       = useState<'login' | 'register'>('login');
  const [regName,     setRegName]    = useState('');
  const [regEmail,    setRegEmail]   = useState('');
  const [regPass,     setRegPass]    = useState('');
  const [regRole,     setRegRole]    = useState<'vendedor' | 'admin'>('vendedor');
  const [regBranch,   setRegBranch]  = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [regLoading,  setRegLoading] = useState(false);
  const [regError,    setRegError]   = useState('');
  const [regOk,       setRegOk]      = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await signIn(email, password);
    if (error) setError('Credenciales incorrectas. Verifique e intente de nuevo.');
    setLoading(false);
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setRegError('');
    if (!regName.trim() || !regEmail.trim() || !regPass.trim()) {
      setRegError('Todos los campos son obligatorios.');
      return;
    }
    if (regPass.length < 6) {
      setRegError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setRegLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: regEmail.trim(),
          password: regPass,
          full_name: regName.trim(),
          role: regRole,
          branch_id: regBranch || null,
        }),
      }
    );
    const json = await res.json();
    setRegLoading(false);
    if (!res.ok || json.error) {
      setRegError(json.error ?? 'Error al registrar usuario.');
      return;
    }
    setRegOk(`Usuario "${regName.trim()}" registrado con exito.`);
    setRegName(''); setRegEmail(''); setRegPass(''); setRegRole('vendedor'); setRegBranch('');
    setTimeout(() => { setRegOk(''); setView('login'); }, 3000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: '#000' }}>

      {/* ── Layer 1: deep radial ambient bloom ───────────────── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background:
          'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(197,160,89,0.09) 0%, transparent 60%), ' +
          'radial-gradient(ellipse 50% 40% at 15% 100%, rgba(197,160,89,0.04) 0%, transparent 50%), ' +
          'radial-gradient(ellipse 50% 40% at 85% 100%, rgba(197,160,89,0.04) 0%, transparent 50%)',
      }} />

      {/* ── Layer 2: fine crosshatch texture ─────────────────── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        opacity: 0.025,
        backgroundImage:
          'repeating-linear-gradient(45deg,  #C5A059 0px, #C5A059 1px, transparent 1px, transparent 64px), ' +
          'repeating-linear-gradient(-45deg, #C5A059 0px, #C5A059 1px, transparent 1px, transparent 64px)',
      }} />

      {/* ── Layer 3: vignette edge darkening ─────────────────── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background:
          'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 42%, rgba(0,0,0,0.72) 100%)',
      }} />

      {/* ── Layer 4: horizontal scan lines at 2% opacity ─────── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        opacity: 0.022,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.15) 2px, rgba(255,255,255,0.15) 3px)',
        backgroundSize: '100% 3px',
      }} />

      {/* ── Content ──────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-sm px-5 animate-slide-up">

        {/* Logo mark */}
        <div className="text-center mb-10">
          {/* Rings */}
          <div className="relative inline-flex items-center justify-center mb-5">
            {/* Outermost glow ring */}
            <div className="absolute w-28 h-28 rounded-full glow-breathe" style={{
              background: 'radial-gradient(circle, rgba(197,160,89,0.12) 0%, transparent 70%)',
              border: '1px solid rgba(197,160,89,0.08)',
            }} />
            {/* Middle ring */}
            <div className="absolute w-[84px] h-[84px] rounded-full" style={{
              border: '1px solid rgba(197,160,89,0.18)',
              boxShadow: '0 0 16px rgba(197,160,89,0.10)',
            }} />
            {/* Inner icon ring */}
            <div className="relative flex items-center justify-center w-[68px] h-[68px] rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(197,160,89,0.18) 0%, rgba(197,160,89,0.06) 100%)',
                border: '1.5px solid rgba(197,160,89,0.48)',
                boxShadow:
                  '0 0 0 3px rgba(197,160,89,0.06), ' +
                  '0 0 28px rgba(197,160,89,0.22), ' +
                  '0 0 0 1px rgba(0,0,0,0.60) inset',
              }}>
              <Glasses size={30} style={{ color: '#C5A059', filter: 'drop-shadow(0 0 6px rgba(197,160,89,0.55))' }} />
            </div>
          </div>

          <h1 className="text-white font-light tracking-[0.32em] text-xl uppercase">
            Óptica Yolanda
          </h1>
          <p className="mt-1 tracking-[0.48em] text-xs uppercase font-light text-gold-muted">
            Elite Management V10
          </p>

          {/* Divider line */}
          <div className="mt-5 flex items-center justify-center gap-3">
            <div className="h-px w-8" style={{ background: 'linear-gradient(to right, transparent, rgba(197,160,89,0.40))' }} />
            <div className="w-1 h-1 rounded-full" style={{ background: '#C5A059', boxShadow: '0 0 6px rgba(197,160,89,0.70)' }} />
            <div className="h-px w-16" style={{ background: 'linear-gradient(to right, rgba(197,160,89,0.40), rgba(197,160,89,0.14))' }} />
            <div className="w-1 h-1 rounded-full" style={{ background: 'rgba(197,160,89,0.35)' }} />
            <div className="h-px w-8" style={{ background: 'linear-gradient(to left, transparent, rgba(197,160,89,0.40))' }} />
          </div>
        </div>

        {/* Card */}
        <div className="login-card p-7">

          {view === 'login' ? (
            <>
              <p className="text-white text-sm font-light tracking-[0.20em] uppercase text-center mb-5">
                Acceso al Sistema
              </p>

              {error && (
                <div className="mb-4 px-3 py-2.5 rounded-xl text-xs text-center animate-fade-in"
                  style={{ background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.28)', color: '#f87171' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="section-label block mb-2">Correo Electronico</label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    required autoComplete="email" placeholder="usuario@opticayolanda.com"
                    className="w-full px-4 py-3 text-sm" style={{ borderRadius: 10 }}
                  />
                </div>
                <div>
                  <label className="section-label block mb-2">Contrasena</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password} onChange={e => setPassword(e.target.value)}
                      required autoComplete="current-password" placeholder="••••••••"
                      className="w-full px-4 py-3 text-sm pr-11" style={{ borderRadius: 10 }}
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'rgba(197,160,89,0.55)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#C5A059')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(197,160,89,0.55)')}>
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="luxury-button w-full py-3 mt-1"
                  style={loading ? { opacity: 0.52, cursor: 'not-allowed' } : {}}>
                  {loading ? (
                    <span className="flex items-center justify-center gap-2.5">
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Verificando...
                    </span>
                  ) : 'Ingresar al Sistema'}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 gold-divider" />
                <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.18)' }}>o</span>
                <div className="flex-1 gold-divider" />
              </div>

              {/* Register button */}
              <button
                onClick={() => { setView('register'); setRegError(''); setRegOk(''); }}
                className="w-full py-2.5 rounded-xl text-sm font-light tracking-wider flex items-center justify-center gap-2 mb-3"
                style={{
                  background: 'rgba(197,160,89,0.07)',
                  border: '1px solid rgba(197,160,89,0.26)',
                  color: 'rgba(197,160,89,0.80)',
                  transition: 'background 0.22s, border-color 0.22s, color 0.22s',
                }}
                onMouseEnter={e => {
                  const b = e.currentTarget;
                  b.style.background = 'rgba(197,160,89,0.13)';
                  b.style.borderColor = 'rgba(197,160,89,0.46)';
                  b.style.color = '#C5A059';
                }}
                onMouseLeave={e => {
                  const b = e.currentTarget;
                  b.style.background = 'rgba(197,160,89,0.07)';
                  b.style.borderColor = 'rgba(197,160,89,0.26)';
                  b.style.color = 'rgba(197,160,89,0.80)';
                }}>
                <UserPlus size={13} />
                Registrar nuevo usuario
              </button>

              {/* Dev mode */}
              <button
                onClick={enterDevMode}
                className="w-full py-2.5 rounded-xl text-sm font-light tracking-wider flex items-center justify-center gap-2"
                style={{
                  background: 'rgba(245,158,11,0.07)',
                  border: '1px solid rgba(245,158,11,0.24)',
                  color: 'rgba(245,158,11,0.72)',
                  transition: 'background 0.22s, border-color 0.22s, color 0.22s',
                }}
                onMouseEnter={e => {
                  const b = e.currentTarget;
                  b.style.background = 'rgba(245,158,11,0.13)';
                  b.style.borderColor = 'rgba(245,158,11,0.44)';
                  b.style.color = '#f59e0b';
                }}
                onMouseLeave={e => {
                  const b = e.currentTarget;
                  b.style.background = 'rgba(245,158,11,0.07)';
                  b.style.borderColor = 'rgba(245,158,11,0.24)';
                  b.style.color = 'rgba(245,158,11,0.72)';
                }}>
                <Zap size={13} />
                Modo Desarrollo — Acceso Inmediato
              </button>
              <p className="text-center text-xs mt-2 font-light" style={{ color: 'rgba(255,255,255,0.16)' }}>
                Sin base de datos · Solo para desarrollo
              </p>
            </>
          ) : (
            <>
              {/* Register form */}
              <div className="flex items-center gap-3 mb-5">
                <button
                  onClick={() => setView('login')}
                  className="p-1.5 rounded-lg"
                  style={{ color: 'rgba(197,160,89,0.55)', background: 'rgba(197,160,89,0.07)', border: '1px solid rgba(197,160,89,0.18)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#C5A059')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(197,160,89,0.55)')}>
                  <ChevronLeft size={14} />
                </button>
                <p className="text-white text-sm font-light tracking-[0.18em] uppercase">
                  Registrar Usuario
                </p>
              </div>

              {regOk && (
                <div className="mb-4 px-3 py-3 rounded-xl text-xs text-center animate-fade-in flex items-center justify-center gap-2"
                  style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.28)', color: '#22c55e' }}>
                  <Check size={13} />
                  {regOk}
                </div>
              )}

              {regError && (
                <div className="mb-4 px-3 py-2.5 rounded-xl text-xs text-center animate-fade-in"
                  style={{ background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.28)', color: '#f87171' }}>
                  {regError}
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="section-label block mb-2">Nombre Completo</label>
                  <input
                    type="text" value={regName} onChange={e => setRegName(e.target.value)}
                    required placeholder="Ej: Maria Garcia"
                    className="w-full px-4 py-3 text-sm" style={{ borderRadius: 10 }}
                  />
                </div>
                <div>
                  <label className="section-label block mb-2">Correo Electronico</label>
                  <input
                    type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                    required placeholder="usuario@opticayolanda.com"
                    className="w-full px-4 py-3 text-sm" style={{ borderRadius: 10 }}
                  />
                </div>
                <div>
                  <label className="section-label block mb-2">Contrasena</label>
                  <div className="relative">
                    <input
                      type={showRegPass ? 'text' : 'password'}
                      value={regPass} onChange={e => setRegPass(e.target.value)}
                      required placeholder="Minimo 6 caracteres"
                      className="w-full px-4 py-3 text-sm pr-11" style={{ borderRadius: 10 }}
                    />
                    <button type="button" onClick={() => setShowRegPass(!showRegPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'rgba(197,160,89,0.55)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#C5A059')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(197,160,89,0.55)')}>
                      {showRegPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="section-label block mb-2">Rol</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([['vendedor', 'Vendedora'], ['admin', 'Administrador']] as const).map(([val, lbl]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setRegRole(val)}
                        className="py-2.5 rounded-xl text-xs font-light tracking-wide transition-all"
                        style={{
                          background: regRole === val ? 'rgba(197,160,89,0.14)' : 'rgba(255,255,255,0.03)',
                          border: regRole === val ? '1px solid rgba(197,160,89,0.48)' : '1px solid rgba(255,255,255,0.08)',
                          color: regRole === val ? '#C5A059' : 'rgba(255,255,255,0.42)',
                        }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="section-label block mb-2">Sucursal <span style={{ color: 'rgba(255,255,255,0.28)' }}>(opcional)</span></label>
                  <select
                    value={regBranch}
                    onChange={e => setRegBranch(e.target.value)}
                    className="w-full px-4 py-3 text-sm outline-none"
                    style={{
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(197,160,89,0.22)',
                      color: regBranch ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.32)',
                    }}>
                    <option value="" style={{ background: '#111', color: '#fff' }}>Sin sucursal (Admin General)</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id} style={{ background: '#111', color: '#fff' }}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={regLoading || !regName.trim() || !regEmail.trim() || !regPass.trim()}
                  className="luxury-button w-full py-3 mt-1"
                  style={regLoading || !regName.trim() || !regEmail.trim() || !regPass.trim() ? { opacity: 0.52, cursor: 'not-allowed' } : {}}>
                  {regLoading ? (
                    <span className="flex items-center justify-center gap-2.5">
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Registrando...
                    </span>
                  ) : 'Guardar Usuario'}
                </button>
              </form>

              <p className="text-center text-xs mt-4 font-light leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.20)' }}>
                El primer usuario se crea libremente.<br />
                Los siguientes requieren un Administrador activo.
              </p>
            </>
          )}
        </div>

        <p className="text-center text-xs mt-7 font-light" style={{ color: 'rgba(255,255,255,0.12)' }}>
          © 2026 Óptica Yolanda · Sistema de Gestión Elite
        </p>
      </div>
    </div>
  );
}
