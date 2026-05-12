import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart3, Users, Building2, Calendar, RefreshCw, TrendingUp, Award,
  Printer, Camera, X, ZoomIn, Heart, ChevronDown, Eye, Bell,
  Store, ShoppingBag, MapPin, Package, Truck, FlaskConical, Glasses,
  Clock, CheckCircle, AlertTriangle,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

const SUCURSALES        = ['Azara', 'Fernando', 'Caacupé', 'La Fina'];
const LS_REVIEWED_KEY   = 'optica_pagos_revisados';
const LS_SEEN_SALES_KEY = 'optica_seen_sales';

function getReviewed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_REVIEWED_KEY) || '[]')); }
  catch { return new Set(); }
}
function markReviewed(id: string) {
  const s = getReviewed(); s.add(id);
  localStorage.setItem(LS_REVIEWED_KEY, JSON.stringify([...s]));
}
function getSeenSales(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_SEEN_SALES_KEY) || '[]')); }
  catch { return new Set(); }
}
function markAllSeen(ids: string[]) {
  const s = getSeenSales();
  ids.forEach(id => s.add(id));
  localStorage.setItem(LS_SEEN_SALES_KEY, JSON.stringify([...s]));
}

type SellerRow = { seller_name: string; sale_count: number; total: number; collected: number };
type BranchRow = { branch_name: string; sale_count: number; total: number; collected: number };
type PhotoEntry = {
  sale_number: string; branch_name: string; seller_name: string;
  created_at: string; photo_url: string; frame_description: string; customer_name: string;
  is_receta?: boolean;
};

function fmt(n: number) {
  return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function getLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
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

// ── Imagen robusta para iOS — no desaparece ───────────────────────────────────
function SafeImg({ src, alt, className, style, onClick }: {
  src: string; alt: string; className?: string; style?: React.CSSProperties; onClick?: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const [loaded,  setLoaded]  = useState(false);

  if (!src || !visible) return null;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{ ...style, opacity: loaded ? 1 : 0, transition: 'opacity 0.2s' }}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      onError={() => setVisible(false)}
      onClick={onClick}
    />
  );
}

function ChannelBadge({ channel }: { channel?: string }) {
  if (!channel) return null;
  const isOnline = channel === 'online';
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-light"
      style={{
        background: isOnline ? 'rgba(139,92,246,0.14)' : 'rgba(34,197,94,0.10)',
        color:      isOnline ? '#a78bfa' : '#22c55e',
        border:     `1px solid ${isOnline ? 'rgba(139,92,246,0.30)' : 'rgba(34,197,94,0.25)'}`,
      }}>
      {isOnline ? <ShoppingBag size={10} /> : <Store size={10} />}
      {isOnline ? 'Online' : 'Local'}
    </span>
  );
}

function DeliveryBadge({ type }: { type?: string }) {
  if (!type) return null;
  const cfg = {
    retiro:     { label: 'Retiro local', color: '#10b981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.25)', icon: <Store   size={10} /> },
    delivery:   { label: 'Delivery',     color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.25)', icon: <Truck   size={10} /> },
    encomienda: { label: 'Encomienda',   color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)', icon: <Package size={10} /> },
  }[type] ?? { label: type, color: '#C5A059', bg: 'rgba(197,160,89,0.10)', border: 'rgba(197,160,89,0.25)', icon: <MapPin size={10} /> };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-light"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function EyeglassReviewCard({ eg, idx, onLightbox }: { eg: any; idx: number; onLightbox: (url: string) => void }) {
  const rx = eg.prescription;
  const hasRx = rx && (rx.od_esfera || rx.oi_esfera || rx.od_cilindro);
  const isConfirmar = eg.receta_a_confirmar === true;
  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(197,160,89,0.14)' }}>
      <div className="flex items-start gap-3 p-3">
        {eg.photo_url ? (
          <button onClick={() => onLightbox(eg.photo_url)}
            className="relative group shrink-0 rounded-lg overflow-hidden"
            style={{ width: 72, height: 56, border: '1px solid rgba(197,160,89,0.28)' }}>
            <SafeImg src={eg.photo_url} alt="armazón" className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.55)' }}>
              <ZoomIn size={14} style={{ color: '#C5A059' }} />
            </div>
          </button>
        ) : (
          <div className="shrink-0 rounded-lg flex items-center justify-center"
            style={{ width: 72, height: 56, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(197,160,89,0.1)' }}>
            <Glasses size={18} style={{ color: 'rgba(197,160,89,0.3)' }} />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.7)' }}>Armazón {idx + 1}</span>
            {eg.saleType === 'reparacion' && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>Reparación</span>}
            {eg.saleType === 'media' && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>½ venta</span>}
            {eg.price && Number(eg.price) > 0 && <span className="text-xs font-light" style={{ color: '#C5A059' }}>Gs. {fmt(Number(eg.price))}</span>}
          </div>
          {eg.frame_description && <p className="text-xs text-white font-light truncate">{eg.frame_description}</p>}
          <div className="flex gap-1.5 flex-wrap">
            {eg.crystals   && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>{eg.crystals}</span>}
            {eg.treatments && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>{eg.treatments}</span>}
          </div>
        </div>
      </div>
      {eg.receta_url && (
        <div className="px-3 pb-2 flex items-center gap-2">
          <p className="text-xs font-light shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>📋 Foto receta:</p>
          <button onClick={() => onLightbox(eg.receta_url)}
            className="relative group rounded-lg overflow-hidden shrink-0"
            style={{ width: 64, height: 48, border: '1px solid rgba(59,130,246,0.35)' }}>
            <SafeImg src={eg.receta_url} alt="receta" className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.55)' }}>
              <ZoomIn size={12} style={{ color: '#3b82f6' }} />
            </div>
          </button>
        </div>
      )}
      {isConfirmar ? (
        <div className="mx-3 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.30)' }}>
          <AlertTriangle size={12} style={{ color: '#f97316', flexShrink: 0 }} />
          <span className="text-xs font-light" style={{ color: '#f97316' }}>Receta pendiente de confirmación</span>
        </div>
      ) : hasRx ? (
        <div className="mx-3 mb-3 rounded-lg p-3 space-y-2"
          style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.22)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <FlaskConical size={10} style={{ color: '#3b82f6' }} />
            <span className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(59,130,246,0.8)' }}>Receta óptica</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-light mb-1" style={{ color: '#C5A059' }}>OD (ojo derecho)</p>
              <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {rx.od_esfera||'—'} / {rx.od_cilindro||'—'} x {rx.od_eje||'—'}
                {rx.od_altura ? ` · Alt: ${rx.od_altura}` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs font-light mb-1" style={{ color: '#C5A059' }}>OI (ojo izquierdo)</p>
              <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {rx.oi_esfera||'—'} / {rx.oi_cilindro||'—'} x {rx.oi_eje||'—'}
                {rx.oi_altura ? ` · Alt: ${rx.oi_altura}` : ''}
              </p>
            </div>
          </div>
          {(rx.add || rx.dp || rx.obs) && (
            <div className="flex flex-wrap gap-3 text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {rx.add && <span>ADD: {rx.add}</span>}
              {rx.dp  && <span>DP: {rx.dp}</span>}
              {rx.obs && <span className="italic">{rx.obs}</span>}
            </div>
          )}
        </div>
      ) : eg.prescription_text ? (
        <div className="mx-3 mb-3 px-3 py-2 rounded-lg"
          style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)' }}>
          <p className="text-xs font-mono font-light" style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8 }}>{eg.prescription_text}</p>
        </div>
      ) : (
        <div className="mx-3 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <FlaskConical size={11} style={{ color: 'rgba(255,255,255,0.2)' }} />
          <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>Sin receta cargada</span>
        </div>
      )}
    </div>
  );
}

function PhotoThumb({ entry }: { entry: PhotoEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="relative group rounded-xl overflow-hidden"
        style={{ width: 80, height: 80, flexShrink: 0, border: entry.is_receta ? '1px solid rgba(59,130,246,0.35)' : '1px solid rgba(197,160,89,0.20)' }}>
        <SafeImg src={entry.photo_url} alt={entry.frame_description || 'foto'} className="w-full h-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.65)' }}>
          <ZoomIn size={16} style={{ color: entry.is_receta ? '#3b82f6' : '#C5A059' }} />
        </div>
        <div className="absolute bottom-0 inset-x-0 px-1 py-0.5"
          style={{ background: 'rgba(0,0,0,0.6)', fontSize: 8, color: entry.is_receta ? 'rgba(59,130,246,0.9)' : 'rgba(197,160,89,0.9)' }}>
          {entry.is_receta ? '📋 receta' : entry.branch_name}
        </div>
      </button>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.93)' }} onClick={() => setOpen(false)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <SafeImg src={entry.photo_url} alt={entry.frame_description || 'foto'} className="w-full rounded-2xl"
              style={{ border: `1px solid ${entry.is_receta ? 'rgba(59,130,246,0.3)' : 'rgba(197,160,89,0.3)'}`, maxHeight: '80vh', objectFit: 'contain' }} />
            <div className="mt-3 text-center">
              <p className="text-xs text-white font-light">{entry.sale_number} · {entry.customer_name} · {entry.branch_name}</p>
              {entry.frame_description && <p className="text-xs font-light" style={{ color: entry.is_receta ? 'rgba(59,130,246,0.7)' : 'rgba(197,160,89,0.7)' }}>{entry.frame_description}</p>}
            </div>
            <button onClick={() => setOpen(false)} className="absolute top-3 right-3 p-2 rounded-full"
              style={{ background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.7)' }}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function ReportPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'gerente';
  const today   = getLocalDate();

  const [selectedDate, setSelectedDate] = useState(today);
  const [scope,        setScope]        = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [sellerFilter, setSellerFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [loading,      setLoading]      = useState(false);
  const { sales: allSalesData, payments: allPaymentsData } = useData();

  const [totalSales,      setTotalSales]      = useState(0);
  const [totalAmount,     setTotalAmount]     = useState(0);
  const [totalCollected,  setTotalCollected]  = useState(0);
  const [bySeller,        setBySeller]        = useState<SellerRow[]>([]);
  const [byBranch,        setByBranch]        = useState<BranchRow[]>([]);
  const [photos,          setPhotos]          = useState<PhotoEntry[]>([]);
  const [photoBranch,     setPhotoBranch]     = useState('');
  const [salesList,       setSalesList]       = useState<any[]>([]);
  const [expandedSale,    setExpandedSale]    = useState<string | null>(null);
  const [highlightedSale, setHighlightedSale] = useState<string | null>(null);
  const [reviewed,        setReviewed]        = useState<Set<string>>(getReviewed());
  const [lightbox,        setLightbox]        = useState<string | null>(null);
  const [alerts,          setAlerts]          = useState<any[]>([]);
  const [allSellers,      setAllSellers]      = useState<string[]>([]);
  const [newSalesAlerts,  setNewSalesAlerts]  = useState<any[]>([]);

  const saleRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const load = useCallback(() => {
    setLoading(true);
    const allVentas = allSalesData;
    const sellers = [...new Set(allVentas.map(v => v.vendedora).filter(Boolean))].sort();
    setAllSellers(sellers);

    if (isAdmin) {
      const seen = getSeenSales();
      const todayVentas = allVentas.filter(v => (v.fecha || '').startsWith(today));
      const unseen = todayVentas.filter(v => !seen.has(String(v.id)));
      const bySellerMap: Record<string, any[]> = {};
      for (const v of unseen) {
        const s = v.vendedora || 'Sin vendedor';
        if (!bySellerMap[s]) bySellerMap[s] = [];
        bySellerMap[s].push(v);
      }
      setNewSalesAlerts(Object.entries(bySellerMap).map(([seller, ventas]) => ({ seller, ventas })));
    }

    let ventas = allVentas.filter(v => v.estadoTrabajo !== 'cancelado');
    if (scope === 'day') {
      ventas = ventas.filter(v => (v.fecha || '').startsWith(selectedDate));
    } else if (scope === 'week') {
      const { start, end } = getWeekRange(selectedDate);
      ventas = ventas.filter(v => { const d = (v.fecha || '').slice(0, 10); return d >= start && d <= end; });
    } else if (scope === 'month') {
      ventas = ventas.filter(v => (v.fecha || '').startsWith(selectedDate.slice(0, 7)));
    } else if (scope === 'year') {
      ventas = ventas.filter(v => (v.fecha || '').startsWith(selectedDate.slice(0, 4)));
    }
    if (sellerFilter) ventas = ventas.filter(v => v.vendedora === sellerFilter);
    if (branchFilter) ventas = ventas.filter(v => v.sucursalVenta === branchFilter);

    setTotalSales(ventas.length);
    setTotalAmount(ventas.reduce((a, v) => a + (Number(v.total) || 0), 0));
    setTotalCollected(ventas.reduce((a, v) => a + ((Number(v.total) || 0) - (Number(v.saldo) || 0)), 0));

    const sellerMap: Record<string, SellerRow> = {};
    for (const v of ventas) {
      const n = v.vendedora || 'Sin vendedor';
      if (!sellerMap[n]) sellerMap[n] = { seller_name: n, sale_count: 0, total: 0, collected: 0 };
      sellerMap[n].sale_count++;
      sellerMap[n].total     += Number(v.total) || 0;
      sellerMap[n].collected += (Number(v.total) || 0) - (Number(v.saldo) || 0);
    }
    setBySeller(Object.values(sellerMap).sort((a, b) => b.total - a.total));

    const branchMap: Record<string, BranchRow> = {};
    for (const v of ventas) {
      const n = v.sucursalVenta || 'Sin sucursal';
      if (!branchMap[n]) branchMap[n] = { branch_name: n, sale_count: 0, total: 0, collected: 0 };
      branchMap[n].sale_count++;
      branchMap[n].total     += Number(v.total) || 0;
      branchMap[n].collected += (Number(v.total) || 0) - (Number(v.saldo) || 0);
    }
    setByBranch(Object.values(branchMap).sort((a, b) => b.total - a.total));

    const photoRows: PhotoEntry[] = [];
    for (const v of ventas) {
      for (const eg of (v.anteojos as any[] || [])) {
        if (eg.photo_url) {
          photoRows.push({
            sale_number: `VTA-${v.id}`, branch_name: v.sucursalVenta || '',
            seller_name: v.vendedora || '', created_at: v.fecha,
            photo_url: eg.photo_url, frame_description: eg.frame_description || '',
            customer_name: `${v.cliente.nombre} ${v.cliente.apellido}`.trim(),
            is_receta: false,
          });
        }
        if (eg.receta_url) {
          photoRows.push({
            sale_number: `VTA-${v.id}`, branch_name: v.sucursalVenta || '',
            seller_name: v.vendedora || '', created_at: v.fecha,
            photo_url: eg.receta_url,
            frame_description: `📋 Receta${eg.frame_description ? ' — ' + eg.frame_description : ''}`,
            customer_name: `${v.cliente.nombre} ${v.cliente.apellido}`.trim(),
            is_receta: true,
          });
        }
      }
    }
    setPhotos(photoRows);
    setSalesList([...ventas].sort((a, b) => b.id - a.id));

    try {
      const rawAlerts = JSON.parse(localStorage.getItem('optica_delivery_alerts') || '[]');
      setAlerts(rawAlerts.filter((a: any) => !a.reviewed));
    } catch {}

    setLoading(false);
  }, [selectedDate, scope, sellerFilter, branchFilter, allSalesData, allPaymentsData, isAdmin, today]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('optica_ventas_updated', h);
    return () => window.removeEventListener('optica_ventas_updated', h);
  }, [load]);

  useEffect(() => {
    if (highlightedSale && saleRefs.current[highlightedSale]) {
      setTimeout(() => {
        saleRefs.current[highlightedSale]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      const t = setTimeout(() => setHighlightedSale(null), 3000);
      return () => clearTimeout(t);
    }
  }, [highlightedSale]);

  function handleAlertClick(alert: any) {
    const saleId = String(alert.saleNumber || '').replace(/^VTA-/i, '');
    if (!saleId) return;
    if (alert.timestamp) {
      const alertDate = new Date(alert.timestamp).toISOString().slice(0, 10);
      setSelectedDate(alertDate); setScope('day');
    }
    setExpandedSale(saleId); setHighlightedSale(saleId);
  }

  function handleNewSaleClick(sale: any) {
    const saleId   = String(sale.id);
    const saleDate = (sale.fecha || '').slice(0, 10);
    if (saleDate) { setSelectedDate(saleDate); setScope('day'); }
    setExpandedSale(saleId); setHighlightedSale(saleId);
  }

  function dismissOneSale(saleId: number, sellerName: string) {
    markAllSeen([String(saleId)]);
    setNewSalesAlerts(prev =>
      prev
        .map(a => a.seller === sellerName
          ? { ...a, ventas: a.ventas.filter((v: any) => v.id !== saleId) }
          : a
        )
        .filter(a => a.ventas.length > 0)
    );
  }

  function dismissNewSales(seller: string, ventas: any[]) {
    markAllSeen(ventas.map(v => String(v.id)));
    setNewSalesAlerts(prev => prev.filter(a => a.seller !== seller));
  }
  function dismissAllNewSales() {
    const allIds = newSalesAlerts.flatMap(a => a.ventas.map((v: any) => String(v.id)));
    markAllSeen(allIds);
    setNewSalesAlerts([]);
  }
  function dismissAlert(alertId: number) {
    try {
      const all = JSON.parse(localStorage.getItem('optica_delivery_alerts') || '[]');
      const updated = all.map((a: any) => a.id === alertId ? { ...a, reviewed: true } : a);
      localStorage.setItem('optica_delivery_alerts', JSON.stringify(updated));
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch {}
  }
  function handleReviewPayment(payId: string) {
    markReviewed(payId); setReviewed(getReviewed());
  }

  const dateLabel = () => {
    if (scope === 'day') return new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (scope === 'week') {
      const { start, end } = getWeekRange(selectedDate);
      return `Semana del ${new Date(start+'T12:00:00').toLocaleDateString('es-PY',{day:'2-digit',month:'2-digit'})} al ${new Date(end+'T12:00:00').toLocaleDateString('es-PY',{day:'2-digit',month:'2-digit',year:'2-digit'})}`;
    }
    if (scope === 'year') return `Año ${selectedDate.slice(0, 4)}`;
    return new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-PY', { month: 'long', year: 'numeric' });
  };

  const METHODS_COLOR: Record<string, string> = {
    efectivo: '#22c55e', transferencia: '#3b82f6', tarjeta: '#f59e0b', qr: '#C5A059', giro: '#a78bfa',
  };

  const totalNewSales = newSalesAlerts.reduce((s, a) => s + a.ventas.length, 0);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">

      {lightbox && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 lg:p-6"
          style={{ background: 'rgba(0,0,0,0.93)' }} onClick={() => setLightbox(null)}>
          <SafeImg src={lightbox} alt="comprobante"
            className="max-w-full w-full rounded-2xl object-contain"
            style={{ maxHeight: '85vh', border: '1px solid rgba(197,160,89,0.3)' }} />
          <p className="absolute bottom-6 text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Toca fuera para cerrar
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-light tracking-wider text-white">Reportes</h1>
          <p className="text-xs mt-0.5 tracking-wide capitalize" style={{ color: 'rgba(197,160,89,0.6)' }}>{dateLabel()}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(197,160,89,0.20)' }}>
            {(['day', 'week', 'month', 'year'] as const).map(s => (
              <button key={s} onClick={() => setScope(s)}
                className="px-3 py-1.5 text-xs font-light"
                style={{ background: scope===s ? 'rgba(197,160,89,0.14)' : 'transparent', color: scope===s ? '#C5A059' : 'rgba(255,255,255,0.42)' }}>
                {s === 'day' ? 'Día' : s === 'week' ? 'Semana' : s === 'month' ? 'Mes' : 'Año'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(197,160,89,0.07)', border: '1px solid rgba(197,160,89,0.18)' }}>
            <Calendar size={13} style={{ color: 'rgba(197,160,89,0.6)' }} />
            <input
              type={scope === 'month' ? 'month' : scope === 'year' ? 'number' : 'date'}
              value={scope === 'month' ? selectedDate.slice(0,7) : scope === 'year' ? selectedDate.slice(0,4) : selectedDate}
              onChange={e => {
                if (scope === 'month') setSelectedDate(e.target.value + '-01');
                else if (scope === 'year') setSelectedDate(e.target.value + '-01-01');
                else setSelectedDate(e.target.value);
              }}
              min={scope === 'year' ? '2024' : undefined}
              max={scope === 'year' ? '2030' : undefined}
              className="bg-transparent text-xs text-white border-none outline-none w-24"
            />
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

      {/* Filtros */}
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

      {/* ✅ Ventas nuevas — botón Vista individual, funciona en mobile */}
      {isAdmin && newSalesAlerts.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(197,160,89,0.35)', background: 'rgba(197,160,89,0.04)' }}>
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid rgba(197,160,89,0.15)' }}>
            <div className="flex items-center gap-2">
              <Bell size={14} style={{ color: '#C5A059' }} />
              <span className="text-xs font-light tracking-wider" style={{ color: '#C5A059' }}>
                🛍️ {totalNewSales} venta{totalNewSales !== 1 ? 's' : ''} nueva{totalNewSales !== 1 ? 's' : ''} hoy sin revisar
              </span>
            </div>
            <button onClick={dismissAllNewSales}
              className="text-xs font-light px-3 py-1 rounded-lg shrink-0"
              style={{ background: 'rgba(197,160,89,0.12)', color: 'rgba(197,160,89,0.7)', border: '1px solid rgba(197,160,89,0.2)' }}>
              Todas vistas
            </button>
          </div>
          <div className="divide-y" style={{ borderColor: 'rgba(197,160,89,0.10)' }}>
            {newSalesAlerts.map(({ seller, ventas }) => (
              <div key={seller} className="px-3 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0"
                      style={{ background: '#C5A059' }}>{ventas.length}</span>
                    <span className="text-sm font-light text-white truncate">{seller}</span>
                    <span className="text-xs font-light shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Gs. {fmt(ventas.reduce((s: number, v: any) => s + Number(v.total), 0))}
                    </span>
                  </div>
                  <button onClick={() => dismissNewSales(seller, ventas)}
                    className="text-xs font-light px-2 py-1 rounded shrink-0 ml-2"
                    style={{ color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.04)' }}>
                    Todas ✓
                  </button>
                </div>
                <div className="space-y-1.5 pl-2">
                  {ventas.map((v: any) => (
                    <div key={v.id} className="flex items-center gap-1.5">
                      {/* ✅ Fila venta — flex-1 para que no empuje el botón */}
                      <button onClick={() => handleNewSaleClick(v)}
                        className="flex-1 min-w-0 text-left flex items-center gap-2 px-2 py-2 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(197,160,89,0.10)' }}>
                        <span className="text-xs font-mono shrink-0" style={{ color: '#C5A059' }}>
                          {String(v.id).slice(-6)}
                        </span>
                        <span className="text-xs text-white font-light flex-1 truncate min-w-0">
                          {v.cliente.nombre} {v.cliente.apellido}
                        </span>
                        <span className="text-xs font-light shrink-0" style={{ color: '#22c55e' }}>
                          {fmt(Number(v.total))}
                        </span>
                        <span className="text-xs font-light shrink-0 hidden sm:inline" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {new Date(v.fecha).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </button>
                      {/* ✅ Botón Vista — tamaño fijo para mobile */}
                      <button
                        onClick={() => dismissOneSale(v.id, seller)}
                        className="shrink-0 flex items-center justify-center gap-1 rounded-lg text-xs font-light"
                        style={{
                          background: 'rgba(16,185,129,0.08)',
                          border: '1px solid rgba(16,185,129,0.25)',
                          color: '#10b981',
                          width: 52,
                          height: 36,
                          minWidth: 52,
                        }}>
                        <CheckCircle size={11} />
                        <span>Ok</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alertas de entrega */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-light tracking-widest uppercase" style={{ color: '#f59e0b' }}>
            🔔 {alerts.length} entrega{alerts.length > 1 ? 's' : ''} pendiente{alerts.length > 1 ? 's' : ''} de verificar
          </p>
          {alerts.map(alert => (
            <div key={alert.id} className="flex items-center gap-3 px-4 py-3 rounded-xl flex-wrap"
              style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <button className="flex-1 min-w-0 text-left group" onClick={() => handleAlertClick(alert)}>
                <p className="text-xs text-white font-light group-hover:underline" style={{ textDecorationColor: '#f59e0b' }}>
                  📦 <strong>{alert.customer}</strong> · <span style={{ color: '#C5A059' }}>{alert.saleNumber}</span>
                </p>
                <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Entregado por {alert.vendedora} · {new Date(alert.timestamp).toLocaleDateString('es-PY')} · Gs. {Number(alert.total).toLocaleString('es-PY')}
                </p>
              </button>
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
      <div className="grid grid-cols-3 gap-3 lg:gap-4">
        {[
          { label: 'Ventas realizadas', value: String(totalSales),           sub: 'pedidos',         icon: <BarChart3   size={16} />, color: '#3b82f6' },
          { label: 'Total facturado',   value: `${fmt(totalAmount)} Gs.`,    sub: 'ventas nuevas',   icon: <TrendingUp  size={16} />, color: '#C5A059' },
          { label: 'Total cobrado',     value: `${fmt(totalCollected)} Gs.`, sub: 'pagos recibidos', icon: <Award       size={16} />, color: '#22c55e' },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-3 lg:p-5" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${k.color}22` }}>
            <div className="flex items-center justify-between mb-2 lg:mb-4">
              <span className="text-xs font-light tracking-wider" style={{ color: 'rgba(255,255,255,0.44)' }}>{k.label}</span>
              <span style={{ color: k.color }}>{k.icon}</span>
            </div>
            <p className="text-xl lg:text-2xl font-light" style={{ color: k.color }}>{k.value}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.28)' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Por vendedora y sucursal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Users size={14} style={{ color: 'rgba(197,160,89,0.6)' }} />
            <span className="text-xs font-light tracking-wider text-white">Por vendedor</span>
          </div>
          {bySeller.length === 0
            ? <div className="text-center py-10"><p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Sin datos</p></div>
            : (
              <table className="w-full">
                <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['Vendedor','Ventas','Facturado','Cobrado'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-light" style={{ color: 'rgba(255,255,255,0.32)' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{bySeller.map((r, i) => (
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
            <Building2 size={14} style={{ color: 'rgba(197,160,89,0.6)' }} />
            <span className="text-xs font-light tracking-wider text-white">Por sucursal</span>
          </div>
          {byBranch.length === 0
            ? <div className="text-center py-10"><p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Sin datos</p></div>
            : (
              <table className="w-full">
                <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['Sucursal','Ventas','Facturado','Cobrado'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-light" style={{ color: 'rgba(255,255,255,0.32)' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{byBranch.map((r, i) => (
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

      {/* Lista de ventas */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <TrendingUp size={14} style={{ color: 'rgba(197,160,89,0.6)' }} />
            <span className="text-xs font-light tracking-wider text-white">Detalle de ventas</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(197,160,89,0.12)', color: '#C5A059' }}>{salesList.length}</span>
          </div>
        </div>
        {salesList.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Sin ventas para este período</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {salesList.map((v, i) => {
              const saleKey       = String(v.id);
              const isExp         = expandedSale === saleKey;
              const isHighlighted = highlightedSale === saleKey;
              const salePays      = allPaymentsData.filter(p => p.saleId === v.id);
              const anteojos      = (v.anteojos as any[]) || [];
              const channel       = (v as any).channel as string | undefined;
              const deliveryType  = (v as any).delivery_type as string | undefined;
              const hasConfirmar  = anteojos.some((eg: any) => eg.receta_a_confirmar);

              return (
                <div key={saleKey}
                  ref={el => { saleRefs.current[saleKey] = el; }}
                  style={{
                    transition: 'box-shadow 0.4s, outline 0.4s',
                    outline:    isHighlighted ? '2px solid rgba(245,158,11,0.7)' : '2px solid transparent',
                    borderRadius: isHighlighted ? 12 : 0,
                    boxShadow:  isHighlighted ? '0 0 24px rgba(245,158,11,0.18)' : 'none',
                  }}>
                  <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer"
                    style={{ background: isHighlighted ? 'rgba(245,158,11,0.05)' : isExp ? 'rgba(197,160,89,0.03)' : i%2===0 ? 'transparent' : 'rgba(255,255,255,0.008)' }}
                    onClick={() => setExpandedSale(isExp ? null : saleKey)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono" style={{ color: isHighlighted ? '#f59e0b' : '#C5A059' }}>VTA-{v.id}</span>
                        <span className="text-xs text-white font-light">{v.cliente.nombre} {v.cliente.apellido}</span>
                        <span className="text-xs font-light hidden sm:inline" style={{ color: 'rgba(255,255,255,0.35)' }}>{v.sucursalVenta}</span>
                        <ChannelBadge channel={channel} />
                        <DeliveryBadge type={deliveryType} />
                        {hasConfirmar && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs"
                            style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.30)' }}>
                            <AlertTriangle size={9} />Receta pendiente
                          </span>
                        )}
                        {salePays.some(p => reviewed.has(String(p.id))) && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
                            <Heart size={9} fill="#ef4444" style={{ color: '#ef4444' }} />
                            <span className="text-xs font-light" style={{ color: '#ef4444', fontSize: 9 }}>Verificado</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {v.vendedora} · {new Date(v.fecha).toLocaleDateString('es-PY', { day:'2-digit', month:'2-digit', year:'2-digit' })} {new Date(v.fecha).toLocaleTimeString('es-PY', { hour:'2-digit', minute:'2-digit' })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-white font-light">Gs. {fmt(Number(v.total))}</p>
                      {Number(v.saldo) > 0
                        ? <p className="text-xs font-light" style={{ color: '#f59e0b' }}>Debe {fmt(Number(v.saldo))}</p>
                        : <p className="text-xs font-light" style={{ color: '#10b981' }}>✓ Pagado</p>}
                    </div>
                    {v.estadoTrabajo === 'entregado' && (
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0 hidden sm:inline"
                        style={{ background: 'rgba(107,114,128,0.15)', color: '#9ca3af' }}>📦 Entregado</span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: v.metodoPago==='efectivo' ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.12)', color: v.metodoPago==='efectivo' ? '#22c55e' : '#3b82f6' }}>
                      {v.metodoPago}
                    </span>
                    <ChevronDown size={13} style={{ color: 'rgba(255,255,255,0.3)', transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                  </div>

                  {isExp && (
                    <div className="px-4 pb-5 space-y-4"
                      style={{ background: 'rgba(197,160,89,0.02)', borderTop: '1px solid rgba(197,160,89,0.08)' }}>
                      <div className="pt-3 flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>Canal:</span>
                          <ChannelBadge channel={channel ?? 'local'} />
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>Entrega:</span>
                          <DeliveryBadge type={deliveryType ?? 'retiro'} />
                        </div>
                        {v.sucursalEntrega && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <MapPin size={11} style={{ color: 'rgba(197,160,89,0.5)' }} />
                            <span className="text-xs font-light text-white">{v.sucursalEntrega}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <Clock size={11} style={{ color: 'rgba(255,255,255,0.3)' }} />
                          <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>
                            {new Date(v.fecha).toLocaleDateString('es-PY', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}
                          </span>
                        </div>
                      </div>

                      {anteojos.length > 0 && (
                        <div>
                          <p className="text-xs font-light tracking-widest uppercase mb-2" style={{ color: 'rgba(197,160,89,0.55)' }}>
                            Armazones y recetas
                          </p>
                          <div className="space-y-2">
                            {anteojos.map((eg: any, ei: number) => (
                              <EyeglassReviewCard key={ei} eg={eg} idx={ei} onLightbox={url => setLightbox(url)} />
                            ))}
                          </div>
                        </div>
                      )}

                      {salePays.length > 0 && (
                        <div>
                          <p className="text-xs font-light tracking-widest uppercase mb-2" style={{ color: 'rgba(197,160,89,0.55)' }}>
                            Pagos y comprobantes
                          </p>
                          <div className="space-y-2">
                            {salePays.map((p: any) => {
                              const mc    = METHODS_COLOR[p.metodo] ?? '#C5A059';
                              const isRev = reviewed.has(String(p.id));
                              return (
                                <div key={p.id} className="rounded-xl overflow-hidden"
                                  style={{ border: `1px solid ${isRev ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}`, background: 'rgba(255,255,255,0.02)' }}>
                                  <div className="flex items-center gap-2 px-3 py-2">
                                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${mc}18`, color: mc }}>{p.metodo}</span>
                                    <span className="text-xs text-white font-light">Gs. {fmt(Number(p.monto))}</span>
                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(197,160,89,0.08)', color: 'rgba(197,160,89,0.6)' }}>
                                      {p.tipo === 'sena' ? 'Seña' : 'Abono'}
                                    </span>
                                    <span className="text-xs ml-auto" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                      {new Date(p.fecha).toLocaleDateString('es-PY', { day:'2-digit', month:'2-digit' })}
                                    </span>
                                    {isRev
                                      ? <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
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
                                  {/* ✅ Comprobante con SafeImg — no desaparece en iOS */}
                                  {p.receipt_url ? (
                                    <div className="px-3 pb-3">
                                      <SafeImg
                                        src={p.receipt_url}
                                        alt="comprobante"
                                        className="h-32 object-contain rounded-lg border cursor-pointer"
                                        style={{ borderColor: 'rgba(197,160,89,0.2)', background: '#111', display: 'block' }}
                                        onClick={() => setLightbox(p.receipt_url)}
                                      />
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

                      {v.observaciones && (
                        <div className="px-3 py-2.5 rounded-lg"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>📝 {v.observaciones}</p>
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

      {/* Galería de fotos y recetas */}
      {photos.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2 flex-wrap">
              <Camera size={14} style={{ color: 'rgba(197,160,89,0.6)' }} />
              <span className="text-xs font-light tracking-wider text-white">Fotos y recetas</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-light" style={{ background: 'rgba(197,160,89,0.12)', color: '#C5A059' }}>
                {photos.filter(p => !p.is_receta).length} armazones
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-light" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
                {photos.filter(p => p.is_receta).length} recetas
              </span>
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
                <p className="text-center font-light"
                  style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.customer_name || p.sale_number}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.22)' }}>
          Óptica Yolanda · Reporte generado el {new Date().toLocaleString('es-PY')}
        </p>
      </div>
    </div>
  );
}
