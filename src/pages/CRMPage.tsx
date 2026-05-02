import { useEffect, useState } from 'react';
import { Bell, MessageCircle, Search, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSales } from '../lib/salesStorage';

const LS_REMINDERS_KEY = 'optica_recordatorios';

type Reminder = {
  id: string;
  customer_name: string;
  customer_phone: string;
  sale_id: number;
  sale_number: string;
  seller_name: string;
  branch_name: string;
  reminder_type: '6_meses' | '12_meses';
  scheduled_date: string;
  status: 'pendiente' | 'enviado';
  sent_at?: string;
};

function getReminders(): Reminder[] {
  try { return JSON.parse(localStorage.getItem(LS_REMINDERS_KEY) || '[]'); }
  catch { return []; }
}

function saveReminders(list: Reminder[]) {
  localStorage.setItem(LS_REMINDERS_KEY, JSON.stringify(list));
}

function generateRemindersFromSales(): Reminder[] {
  const sales = getSales();
  const existing = getReminders();
  const existingIds = new Set(existing.map(r => r.id));
  const newOnes: Reminder[] = [];

  for (const v of sales) {
    const saleDate = new Date(v.fecha);
    const id6 = `${v.id}-6m`;
    const id12 = `${v.id}-12m`;

    if (!existingIds.has(id6)) {
      const d = new Date(saleDate);
      d.setMonth(d.getMonth() + 6);
      newOnes.push({
        id: id6,
        customer_name: `${v.cliente.nombre} ${v.cliente.apellido}`.trim(),
        customer_phone: v.cliente.telefono,
        sale_id: v.id,
        sale_number: `VTA-${v.id}`,
        seller_name: v.vendedora,
        branch_name: v.sucursalVenta,
        reminder_type: '6_meses',
        scheduled_date: d.toISOString().slice(0, 10),
        status: 'pendiente',
      });
    }

    if (!existingIds.has(id12)) {
      const d = new Date(saleDate);
      d.setMonth(d.getMonth() + 12);
      newOnes.push({
        id: id12,
        customer_name: `${v.cliente.nombre} ${v.cliente.apellido}`.trim(),
        customer_phone: v.cliente.telefono,
        sale_id: v.id,
        sale_number: `VTA-${v.id}`,
        seller_name: v.vendedora,
        branch_name: v.sucursalVenta,
        reminder_type: '6_meses' === '6_meses' ? '12_meses' : '12_meses',
        scheduled_date: d.toISOString().slice(0, 10),
        status: 'pendiente',
      });
    }
  }

  if (newOnes.length > 0) {
    const updated = [...existing, ...newOnes];
    saveReminders(updated);
    return updated;
  }
  return existing;
}

export default function CRMPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'gerente';

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filter, setFilter] = useState<'todos' | 'pendiente' | 'enviado'>('todos');
  const [typeFilter, setTypeFilter] = useState<'todos' | '6_meses' | '12_meses'>('todos');
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, [profile]);

  function load() {
    const all = generateRemindersFromSales();
    setReminders(all);
  }

  function markSent(id: string) {
    const updated = getReminders().map(r =>
      r.id === id ? { ...r, status: 'enviado' as const, sent_at: new Date().toISOString() } : r
    );
    saveReminders(updated);
    setReminders(updated);
  }

  function buildWhatsAppUrl(r: Reminder) {
    if (!r.customer_phone) return null;
    const clean = r.customer_phone.replace(/\D/g, '');
    const full = clean.startsWith('595') ? clean : `595${clean.replace(/^0/, '')}`;
    const months = r.reminder_type === '6_meses' ? 6 : 12;
    const msg = encodeURIComponent(
      `Hola ${r.customer_name.split(' ')[0]}! 👓\n\nTe saludamos desde *Óptica Yolanda*.\n\nYa pasaron *${months} meses* desde tu última consulta.\n\nEs momento de realizar tu control de vista.\n\n📍 Estamos disponibles en nuestras sucursales.\n\n¡Te esperamos!`
    );
    return `https://wa.me/${full}?text=${msg}`;
  }

  // Vendedora solo ve sus propios recordatorios
  const visible = isAdmin
    ? reminders
    : reminders.filter(r => r.seller_name === profile?.full_name);

  const filtered = visible.filter(r => {
    if (filter !== 'todos' && r.status !== filter) return false;
    if (typeFilter !== 'todos' && r.reminder_type !== typeFilter) return false;
    if (search && !r.customer_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const pending = visible.filter(r => r.status === 'pendiente').length;
  const overdue = visible.filter(r => r.status === 'pendiente' && new Date(r.scheduled_date) < new Date()).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl text-white font-light tracking-wider">CRM · Recordatorios</h1>
          <p className="text-sm font-light mt-1" style={{ color: 'rgba(197,160,89,0.7)' }}>
            {isAdmin ? 'Seguimiento de todas las sucursales' : `Mis recordatorios · ${profile?.full_name}`}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 rounded-lg border text-xs font-light"
            style={{ borderColor: 'rgba(245,158,11,0.3)', color: '#f59e0b', background: 'rgba(245,158,11,0.08)' }}>
            <Bell size={12} className="inline mr-1" />{pending} pendientes
          </div>
          {overdue > 0 && (
            <div className="px-4 py-2 rounded-lg border text-xs font-light"
              style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}>
              <Clock size={12} className="inline mr-1" />{overdue} vencidos
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(197,160,89,0.5)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
            className="pl-9 pr-4 py-2 rounded-lg text-xs bg-transparent text-white outline-none border"
            style={{ borderColor: 'rgba(197,160,89,0.25)', background: 'rgba(255,255,255,0.03)' }} />
        </div>
        <div className="flex gap-1">
          {(['todos', 'pendiente', 'enviado'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-light transition-all"
              style={{
                background: filter === f ? 'rgba(197,160,89,0.15)' : 'rgba(255,255,255,0.03)',
                color: filter === f ? '#C5A059' : 'rgba(255,255,255,0.4)',
                border: `1px solid ${filter === f ? 'rgba(197,160,89,0.3)' : 'rgba(255,255,255,0.08)'}`
              }}>
              {f === 'todos' ? 'Todos' : f === 'pendiente' ? 'Pendientes' : 'Enviados'}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['todos', '6_meses', '12_meses'] as const).map(f => (
            <button key={f} onClick={() => setTypeFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-light transition-all"
              style={{
                background: typeFilter === f ? 'rgba(197,160,89,0.15)' : 'rgba(255,255,255,0.03)',
                color: typeFilter === f ? '#C5A059' : 'rgba(255,255,255,0.4)',
                border: `1px solid ${typeFilter === f ? 'rgba(197,160,89,0.3)' : 'rgba(255,255,255,0.08)'}`
              }}>
              {f === 'todos' ? 'Todos' : f === '6_meses' ? '6 Meses' : '12 Meses'}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(197,160,89,0.15)' }}>
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Bell size={32} className="mx-auto mb-3 opacity-20" style={{ color: '#C5A059' }} />
            <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>No hay recordatorios para mostrar</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(197,160,89,0.1)' }}>
                {['Cliente', 'Teléfono', isAdmin ? 'Vendedora' : 'Sucursal', 'Tipo', 'Fecha', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-light tracking-wider uppercase"
                    style={{ color: 'rgba(197,160,89,0.6)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const waUrl = buildWhatsAppUrl(r);
                const isOverdue = r.status === 'pendiente' && new Date(r.scheduled_date) < new Date();
                return (
                  <tr key={r.id} className="border-b"
                    style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(197,160,89,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-4 py-3 text-white font-light">{r.customer_name}</td>
                    <td className="px-4 py-3 font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>{r.customer_phone || '—'}</td>
                    <td className="px-4 py-3 font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {isAdmin ? r.seller_name : r.branch_name}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-light"
                        style={{
                          background: r.reminder_type === '6_meses' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                          color: r.reminder_type === '6_meses' ? '#3b82f6' : '#10b981'
                        }}>
                        {r.reminder_type === '6_meses' ? '6 Meses' : '12 Meses'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-light" style={{ color: isOverdue ? '#ef4444' : 'rgba(255,255,255,0.5)' }}>
                      {new Date(r.scheduled_date).toLocaleDateString('es-PY')}
                      {isOverdue && <span className="ml-1 text-xs" style={{ color: '#ef4444' }}>· Vencido</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-xs font-light"
                        style={{
                          background: r.status === 'enviado' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                          color: r.status === 'enviado' ? '#10b981' : '#f59e0b'
                        }}>
                        {r.status === 'enviado' ? <CheckCircle size={10} /> : <Clock size={10} />}
                        {r.status === 'enviado' ? 'Enviado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {waUrl && (
                          <a href={waUrl} target="_blank" rel="noopener noreferrer"
                            onClick={() => r.status === 'pendiente' && markSent(r.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-light"
                            style={{ background: 'rgba(37,211,102,0.12)', color: '#25d366', border: '1px solid rgba(37,211,102,0.25)' }}>
                            <MessageCircle size={12} />WhatsApp
                          </a>
                        )}
                        {r.status === 'pendiente' && (
                          <button onClick={() => markSent(r.id)}
                            className="px-2 py-1.5 rounded-lg text-xs font-light"
                            style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>
                            <CheckCircle size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="p-4 rounded-xl border flex items-start gap-3"
        style={{ borderColor: 'rgba(37,211,102,0.2)', background: 'rgba(37,211,102,0.04)' }}>
        <MessageCircle size={16} className="mt-0.5 shrink-0" style={{ color: '#25d366' }} />
        <div>
          <p className="text-xs font-light text-white">Los recordatorios se generan automáticamente al registrar una venta.</p>
          <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Al hacer click en "WhatsApp", se abrirá WhatsApp con el mensaje pre-configurado. El recordatorio se marcará como enviado.
          </p>
        </div>
      </div>
    </div>
  );
}
