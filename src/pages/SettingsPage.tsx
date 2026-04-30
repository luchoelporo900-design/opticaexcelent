import { useState } from 'react';
import { Settings, User, Shield, Bell, Glasses } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function SettingsPage() {
  const { profile, user } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    await supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl text-white font-light tracking-wider">Configuración</h1>
        <p className="text-sm font-light mt-1" style={{ color: 'rgba(197,160,89,0.7)' }}>
          Administración del sistema
        </p>
      </div>

      {/* Profile */}
      <div className="rounded-xl border p-5 space-y-4"
        style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(197,160,89,0.15)' }}>
        <div className="flex items-center gap-2 mb-3">
          <User size={14} style={{ color: '#C5A059' }} />
          <h2 className="text-sm font-light tracking-wider text-white">Mi Perfil</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs mb-1 font-light" style={{ color: 'rgba(197,160,89,0.6)' }}>Nombre completo</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-transparent text-white text-sm outline-none border"
              style={{ borderColor: 'rgba(197,160,89,0.25)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1 font-light" style={{ color: 'rgba(197,160,89,0.6)' }}>Email</label>
            <input value={user?.email || ''} disabled
              className="w-full px-3 py-2 rounded-lg text-sm outline-none border opacity-50"
              style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.5)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1 font-light" style={{ color: 'rgba(197,160,89,0.6)' }}>Rol</label>
            <input value={profile?.role || ''} disabled
              className="w-full px-3 py-2 rounded-lg text-sm outline-none border opacity-50 capitalize"
              style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.5)' }} />
          </div>
        </div>

        <button onClick={saveProfile} disabled={saving}
          className="px-4 py-2 rounded-lg text-xs text-black font-medium disabled:opacity-40 transition-all"
          style={{ background: saved ? '#10b981' : '#C5A059' }}>
          {saving ? 'Guardando...' : saved ? 'Guardado!' : 'Guardar cambios'}
        </button>
      </div>

      {/* System info */}
      <div className="rounded-xl border p-5 space-y-4"
        style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(197,160,89,0.15)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Glasses size={14} style={{ color: '#C5A059' }} />
          <h2 className="text-sm font-light tracking-wider text-white">Acerca del Sistema</h2>
        </div>

        <div className="space-y-3">
          {[
            { label: 'Sistema', value: 'Óptica Yolanda · Elite Management' },
            { label: 'Versión', value: 'V10.0.0' },
            { label: 'Sucursales activas', value: '4 (Azara, Fernando, Caacupé, La Fina)' },
            { label: 'Base de datos', value: 'Supabase PostgreSQL' },
            { label: 'Módulos', value: 'Dashboard · POS · CRM · Laboratorio · Simuladores' },
          ].map(item => (
            <div key={item.label} className="flex justify-between text-xs font-light py-2 border-b"
              style={{ borderColor: 'rgba(197,160,89,0.06)' }}>
              <span style={{ color: 'rgba(197,160,89,0.6)' }}>{item.label}</span>
              <span className="text-white">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-xl border text-xs font-light"
        style={{ borderColor: 'rgba(197,160,89,0.15)', background: 'rgba(197,160,89,0.04)' }}>
        <p style={{ color: 'rgba(197,160,89,0.8)' }}>Para crear nuevos usuarios y asignar roles, contacte al administrador del sistema.</p>
      </div>
    </div>
  );
}
