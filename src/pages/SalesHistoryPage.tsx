import { useState, useCallback, useEffect } from 'react';
import { Search, RefreshCw, ChevronDown, Package, Clock, CheckCircle, XCircle, FlaskConical, ShoppingBag, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSales } from '../lib/salesStorage';

type SaleStatus = 'pendiente' | 'en_proceso' | 'en_laboratorio' | 'listo' | 'pagado_total' | 'entregado' | 'cancelado';

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendiente:      { label: 'Pendiente',      color: '#f59e0b', icon: <Clock        size={11} /> },
  en_proceso:     { label: 'En Proceso',     color: '#f59e0b', icon: <Clock        size={11} /> },
  en_laboratorio: { label: 'Laboratorio',    color: '#3b82f6', icon: <FlaskConical size={11} /> },
  listo:          { label: 'Listo',          color: '#10b981', icon: <CheckCircle  size={11} /> },
  pagado_total:   { label: 'Pagado Total',   color: '#22c55e', icon: <CheckCircle  size={11} /> },
  entregado:      { label: 'Entregado',      color: '#6b7280', icon: <Package      size={11} /> },
  cancelado:      { label: 'Cancelado',      color: '#ef4444', icon: <XCircle      size={11} /> },
};

function fmt(n: number) {
  return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export default function SalesHistoryPage() {
  const { profile } = useAuth();
  const isAdmin     = profile?.role === 'admin' || profile?.role === 'gerente';
  const isVendedora = profile?.role === 'vendedora';

  const [sales,        setSales]        = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [expandedId,   setExpandedId]   = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    let all = getSales();
    if (isVendedora) all = all.filter(v => v.vendedora === profile?.full_name);
    all = all.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    setSales(all);
    setLoading(false);
  }, [isVendedora, profile?.full_name]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('optica_ventas_updated', h);
    return () => window.removeEventListener('optica_ventas_updated', h);
  }, [load]);

  // Búsqueda por nombre, CI, celular o número de venta
  const filtered = sales.filter(v => {
    if (statusFilter !== 'todos' && v.estadoTrabajo !== statusFilter) return false;
    if (search) {
      const q    = normalize(search);
      const name = normalize(`${v.cliente.nombre} ${v.cliente.apellido}`);
      const ci   = normalize(v.cliente.ci || '');
      const tel  = (v.cliente.telefono || '').replace(/\D/g, '');
      const qTel = search.replace(/\D/g, '');
      const vtaId = String(v.id);
      return (
        name.includes(q) ||
        ci.includes(q) ||
        (qTel.length >= 3 && tel.includes(qTel)) ||
        vtaId.includes(q) ||
        (v.vendedora || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const countBy = (status: string) => sales.filter(v => v.estadoTrabajo === status).length;
  const totalFacturado = sales.reduce((s, v) => s + (Number(v.total) || 0), 0);
  const totalCobrado   = sales.reduce((s, v) => s + ((Number(v.total) || 0) - (Number(v.saldo) || 0)), 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-light tracking-wider text-white">
            {isVendedora ? 'Mis Ventas' : 'Historial de Ventas'}
          </h1>
          <p className="text-xs text-gold-muted mt-0.5 tracking-wide">
            {isVendedora ? `${profile?.full_name} · todas tus ventas` : 'Registro completo de ventas'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border"
            style={{ borderColor: 'rgba(197,160,89,0.2)', background: 'rgba(255,255,255,0.02)' }}>
            <Search size={13} style={{ color: 'rgba(197,160,89,0.5)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nombre, C.I., celular o venta..."
              className="bg-transparent text-xs text-white outline-none w-44"
            />
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.2)' }}>
          <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Total ventas</p>
          <p className="text-2xl font-light" style={{ color: '#C5A059' }}>{sales.length}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Entregadas</p>
          <p className="text-2xl font-light" style={{ color: '#10b981' }}>{countBy('entregado')}</p>
        </div>
        {isAdmin && (
          <>
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.2)' }}>
              <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Total facturado</p>
              <p className="text-lg font-light" style={{ color: '#C5A059' }}>Gs. {fmt(totalFacturado)}</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Total cobrado</p>
              <p className="text-lg font-light" style={{ color: '#22c55e' }}>Gs. {fmt(totalCobrado)}</p>
            </div>
          </>
        )}
      </div>

      {/* Filtros por estado */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setStatusFilter('todos')}
          className="px-3 py-1.5 rounded-lg text-xs font-light"
          style={{ background: statusFilter === 'todos' ? 'rgba(197,160,89,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${statusFilter === 'todos' ? 'rgba(197,160,89,0.4)' : 'rgba(255,255,255,0.08)'}`, color: statusFilter === 'todos' ? '#C5A059' : 'rgba(255,255,255,0.4)' }}>
          Todas ({sales.length})
        </button>
        {Object.entries(STATUS_CFG).map(([key, cfg]) => {
          const count = countBy(key);
          if (count === 0) return null;
          return (
            <button key={key} onClick={() => setStatusFilter(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light"
              style={{ background: statusFilter === key ? `${cfg.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${statusFilter === key ? cfg.color + '44' : 'rgba(255,255,255,0.08)'}`, color: statusFilter === key ? cfg.color : 'rgba(255,255,255,0.4)' }}>
              {cfg.icon}{cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Lista */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        {loading ? (
          <div className="p-6 space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded shimmer" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag size={32} style={{ color: 'rgba(197,160,89,0.2)', margin: '0 auto 12px' }} />
            <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {search ? 'Sin resultados para esa búsqueda' : 'No hay ventas registradas'}
            </p>
          </div>
        ) : (
          <div>
            {/* Header tabla */}
            <div className="grid px-5 py-2.5 text-xs font-light"
              style={{ gridTemplateColumns: '1fr 130px 100px 120px 36px', borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.30)' }}>
              <span>Cliente / Venta</span>
              <span>Total / Pagado</span>
              <span>Saldo</span>
              <span>Estado</span>
              <span />
            </div>

            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              {filtered.map((v, saleIdx) => {
                const saleNum  = saleIdx + 1;
                const key      = String(v.id);
                const isExp    = expandedId === key;
                const sc       = STATUS_CFG[v.estadoTrabajo] ?? STATUS_CFG.pendiente;
                const name     = `${v.cliente.nombre} ${v.cliente.apellido}`.trim() || '—';
                const anteojos = (v.anteojos as any[]) || [];
                const waUrl    = v.cliente.telefono
                  ? `https://wa.me/595${v.cliente.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${v.cliente.nombre}! Te contactamos de Óptica Yolanda.`)}`
                  : null;
                const fechaStr = new Date(v.fecha).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: '2-digit' });

                return (
                  <div key={key}>
                    <div className="grid items-center gap-3 px-5 py-3.5 cursor-pointer"
                      style={{ gridTemplateColumns: '1fr 130px 100px 120px 36px', background: isExp ? 'rgba(197,160,89,0.03)' : 'transparent' }}
                      onMouseEnter={e => { if (!isExp) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.015)'; }}
                      onMouseLeave={e => { if (!isExp) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      onClick={() => setExpandedId(isExp ? null : key)}>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium text-black shrink-0"
                            style={{ background: '#C5A059', fontSize: 9 }}>{saleNum}</span>
                          <p className="text-sm text-white font-light truncate">{name}</p>
                        </div>
                        <p className="text-xs font-light mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.36)' }}>
                          <span style={{ color: '#C5A059' }}>VTA-{v.id}</span>
                          {v.sucursalVenta ? ` · ${v.sucursalVenta}` : ''}
                          {isAdmin && v.vendedora ? ` · ${v.vendedora}` : ''}
                          {' · '}<span style={{ color: 'rgba(255,255,255,0.5)' }}>{fechaStr}</span>
                        </p>
                        {/* CI y celular siempre visibles bajo el nombre */}
                        <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
                          {v.cliente.ci   ? <span>CI: <span style={{ color: 'rgba(197,160,89,0.6)' }}>{v.cliente.ci}</span></span> : null}
                          {v.cliente.ci && v.cliente.telefono ? ' · ' : ''}
                          {v.cliente.telefono ? <span>📞 {v.cliente.telefono}</span> : null}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-white font-light">Gs. {fmt(Number(v.total))}</p>
                        <p className="text-xs font-light mt-0.5" style={{ color: '#10b981' }}>Pagó {fmt(Number(v.sena))}</p>
                      </div>

                      <p className="text-sm font-light" style={{ color: Number(v.saldo) > 0 ? '#f59e0b' : '#10b981' }}>
                        {Number(v.saldo) > 0 ? `Gs. ${fmt(Number(v.saldo))}` : '✓ Pagado'}
                      </p>

                      <span className="px-2 py-1 rounded text-xs font-light inline-flex items-center gap-1"
                        style={{ background: `${sc.color}18`, color: sc.color }}>
                        {sc.icon}{sc.label}
                      </span>

                      <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)', transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </div>

                    {/* Panel expandido */}
                    {isExp && (
                      <div className="px-5 pb-5 space-y-4" style={{ background: 'rgba(197,160,89,0.02)' }}>

                        {/* Info cliente */}
                        <div className="flex items-center gap-3 pt-2 flex-wrap">
                          {v.cliente.telefono && (
                            <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.45)' }}>
                              📞 {v.cliente.telefono}
                            </span>
                          )}
                          {v.cliente.ci && (
                            <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>
                              CI: {v.cliente.ci}
                            </span>
                          )}
                          <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            📅 {new Date(v.fecha).toLocaleDateString('es-PY', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                          </span>
                          {waUrl && (
                            <a href={waUrl} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light"
                              style={{ background: 'rgba(37,211,102,0.1)', color: '#25D366', border: '1px solid rgba(37,211,102,0.25)' }}>
                              <MessageCircle size={12} />WhatsApp
                            </a>
                          )}
                        </div>

                        {/* Anteojos con receta */}
                        {anteojos.length > 0 && (
                          <div className="space-y-3">
                            <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.55)' }}>
                              Lentes vendidos
                            </p>
                            {anteojos.map((eg: any, i: number) => (
                              <div key={i} className="rounded-xl p-4 space-y-3"
                                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(197,160,89,0.12)' }}>
                                <div className="flex items-start gap-3">
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
                                    <p className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.7)' }}>Armazón {i + 1}</p>
                                    {eg.frame_description && <p className="text-sm text-white font-light">{eg.frame_description}</p>}
                                    <div className="flex gap-2 flex-wrap">
                                      {eg.crystals   && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>{eg.crystals}</span>}
                                      {eg.treatments && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>{eg.treatments}</span>}
                                      {eg.price      && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(197,160,89,0.1)', color: '#C5A059' }}>Gs. {Number(eg.price).toLocaleString('es-PY')}</span>}
                                    </div>
                                  </div>
                                </div>

                                {/* ── RECETA ÓPTICA ── siempre visible si existe */}
                                {eg.prescription && (
                                  <div className="rounded-lg p-3 space-y-2"
                                    style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.18)' }}>
                                    <p className="text-xs font-light tracking-widest uppercase flex items-center gap-1.5"
                                      style={{ color: 'rgba(197,160,89,0.7)' }}>
                                      <FlaskConical size={11} style={{ color: '#3b82f6' }} />
                                      Receta óptica
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <p className="text-xs font-light mb-1" style={{ color: '#C5A059' }}>OD (ojo derecho)</p>
                                        <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.75)' }}>
                                          {eg.prescription.od_esfera || '—'} / {eg.prescription.od_cilindro || '—'} x {eg.prescription.od_eje || '—'}
                                          {eg.prescription.od_altura ? ` · Alt: ${eg.prescription.od_altura}` : ''}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs font-light mb-1" style={{ color: '#C5A059' }}>OI (ojo izquierdo)</p>
                                        <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.75)' }}>
                                          {eg.prescription.oi_esfera || '—'} / {eg.prescription.oi_cilindro || '—'} x {eg.prescription.oi_eje || '—'}
                                          {eg.prescription.oi_altura ? ` · Alt: ${eg.prescription.oi_altura}` : ''}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-3 text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                      {eg.prescription.add && <span>ADD: {eg.prescription.add}</span>}
                                      {eg.prescription.dp  && <span>DP: {eg.prescription.dp}</span>}
                                      {eg.prescription.obs && <span>{eg.prescription.obs}</span>}
                                    </div>
                                  </div>
                                )}

                                {/* También soporta prescription_text como texto plano */}
                                {!eg.prescription && eg.prescription_text && (
                                  <div className="rounded-lg px-3 py-2"
                                    style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.12)' }}>
                                    <p className="text-xs font-light tracking-widest uppercase mb-1" style={{ color: 'rgba(197,160,89,0.6)' }}>Receta</p>
                                    <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8 }}>
                                      {eg.prescription_text}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Observaciones */}
                        {v.observaciones && (
                          <div className="px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>📝 {v.observaciones}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
