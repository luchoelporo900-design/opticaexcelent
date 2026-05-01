import { useState, useEffect } from 'react';
import { User, Glasses, Plus, Eye, EyeOff, Check, X, RefreshCw, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useBranch } from '../context/BranchContext';

type TeamMember = {
  id: string;
  full_name: string;
  role: string;
  branch_id: string | null;
  created_at: string;
  branch_name?: string | null;
};

const ROLES = [
  { id: 'vendedor',    label: 'Vendedora',     color: '#3b82f6' },
  { id: 'laboratorio', label: 'Laboratorio',   color: '#10b981' },
  { id: 'gerente',     label: 'Gerente',       color: '#f59e0b' },
  { id: 'admin',       label: 'Administrador', color: '#C5A059' },
];

function roleColor(role: string) { return ROLES.find(r => r.id === role)?.color ?? 'rgba(255,255,255,0.4)'; }
function roleLabel(role: string) { return ROLES.find(r => r.id === role)?.label ?? role; }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-light mb-1.5 tracking-wide" style={{ color: 'rgba(197,160,89,0.65)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function GoldInput({ value, onChange, placeholder, type = 'text', disabled = false }: {
  value: string; onChange?: (v: string) => void;
  placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input
      type={type} value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border"
      style={{ borderColor: disabled ? 'rgba(255,255,255,0.08)' : 'rgba(197,160,89,0.22)', opacity: disabled ? 0.5 : 1 }}
    />
  );
}

export default function SettingsPage() {
  const { profile, user } = useAuth();
  const { branches } = useBranch();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'gerente';

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  const [team,        setTeam]        = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newName,    setNewName]    = useState('');
  const [newEmail,   setNewEmail]   = useState('');
  const [newPass,    setNewPass]    = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [newRole,    setNewRole]    = useState('admin');
  const [newBranch,  setNewBranch]  = useState('');
  const [creating,   setCreating]   = useState(false);
  const [createErr,  setCreateErr]  = useState('');
  const [createOk,   setCreateOk]   = useState('');

  // Show team panel to everyone — admins manage the team; others can see
  // it so that the very first admin account can be created (bootstrap mode).
  useEffect(() => { loadTeam(); }, []);

  async function loadTeam() {
    setLoadingTeam(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, branch_id, created_at, branches(name)')
      .order('created_at', { ascending: false });
    setTeam((data ?? []).map((p: any) => ({
      id: p.id, full_name: p.full_name, role: p.role,
      branch_id: p.branch_id, created_at: p.created_at,
      branch_name: p.branches?.name ?? null,
    })));
    setLoadingTeam(false);
  }

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    await supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function createUser() {
    setCreateErr('');
    if (!newName.trim() || !newEmail.trim() || !newPass.trim()) {
      setCreateErr('Nombre, email y contraseña son obligatorios.');
      return;
    }
    if (newPass.length < 6) { setCreateErr('La contraseña debe tener al menos 6 caracteres.'); return; }
    setCreating(true);

    // Get token if logged in; bootstrap mode works without one
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
          email: newEmail.trim(),
          password: newPass,
          full_name: newName.trim(),
          role: newRole,
          branch_id: newBranch || null,
        }),
      }
    );
    const json = await res.json();
    if (!res.ok || json.error) { setCreateErr(json.error ?? 'Error al crear usuario.'); setCreating(false); return; }

    setCreateOk(`Usuario "${newName.trim()}" creado con éxito.`);
    setNewName(''); setNewEmail(''); setNewPass(''); setNewRole('vendedor'); setNewBranch('');
    setShowCreate(false); setCreating(false);
    setTimeout(() => setCreateOk(''), 6000);
    loadTeam();
  }

  async function updateMemberRole(id: string, role: string) {
    await supabase.from('profiles').update({ role }).eq('id', id);
    setTeam(prev => prev.map(m => m.id === id ? { ...m, role } : m));
  }

  async function updateMemberBranch(id: string, branch_id: string) {
    await supabase.from('profiles').update({ branch_id: branch_id || null }).eq('id', id);
    const bn = branches.find(b => b.id === branch_id)?.name ?? null;
    setTeam(prev => prev.map(m => m.id === id ? { ...m, branch_id, branch_name: bn } : m));
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-light tracking-wider text-white">Configuración</h1>
        <p className="text-xs text-gold-muted mt-0.5 tracking-wide">Administración del sistema</p>
      </div>

      {createOk && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl animate-fade-in"
          style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.28)' }}>
          <Check size={14} style={{ color: '#22c55e' }} />
          <p className="text-sm font-light" style={{ color: '#22c55e' }}>{createOk}</p>
        </div>
      )}

      {/* My profile */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(197,160,89,0.14)' }}>
        <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(197,160,89,0.09)' }}>
          <User size={14} style={{ color: '#C5A059' }} />
          <span className="text-sm font-light tracking-wide text-white">Mi Perfil</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <Field label="Nombre completo"><GoldInput value={fullName} onChange={setFullName} placeholder="Tu nombre" /></Field>
            <Field label="Email"><GoldInput value={user?.email || ''} disabled /></Field>
            <Field label="Rol">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border" style={{ borderColor: 'rgba(197,160,89,0.12)' }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: roleColor(profile?.role ?? '') }} />
                <span className="text-sm font-light text-white">{roleLabel(profile?.role ?? '')}</span>
              </div>
            </Field>
          </div>
          <button onClick={saveProfile} disabled={saving}
            className="px-5 py-2 rounded-xl text-xs font-medium transition-all"
            style={{ background: saved ? 'rgba(34,197,94,0.15)' : '#C5A059', color: saved ? '#22c55e' : '#000', border: saved ? '1px solid rgba(34,197,94,0.35)' : 'none' }}>
            {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Team management — visible to all so first admin can be created */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(197,160,89,0.14)' }}>
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid rgba(197,160,89,0.09)' }}>
            <div className="flex items-center gap-3">
              <Shield size={14} style={{ color: '#C5A059' }} />
              <span className="text-sm font-light tracking-wide text-white">Gestión de Equipo</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(197,160,89,0.12)', color: '#C5A059' }}>
                {team.length} usuarios
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadTeam} disabled={loadingTeam}
                className="p-2 rounded-lg" style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)' }}>
                <RefreshCw size={12} className={loadingTeam ? 'animate-spin' : ''} />
              </button>
              <button onClick={() => { setShowCreate(!showCreate); setCreateErr(''); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                style={{ background: showCreate ? 'rgba(255,255,255,0.06)' : '#C5A059', color: showCreate ? 'rgba(255,255,255,0.6)' : '#000' }}>
                {showCreate ? <><X size={12} /> Cancelar</> : <><Plus size={12} /> Nuevo usuario</>}
              </button>
            </div>
          </div>

          {showCreate && (
            <div className="p-5 space-y-4" style={{ borderBottom: '1px solid rgba(197,160,89,0.08)', background: 'rgba(197,160,89,0.02)' }}>
              <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.55)' }}>
                {team.length === 0 ? 'Crear primer administrador' : 'Crear nuevo usuario'}
              </p>
              {team.length === 0 && (
                <div className="px-4 py-3 rounded-xl text-xs font-light"
                  style={{ background: 'rgba(197,160,89,0.07)', border: '1px solid rgba(197,160,89,0.25)', color: 'rgba(197,160,89,0.85)', lineHeight: 1.6 }}>
                  Modo configuracion inicial. Crea tu cuenta de Administrador principal para empezar. Despues solo los Admin/Gerente podran crear usuarios.
                </div>
              )}
              {createErr && (
                <div className="px-3 py-2 rounded-xl text-xs"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                  {createErr}
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Field label="Nombre completo"><GoldInput value={newName} onChange={setNewName} placeholder="Ej: María García" /></Field>
                <Field label="Email para login"><GoldInput value={newEmail} onChange={setNewEmail} type="email" placeholder="usuario@opticayolanda.com" /></Field>
                <Field label="Contraseña">
                  <div className="relative">
                    <GoldInput value={newPass} onChange={setNewPass} type={showPass ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(197,160,89,0.5)' }}>
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </Field>
                <Field label="Rol">
                  <select value={newRole} onChange={e => setNewRole(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm font-light outline-none border"
                    style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(197,160,89,0.22)', color: 'rgba(255,255,255,0.8)' }}>
                    {ROLES.map(r => <option key={r.id} value={r.id} style={{ background: '#111' }}>{r.label}</option>)}
                  </select>
                </Field>
                <Field label="Sucursal asignada">
                  <select value={newBranch} onChange={e => setNewBranch(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm font-light outline-none border"
                    style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(197,160,89,0.22)', color: 'rgba(255,255,255,0.8)' }}>
                    <option value="" style={{ background: '#111' }}>Sin sucursal específica</option>
                    {branches.map(b => <option key={b.id} value={b.id} style={{ background: '#111' }}>{b.name}</option>)}
                  </select>
                </Field>
              </div>
              <button onClick={createUser} disabled={creating}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-medium"
                style={{ background: '#C5A059', color: '#000' }}>
                <User size={12} />
                {creating ? 'Creando usuario...' : 'Crear Usuario'}
              </button>
            </div>
          )}

          {loadingTeam ? (
            <div className="p-5 space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded shimmer" />)}</div>
          ) : team.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.28)' }}>
                No hay usuarios registrados aun.
              </p>
              <button
                onClick={() => { setShowCreate(true); setCreateErr(''); }}
                className="text-xs px-4 py-2 rounded-xl font-medium"
                style={{ background: '#C5A059', color: '#000' }}>
                Crear primer administrador
              </button>
            </div>
          ) : (
            <div>
              <div className="grid px-5 py-2.5 text-xs font-light"
                style={{ gridTemplateColumns: '1fr 170px 180px 90px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.30)' }}>
                <span>Usuario</span><span>Rol</span><span>Sucursal</span><span>Desde</span>
              </div>
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                {team.map((m, i) => (
                  <div key={m.id} className="grid items-center gap-3 px-5 py-3"
                    style={{ gridTemplateColumns: '1fr 170px 180px 90px', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.008)' }}>
                    <div className="min-w-0">
                      <p className="text-sm text-white font-light truncate">{m.full_name}</p>
                      {m.id === profile?.id && <span className="text-xs" style={{ color: 'rgba(197,160,89,0.6)' }}>← tú</span>}
                    </div>
                    <select value={m.role} onChange={e => updateMemberRole(m.id, e.target.value)}
                      disabled={m.id === profile?.id}
                      className="px-2 py-1.5 rounded-lg text-xs outline-none border"
                      style={{ background: `${roleColor(m.role)}12`, borderColor: `${roleColor(m.role)}35`, color: roleColor(m.role), opacity: m.id === profile?.id ? 0.6 : 1 }}>
                      {ROLES.map(r => <option key={r.id} value={r.id} style={{ background: '#111', color: '#fff' }}>{r.label}</option>)}
                    </select>
                    <select value={m.branch_id || ''} onChange={e => updateMemberBranch(m.id, e.target.value)}
                      className="px-2 py-1.5 rounded-lg text-xs outline-none border"
                      style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(197,160,89,0.18)', color: 'rgba(255,255,255,0.7)' }}>
                      <option value="" style={{ background: '#111' }}>Sin sucursal</option>
                      {branches.map(b => <option key={b.id} value={b.id} style={{ background: '#111' }}>{b.name}</option>)}
                    </select>
                    <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.32)' }}>
                      {new Date(m.created_at).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      {/* System info */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(197,160,89,0.14)' }}>
        <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(197,160,89,0.09)' }}>
          <Glasses size={14} style={{ color: '#C5A059' }} />
          <span className="text-sm font-light tracking-wide text-white">Acerca del Sistema</span>
        </div>
        <div className="p-5 space-y-0">
          {[
            ['Sistema',         'Óptica Yolanda · Elite Management'],
            ['Versión',         'V32.0.0'],
            ['Sucursales',      '4 (Azara, Fernando, Caacupé, La Fina)'],
            ['Base de datos',   'Supabase PostgreSQL'],
            ['Módulos activos', 'Dashboard · POS · CRM · Caja · Saldos · Reportes'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-xs font-light py-2.5 border-b"
              style={{ borderColor: 'rgba(197,160,89,0.07)' }}>
              <span style={{ color: 'rgba(197,160,89,0.6)' }}>{label}</span>
              <span className="text-white">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
