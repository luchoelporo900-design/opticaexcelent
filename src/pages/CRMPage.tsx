import { useEffect, useState } from 'react';
import { Bell, MessageCircle, Search, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

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

// Nombres que se consideran demo — se excluyen siempre
const DEMO_NAMES = ['cliente demo', 'vendedora demo', 'demo'];

function isDemo(name: string): boolean {
  const n = name.toLowerCase().trim();
  return DEMO_NAMES.some(d => n.includes(d));
}

function getReminders(): Reminder[] {
  try { return JSON.parse(localStorage.getItem(LS_REMINDERS_KEY) || '[]'); }
  catch { return []; }
}

function saveReminders(reminders: Reminder[]) {
  try {
    localStorage.setItem(LS_REMINDERS_KEY, JSON.stringify(reminders));
  } catch (e) {
    // Quota excedida: limpiar enviados viejos (más de 6 meses) y reintentar
    const seisM = Date.now() - 1000 * 60 * 60 * 24 * 180;
    const limpios = reminders.filter(r =>
      r.status !== 'enviado' || new Date(r.scheduled_date).getTime() > seisM
    );
    try {
      localStorage.setItem(LS_REMINDERS_KEY, JSON.stringify(limpios));
    } catch (e2) {
      // Si sigue fallando, guardar solo pendientes
      const soloP = reminders.filter(r => r.status !== 'enviado');
      try { localStorage.setItem(LS_REMINDERS_KEY, JSON.stringify(soloP)); } catch {}
    }
  }
}

export default function CRMPage() {
  const { profile } = useAuth();
  const { sales: allSales } = useData();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'gerente';

  const [reminders,   setReminders]   = useState<Reminder[]>([]);
  const [filter,      setFilter]      = useState<'todos' | 'pendiente' | 'enviado'>('pendiente');
  const [typeFilter,  setTypeFilter]  = useState<'todos' | '6_meses' | '12_meses'>('todos');
  const [search,      setSearch]      = useState('');
  const [activeTab,   setActiveTab]   = useState<'6_meses' | '12_meses' | 'todos'>('todos');

  useEffect(() => { load(); }, [allSales]);

  function load() {
    const existing   = getReminders();
    const existingIds = new Set(existing.map(r => r.id));
    const newOnes: Reminder[] = [];

    for (const v of allSales) {
      // Saltar ventas demo
      const fullName = `${v.cliente.nombre} ${v.cliente.apellido}`.trim();
      if (isDemo(fullName)) continue;
      if (isDemo(v.vendedora || '')) continue;
      // Saltar si no tiene nombre real
      if (!v.cliente.nombre?.trim() || !v.cliente.apellido?.trim()) continue;

      const saleDate = new Date(v.fecha);
      const id6  = `${v.id}-6m`;
      const id12 = `${v.id}-12m`;

      if (!existingIds.has(id6)) {
        const d = new Date(saleDate);
        d.setMonth(d.getMonth() + 6);
        newOnes.push({
          id: id6,
          customer_name:  fullName,
          customer_phone: v.cliente.telefono || '',
          sale_id:        v.id,
          sale_number:    `VTA-${v.id}`,
          seller_name:    v.vendedora || '',
          branch_name:    v.sucursalVenta || '',
          reminder_type:  '6_meses',
          scheduled_date: d.toISOString().slice(0, 10),
          status:         'pendiente',
        });
      }

      if (!existingIds.has(id12)) {
        const d = new Date(saleDate);
        d.setMonth(d.getMonth() + 12);
        newOnes.push({
          id: id12,
          customer_name:  fullName,
          customer_phone: v.cliente.telefono || '',
          sale_id:        v.id,
          sale_number:    `VTA-${v.id}`,
          seller_name:    v.vendedora || '',
          branch_name:    v.sucursalVenta || '',
          reminder_type:  '12_meses',
          scheduled_date: d.toISOString().slice(0, 10),
          status:         'pendiente',
        });
      }
    }

    const updated = newOnes.length > 0 ? [...existing, ...newOnes] : existing;
    if (newOnes.length > 0) saveReminders(updated);

    // Filtrar demos de los ya guardados también
    const clean = updated.filter(r => !isDemo(r.customer_name) && !isDemo(r.seller_name));
    setReminders(clean);
  }

  function markSent(id: string) {
    const updated = getReminders().map(r =>
      r.id === id ? { ...r, status: 'enviado' as const, sent_at: new Date().toISOString() } : r
    );
    saveReminders(updated);
    setReminders(updated.filter(r => !isDemo(r.customer_name) && !isDemo(r.seller_name)));
  }

  function buildWhatsAppUrl(r: Reminder) {
    if (!r.customer_phone) return null;
    const clean = r.customer_phone.replace(/\D/g, '');
    const full  = clean.startsWith('595') ? clean : `595${clean.replace(/^0/, '')}`;
    const months = r.reminder_type === '6_meses' ? 6 : 12;
    const msg = encodeURIComponent(
      `Hola ${r.customer_name.split(' ')[0]}! 👓\n\nTe saludamos desde *Óptica Excelent*.\n\nYa pasaron *${months} meses* desde tu última consulta.\n\nEs momento de realizar tu control de vista. 😊\n\n📍 Estamos disponibles en nuestras sucursales.\n\n¡Te esperamos!`
    );
    return `https://wa.me/${full}?text=${msg}`;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Solo mostrar recordatorios cuya fecha ya llegó o está próxima (dentro de 30 días)
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + 30);

  const visible = reminders.filter(r => {
    // Vendedora solo ve los suyos
    if (!isAdmin && r.seller_name !== profile?.full_name) return false;
    return true;
  });

  // Recordatorios que YA llegó su fecha (hoy o antes) — son los que hay que contactar
  const dueNow = visible.filter(r => new Date(r.scheduled_date) <= windowEnd);

  const filtered = dueNow.filter(r => {
    if (filter !== 'todos' && r.status !== filter) return false;
    if (activeTab !== 'todos' && r.reminder_type !== activeTab) return false;
    if (typeFilter !== 'todos' && r.reminder_type !== typeFilter) return false;
    if (search && !r.customer_name.toLowerCase().includes(search.toLowerCase()) &&
        !r.customer_phone.includes(search)) return false;
    return true;
  });

  // Separar por tipo
  const por6meses  = filtered.filter(r => r.reminder_type === '6_meses');
  const por12meses = filtered.filter(r => r.reminder_type === '12_meses');

  const pendingCount  = dueNow.filter(r => r.status === 'pendiente').length;
  const overdueCount  = dueNow.filter(r => r.status === 'pendiente' && new Date(r.scheduled_date) < today).length;

  function ReminderTable({ list }: { list: Reminder[] }) {
    if (list.length === 0) return (
      <div className="text-center py-10">
        <Bell size={28} style={{ color: 'rgba(197,160,89,0.2)', margin: '0 auto 10px' }} />
        <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.28)' }}>No hay recordatorios para mostrar</p>
      </div>
    );

    return (
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
          {list.map(r => {
            const waUrl    = buildWhatsAppUrl(r);
            const rDate    = new Date(r.scheduled_date);
            const isOverdue = r.status === 'pendiente' && rDate < today;
            const isToday   = rDate.toDateString() === today.toDateString();
            return (
              <tr key={r.id} className="border-b"
                style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(197,160,89,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td className="px-4 py-3 text-white font-light">{r.customer_name}</td>
                <td className="px-4 py-3 font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {r.customer_phone || '—'}
                </td>
                <td className="px-4 py-3 font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {isAdmin ? r.seller_name : r.branch_name}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-light"
                    style={{
                      background: r.reminder_type === '6_meses' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                      color:      r.reminder_type === '6_meses' ? '#3b82f6' : '#10b981',
                    }}>
                    {r.reminder_type === '6_meses' ? '6 Meses' : '12 Meses'}
                  </span>
                </td>
                <td className="px-4 py-3 font-light" style={{ color: isOverdue ? '#ef4444' : isToday ? '#f59e0b' : 'rgba(255,255,255,0.5)' }}>
                  {rDate.toLocaleDateString('es-PY')}
                  {isOverdue && <span className="ml-1" style={{ color: '#ef4444' }}>· Vencido</span>}
                  {isToday   && <span className="ml-1" style={{ color: '#f59e0b' }}>· Hoy</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-xs font-light"
                    style={{
                      background: r.status === 'enviado' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                      color:      r.status === 'enviado' ? '#10b981' : '#f59e0b',
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
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl text-white font-light tracking-wider">CRM · Recordatorios</h1>
          <p className="text-sm font-light mt-1" style={{ color: 'rgba(197,160,89,0.7)' }}>
            {isAdmin ? 'Seguimiento de todas las sucursales' : `Mis recordatorios · ${profile?.full_name}`}
          </p>
        </div>
        <div className="flex gap-3 items-center">
          {pendingCount > 0 && (
            <div className="px-4 py-2 rounded-lg border text-xs font-light"
              style={{ borderColor: 'rgba(245,158,11,0.3)', color: '#f59e0b', background: 'rgba(245,158,11,0.08)' }}>
              <Bell size={12} className="inline mr-1" />{pendingCount} pendientes
            </div>
          )}
          {overdueCount > 0 && (
            <div className="px-4 py-2 rounded-lg border text-xs font-light"
              style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}>
              <Clock size={12} className="inline mr-1" />{overdueCount} vencidos
            </div>
          )}
          <button onClick={load}
            className="p-2 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(197,160,89,0.5)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente o teléfono..."
            className="pl-9 pr-4 py-2 rounded-lg text-xs bg-transparent text-white outline-none border"
            style={{ borderColor: 'rgba(197,160,89,0.25)', background: 'rgba(255,255,255,0.03)' }} />
        </div>
        <div className="flex gap-1">
          {(['todos', 'pendiente', 'enviado'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-light"
              style={{
                background: filter === f ? 'rgba(197,160,89,0.15)' : 'rgba(255,255,255,0.03)',
                color:      filter === f ? '#C5A059' : 'rgba(255,255,255,0.4)',
                border:     `1px solid ${filter === f ? 'rgba(197,160,89,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}>
              {f === 'todos' ? 'Todos' : f === 'pendiente' ? 'Pendientes' : 'Enviados'}
            </button>
          ))}
        </div>
      </div>

      {/* Aviso de ventana */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-light"
        style={{ background: 'rgba(197,160,89,0.05)', border: '1px solid rgba(197,160,89,0.15)', color: 'rgba(197,160,89,0.7)' }}>
        <Bell size={12} />
        Mostrando clientes que cumplen 6 o 12 meses desde su compra — hoy y los próximos 30 días.
      </div>

      {/* Tabs 6 meses / 12 meses */}
      <div className="space-y-6">

        {/* ── 6 MESES ── */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(59,130,246,0.2)' }}>
          <div className="flex items-center gap-3 px-5 py-3.5"
            style={{ background: 'rgba(59,130,246,0.05)', borderBottom: '1px solid rgba(59,130,246,0.12)' }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#3b82f6' }} />
            <span className="text-sm font-light text-white tracking-wide">Recordatorios 6 meses</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
              {por6meses.length} clientes
            </span>
            <span className="text-xs font-light ml-auto" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Compraron hace ~6 meses
            </span>
          </div>
          <ReminderTable list={por6meses} />
        </div>

        {/* ── 12 MESES ── */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(16,185,129,0.2)' }}>
          <div className="flex items-center gap-3 px-5 py-3.5"
            style={{ background: 'rgba(16,185,129,0.05)', borderBottom: '1px solid rgba(16,185,129,0.12)' }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#10b981' }} />
            <span className="text-sm font-light text-white tracking-wide">Recordatorios 12 meses</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
              {por12meses.length} clientes
            </span>
            <span className="text-xs font-light ml-auto" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Compraron hace ~12 meses
            </span>
          </div>
          <ReminderTable list={por12meses} />
        </div>

      </div>

      {/* Info */}
      <div className="p-4 rounded-xl border flex items-start gap-3"
        style={{ borderColor: 'rgba(37,211,102,0.2)', background: 'rgba(37,211,102,0.04)' }}>
        <MessageCircle size={16} className="mt-0.5 shrink-0" style={{ color: '#25d366' }} />
        <div>
          <p className="text-xs font-light text-white">Los recordatorios se generan automáticamente al registrar una venta.</p>
          <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Al hacer click en "WhatsApp" se abrirá con el mensaje pre-configurado y el recordatorio se marcará como enviado.
          </p>
        </div>
      </div>
    </div>
  );
}
