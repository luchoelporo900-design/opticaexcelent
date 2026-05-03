import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Users, Building2, Calendar, RefreshCw, TrendingUp, Award, Printer, Camera, X, ZoomIn, Heart, ChevronDown, Eye } from 'lucide-react';
import { getSales, getPayments } from '../lib/salesStorage';

const SUCURSALES = ['Azara', 'Fernando', 'Caacupé', 'La Fina'];
const LS_REVIEWED_KEY = 'optica_pagos_revisados';

function getReviewed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_REVIEWED_KEY) || '[]')); }
  catch { return new Set(); }
}
function markReviewed(id: string) {
  const s = getReviewed(); s.add(id);
  localStorage.setItem(LS_REVIEWED_KEY, JSON.stringify([...s]));
}

type SellerRow = { seller_name: string; sale_count: number; total: number; collected: number };
type BranchRow = { branch_name: string; sale_count: number; total: number; collected: number };
type PhotoEntry = { sale_number: string; branch_name: string; seller_name: string; created_at: string; photo_url: string; frame_description: string; customer_name: string };

function fmt(n: number) {
  return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Calcular inicio y fin de semana (lunes-sábado)
function getWeekRange(dateStr: string): { start: string; end: string } {
  const d   = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  const f = (x: Date) => x.toISOString().slice(0, 10);
  return { start: f(monday), end: f(saturday) };
}

function PhotoThumb({ entry }: { entry: PhotoEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="relative group rounded-xl overflow-hidden"
        style={{ width: 80, height: 80, border: '1px solid rgba(197,160,89,0.20)', flexShrink: 0 }}>
        <img src={entry.photo_url} alt={entry.frame_description || 'armazón'} className="w-full h-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.65)' }}>
          <ZoomIn size={16} style={{ color: '#C5A059' }} />
        </div>
        <div className="absolute bottom-0 inset-x-0 px-1 py-0.5" style={{ background: 'rgba(0,0,0,0.6)', fontSize: 8, color: 'rgba(197,160,89,0.9)' }}>
          {entry.branch_name}
        </div>
      </button>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.93)' }} onClick={() => setOpen(false)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <img src={entry.photo_url} alt={entry.frame_description || 'armazón'} className="w-full rounded-2xl"
              style={{ border: '1px solid rgba(197,160,89,0.3)', maxHeight: '80vh', objectFit: 'contain' }} />
            <div className="mt-3 text-center">
              <p className="text-xs text-white font-light">{entry.sale_number} · {entry.customer_name} · {entry.branch_name}</p>
              {entry.frame_description && <p className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.7)' }}>{entry.frame_description}</p>}
            </div>
            <button onClick={() => setOpen(false)} className="absolute top-3 right-3 p-2 rounded-full" style={{ background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.7)' }}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function ReportPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [scope,        setScope]        = useState<'day' | 'week' | 'month'>('day');
  const [sellerFilter, setSellerFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [loading,      setLoading]      = useState(false);

  const [totalSales,     setTotalSales]     = useState(0);
  const [totalAmount,    setTotalAmount]    = useState(0);
  const [totalCollected, setTotalCollected] = useState(0);
  const [bySeller,       setBySeller]       = useState<SellerRow[]>([]);
  const [byBranch,       setByBranch]       = useState<BranchRow[]>([]);
  const [photos,         setPhotos]         = useState<PhotoEntry[]>([]);
  const [photoBranch,    setPhotoBranch]    = useState('');
  const [salesList,      setSalesList]      = useState<any[]>([]);
  const [expandedSale,   setExpandedSale]   = useState<string | null>(null);
  const [reviewed,       setReviewed]       = useState<Set<string>>(getReviewed());
  const [lightbox,       setLightbox]       = useState<string | null>(null);
  const [alerts,         setAlerts]         = useState<any[]>([]);
  const [allSellers,     setAllSellers]     = useState<string[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    const allVentas = getSales();

    // Get all sellers for filter
    const sellers = [...new Set(allVentas.map(v => v.vendedora).filter(Boolean))].sort();
    setAllSellers(sellers);

    // Build date filter
    let ventas = allVentas.filter(v => v.estadoTrabajo !== 'cancelado');

    if (scope === 'day') {
      ventas = ventas.filter(v => (v.fecha || '').startsWith(selectedDate));
    } else if (scope === 'week') {
      const { start, end } = getWeekRange(selectedDate);
      ventas = ventas.filter(v => {
        const d = (v.fecha || '').slice(0, 10);
        return d >= start && d <= end;
      });
    } else {
      ventas = ventas.filter(v => (v.fecha || '').startsWith(selectedDate.slice(0, 7)));
    }

    // Apply filters
    if (sellerFilter) ventas = ventas.filter(v => v.vendedora === sellerFilter);
    if (branchFilter) ventas = ventas.filter(v => v.sucursalVenta === branchFilter);

    setTotalSales(ventas.length);
    setTotalAmount(ventas.reduce((a, v) => a + (Number(v.total) || 0), 0));
    setTotalCollected(ventas.reduce((a, v) => a + ((Number(v.total) || 0) - (Number(v.saldo) || 0)), 0));

    // By seller
    const sellerMap: Record<string, SellerRow> = {};
    for (const v of ventas) {
      const n = v.vendedora || 'Sin vendedor';
      if (!sellerMap[n]) sellerMap[n] = { seller_name: n, sale_count: 0, total: 0, collected: 0 };
      sellerMap[n].sale_count++;
      sellerMap[n].total     += Number(v.total) || 0;
      sellerMap[n].collected += (Number(v.total) || 0) - (Number(v.saldo) || 0);
    }
    setBySeller(Object.values(sellerMap).sort((a, b) => b.total - a.total));

    // By branch
    const branchMap: Record<string, BranchRow> = {};
    for (const v of ventas) {
      const n = v.sucursalVenta || 'Sin sucursal';
      if (!branchMap[n]) branchMap[n] = { branch_name: n, sale_count: 0, total: 0, collected: 0 };
      branchMap[n].sale_count++;
      branchMap[n].total     += Number(v.total) || 0;
      branchMap[n].collected += (Number(v.total) || 0) - (Number(v.saldo) || 0);
    }
    setByBranch(Object.values(branchMap).sort((a, b) => b.total - a.total));

    // Photos
    const photoRows: PhotoEntry[] = [];
    for (const v of ventas) {
      for (const eg of (v.anteojos as any[] || [])) {
        if (eg.photo_url) {
          photoRows.push({
            sale_number: `VTA-${v.id}`, branch_name: v.sucursalVenta || '',
            seller_name: v.vendedora || '', created_at: v.fecha,
            photo_url: eg.photo_url, frame_description: eg.frame_description || '',
            customer_name: `${v.cliente.nombre} ${v.cliente.apellido}`.trim(),
          });
        }
      }
    }
    setPhotos(photoRows);

    // Sales list sorted desc
    setSalesList([...ventas].sort((a, b) => a.id - b.id)); // Ordenado por número de venta asc

    // Cargar alertas de entregas pendientes de verificar
    try {
      const rawAlerts = JSON.parse(localStorage.getItem('optica_delivery_alerts') || '[]');
      setAlerts(rawAlerts.filter((a: any) => !a.reviewed));
    } catch {}

    setLoading(false);
  }, [selectedDate, scope, sellerFilter, branchFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('optica_ventas_updated', h);
    return () => window.removeEventListener('optica_ventas_updated', h);
  }, [load]);

  function dismissAlert(alertId: number) {
    try {
      const all = JSON.parse(localStorage.getItem('optica_delivery_alerts') || '[]');
      const updated = all.map((a: any) => a.id === alertId ? { ...a, reviewed: true } : a);
      localStorage.setItem('optica_delivery_alerts', JSON.stringify(updated));
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch {}
  }

  function handleReviewPayment(payId: string) {
    markReviewed(payId);
    setReviewed(getReviewed());
  }

  const dateLabel = () => {
    if (scope === 'day') return new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (scope === 'week') {
      const { start, end } = getWeekRange(selectedDate);
      return `Semana del ${new Date(start + 'T12:00:00').toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })} al ${new Date(end + 'T12:00:00').toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: '2-digit' })}`;
    }
    return new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-PY', { month: 'long', year: 'numeric' });
  };

  const METHODS_COLOR: Record<string, string> = {
    efectivo: '#22c55e', transferencia: '#3b82f6', tarjeta: '#f59e0b', qr: '#C5A059', giro: '#a78bfa'
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.93)' }} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="comprobante" className="max-w-xl w-full rounded-2xl object-contain"
            style={{ maxHeight: '80vh', border: '1px solid rgba(197,160,89,0.3)' }} onClick={e => e.stopPropagation()} />
          <p className="absolute bottom-8 text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>Clic fuera para cerrar</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-light tracking-wider text-white">Reportes</h1>
          <p className="text-xs text-gold-muted mt-0.5 tracking-wide capitalize">{dateLabel()}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Scope */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(197,160,89,0.20)' }}>
            {(['day', 'week', 'month'] as const).map(s => (
              <button key={s} onClick={() => setScope(s)}
                className="px-3 py-1.5 text-xs font-light"
                style={{ background: scope === s ? 'rgba(197,160,89,0.14)' : 'transparent', color: scope === s ? '#C5A059' : 'rgba(255,255,255,0.42)' }}>
                {s === 'day' ? 'Día' : s === 'week' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
          {/* Date picker */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(197,160,89,0.07)', border: '1px solid rgba(197,160,89,0.18)' }}>
            <Calendar size={13} className="text-gold-muted" />
            <input type={scope === 'month' ? 'month' : 'date'}
              value={scope === 'month' ? selectedDate.slice(0, 7) : selectedDate}
              onChange={e => setSelectedDate(scope === 'month' ? e.target.value + '-01' : e.target.value)}
              className="bg-transparent text-xs text-white border-none outline-none" />
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light"
            style={{ background: 'rgba(197,160,89,0.10)', border: '1px solid rgba(197,160,89,0.28)', color: '#C5A059' }}>
            <Printer size={13} />Imprimir
          </button>
        </div>
      </div>

      {/* Filtros vendedora y sucursal */}
      <div className="flex flex-wrap gap-3">
        <select value={sellerFilter} onChange={e => setSellerFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs outline-none border"
          style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(197,160,89,0.22)', color: sellerFilter ? '#C5A059' : 'rgba(255,255,255,0.5)' }}>
          <option value="" style={{ background: '#111' }}>Todas las vendedoras</option>
          {allSellers.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
        </select>
        <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs outline-none border"
          style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(197,160,89,0.22)', color: branchFilter ? '#C5A059' : 'rgba(255,255,255,0.5)' }}>
          <option value="" style={{ background: '#111' }}>Todas las sucursales</option>
          {SUCURSALES.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
        </select>
        {(sellerFilter || branchFilter) && (
          <button onClick={() => { setSellerFilter(''); setBranchFilter(''); }}
            className="px-3 py-2 rounded-lg text-xs font-light"
            style={{ background: 'rgba(239,68,68,0.08)', color: 'rgba(239,68,68,0.7)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <X size={12} className="inline mr-1" />Limpiar filtros
          </button>
        )}
      </div>

      {/* Alertas de entregas pendientes de verificar */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-light tracking-widest uppercase" style={{ color: '#f59e0b' }}>
            🔔 {alerts.length} entrega{alerts.length > 1 ? 's' : ''} pendiente{alerts.length > 1 ? 's' : ''} de verificar
          </p>
          {alerts.map(alert => (
            <div key={alert.id} className="flex items-center gap-3 px-4 py-3 rounded-xl flex-wrap"
              style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white font-light">
                  📦 <strong>{alert.customer}</strong> · {alert.saleNumber}
                </p>
                <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Entregado por {alert.vendedora} · {new Date(alert.timestamp).toLocaleDateString('es-PY')} {new Date(alert.timestamp).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                  · Total: Gs. {Number(alert.total).toLocaleString('es-PY')}
                </p>
              </div>
              <p className="text-xs font-light" style={{ color: '#f59e0b' }}>
                Verificá el pago del saldo en la sección de cobros
              </p>
              <button onClick={() => dismissAlert(alert.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)' }}>
                <Heart size={11} />Ya verifiqué
              </button>
            </div>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Ventas realizadas', value: String(totalSales), sub: 'pedidos', icon: <BarChart3 size={16} />, color: '#3b82f6' },
          { label: 'Total facturado',   value: `${fmt(totalAmount)} Gs.`,    sub: 'ventas nuevas',   icon: <TrendingUp size={16} />, color: '#C5A059' },
          { label: 'Total cobrado',     value: `${fmt(totalCollected)} Gs.`, sub: 'pagos recibidos', icon: <Award size={16} />,     color: '#22c55e' },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${k.color}22` }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-light tracking-wider" style={{ color: 'rgba(255,255,255,0.44)' }}>{k.label}</span>
              <span style={{ color: k.color }}>{k.icon}</span>
            </div>
            <p className="text-2xl font-light" style={{ color: k.color }}>{k.value}</p>
            <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.28)' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Tablas por vendedora y sucursal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Users size={14} className="text-gold-muted" />
            <span className="text-xs font-light tracking-wider text-white">Por vendedor</span>
          </div>
          {bySeller.length === 0 ? <div className="text-center py-10"><p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Sin datos</p></div> : (
            <table className="w-full">
              <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['Vendedor','Ventas','Facturado','Cobrado'].map(h => <th key={h} className="px-4 py-2.5 text-left text-xs font-light" style={{ color: 'rgba(255,255,255,0.32)' }}>{h}</th>)}
              </tr></thead>
              <tbody>{bySeller.map((r,i) => (
                <tr key={r.seller_name} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i%2===0?'transparent':'rgba(255,255,255,0.01)' }}>
                  <td className="px-4 py-3 text-xs text-white font-light">{r.seller_name}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#3b82f6' }}>{r.sale_count}</td>
                  <td className="px-4 py-3 text-xs font-light" style={{ color: '#C5A059' }}>{fmt(r.total)}</td>
                  <td className="px-4 py-3 text-xs font-light" style={{ color: '#22c55e' }}>{fmt(r.collected)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Building2 size={14} className="text-gold-muted" />
            <span className="text-xs font-light tracking-wider text-white">Por sucursal</span>
          </div>
          {byBranch.length === 0 ? <div className="text-center py-10"><p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Sin datos</p></div> : (
            <table className="w-full">
              <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['Sucursal','Ventas','Facturado','Cobrado'].map(h => <th key={h} className="px-4 py-2.5 text-left text-xs font-light" style={{ color: 'rgba(255,255,255,0.32)' }}>{h}</th>)}
              </tr></thead>
              <tbody>{byBranch.map((r,i) => (
                <tr key={r.branch_name} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i%2===0?'transparent':'rgba(255,255,255,0.01)' }}>
                  <td className="px-4 py-3 text-xs text-white font-light">{r.branch_name}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#3b82f6' }}>{r.sale_count}</td>
                  <td className="px-4 py-3 text-xs font-light" style={{ color: '#C5A059' }}>{fmt(r.total)}</td>
                  <td className="px-4 py-3 text-xs font-light" style={{ color: '#22c55e' }}>{fmt(r.collected)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>

      {/* Lista de ventas con comprobantes y revisado */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-gold-muted" />
            <span className="text-xs font-light tracking-wider text-white">Detalle de ventas</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(197,160,89,0.12)', color: '#C5A059' }}>{salesList.length}</span>
          </div>
        </div>
        {salesList.length === 0 ? (
          <div className="text-center py-12"><p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Sin ventas para este período</p></div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {salesList.map((v, i) => {
              const saleNum = i + 1; // Número correlativo 1, 2, 3...

              const saleKey  = String(v.id);
              const isExp    = expandedSale === saleKey;
              const salePays = getPayments().filter(p => p.saleId === v.id);
              const anteojos = (v.anteojos as any[]) || [];

              return (
                <div key={saleKey}>
                  <div className="flex items-center gap-3 px-5 py-3.5 cursor-pointer"
                    style={{ background: isExp ? 'rgba(197,160,89,0.03)' : i%2===0?'transparent':'rgba(255,255,255,0.008)' }}
                    onClick={() => setExpandedSale(isExp ? null : saleKey)}>
                    {(() => {
                      const salePaysForRow = getPayments().filter(p => p.saleId === v.id);
                      const anyVerified    = salePaysForRow.some(p => reviewed.has(String(p.id)));
                      return (
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-black shrink-0"
                              style={{ background: '#C5A059', fontSize: 10 }}>{saleNum}</span>
                            <span className="text-xs font-mono" style={{ color: '#C5A059' }}>VTA-{v.id}</span>
                            <span className="text-xs text-white font-light">{v.cliente.nombre} {v.cliente.apellido}</span>
                            <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>{v.sucursalVenta}</span>
                            {anyVerified && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
                                <Heart size={9} fill="#ef4444" style={{ color: '#ef4444' }} />
                                <span className="text-xs font-light" style={{ color: '#ef4444', fontSize: 9 }}>Verificado</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            {v.vendedora} · {new Date(v.fecha).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: '2-digit' })} {new Date(v.fecha).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      );
                    })()}
                    <div className="text-right shrink-0">
                      <p className="text-xs text-white font-light">Gs. {fmt(Number(v.total))}</p>
                      {Number(v.saldo) > 0
                        ? <p className="text-xs font-light" style={{ color: '#f59e0b' }}>Debe {fmt(Number(v.saldo))}</p>
                        : <p className="text-xs font-light" style={{ color: '#10b981' }}>✓ Pagado</p>}
                    </div>
                    {v.estadoTrabajo === 'entregado' && (
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: 'rgba(107,114,128,0.15)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.3)' }}>
                        📦 Entregado
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-full shrink-0 ml-1"
                      style={{ background: v.metodoPago === 'efectivo' ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.12)', color: v.metodoPago === 'efectivo' ? '#22c55e' : '#3b82f6' }}>
                      {v.metodoPago}
                    </span>
                    <ChevronDown size={13} style={{ color: 'rgba(255,255,255,0.3)', transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                  </div>

                  {isExp && (
                    <div className="px-5 pb-4 space-y-3" style={{ background: 'rgba(197,160,89,0.02)', borderTop: '1px solid rgba(197,160,89,0.08)' }}>

                      {/* Lentes */}
                      {anteojos.length > 0 && (
                        <div className="pt-3">
                          <p className="text-xs font-light tracking-widest uppercase mb-2" style={{ color: 'rgba(197,160,89,0.55)' }}>Lentes</p>
                          <div className="space-y-2">
                            {anteojos.map((eg: any, ei: number) => (
                              <div key={ei} className="flex items-start gap-3 rounded-lg p-3"
                                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(197,160,89,0.1)' }}>
                                {eg.photo_url ? (
                                  <img src={eg.photo_url} alt="armazón" className="w-16 h-12 object-cover rounded-lg border cursor-pointer shrink-0"
                                    style={{ borderColor: 'rgba(197,160,89,0.3)' }} onClick={() => setLightbox(eg.photo_url)} />
                                ) : (
                                  <div className="w-16 h-12 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(197,160,89,0.1)' }}>
                                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Sin foto</span>
                                  </div>
                                )}
                                <div className="flex-1 space-y-1">
                                  {eg.frame_description && <p className="text-xs text-white font-light">{eg.frame_description}</p>}
                                  <div className="flex gap-2 flex-wrap">
                                    {eg.crystals   && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>{eg.crystals}</span>}
                                    {eg.treatments && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>{eg.treatments}</span>}
                                  </div>
                                  {eg.showReceta && eg.prescription && (
                                    <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                      OD: {eg.prescription.od_esfera}/{eg.prescription.od_cilindro}x{eg.prescription.od_eje} · OI: {eg.prescription.oi_esfera}/{eg.prescription.oi_cilindro}x{eg.prescription.oi_eje}
                                      {eg.prescription.od_altura ? ` · Alt: ${eg.prescription.od_altura}` : ''}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Pagos con comprobantes y ❤️ */}
                      {salePays.length > 0 && (
                        <div>
                          <p className="text-xs font-light tracking-widest uppercase mb-2" style={{ color: 'rgba(197,160,89,0.55)' }}>Pagos y comprobantes</p>
                          <div className="space-y-2">
                            {salePays.map((p: any) => {
                              const mc      = METHODS_COLOR[p.metodo] ?? '#C5A059';
                              const isRev   = reviewed.has(String(p.id));
                              return (
                                <div key={p.id} className="rounded-xl overflow-hidden"
                                  style={{ border: `1px solid ${isRev ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}`, background: 'rgba(255,255,255,0.02)' }}>
                                  <div className="flex items-center gap-2 px-3 py-2">
                                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${mc}18`, color: mc }}>{p.metodo}</span>
                                    <span className="text-xs text-white font-light">Gs. {fmt(Number(p.monto))}</span>
                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(197,160,89,0.08)', color: 'rgba(197,160,89,0.6)' }}>{p.tipo === 'sena' ? 'Seña' : 'Abono'}</span>
                                    <span className="text-xs ml-auto" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                      {new Date(p.fecha).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })} {new Date(p.fecha).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {isRev
                                      ? <div className="flex items-center gap-1 px-2 py-1 rounded-full"
                                          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
                                          <Heart size={11} fill="#ef4444" style={{ color: '#ef4444' }} />
                                          <span className="text-xs font-light" style={{ color: '#ef4444' }}>Verificado</span>
                                        </div>
                                      : <button onClick={() => handleReviewPayment(String(p.id))}
                                          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-light"
                                          style={{ background: 'rgba(239,68,68,0.08)', color: 'rgba(239,68,68,0.6)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                          <Heart size={11} />Revisar
                                        </button>
                                    }
                                  </div>
                                  {p.receipt_url ? (
                                    <div className="px-3 pb-3">
                                      <img src={p.receipt_url} alt="comprobante"
                                        className="h-32 object-contain rounded-lg border cursor-pointer"
                                        style={{ borderColor: 'rgba(197,160,89,0.2)', background: '#111' }}
                                        onClick={() => setLightbox(p.receipt_url)} />
                                      <p className="text-xs mt-1 font-light" style={{ color: 'rgba(255,255,255,0.25)' }}>Clic para ampliar</p>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 px-3 pb-2">
                                      <Eye size={11} style={{ color: 'rgba(255,255,255,0.2)' }} />
                                      <p className="text-xs font-light" style={{ color: p.metodo !== 'efectivo' ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.2)' }}>
                                        {p.metodo !== 'efectivo' ? 'Sin comprobante' : 'Efectivo — sin foto'}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
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

      {/* Fotos armazones */}
      {photos.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2">
              <Camera size={14} className="text-gold-muted" />
              <span className="text-xs font-light tracking-wider text-white">Fotos de armazones</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-light" style={{ background: 'rgba(197,160,89,0.12)', color: '#C5A059' }}>{photos.length}</span>
            </div>
            <select value={photoBranch} onChange={e => setPhotoBranch(e.target.value)}
              className="bg-transparent text-xs outline-none px-2 py-1 rounded-lg"
              style={{ border: '1px solid rgba(197,160,89,0.20)', color: 'rgba(255,255,255,0.6)' }}>
              <option value="" style={{ background: '#111' }}>Todas las sucursales</option>
              {[...new Set(photos.map(p => p.branch_name).filter(Boolean))].map(b => (
                <option key={b} value={b} style={{ background: '#111' }}>{b}</option>
              ))}
            </select>
          </div>
          <div className="p-4 flex flex-wrap gap-3">
            {photos.filter(p => !photoBranch || p.branch_name === photoBranch).map((p, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <PhotoThumb entry={p} />
                <p className="text-center font-light" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.customer_name || p.sale_number}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.22)' }}>Óptica Yolanda · Reporte generado el {new Date().toLocaleString('es-PY')}</p>
      </div>
    </div>
  );
}
