import { useState, useEffect } from 'react';
import { User, Glasses, Plus, Eye, EyeOff, Check, X, RefreshCw, Shield, Package, ToggleLeft, ToggleRight, PencilLine } from 'lucide-react';
import { useAuth, Profile } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const SUCURSALES = ['Azara', 'Fernando', 'Caacupé', 'La Fina'];

const ROLES = [
  { id: 'vendedora',   label: 'Vendedora',     color: '#3b82f6' },
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
  value: string; onChange?: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder} disabled={disabled}
      className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border"
      style={{ borderColor: disabled ? 'rgba(255,255,255,0.08)' : 'rgba(197,160,89,0.22)', opacity: disabled ? 0.5 : 1 }} />
  );
}

// Componente reutilizable para sección de permisos por toggle
function PermToggleSection({
  icon,
  title,
  badge,
  description,
  vendedoras,
  perms,
  savingId,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  badge: string;
  description: string;
  vendedoras: Profile[];
  perms: Record<string, boolean>;
  savingId: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(197,160,89,0.14)' }}>
      <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(197,160,89,0.09)' }}>
        {icon}
        <span className="text-sm font-light tracking-wide text-white">{title}</span>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(197,160,89,0.12)', color: '#C5A059' }}>
          {badge}
        </span>
      </div>
      <div className="p-5">
        <p className="text-xs font-light mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>{description}</p>
        {vendedoras.length === 0 ? (
          <p className="text-xs font-light text-center py-4" style={{ color: 'rgba(255,255,255,0.28)' }}>
            No hay vendedoras registradas
          </p>
        ) : (
          <div className="space-y-2">
            {vendedoras.map(m => {
              const enabled  = perms[m.id] ?? false;
              const isSaving = savingId === m.id;
              return (
                <div key={m.id} className="flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{ background: enabled ? 'rgba(34,197,94,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${enabled ? 'rgba(34,197,94,0.20)' : 'rgba(255,255,255,0.07)'}` }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)' }}>
                      <User size={14} style={{ color: '#3b82f6' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-light text-white truncate">{m.full_name}</p>
                      <p className="text-xs font-light truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {m.branch_id || 'Sin sucursal'} · {m.email}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onToggle(m.id)}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-light shrink-0 ml-3"
                    style={{
                      background: enabled ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${enabled ? 'rgba(34,197,94,0.30)' : 'rgba(255,255,255,0.10)'}`,
                      color: enabled ? '#22c55e' : 'rgba(255,255,255,0.4)',
                      opacity: isSaving ? 0.5 : 1,
                    }}>
                    {isSaving ? (
                      <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                    ) : enabled ? (
                      <ToggleRight size={16} />
                    ) : (
                      <ToggleLeft size={16} />
                    )}
                    {isSaving ? 'Guardando...' : enabled ? 'Habilitada' : 'Deshabilitada'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'gerente';

  const [fullName,    setFullName]    = useState(profile?.full_name || '');
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [team,        setTeam]        = useState<Profile[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newName,    setNewName]    = useState('');
  const [newEmail,   setNewEmail]   = useState('');
  const [newPass,    setNewPass]    = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [newRole,    setNewRole]    = useState('vendedora');
  const [newBranch,  setNewBranch]  = useState('');
  const [creating,   setCreating]   = useState(false);
  const [createErr,  setCreateErr]  = useState('');
  const [createOk,   setCreateOk]   = useState('');

  // Permisos de stock por usuario
  const [stockPerms,      setStockPerms]      = useState<Record<string, boolean>>({});
  const [savingStockPerm, setSavingStockPerm] = useState<string | null>(null);

  // Permisos de edición de ventas por usuario
  const [editPerms,      setEditPerms]      = useState<Record<string, boolean>>({});
  const [savingEditPerm, setSavingEditPerm] = useState<string | null>(null);

  useEffect(() => { loadTeam(); }, []);

  async function loadTeam() {
    setLoadingTeam(true);
    const { data } = await supabase
      .from('optica_users')
      .select('*')
      .order('created_at', { ascending: true });
    if (data) {
      setTeam(data as Profile[]);
      const stockP: Record<string, boolean> = {};
      const editP:  Record<string, boolean> = {};
      for (const u of data as any[]) {
        stockP[u.id] = u.puede_cargar_stock   ?? false;
        editP[u.id]  = u.puede_editar_ventas  ?? false;
      }
      setStockPerms(stockP);
      setEditPerms(editP);
    }
    setLoadingTeam(false);
  }

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    await supabase.from('optica_users').update({ full_name: fullName }).eq('id', profile.id);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    loadTeam();
  }

  async function createUser() {
    setCreateErr('');
    if (!newName.trim() || !newEmail.trim() || !newPass.trim()) {
      setCreateErr('Todos los campos son obligatorios.'); return;
    }
    if (newPass.length < 6) {
      setCreateErr('La contraseña debe tener al menos 6 caracteres.'); return;
    }
    setCreating(true);
    const { data: existing } = await supabase.from('optica_users').select('id').eq('email', newEmail.trim().toLowerCase()).maybeSingle();
    if (existing) { setCreateErr('Ya existe un usuario con ese correo.'); setCreating(false); return; }

    const newUser: Profile = {
      id: Date.now().toString(),
      full_name: newName.trim(),
      email: newEmail.trim().toLowerCase(),
      password: newPass,
      role: newRole as Profile['role'],
      branch_id: newBranch || null,
      avatar_url: '',
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('optica_users').insert(newUser);
    if (error) { setCreateErr('Error al crear el usuario. Intentá de nuevo.'); setCreating(false); return; }

    setCreateOk(`Usuario "${newName.trim()}" creado con éxito.`);
    setNewName(''); setNewEmail(''); setNewPass('');
    setNewRole('vendedora'); setNewBranch('');
    setShowCreate(false); setCreating(false);
    loadTeam();
    setTimeout(() => setCreateOk(''), 6000);
  }

  async function updateMemberRole(id: string, role: string) {
    await supabase.from('optica_users').update({ role }).eq('id', id);
    loadTeam();
  }

  async function updateMemberBranch(id: string, branch_id: string) {
    await supabase.from('optica_users').update({ branch_id: branch_id || null }).eq('id', id);
    loadTeam();
  }

  async function deleteUser(id: string) {
    if (id === profile?.id) return;
    if (!window.confirm('¿Eliminar este usuario?')) return;
    await supabase.from('optica_users').delete().eq('id', id);
    loadTeam();
  }

  async function toggleStockPerm(userId: string) {
    const newVal = !(stockPerms[userId] ?? false);
    setSavingStockPerm(userId);
    await supabase.from('optica_users').update({ puede_cargar_stock: newVal }).eq('id', userId);
    setStockPerms(prev => ({ ...prev, [userId]: newVal }));
    setSavingStockPerm(null);
  }

  async function toggleEditPerm(userId: string) {
    const newVal = !(editPerms[userId] ?? false);
    setSavingEditPerm(userId);
    await supabase.from('optica_users').update({ puede_editar_ventas: newVal }).eq('id', userId);
    setEditPerms(prev => ({ ...prev, [userId]: newVal }));
    setSavingEditPerm(null);
  }

  const vendedoras = team.filter(m => m.role === 'vendedora');

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

      {/* Mi perfil */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(197,160,89,0.14)' }}>
        <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(197,160,89,0.09)' }}>
          <User size={14} style={{ color: '#C5A059' }} />
          <span className="text-sm font-light tracking-wide text-white">Mi Perfil</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <Field label="Nombre completo"><GoldInput value={fullName} onChange={setFullName} placeholder="Tu nombre" /></Field>
            <Field label="Email"><GoldInput value={profile?.email || ''} disabled /></Field>
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

      {/* Permisos de Stock — solo admin */}
      {isAdmin && (
        <PermToggleSection
          icon={<Package size={14} style={{ color: '#C5A059' }} />}
          title="Permisos de Stock"
          badge="Vendedoras"
          description="Controlá quién puede agregar armazones al stock. Las vendedoras habilitadas podrán cargar nuevos modelos desde su celular."
          vendedoras={vendedoras}
          perms={stockPerms}
          savingId={savingStockPerm}
          onToggle={toggleStockPerm}
        />
      )}

      {/* Permisos de Edición de Ventas — solo admin */}
      {isAdmin && (
        <PermToggleSection
          icon={<PencilLine size={14} style={{ color: '#C5A059' }} />}
          title="Permisos de Edición de Ventas"
          badge="Vendedoras"
          description="Controlá quién puede editar ventas existentes. Las vendedoras habilitadas podrán modificar estado, montos, observaciones y más."
          vendedoras={vendedoras}
          perms={editPerms}
          savingId={savingEditPerm}
          onToggle={toggleEditPerm}
        />
      )}

      {/* Gestión de equipo — solo admin */}
      {isAdmin && (
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
              <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.55)' }}>Crear nuevo usuario</p>
              {createErr && (
                <div className="px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
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
                    {SUCURSALES.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <button onClick={createUser} disabled={creating || !newName.trim() || !newEmail.trim() || !newPass.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-medium"
                style={{ background: '#C5A059', color: '#000', opacity: (!newName.trim() || !newEmail.trim() || !newPass.trim()) ? 0.45 : 1, cursor: (!newName.trim() || !newEmail.trim() || !newPass.trim()) ? 'not-allowed' : 'pointer' }}>
                <User size={12} />{creating ? 'Creando...' : 'Crear Usuario'}
              </button>
            </div>
          )}

          {loadingTeam ? (
            <div className="text-center py-8">
              <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>Cargando usuarios...</p>
            </div>
          ) : team.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.28)' }}>No hay usuarios registrados.</p>
            </div>
          ) : (
            <div>
              <div className="grid px-5 py-2.5 text-xs font-light"
                style={{ gridTemplateColumns: '1fr 160px 180px 50px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.30)' }}>
                <span>Usuario</span><span>Rol</span><span>Sucursal</span><span></span>
              </div>
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                {team.map((m, i) => (
                  <div key={m.id} className="grid items-center gap-3 px-5 py-3"
                    style={{ gridTemplateColumns: '1fr 160px 180px 50px', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.008)' }}>
                    <div className="min-w-0">
                      <p className="text-sm text-white font-light truncate">{m.full_name}</p>
                      <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>{m.email}</p>
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
                      {SUCURSALES.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
                    </select>
                    {m.id !== profile?.id && (
                      <button onClick={() => deleteUser(m.id)}
                        className="flex items-center justify-center w-8 h-8 rounded-lg"
                        style={{ color: 'rgba(239,68,68,0.5)', border: '1px solid rgba(239,68,68,0.2)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(239,68,68,0.5)'; }}>
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info sistema */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(197,160,89,0.14)' }}>
        <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(197,160,89,0.09)' }}>
          <Glasses size={14} style={{ color: '#C5A059' }} />
          <span className="text-sm font-light tracking-wide text-white">Acerca del Sistema</span>
        </div>
        <div className="p-5">
          {[
            ['Sistema',         'Óptica Yolanda · Elite Management'],
            ['Versión',         'V32.0.0'],
            ['Sucursales',      '4 (Azara, Fernando, Caacupé, La Fina)'],
            ['Base de datos',   'Supabase (nube)'],
            ['Módulos activos', 'Dashboard · POS · CRM · Caja · Saldos · Lab · Stock · Reportes'],
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
