import { useEffect, useState } from 'react';
import { Bell, MessageCircle, Search, CheckCircle, Clock, X, Filter } from 'lucide-react';
import { supabase, Reminder, Customer } from '../lib/supabase';

type ReminderWithCustomer = Reminder & { customers: Customer };

export default function CRMPage() {
  const [reminders, setReminders] = useState<ReminderWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todos' | 'pendiente' | 'enviado'>('todos');
  const [typeFilter, setTypeFilter] = useState<'todos' | '6_meses' | '12_meses'>('todos');
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => { loadReminders(); }, []);

  async function loadReminders() {
    const { data } = await supabase
      .from('reminders')
      .select('*, customers(*)')
      .order('scheduled_date', { ascending: true });
    setReminders((data || []) as ReminderWithCustomer[]);
    setLoading(false);
  }

  async function markSent(id: string) {
    setSending(id);
    await supabase.from('reminders').update({ status: 'enviado', sent_at: new Date().toISOString() }).eq('id', id);
    await loadReminders();
    setSending(null);
  }

  function buildWhatsAppUrl(reminder: ReminderWithCustomer) {
    const customer = reminder.customers;
    const phone = customer.whatsapp || customer.phone;
    if (!phone) return null;

    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('595') ? cleanPhone : `595${cleanPhone.replace(/^0/, '')}`;

    const months = reminder.reminder_type === '6_meses' ? 6 : 12;
    const message = encodeURIComponent(
      `Hola ${customer.full_name.split(' ')[0]}! 👓\n\nTe saludamos desde *Óptica Yolanda*.\n\nYa pasaron *${months} meses* desde tu última consulta.\n\nEs momento de realizar tu control de vista y verificar si tu graduación sigue siendo la correcta.\n\n📍 Estamos disponibles en nuestras 4 sucursales.\n📅 Podés agendarte cuando gustes.\n\n¡Te esperamos!`
    );

    return `https://wa.me/${fullPhone}?text=${message}`;
  }

  const filtered = reminders.filter(r => {
    if (filter !== 'todos' && r.status !== filter) return false;
    if (typeFilter !== 'todos' && r.reminder_type !== typeFilter) return false;
    if (search && !r.customers?.full_name.toLowerCase().includes(search.toLowerCase()) &&
      !r.customers?.ci?.includes(search)) return false;
    return true;
  });

  const pending = reminders.filter(r => r.status === 'pendiente').length;
  const overdue = reminders.filter(r => r.status === 'pendiente' && new Date(r.scheduled_date) < new Date()).length;

  const typeLabels: Record<string, string> = {
    '6_meses': '6 Meses',
    '12_meses': '12 Meses',
    'personalizado': 'Personalizado'
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-white font-light tracking-wider">CRM · Recordatorios</h1>
          <p className="text-sm font-light mt-1" style={{ color: 'rgba(197,160,89,0.7)' }}>
            Seguimiento y recordatorios automáticos por WhatsApp
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

      {/* Filters */}
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
              className="px-3 py-1.5 rounded-lg text-xs font-light transition-all capitalize"
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
              {f === 'todos' ? 'Todos' : typeLabels[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Reminders table */}
      <div className="rounded-xl border overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(197,160,89,0.15)' }}>
        {loading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Bell size={32} className="mx-auto mb-3 opacity-20" style={{ color: '#C5A059' }} />
            <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>No hay recordatorios para mostrar</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(197,160,89,0.1)' }}>
                {['Cliente', 'CI', 'Teléfono', 'Tipo', 'Fecha', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-light tracking-wider uppercase"
                    style={{ color: 'rgba(197,160,89,0.6)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(reminder => {
                const waUrl = buildWhatsAppUrl(reminder);
                const isOverdue = reminder.status === 'pendiente' && new Date(reminder.scheduled_date) < new Date();
                const isSending = sending === reminder.id;

                return (
                  <tr key={reminder.id} className="border-b transition-colors"
                    style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(197,160,89,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-4 py-3 text-white font-light">{reminder.customers?.full_name}</td>
                    <td className="px-4 py-3 font-light font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>{reminder.customers?.ci}</td>
                    <td className="px-4 py-3 font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {reminder.customers?.whatsapp || reminder.customers?.phone || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-light"
                        style={{
                          background: reminder.reminder_type === '6_meses' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                          color: reminder.reminder_type === '6_meses' ? '#3b82f6' : '#10b981'
                        }}>
                        {typeLabels[reminder.reminder_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-light" style={{ color: isOverdue ? '#ef4444' : 'rgba(255,255,255,0.5)' }}>
                      {new Date(reminder.scheduled_date).toLocaleDateString('es-PY')}
                      {isOverdue && <span className="ml-1 text-xs" style={{ color: '#ef4444' }}>· Vencido</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-xs font-light`}
                        style={{
                          background: reminder.status === 'enviado' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                          color: reminder.status === 'enviado' ? '#10b981' : '#f59e0b'
                        }}>
                        {reminder.status === 'enviado' ? <CheckCircle size={10} /> : <Clock size={10} />}
                        {reminder.status === 'enviado' ? 'Enviado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {waUrl && (
                          <a href={waUrl} target="_blank" rel="noopener noreferrer"
                            onClick={() => reminder.status === 'pendiente' && markSent(reminder.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-light transition-all"
                            style={{ background: 'rgba(37,211,102,0.12)', color: '#25d366', border: '1px solid rgba(37,211,102,0.25)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(37,211,102,0.2)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(37,211,102,0.12)')}>
                            <MessageCircle size={12} />
                            WhatsApp
                          </a>
                        )}
                        {reminder.status === 'pendiente' && (
                          <button onClick={() => markSent(reminder.id)} disabled={isSending}
                            className="px-2 py-1.5 rounded-lg text-xs font-light transition-all disabled:opacity-50"
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

      {/* WhatsApp info */}
      <div className="p-4 rounded-xl border flex items-start gap-3"
        style={{ borderColor: 'rgba(37,211,102,0.2)', background: 'rgba(37,211,102,0.04)' }}>
        <MessageCircle size={16} className="mt-0.5 shrink-0" style={{ color: '#25d366' }} />
        <div>
          <p className="text-xs font-light text-white">Los mensajes de WhatsApp se generan automáticamente al registrar una venta.</p>
          <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Al hacer click en "WhatsApp", se abrirá WhatsApp con el mensaje pre-configurado para enviar al cliente.
            El recordatorio se marcará como enviado automáticamente.
          </p>
        </div>
      </div>
    </div>
  );
}
