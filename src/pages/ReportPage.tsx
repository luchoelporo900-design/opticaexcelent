import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Users, Building2, Calendar, RefreshCw, TrendingUp, Award, Printer, Camera, X, ZoomIn } from 'lucide-react';
import { getSales } from '../lib/salesStorage';
import { supabase } from '../lib/supabase';

type SellerRow = { seller_name: string; sale_count: number; total: number; collected: number };
type BranchRow = { branch_name: string; sale_count: number; total: number; collected: number };

type PhotoEntry = {
  sale_number: string;
  branch_name: string;
  seller_name: string;
  created_at: string;
  photo_url: string;
  frame_description: string;
  customer_name: string;
};

function fmt(n: number) {
  return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── Photo lightbox ────────────────────────────────────────────────────────────
function PhotoThumb({ entry }: { entry: PhotoEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative group rounded-xl overflow-hidden"
        style={{ width: 80, height: 80, border: '1px solid rgba(197,160,89,0.20)', flexShrink: 0 }}>
        <img src={entry.photo_url} alt={entry.frame_description || 'armazón'}
          className="w-full h-full object-cover" />
        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.65)' }}>
          <ZoomIn size={16} style={{ color: '#C5A059' }} />
        </div>
        <div className="absolute bottom-0 inset-x-0 px-1 py-0.5"
          style={{ background: 'rgba(0,0,0,0.6)', fontSize: 8, color: 'rgba(197,160,89,0.9)', lineHeight: 1.3 }}>
          {entry.branch_name}
        </div>
      </button>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.93)' }}
          onClick={() => setOpen(false)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <img src={entry.photo_url} alt={entry.frame_description || 'armazón'}
              className="w-full rounded-2xl" style={{ border: '1px solid rgba(197,160,89,0.3)', maxHeight: '80vh', objectFit: 'contain' }} />
            <div className="mt-3 text-center space-y-0.5">
              <p className="text-xs text-white font-light">
                {entry.sale_number} · {entry.customer_name} · {entry.branch_name}
              </p>
              {entry.frame_description && (
                <p className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.7)' }}>{entry.frame_description}</p>
              )}
              <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {new Date(entry.created_at).toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' })}
                {' · '}{entry.seller_name}
              </p>
            </div>
            <button onClick={() => setOpen(false)}
              className="absolute top-3 right-3 p-2 rounded-full"
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
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [scope, setScope] = useState<'day' | 'month'>('day');
  const [loading, setLoading] = useState(false);

  // Totals
  const [totalSales, setTotalSales] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalCollected, setTotalCollected] = useState(0);

  // Breakdowns
  const [bySeller, setBySeller] = useState<SellerRow[]>([]);
  const [byBranch, setByBranch] = useState<BranchRow[]>([]);
  const [photos,   setPhotos]   = useState<PhotoEntry[]>([]);
  const [photoBranch, setPhotoBranch] = useState<string>('');

  const load = useCallback(() => {
    setLoading(true);

    const allVentas = getSales();

    let prefix: string;
    if (scope === 'day') {
      prefix = selectedDate; // 'YYYY-MM-DD'
    } else {
      prefix = selectedDate.slice(0, 7); // 'YYYY-MM'
    }

    const ventas = allVentas.filter(v =>
      (v.fecha || '').startsWith(prefix) && v.estadoTrabajo !== 'cancelado'
    );

    setTotalSales(ventas.length);
    const facturado = ventas.reduce((a, v) => a + (Number(v.total) || 0), 0);
    setTotalAmount(facturado);
    const cobrado = ventas.reduce((a, v) => a + ((Number(v.total) || 0) - (Number(v.saldo) || 0)), 0);
    setTotalCollected(cobrado);

    // By seller
    const sellerMap: Record<string, SellerRow> = {};
    for (const v of ventas) {
      const name = v.vendedora || 'Sin vendedor';
      if (!sellerMap[name]) sellerMap[name] = { seller_name: name, sale_count: 0, total: 0, collected: 0 };
      sellerMap[name].sale_count++;
      sellerMap[name].total += Number(v.total) || 0;
      sellerMap[name].collected += (Number(v.total) || 0) - (Number(v.saldo) || 0);
    }
    setBySeller(Object.values(sellerMap).sort((a, b) => b.total - a.total));

    // By branch (sucursalVenta)
    const branchMap: Record<string, BranchRow> = {};
    for (const v of ventas) {
      const name = v.sucursalVenta || 'Sin sucursal';
      if (!branchMap[name]) branchMap[name] = { branch_name: name, sale_count: 0, total: 0, collected: 0 };
      branchMap[name].sale_count++;
      branchMap[name].total += Number(v.total) || 0;
      branchMap[name].collected += (Number(v.total) || 0) - (Number(v.saldo) || 0);
    }
    setByBranch(Object.values(branchMap).sort((a, b) => b.total - a.total));

    // Fetch photos from Supabase for the selected period
    const dateFilter = scope === 'day' ? selectedDate : selectedDate.slice(0, 7);
    supabase
      .from('sale_eyeglasses')
      .select('photo_url, frame_description, price, sales!inner(sale_number, created_at, seller_name, customer_first_name, customer_last_name, branches(name))')
      .not('photo_url', 'is', null)
      .neq('photo_url', '')
      .order('created_at', { referencedTable: 'sales', ascending: false })
      .limit(80)
      .then(({ data: egData }) => {
        const photoRows: PhotoEntry[] = [];
        for (const eg of (egData ?? []) as any[]) {
          const sale = eg.sales;
          if (!sale) continue;
          const saleDate: string = sale.created_at ?? '';
          if (!saleDate.startsWith(dateFilter)) continue;
          photoRows.push({
            sale_number: sale.sale_number ?? '',
            branch_name: sale.branches?.name ?? '',
            seller_name: sale.seller_name ?? '',
            created_at: saleDate,
            photo_url: eg.photo_url,
            frame_description: eg.frame_description ?? '',
            customer_name: `${sale.customer_first_name ?? ''} ${sale.customer_last_name ?? ''}`.trim(),
          });
        }
        // Also add localStorage photo entries
        for (const v of ventas) {
          for (const eg of (v.anteojos as any[] ?? [])) {
            if (eg.photo_url) {
              photoRows.push({
                sale_number: `VTA-${v.id}`,
                branch_name: v.sucursalVenta ?? '',
                seller_name: v.vendedora ?? '',
                created_at: v.fecha,
                photo_url: eg.photo_url,
                frame_description: eg.frame_description ?? '',
                customer_name: `${v.cliente.nombre} ${v.cliente.apellido}`.trim(),
              });
            }
          }
        }
        setPhotos(photoRows);
      });

    setLoading(false);
  }, [selectedDate, scope]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onUpdate = () => load();
    window.addEventListener('optica_ventas_updated', onUpdate);
    return () => window.removeEventListener('optica_ventas_updated', onUpdate);
  }, [load]);

  function handlePrint() {
    window.print();
  }

  const dateLabel = scope === 'day'
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-PY', { month: 'long', year: 'numeric' });

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-light tracking-wider text-white">Reportes</h1>
          <p className="text-xs text-gold-muted mt-0.5 tracking-wide capitalize">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Scope toggle */}
          <div className="flex rounded-lg overflow-hidden"
            style={{ border: '1px solid rgba(197,160,89,0.20)' }}>
            {(['day', 'month'] as const).map(s => (
              <button key={s} onClick={() => setScope(s)}
                className="px-3 py-1.5 text-xs font-light"
                style={{
                  background: scope === s ? 'rgba(197,160,89,0.14)' : 'transparent',
                  color: scope === s ? '#C5A059' : 'rgba(255,255,255,0.42)',
                }}>
                {s === 'day' ? 'Día' : 'Mes'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(197,160,89,0.07)', border: '1px solid rgba(197,160,89,0.18)' }}>
            <Calendar size={13} className="text-gold-muted" />
            <input
              type={scope === 'day' ? 'date' : 'month'}
              value={scope === 'day' ? selectedDate : selectedDate.slice(0, 7)}
              onChange={e => setSelectedDate(scope === 'day' ? e.target.value : e.target.value + '-01')}
              className="bg-transparent text-xs text-white border-none outline-none"
            />
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light"
            style={{ background: 'rgba(197,160,89,0.10)', border: '1px solid rgba(197,160,89,0.28)', color: '#C5A059' }}>
            <Printer size={13} />
            Imprimir
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Ventas realizadas', value: String(totalSales), sub: 'pedidos', icon: <BarChart3 size={16} />, color: '#3b82f6' },
          { label: 'Total facturado', value: `${fmt(totalAmount)} Gs.`, sub: 'ventas nuevas', icon: <TrendingUp size={16} />, color: '#C5A059' },
          { label: 'Total cobrado', value: `${fmt(totalCollected)} Gs.`, sub: 'pagos recibidos', icon: <Award size={16} />, color: '#22c55e' },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-5"
            style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${k.color}22` }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-light tracking-wider" style={{ color: 'rgba(255,255,255,0.44)' }}>
                {k.label}
              </span>
              <span style={{ color: k.color }}>{k.icon}</span>
            </div>
            <p className="text-2xl font-light" style={{ color: k.color }}>{k.value}</p>
            <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.28)' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* By seller */}
        <div className="rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 px-5 py-4"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Users size={14} className="text-gold-muted" />
            <span className="text-xs font-light tracking-wider text-white">Por vendedor</span>
          </div>
          {bySeller.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Sin datos</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['Vendedor', 'Ventas', 'Facturado', 'Cobrado'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-light"
                      style={{ color: 'rgba(255,255,255,0.32)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bySeller.map((r, i) => (
                  <tr key={r.seller_name}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td className="px-4 py-3 text-xs text-white font-light">{r.seller_name}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#3b82f6' }}>{r.sale_count}</td>
                    <td className="px-4 py-3 text-xs font-light" style={{ color: '#C5A059' }}>{fmt(r.total)}</td>
                    <td className="px-4 py-3 text-xs font-light" style={{ color: '#22c55e' }}>{fmt(r.collected)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* By branch */}
        <div className="rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 px-5 py-4"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Building2 size={14} className="text-gold-muted" />
            <span className="text-xs font-light tracking-wider text-white">Por sucursal</span>
          </div>
          {byBranch.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Sin datos</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['Sucursal', 'Ventas', 'Facturado', 'Cobrado'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-light"
                      style={{ color: 'rgba(255,255,255,0.32)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byBranch.map((r, i) => (
                  <tr key={r.branch_name}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td className="px-4 py-3 text-xs text-white font-light">{r.branch_name}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#3b82f6' }}>{r.sale_count}</td>
                    <td className="px-4 py-3 text-xs font-light" style={{ color: '#C5A059' }}>{fmt(r.total)}</td>
                    <td className="px-4 py-3 text-xs font-light" style={{ color: '#22c55e' }}>{fmt(r.collected)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Photo gallery */}
      {photos.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2">
              <Camera size={14} className="text-gold-muted" />
              <span className="text-xs font-light tracking-wider text-white">Fotos de armazones</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-light"
                style={{ background: 'rgba(197,160,89,0.12)', color: '#C5A059' }}>
                {photos.length}
              </span>
            </div>
            {/* Branch filter */}
            <select
              value={photoBranch}
              onChange={e => setPhotoBranch(e.target.value)}
              className="bg-transparent text-xs outline-none px-2 py-1 rounded-lg"
              style={{ border: '1px solid rgba(197,160,89,0.20)', color: 'rgba(255,255,255,0.6)' }}>
              <option value="" style={{ background: '#111' }}>Todas las sucursales</option>
              {[...new Set(photos.map(p => p.branch_name).filter(Boolean))].map(b => (
                <option key={b} value={b} style={{ background: '#111' }}>{b}</option>
              ))}
            </select>
          </div>
          <div className="p-4 flex flex-wrap gap-3">
            {photos
              .filter(p => !photoBranch || p.branch_name === photoBranch)
              .map((p, i) => (
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

      {/* Printable footer note */}
      <div className="text-center pt-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.22)' }}>
          Óptica Yolanda · Reporte generado el {new Date().toLocaleString('es-PY')}
        </p>
      </div>
    </div>
  );
}
