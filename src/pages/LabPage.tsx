import { useEffect, useState } from 'react';
import { FlaskConical, Package, CheckCircle, Truck, Search, RefreshCw, MessageCircle } from 'lucide-react';
import { getSales } from '../lib/salesStorage';
import { useAuth } from '../context/AuthContext';

const LS_LAB_KEY  = 'optica_lab_orders';
const SUCURSALES  = ['Azara', 'Fernando', 'Caacupé', 'La Fina'];

type LabStatus = 'enviado' | 'proceso' | 'listo' | 'entregado';

type LabOrder = {
  id: string;
  sale_id: number;
  sale_number: string;
  customer_name: string;
  customer_phone: string;
  seller_name: string;
  branch_name: string;
  status: LabStatus;
  notes: string;
  created_at: string;
  updated_at: string;
  anteojos: any[];
};

const STATUS_FLOW: LabStatus[] = ['enviado', 'proceso', 'listo', 'entregado'];

const statusConfig: Record<LabStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  enviado:   { label: 'Enviado al Lab',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: <Package     size={14} /> },
  proceso:   { label: 'En Proceso',      color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  icon: <RefreshCw   size={14} /> },
  listo:     { label: 'Listo / Retirar', color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: <CheckCircle size={14} /> },
  entregado: { label: 'Entregado',       color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: <Truck       size={14} /> },
};

function getLabOrders(): LabOrder[] {
  try { return JSON.parse(localStorage.getItem(LS_LAB_KEY) || '[]'); }
  catch { return []; }
}

function saveLabOrders(orders: LabOrder[]) {
  localStorage.setItem(LS_LAB_KEY, JSON.stringify(orders));
}

function generateLabOrdersFromSales(): LabOrder[] {
  const sales    = getSales();
  const existing = getLabOrders();
  const existingIds = new Set(existing.map(o => o.id));
  const newOnes: LabOrder[] = [];

  for (const v of sales) {
    const id = `lab-${v.id}`;
    if (!existingIds.has(id)) {
      newOnes.push({
        id,
        sale_id:       v.id,
        sale_number:   `VTA-${v.id}`,
        customer_name: `${v.cliente.nombre} ${v.cliente.apellido}`.trim(),
        customer_phone: v.cliente.telefono || '',
        seller_name:   v.vendedora,
        branch_name:   v.sucursalVenta,
        status:        'enviado',
        notes:         String(v.observaciones || ''),
        created_at:    v.fecha,
        updated_at:    v.fecha,
        anteojos:      (v.anteojos as any[]) || [],
      });
    }
  }

  if (newOnes.length > 0) {
    const updated = [...existing, ...newOnes];
    saveLabOrders(updated);
    return updated;
  }
  return existing;
}

function buildWhatsAppUrl(phone: string, customerName: string) {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, '');
  const full  = clean.startsWith('595') ? clean : `595${clean.replace(/^0/, '')}`;
  const msg   = encodeURIComponent(
    `Hola ${customerName.split(' ')[0]}! 👓\n\nTe saludamos desde *Óptica Yolanda*.\n\n✅ Tu pedido ya está *listo para retirar*.\n\nPodés pasar por nuestra sucursal cuando gustes.\n\n¡Te esperamos!`
  );
  return `https://wa.me/${full}?text=${msg}`;
}

export default function LabPage() {
  const { profile } = useAuth();
  const isLab      = profile?.role === 'laboratorio';
  const isAdmin    = profile?.role === 'admin' || profile?.role === 'gerente';
  const isVendedora = profile?.role === 'vendedora';

  const [orders,       setOrders]       = useState<LabOrder[]>([]);
  const [branchFilter, setBranchFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [search,       setSearch]       = useState('');
  const [notes,        setNotes]        = useState<Record<string, string>>({});
  const [expandedId,   setExpandedId]   = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  function load() {
    setOrders(generateLabOrdersFromSales());
  }

  function updateStatus(id: string, status: LabStatus) {
    const updated = getLabOrders().map(o =>
      o.id === id ? { ...o, status, updated_at: new Date().toISOString(), notes: notes[id] ?? o.notes } : o
    );
    saveLabOrders(updated);
    setOrders(updated);
  }

  // Filtro por rol
  const roleFiltered = orders.filter(o => {
    if (isVendedora) return o.seller_name === profile?.full_name;
    // Lab y admin ven todo
    return true;
  });

  // Vendedora solo ve hasta "listo" (no ve "entregado")
  const visibleStatuses = isVendedora
    ? ['enviado', 'proceso', 'listo']
    : STATUS_FLOW;

  const filtered = roleFiltered.filter(o => {
    if (!visibleStatuses.includes(o.status)) return false;
    if (branchFilter !== 'todos' && o.branch_name !== branchFilter) return false;
    if (statusFilter !== 'todos' && o.status !== statusFilter) return false;
    if (search && !o.sale_number.toLowerCase().includes(search.toLowerCase()) &&
        !o.customer_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const countByStatus = (s: string) => roleFiltered.filter(o => o.status === s).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl text-white font-light tracking-wider">Panel de Laboratorio</h1>
          <p className="text-sm font-light mt-1" style={{ color: 'rgba(197,160,89,0.7)' }}>
            {isVendedora
              ? `Mis pedidos · ${profile?.full_name}`
              : 'Seguimiento de pedidos · Todas las sucursales'}
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-light border"
          style={{ borderColor: 'rgba(197,160,89,0.3)', color: '#C5A059', background: 'rgba(197,160,89,0.08)' }}>
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(isVendedora ? ['enviado', 'proceso', 'listo'] : STATUS_FLOW).map(s => {
          const cfg   = statusConfig[s as LabStatus];
          const count = countByStatus(s);
          return (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? 'todos' : s)}
              className="p-4 rounded-xl border text-left transition-all"
              style={{
                background:   statusFilter === s ? cfg.bg : 'rgba(255,255,255,0.02)',
                borderColor:  statusFilter === s ? cfg.color + '60' : 'rgba(197,160,89,0.1)',
              }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: cfg.color }}>{cfg.icon}</div>
              <p className="text-2xl font-light text-white">{count}</p>
              <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{cfg.label}</p>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(197,160,89,0.5)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar pedido o cliente..."
            className="pl-9 pr-4 py-2 rounded-lg text-xs bg-transparent text-white outline-none border"
            style={{ borderColor: 'rgba(197,160,89,0.25)', background: 'rgba(255,255,255,0.03)' }} />
        </div>
        {(isLab || isAdmin) && (
          <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-xs font-light bg-transparent text-white outline-none border"
            style={{ borderColor: 'rgba(197,160,89,0.25)', background: '#111' }}>
            <option value="todos">Todas las sucursales</option>
            {SUCURSALES.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
          </select>
        )}
      </div>

      {/* Órdenes */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border p-12 text-center"
          style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(197,160,89,0.15)' }}>
          <FlaskConical size={32} className="mx-auto mb-3 opacity-20" style={{ color: '#C5A059' }} />
          <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>No hay pedidos para mostrar</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(order => {
            const cfg        = statusConfig[order.status];
            const currentIdx = STATUS_FLOW.indexOf(order.status);
            const nextStatus = STATUS_FLOW[currentIdx + 1];
            const isExp      = expandedId === order.id;
            const waUrl      = order.status === 'listo' ? buildWhatsAppUrl(order.customer_phone, order.customer_name) : null;

            return (
              <div key={order.id} className="rounded-xl border overflow-hidden"
                style={{
                  background:  'rgba(255,255,255,0.02)',
                  borderColor: order.status === 'listo' ? 'rgba(16,185,129,0.4)' : 'rgba(197,160,89,0.1)',
                  boxShadow:   order.status === 'listo' ? '0 0 20px rgba(16,185,129,0.08)' : 'none',
                }}>

                {/* Fila principal */}
                <div className="flex items-start justify-between gap-4 p-4 cursor-pointer"
                  onClick={() => setExpandedId(isExp ? null : order.id)}>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm font-light" style={{ color: '#C5A059' }}>{order.sale_number}</span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-light"
                        style={{ background: cfg.bg, color: cfg.color }}>
                        {cfg.icon}{cfg.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-light"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                        {order.branch_name}
                      </span>
                      {(isLab || isAdmin) && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-light"
                          style={{ background: 'rgba(197,160,89,0.08)', color: 'rgba(197,160,89,0.7)' }}>
                          {order.seller_name}
                        </span>
                      )}
                    </div>
                    <p className="text-white font-light text-sm mt-1">{order.customer_name}</p>
                    {order.customer_phone && (
                      <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        📞 {order.customer_phone}
                      </p>
                    )}
                    <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {new Date(order.created_at).toLocaleDateString('es-PY')}
                    </p>

                    {/* Timeline */}
                    <div className="flex items-center gap-1 mt-3">
                      {STATUS_FLOW.map((s, i) => {
                        const done = STATUS_FLOW.indexOf(order.status) >= i;
                        return (
                          <div key={s} className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full transition-all"
                              style={{ background: done ? statusConfig[s as LabStatus].color : 'rgba(255,255,255,0.15)' }} />
                            {i < STATUS_FLOW.length - 1 && (
                              <div className="w-8 h-px"
                                style={{ background: done && i < STATUS_FLOW.indexOf(order.status) ? '#C5A059' : 'rgba(255,255,255,0.1)' }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {/* WhatsApp cuando listo */}
                    {waUrl && (
                      <a href={waUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                        style={{ background: 'rgba(37,211,102,0.15)', color: '#25d366', border: '1px solid rgba(37,211,102,0.35)' }}>
                        <MessageCircle size={13} />Avisar cliente
                      </a>
                    )}

                    {/* Avanzar estado — solo lab y admin */}
                    {(isLab || isAdmin) && nextStatus && (
                      <button onClick={e => { e.stopPropagation(); updateStatus(order.id, nextStatus); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light transition-all"
                        style={{
                          background:  statusConfig[nextStatus].bg,
                          color:       statusConfig[nextStatus].color,
                          border:      `1px solid ${statusConfig[nextStatus].color}40`,
                        }}>
                        {statusConfig[nextStatus].icon}
                        {statusConfig[nextStatus].label} →
                      </button>
                    )}

                    {(isLab || isAdmin) && (
                      <input placeholder="Nota..."
                        value={notes[order.id] ?? order.notes}
                        onChange={e => setNotes(prev => ({ ...prev, [order.id]: e.target.value }))}
                        onClick={e => e.stopPropagation()}
                        className="px-2 py-1 rounded text-xs bg-transparent text-white outline-none border"
                        style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                    )}
                  </div>
                </div>

                {/* Panel expandido — detalles del lente */}
                {isExp && order.anteojos.length > 0 && (
                  <div className="border-t px-4 py-4 space-y-4"
                    style={{ borderColor: 'rgba(197,160,89,0.1)', background: 'rgba(197,160,89,0.02)' }}>
                    <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.6)' }}>
                      Detalle del pedido
                    </p>
                    {order.anteojos.map((eg: any, i: number) => (
                      <div key={i} className="rounded-xl p-4 space-y-3"
                        style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(197,160,89,0.12)' }}>

                        <div className="flex items-start gap-3">
                          {/* Foto armazón */}
                          {eg.photo_url ? (
                            <img src={eg.photo_url} alt="armazón"
                              className="w-20 h-16 object-cover rounded-lg border shrink-0 cursor-pointer"
                              style={{ borderColor: 'rgba(197,160,89,0.3)' }}
                              onClick={() => window.open(eg.photo_url, '_blank')} />
                          ) : (
                            <div className="w-20 h-16 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(197,160,89,0.1)' }}>
                              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Sin foto</span>
                            </div>
                          )}

                          <div className="flex-1 space-y-1">
                            <p className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.7)' }}>
                              Anteojo {i + 1}
                            </p>
                            {eg.frame_description && (
                              <p className="text-sm text-white font-light">{eg.frame_description}</p>
                            )}
                            <div className="flex gap-2 flex-wrap mt-1">
                              {eg.crystals && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-light"
                                  style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
                                  {eg.crystals}
                                </span>
                              )}
                              {eg.treatments && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-light"
                                  style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                                  {eg.treatments}
                                </span>
                              )}
                              {eg.price && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-light"
                                  style={{ background: 'rgba(197,160,89,0.1)', color: '#C5A059' }}>
                                  Gs. {Number(eg.price).toLocaleString('es-PY')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Receta */}
                        {eg.showReceta && eg.prescription && (
                          <div className="rounded-lg p-3 space-y-3"
                            style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.12)' }}>
                            <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.6)' }}>
                              Receta óptica
                            </p>

                            {/* OD */}
                            <div>
                              <p className="text-xs font-light mb-1.5" style={{ color: '#C5A059' }}>OD — Ojo Derecho</p>
                              <div className="grid grid-cols-4 gap-2">
                                {[
                                  { label: 'Esfera',   val: eg.prescription.od_esfera },
                                  { label: 'Cilindro', val: eg.prescription.od_cilindro },
                                  { label: 'Eje',      val: eg.prescription.od_eje },
                                  { label: 'Altura',   val: eg.prescription.od_altura },
                                ].map(f => (
                                  <div key={f.label} className="text-center">
                                    <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{f.label}</p>
                                    <div className="px-2 py-1.5 rounded-lg text-xs font-mono text-center"
                                      style={{ background: 'rgba(255,255,255,0.05)', color: f.val ? '#fff' : 'rgba(255,255,255,0.2)' }}>
                                      {f.val || '—'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* OI */}
                            <div>
                              <p className="text-xs font-light mb-1.5" style={{ color: '#C5A059' }}>OI — Ojo Izquierdo</p>
                              <div className="grid grid-cols-4 gap-2">
                                {[
                                  { label: 'Esfera',   val: eg.prescription.oi_esfera },
                                  { label: 'Cilindro', val: eg.prescription.oi_cilindro },
                                  { label: 'Eje',      val: eg.prescription.oi_eje },
                                  { label: 'Altura',   val: eg.prescription.oi_altura },
                                ].map(f => (
                                  <div key={f.label} className="text-center">
                                    <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{f.label}</p>
                                    <div className="px-2 py-1.5 rounded-lg text-xs font-mono text-center"
                                      style={{ background: 'rgba(255,255,255,0.05)', color: f.val ? '#fff' : 'rgba(255,255,255,0.2)' }}>
                                      {f.val || '—'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* ADD / DP / Obs */}
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { label: 'ADD', val: eg.prescription.add },
                                { label: 'DP',  val: eg.prescription.dp  },
                                { label: 'Obs', val: eg.prescription.obs },
                              ].map(f => (
                                <div key={f.label} className="text-center">
                                  <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{f.label}</p>
                                  <div className="px-2 py-1.5 rounded-lg text-xs font-mono"
                                    style={{ background: 'rgba(255,255,255,0.05)', color: f.val ? '#fff' : 'rgba(255,255,255,0.2)' }}>
                                    {f.val || '—'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
