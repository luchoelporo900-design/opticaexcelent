import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Search, CheckCircle, Package, MessageCircle, ChevronDown, Printer, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const SUCURSALES = ['Azara', 'Fernando', 'Caacupé', 'La Fina'];

type LabStatus = 'enviado' | 'proceso' | 'listo' | 'entregado';

type LabHistoryEntry = {
  status: LabStatus;
  timestamp: string;
  by: string;
};

type LabOrder = {
  id: string;
  sale_id: number;
  sale_number: string;
  customer_name: string;
  customer_phone: string;
  customer_ci: string;
  seller_name: string;
  seller_phone?: string;
  branch_name: string;
  status: LabStatus;
  notes: string;
  created_at: string;
  updated_at: string;
  anteojos: any[];
  history: LabHistoryEntry[];
};

const STATUS_FLOW: LabStatus[] = ['enviado', 'proceso', 'listo', 'entregado'];

const statusConfig: Record<LabStatus, { label: string; color: string; bg: string }> = {
  enviado:   { label: 'Enviado al Lab',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  proceso:   { label: 'En Proceso',      color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
  listo:     { label: 'Listo / Retirar', color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  entregado: { label: 'Entregado',       color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function buildWhatsAppUrlForSeller(sellerPhone: string, sellerName: string, customerName: string, saleNumber: string) {
  if (!sellerPhone) return null;
  const clean = sellerPhone.replace(/\D/g, '');
  const full  = clean.startsWith('595') ? clean : `595${clean.replace(/^0/, '')}`;
  const msg   = encodeURIComponent(
    `Hola ${sellerName.split(' ')[0]}! 🔬\n\n` +
    `El trabajo de *${customerName}* (${saleNumber}) ya está *listo para retirar*.\n\n` +
    `Podés coordinar la entrega con el cliente. ✅`
  );
  return `https://wa.me/${full}?text=${msg}`;
}

function printOrders(orders: LabOrder[]) {
  const now = new Date().toLocaleString('es-PY');
  const rows = orders.map((o) => {
    const statusLabel = statusConfig[o.status]?.label ?? o.status;
    const fecha = new Date(o.created_at).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const lentes = o.anteojos.map((eg: any, i: number) => {
      const receta = (eg.showReceta && eg.prescription) ? `
        <div style="margin-top:6px;padding:6px 8px;border:1px solid #ccc;border-radius:4px;font-size:11px;">
          <strong>Receta óptica</strong><br/>
          <table style="width:100%;margin-top:4px;border-collapse:collapse;">
            <tr>
              <td style="padding:2px 6px;font-weight:600;color:#555;">OD</td>
              <td style="padding:2px 4px;">Esf: <strong>${eg.prescription.od_esfera || '—'}</strong></td>
              <td style="padding:2px 4px;">Cil: <strong>${eg.prescription.od_cilindro || '—'}</strong></td>
              <td style="padding:2px 4px;">Eje: <strong>${eg.prescription.od_eje || '—'}</strong></td>
            </tr>
            <tr>
              <td style="padding:2px 6px;font-weight:600;color:#555;">OI</td>
              <td style="padding:2px 4px;">Esf: <strong>${eg.prescription.oi_esfera || '—'}</strong></td>
              <td style="padding:2px 4px;">Cil: <strong>${eg.prescription.oi_cilindro || '—'}</strong></td>
              <td style="padding:2px 4px;">Eje: <strong>${eg.prescription.oi_eje || '—'}</strong></td>
            </tr>
          </table>
          ${eg.prescription.add ? `<span style="margin-right:10px;">ADD: <strong>${eg.prescription.add}</strong></span>` : ''}
          ${eg.prescription.dp  ? `<span>DP: <strong>${eg.prescription.dp}</strong></span>` : ''}
        </div>` : '';
      return `
        <div style="margin-top:8px;padding:8px;border:1px solid #e0d8c8;border-radius:4px;background:#fffdf7;">
          <strong style="font-size:12px;">Armazón ${i + 1}</strong>
          ${eg.frame_description ? `<div style="font-size:12px;margin-top:2px;">${eg.frame_description}</div>` : ''}
          ${eg.crystals   ? `<div style="font-size:11px;color:#3b82f6;margin-top:2px;">Cristales: ${eg.crystals}</div>` : ''}
          ${eg.treatments ? `<div style="font-size:11px;color:#10b981;margin-top:2px;">Tratamientos: ${eg.treatments}</div>` : ''}
          ${receta}
        </div>`;
    }).join('');
    return `
      <div style="page-break-inside:avoid;margin-bottom:16px;padding:12px 14px;border:1px solid #c8b87a;border-radius:8px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
          <div>
            <span style="font-family:monospace;font-size:13px;color:#8a6a00;font-weight:600;">${o.sale_number}</span>
            <span style="margin-left:8px;font-size:11px;padding:2px 8px;border-radius:20px;background:#f3ead8;color:#8a6a00;">${statusLabel}</span>
            <span style="margin-left:6px;font-size:11px;color:#666;">${o.branch_name}</span>
          </div>
          <div style="font-size:11px;color:#888;">${fecha}</div>
        </div>
        <div style="margin-top:6px;">
          <strong style="font-size:14px;">${o.customer_name}</strong>
          ${o.customer_ci    ? `<span style="margin-left:10px;font-size:11px;color:#8a6a00;">CI: ${o.customer_ci}</span>` : ''}
          ${o.customer_phone ? `<span style="margin-left:10px;font-size:11px;color:#666;">📞 ${o.customer_phone}</span>` : ''}
        </div>
        <div style="font-size:11px;color:#888;margin-top:2px;">Vendedora: ${o.seller_name}</div>
        ${lentes}
        ${o.notes ? `<div style="margin-top:8px;font-size:11px;color:#666;padding:6px 8px;background:#f9f9f9;border-radius:4px;">📝 ${o.notes}</div>` : ''}
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Laboratorio — Óptica Yolanda</title>
  <style>*{box-sizing:border-box;}body{font-family:Arial,sans-serif;color:#111;margin:0;padding:20px;background:#fff;}@media print{body{padding:10px;}.no-print{display:none!important;}}</style>
  </head><body>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #c8b87a;">
    <div><h1 style="margin:0;font-size:20px;color:#8a6a00;">🔬 Óptica Yolanda</h1>
    <p style="margin:4px 0 0;font-size:13px;color:#555;">Panel de Laboratorio · ${orders.length} pedido${orders.length !== 1 ? 's' : ''}</p></div>
    <div style="text-align:right;font-size:11px;color:#888;">Impreso el ${now}</div>
  </div>${rows}
  <div class="no-print" style="margin-top:20px;text-align:center;">
    <button onclick="window.print()" style="padding:10px 24px;background:#8a6a00;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">🖨️ Imprimir ahora</button>
  </div></body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

export default function LabPage() {
  const { profile } = useAuth();
  const isLab       = profile?.role === 'laboratorio';
  const isAdmin     = profile?.role === 'admin' || profile?.role === 'gerente';
  const isVendedora = profile?.role === 'vendedora';

  const [orders,       setOrders]       = useState<LabOrder[]>([]);
  const [branchFilter, setBranchFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [sellerFilter, setSellerFilter] = useState('todos');
  const [search,       setSearch]       = useState('');
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [notes,        setNotes]        = useState<Record<string, string>>({});
  const [lightbox,     setLightbox]     = useState<string | null>(null);
  const [loading,      setLoading]      = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('lab_orders')
        .select('*')
        .order('created_at', { ascending: false });

      setOrders((data || []).map((row: any) => ({
        ...row,
        anteojos: row.anteojos || [],
        history:  row.history  || [],
      })));
    } catch (err) {
      console.error('Error cargando lab orders:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const interval = setInterval(() => load(), 30000);
    return () => clearInterval(interval);
  }, [load]);

  async function updateStatus(id: string, status: LabStatus) {
    const now    = new Date().toISOString();
    const byName = profile?.full_name ?? 'Laboratorio';
    const order  = orders.find(o => o.id === id);
    if (!order) return;

    const newHistory = [...(order.history || []), { status, timestamp: now, by: byName }];
    const newNotes   = notes[id] ?? order.notes;

    await supabase.from('lab_orders').update({
      status, updated_at: now, notes: newNotes, history: newHistory,
    }).eq('id', id);

    setOrders(prev => prev.map(o =>
      o.id === id ? { ...o, status, updated_at: now, notes: newNotes, history: newHistory } : o
    ));

    window.dispatchEvent(new Event('optica_ventas_updated'));
  }

  const allSellers = [...new Set(orders.map(o => o.seller_name).filter(Boolean))].sort();

  const roleFiltered = orders.filter(o => {
    if (isVendedora) return o.seller_name === profile?.full_name;
    return true;
  });

  const visibleStatuses = isVendedora ? ['enviado', 'proceso', 'listo'] : STATUS_FLOW;

  const filtered = roleFiltered.filter(o => {
    if (!visibleStatuses.includes(o.status)) return false;
    if (statusFilter !== 'todos' && o.status !== statusFilter) return false;
    if (branchFilter !== 'todos' && o.branch_name !== branchFilter) return false;
    if (sellerFilter !== 'todos' && o.seller_name !== sellerFilter) return false;
    if (search) {
      const q      = normalize(search);
      const qNum   = search.replace(/\D/g, '');
      const name   = normalize(o.customer_name);
      const ci     = normalize(o.customer_ci || '');
      const seller = normalize(o.seller_name || '');
      const phone  = (o.customer_phone || '').replace(/\D/g, '');
      const vtaId  = o.sale_number.toLowerCase();
      return name.includes(q) || ci.includes(q) || seller.includes(q) || vtaId.includes(search.toLowerCase()) || (qNum.length >= 3 && phone.includes(qNum));
    }
    return true;
  });

  const countByStatus = (s: string) => roleFiltered.filter(o => o.status === s).length;
  const hasFilters = search || branchFilter !== 'todos' || sellerFilter !== 'todos' || statusFilter !== 'todos';

  function clearFilters() {
    setSearch(''); setBranchFilter('todos'); setSellerFilter('todos'); setStatusFilter('todos');
  }

  return (
    <div className="p-6 space-y-5" onClick={() => lightbox && setLightbox(null)}>

      {lightbox && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.93)' }} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="foto" className="max-w-xl w-full rounded-2xl object-contain"
            style={{ maxHeight: '80vh', border: '1px solid rgba(197,160,89,0.3)' }}
            onClick={e => e.stopPropagation()} />
          <p className="absolute bottom-8 text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>Clic fuera para cerrar</p>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl text-white font-light tracking-wider">Panel de Laboratorio</h1>
          <p className="text-sm font-light mt-1" style={{ color: 'rgba(197,160,89,0.7)' }}>
            {isVendedora ? `Mis pedidos · ${profile?.full_name}` : 'Seguimiento de pedidos · Todas las sucursales'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => printOrders(filtered)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-light border"
            style={{ borderColor: 'rgba(197,160,89,0.3)', color: '#C5A059', background: 'rgba(197,160,89,0.08)' }}>
            <Printer size={14} /> Imprimir ({filtered.length})
          </button>
          <button onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-light border"
            style={{ borderColor: 'rgba(197,160,89,0.3)', color: '#C5A059', background: 'rgba(197,160,89,0.08)' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(isVendedora ? ['enviado', 'proceso', 'listo'] : STATUS_FLOW).map(s => {
          const cfg   = statusConfig[s as LabStatus];
          const count = countByStatus(s);
          return (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? 'todos' : s)}
              className="p-4 rounded-xl border text-left transition-all"
              style={{ background: statusFilter === s ? cfg.bg : 'rgba(255,255,255,0.02)', borderColor: statusFilter === s ? cfg.color + '60' : 'rgba(197,160,89,0.1)' }}>
              <p className="text-2xl font-light text-white">{count}</p>
              <p className="text-xs font-light mt-0.5" style={{ color: cfg.color }}>{cfg.label}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(197,160,89,0.5)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre, C.I., celular o venta..."
            className="pl-9 pr-4 py-2 rounded-lg text-xs bg-transparent text-white outline-none border w-52"
            style={{ borderColor: 'rgba(197,160,89,0.25)', background: 'rgba(255,255,255,0.03)' }} />
        </div>
        {(isLab || isAdmin) && (
          <select value={sellerFilter} onChange={e => setSellerFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-xs font-light bg-transparent outline-none border"
            style={{ borderColor: 'rgba(197,160,89,0.25)', background: '#111', color: sellerFilter !== 'todos' ? '#C5A059' : 'rgba(255,255,255,0.6)' }}>
            <option value="todos" style={{ background: '#111' }}>Todas las vendedoras</option>
            {allSellers.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
          </select>
        )}
        {(isLab || isAdmin) && (
          <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-xs font-light bg-transparent text-white outline-none border"
            style={{ borderColor: 'rgba(197,160,89,0.25)', background: '#111', color: branchFilter !== 'todos' ? '#C5A059' : 'rgba(255,255,255,0.6)' }}>
            <option value="todos" style={{ background: '#111' }}>Todas las sucursales</option>
            {SUCURSALES.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
          </select>
        )}
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-light"
            style={{ background: 'rgba(239,68,68,0.08)', color: 'rgba(239,68,68,0.7)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <X size={12} />Limpiar
          </button>
        )}
        {hasFilters && <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(197,160,89,0.15)' }}>
          <Package size={32} className="mx-auto mb-3 opacity-20" style={{ color: '#C5A059' }} />
          <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {hasFilters ? 'No se encontraron pedidos' : 'No hay pedidos para mostrar'}
          </p>
          {hasFilters && (
            <button onClick={clearFilters} className="mt-3 text-xs font-light px-3 py-1.5 rounded-lg"
              style={{ color: '#C5A059', border: '1px solid rgba(197,160,89,0.3)', background: 'rgba(197,160,89,0.06)' }}>
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const cfg        = statusConfig[order.status];
            const isExp      = expandedId === order.id;
            const waUrl      = order.status === 'listo' ? buildWhatsAppUrlForSeller(order.seller_phone || '', order.seller_name, order.customer_name, order.sale_number) : null;
            const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(order.status) + 1];
            const canAdvance = (isLab || isAdmin) && nextStatus && order.status !== 'entregado';

            return (
              <div key={order.id} className="rounded-xl border overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.02)', borderColor: order.status === 'listo' ? 'rgba(16,185,129,0.4)' : 'rgba(197,160,89,0.12)', boxShadow: order.status === 'listo' ? '0 0 20px rgba(16,185,129,0.06)' : 'none' }}>

                <div className="flex items-start justify-between gap-4 p-4 cursor-pointer" onClick={() => setExpandedId(isExp ? null : order.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-sm font-light" style={{ color: '#C5A059' }}>{order.sale_number}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-light" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-light" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>{order.branch_name}</span>
                      {(isLab || isAdmin) && <span className="px-2 py-0.5 rounded-full text-xs font-light" style={{ background: 'rgba(197,160,89,0.08)', color: 'rgba(197,160,89,0.7)' }}>{order.seller_name}</span>}
                    </div>
                    <p className="text-white font-light">{order.customer_name}</p>
                    {order.customer_ci && <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(197,160,89,0.6)' }}>CI: {order.customer_ci}</p>}
                    {order.customer_phone && <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>📞 {order.customer_phone}</p>}
                    <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{new Date(order.created_at).toLocaleDateString('es-PY')}</p>
                    <div className="flex items-center gap-1 mt-2">
                      {STATUS_FLOW.map((s, i) => {
                        const done = STATUS_FLOW.indexOf(order.status) >= i;
                        return (
                          <div key={s} className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ background: done ? statusConfig[s as LabStatus].color : 'rgba(255,255,255,0.15)' }} />
                            {i < STATUS_FLOW.length - 1 && <div className="w-6 h-px" style={{ background: done && i < STATUS_FLOW.indexOf(order.status) ? '#C5A059' : 'rgba(255,255,255,0.1)' }} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => printOrders([order])}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light"
                      style={{ background: 'rgba(197,160,89,0.08)', color: 'rgba(197,160,89,0.7)', border: '1px solid rgba(197,160,89,0.2)' }}>
                      <Printer size={12} />Imprimir
                    </button>
                    {waUrl && (
                      <a href={waUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                        style={{ background: 'rgba(37,211,102,0.15)', color: '#25d366', border: '1px solid rgba(37,211,102,0.35)' }}>
                        <MessageCircle size={13} />Avisar vendedora
                      </a>
                    )}
                    {canAdvance && (
                      <button onClick={() => updateStatus(order.id, nextStatus)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{ background: statusConfig[nextStatus].bg, color: statusConfig[nextStatus].color, border: `1px solid ${statusConfig[nextStatus].color}40` }}>
                        {nextStatus === 'proceso'   && '▶ En Proceso'}
                        {nextStatus === 'listo'     && '✓ Marcar Listo'}
                        {nextStatus === 'entregado' && '📦 Entregado'}
                      </button>
                    )}
                    {(isLab || isAdmin) && (
                      <input placeholder="Nota..." value={notes[order.id] ?? order.notes}
                        onChange={e => setNotes(prev => ({ ...prev, [order.id]: e.target.value }))}
                        className="px-2 py-1 rounded text-xs bg-transparent text-white outline-none border w-32"
                        style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                    )}
                  </div>
                  <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)', transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0, marginTop: 4 }} />
                </div>

                {isExp && (
                  <div className="border-t px-4 py-4 space-y-4" style={{ borderColor: 'rgba(197,160,89,0.1)', background: 'rgba(197,160,89,0.02)' }}>
                    {order.anteojos.length === 0 ? (
                      <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>Sin detalle de lentes registrado</p>
                    ) : (
                      order.anteojos.map((eg: any, i: number) => (
                        <div key={i} className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(197,160,89,0.14)' }}>
                          <div className="flex items-start gap-3">
                            {eg.photo_url ? (
                              <img src={eg.photo_url} alt="armazón" className="w-24 h-20 object-cover rounded-lg border cursor-pointer shrink-0"
                                style={{ borderColor: 'rgba(197,160,89,0.3)' }} onClick={e => { e.stopPropagation(); setLightbox(eg.photo_url); }} />
                            ) : (
                              <div className="w-24 h-20 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(197,160,89,0.1)' }}>
                                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Sin foto</span>
                              </div>
                            )}
                            <div className="flex-1 space-y-1.5">
                              <p className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.7)' }}>Anteojo {i + 1}</p>
                              {eg.frame_description && <p className="text-sm text-white font-light">📦 {eg.frame_description}</p>}
                              <div className="flex gap-2 flex-wrap">
                                {eg.crystals   && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>🔬 {eg.crystals}</span>}
                                {eg.treatments && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>✨ {eg.treatments}</span>}
                              </div>
                            </div>
                          </div>
                          {eg.showReceta && eg.prescription && (
                            <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.14)' }}>
                              <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.65)' }}>Receta óptica</p>
                              <div className="grid grid-cols-2 gap-3">
                                {[['OD', 'od'], ['OI', 'oi']].map(([label, key]) => (
                                  <div key={key}>
                                    <p className="text-xs font-light mb-1.5" style={{ color: '#C5A059' }}>{label}</p>
                                    <div className="grid grid-cols-3 gap-1.5">
                                      {[['Esfera', `${key}_esfera`], ['Cilindro', `${key}_cilindro`], ['Eje', `${key}_eje`]].map(([fl, fk]) => (
                                        <div key={fk} className="text-center">
                                          <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>{fl}</p>
                                          <div className="px-1 py-1.5 rounded text-xs font-mono text-center" style={{ background: 'rgba(255,255,255,0.06)', color: eg.prescription[fk] ? '#fff' : 'rgba(255,255,255,0.2)' }}>
                                            {eg.prescription[fk] || '—'}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}

                    {order.notes && (
                      <div className="px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>📝 {order.notes}</p>
                      </div>
                    )}

                    {order.history && order.history.length > 0 && (
                      <div>
                        <p className="text-xs font-light tracking-widest uppercase mb-2" style={{ color: 'rgba(197,160,89,0.55)' }}>📋 Historial del pedido</p>
                        <div className="space-y-1.5">
                          {order.history.map((h, i) => {
                            const hcfg = statusConfig[h.status];
                            return (
                              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: hcfg.color }} />
                                <span className="text-xs font-light flex-1" style={{ color: hcfg.color }}>{hcfg.label}</span>
                                <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>{h.by}</span>
                                <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.25)' }}>
                                  {new Date(h.timestamp).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })}
                                  {' '}{new Date(h.timestamp).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(isLab || isAdmin) && order.status === 'proceso' && (
                      <button onClick={e => { e.stopPropagation(); updateStatus(order.id, 'listo'); }}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
                        style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)' }}>
                        <CheckCircle size={16} />✓ Marcar como Listo para Retirar
                      </button>
                    )}

                    {order.status === 'listo' && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
                          <CheckCircle size={14} style={{ color: '#10b981' }} />
                          <p className="text-xs font-light" style={{ color: '#10b981' }}>Trabajo listo — esperando que la vendedora entregue al cliente</p>
                        </div>
                        {waUrl ? (
                          <a href={waUrl} target="_blank" rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-light"
                            style={{ background: 'rgba(37,211,102,0.10)', color: '#25d366', border: '1px solid rgba(37,211,102,0.3)' }}>
                            <MessageCircle size={14} />Avisar a {order.seller_name} que está listo
                          </a>
                        ) : (
                          <p className="text-xs font-light text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>La vendedora no tiene teléfono registrado</p>
                        )}
                      </div>
                    )}
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
