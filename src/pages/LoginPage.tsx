import { useState, FormEvent } from 'react';
import { Eye, EyeOff, Glasses, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { signIn, enterDevMode } = useAuth();
  const [email,    setEmail]    = useState('admin@opticayolanda.com');
  const [password, setPassword] = useState('admin123');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await signIn(email, password);
    if (error) setError('Credenciales incorrectas. Verifique e intente de nuevo.');
    setLoading(false);
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

        {/* Login card */}
        <div className="login-card p-7">
          <p className="text-white text-sm font-light tracking-[0.20em] uppercase text-center mb-5">
            Acceso al Sistema
          </p>

          {/* Credentials hint */}
          <div className="mb-5 px-3 py-2.5 rounded-xl text-center"
            style={{
              background: 'rgba(197,160,89,0.055)',
              border: '1px solid rgba(197,160,89,0.18)',
            }}>
            <p className="text-xs font-light text-gold-muted">
              Administrador configurado
            </p>
            <p className="text-xs font-mono mt-0.5" style={{ color: 'rgba(255,255,255,0.36)' }}>
              admin@opticayolanda.com · admin123
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-xl text-xs text-center animate-fade-in"
              style={{
                background: 'rgba(239,68,68,0.09)',
                border: '1px solid rgba(239,68,68,0.28)',
                color: '#f87171',
              }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="section-label block mb-2">Correo Electrónico</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email"
                className="w-full px-4 py-3 text-sm"
                style={{ borderRadius: 10 }}
              />
            </div>

            {/* Password */}
            <div>
              <label className="section-label block mb-2">Contraseña</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  required autoComplete="current-password"
                  className="w-full px-4 py-3 text-sm pr-11"
                  style={{ borderRadius: 10 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'rgba(197,160,89,0.55)', transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#C5A059')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(197,160,89,0.55)')}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
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
        </div>

        <p className="text-center text-xs mt-7 font-light" style={{ color: 'rgba(255,255,255,0.12)' }}>
          © 2026 Óptica Yolanda · Sistema de Gestión Elite
        </p>
      </div>
    </div>
  );
}
