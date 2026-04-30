import { useEffect, useState } from 'react';
import { FlaskConical, Package, CheckCircle, Truck, Search, Clock, RefreshCw } from 'lucide-react';
import { supabase, LabOrder, Branch } from '../lib/supabase';

type LabOrderFull = LabOrder & {
  sales: { sale_number: string; customers: { full_name: string; ci: string } };
  branches: Branch;
};

const STATUS_FLOW: LabOrder['status'][] = ['enviado', 'proceso', 'listo', 'entregado'];

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  enviado: { label: 'Enviado al Lab', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: <Package size={14} /> },
  proceso: { label: 'En Proceso', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', icon: <RefreshCw size={14} /> },
  listo: { label: 'Listo / Retirar', color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: <CheckCircle size={14} /> },
  entregado: { label: 'Entregado', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: <Truck size={14} /> },
};

export default function LabPage() {
  const [orders, setOrders] = useState<LabOrderFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from('branches').select('*').then(({ data }) => setBranches(data || []));
    loadOrders();
  }, []);

  async function loadOrders() {
    const { data } = await supabase
      .from('lab_orders')
      .select('*, sales(sale_number, customers(full_name, ci)), branches(*)')
      .order('created_at', { ascending: false });
    setOrders((data || []) as LabOrderFull[]);
    setLoading(false);
  }

  async function updateStatus(id: string, status: LabOrder['status']) {
    setUpdating(id);
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === 'listo') updates.ready_date = new Date().toISOString();
    if (status === 'entregado') updates.delivered_date = new Date().toISOString();
    if (notes[id]) updates.notes = notes[id];
    await supabase.from('lab_orders').update(updates).eq('id', id);
    await loadOrders();
    setUpdating(null);
  }

  const filtered = orders.filter(o => {
    if (branchFilter !== 'todos' && o.branch_id !== branchFilter) return false;
    if (statusFilter !== 'todos' && o.status !== statusFilter) return false;
    if (search && !o.order_number.toLowerCase().includes(search.toLowerCase()) &&
      !o.sales?.customers?.full_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const countByStatus = (s: string) => orders.filter(o => o.status === s).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-white font-light tracking-wider">Panel de Laboratorio</h1>
          <p className="text-sm font-light mt-1" style={{ color: 'rgba(197,160,89,0.7)' }}>
            Seguimiento de pedidos · Todas las sucursales
          </p>
        </div>
        <button onClick={() => { setLoading(true); loadOrders(); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-light border transition-all"
          style={{ borderColor: 'rgba(197,160,89,0.3)', color: '#C5A059', background: 'rgba(197,160,89,0.08)' }}>
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* Status overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATUS_FLOW.map(s => {
          const cfg = statusConfig[s];
          const count = countByStatus(s);
          return (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? 'todos' : s)}
              className="p-4 rounded-xl border text-left transition-all"
              style={{
                background: statusFilter === s ? cfg.bg : 'rgba(255,255,255,0.02)',
                borderColor: statusFilter === s ? cfg.color + '60' : 'rgba(197,160,89,0.1)'
              }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: cfg.color }}>{cfg.icon}</div>
              <p className="text-2xl font-light text-white">{count}</p>
              <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{cfg.label}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(197,160,89,0.5)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar pedido o cliente..."
            className="pl-9 pr-4 py-2 rounded-lg text-xs bg-transparent text-white outline-none border"
            style={{ borderColor: 'rgba(197,160,89,0.25)', background: 'rgba(255,255,255,0.03)' }} />
        </div>
        <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs font-light bg-transparent text-white outline-none border"
          style={{ borderColor: 'rgba(197,160,89,0.25)', background: '#111' }}>
          <option value="todos">Todas las sucursales</option>
          {branches.map(b => <option key={b.id} value={b.id} style={{ background: '#111' }}>{b.name}</option>)}
        </select>
      </div>

      {/* Orders */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border p-12 text-center"
          style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(197,160,89,0.15)' }}>
          <FlaskConical size={32} className="mx-auto mb-3 opacity-20" style={{ color: '#C5A059' }} />
          <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>No hay pedidos para mostrar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const cfg = statusConfig[order.status];
            const isUpdating = updating === order.id;
            const currentIdx = STATUS_FLOW.indexOf(order.status);
            const nextStatus = STATUS_FLOW[currentIdx + 1];

            return (
              <div key={order.id} className="rounded-xl border p-4 transition-all"
                style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(197,160,89,0.1)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(197,160,89,0.25)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(197,160,89,0.1)')}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm font-light" style={{ color: '#C5A059' }}>{order.order_number}</span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-light"
                        style={{ background: cfg.bg, color: cfg.color }}>
                        {cfg.icon}{cfg.label}
                      </span>
                      {order.branches && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-light"
                          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                          {order.branches.name}
                        </span>
                      )}
                    </div>
                    <p className="text-white font-light text-sm mt-1">{order.sales?.customers?.full_name}</p>
                    <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Venta: {order.sales?.sale_number} · CI: {order.sales?.customers?.ci}
                    </p>

                    {/* Timeline */}
                    <div className="flex items-center gap-1 mt-3">
                      {STATUS_FLOW.map((s, i) => {
                        const done = STATUS_FLOW.indexOf(order.status) >= i;
                        return (
                          <div key={s} className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full transition-all"
                              style={{ background: done ? statusConfig[s].color : 'rgba(255,255,255,0.15)' }} />
                            {i < STATUS_FLOW.length - 1 && (
                              <div className="w-8 h-px"
                                style={{ background: done && i < STATUS_FLOW.indexOf(order.status) ? '#C5A059' : 'rgba(255,255,255,0.1)' }} />
                            )}
                          </div>
                        );
                      })}
                      <span className="text-xs ml-2 font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {new Date(order.created_at).toLocaleDateString('es-PY')}
                      </span>
                    </div>

                    {order.notes && (
                      <p className="text-xs mt-2 font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        Nota: {order.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {nextStatus && (
                      <button
                        onClick={() => updateStatus(order.id, nextStatus)}
                        disabled={isUpdating}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light transition-all disabled:opacity-50"
                        style={{
                          background: statusConfig[nextStatus].bg,
                          color: statusConfig[nextStatus].color,
                          border: `1px solid ${statusConfig[nextStatus].color}40`
                        }}>
                        {isUpdating ? <RefreshCw size={12} className="animate-spin" /> : statusConfig[nextStatus].icon}
                        {statusConfig[nextStatus].label} →
                      </button>
                    )}
                    <input
                      placeholder="Nota..."
                      value={notes[order.id] || order.notes}
                      onChange={e => setNotes(prev => ({ ...prev, [order.id]: e.target.value }))}
                      className="px-2 py-1 rounded text-xs bg-transparent text-white outline-none border"
                      style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
