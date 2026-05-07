import { useState, FormEvent } from 'react';
import { Eye, EyeOff, Glasses } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { signIn } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
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

      <div className="absolute inset-0 pointer-events-none" style={{
        background:
          'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(197,160,89,0.09) 0%, transparent 60%), ' +
          'radial-gradient(ellipse 50% 40% at 15% 100%, rgba(197,160,89,0.04) 0%, transparent 50%), ' +
          'radial-gradient(ellipse 50% 40% at 85% 100%, rgba(197,160,89,0.04) 0%, transparent 50%)',
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        opacity: 0.025,
        backgroundImage:
          'repeating-linear-gradient(45deg,  #C5A059 0px, #C5A059 1px, transparent 1px, transparent 64px), ' +
          'repeating-linear-gradient(-45deg, #C5A059 0px, #C5A059 1px, transparent 1px, transparent 64px)',
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 42%, rgba(0,0,0,0.72) 100%)',
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        opacity: 0.022,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.15) 2px, rgba(255,255,255,0.15) 3px)',
        backgroundSize: '100% 3px',
      }} />

      <div className="relative z-10 w-full max-w-sm px-5 animate-slide-up">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="relative inline-flex items-center justify-center mb-5">
            <div className="absolute w-28 h-28 rounded-full glow-breathe" style={{
              background: 'radial-gradient(circle, rgba(197,160,89,0.12) 0%, transparent 70%)',
              border: '1px solid rgba(197,160,89,0.08)',
            }} />
            <div className="absolute w-[84px] h-[84px] rounded-full" style={{
              border: '1px solid rgba(197,160,89,0.18)',
              boxShadow: '0 0 16px rgba(197,160,89,0.10)',
            }} />
            <div className="relative flex items-center justify-center w-[68px] h-[68px] rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(197,160,89,0.18) 0%, rgba(197,160,89,0.06) 100%)',
                border: '1.5px solid rgba(197,160,89,0.48)',
                boxShadow: '0 0 0 3px rgba(197,160,89,0.06), 0 0 28px rgba(197,160,89,0.22), 0 0 0 1px rgba(0,0,0,0.60) inset',
              }}>
              <Glasses size={30} style={{ color: '#C5A059', filter: 'drop-shadow(0 0 6px rgba(197,160,89,0.55))' }} />
            </div>
          </div>
          <h1 className="text-white font-light tracking-[0.32em] text-xl uppercase">Óptica Yolanda</h1>
          <p className="mt-1 tracking-[0.48em] text-xs uppercase font-light text-gold-muted">Elite Management V10</p>
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
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email" placeholder="usuario@opticayolanda.com"
                className="w-full px-4 py-3 text-sm" style={{ borderRadius: 10 }} />
            </div>
            <div>
              <label className="section-label block mb-2">Contrasena</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} required
                  autoComplete="current-password" placeholder="••••••••"
                  className="w-full px-4 py-3 text-sm pr-11" style={{ borderRadius: 10 }} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'rgba(197,160,89,0.55)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#C5A059')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(197,160,89,0.55)')}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="luxury-button w-full py-3 mt-1"
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
        </div>

        <p className="text-center text-xs mt-7 font-light" style={{ color: 'rgba(255,255,255,0.12)' }}>
          © 2026 Óptica Yolanda · Sistema de Gestión Elite
        </p>
      </div>
    </div>
  );
}
