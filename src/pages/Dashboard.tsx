import { useEffect, useState } from 'react';
import { TrendingUp, ShoppingCart, Users, FlaskConical, Clock, CheckCircle, AlertCircle, Building2, Trophy, Medal, X, DollarSign, MessageCircle, Plus, Minus, Banknote, CreditCard } from 'lucide-react';
import { supabase, Sale, LabOrder } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getSales, saveSale } from '../lib/salesStorage';

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

type Stats = {
  totalSales: number;
  totalCustomers: number;
  pendingLab: number;
  readyLab: number;
  todaySales: number;
  monthlySales: number;
};

type BranchStat = { name: string; count: number; total: number };

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({ totalSales: 0, totalCustomers: 0, pendingLab: 0, readyLab: 0, todaySales: 0, monthlySales: 0 });
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [branchStats, setBranchStats] = useState<BranchStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayCash, setTodayCash] = useState(0);
  const [myPoints, setMyPoints] = useState<number>(0);
  const [prizeLevel, setPrizeLevel] = useState<'sin_nivel' | 'bronce' | 'oro'>('sin_nivel');
  const [dismissedLevel, setDismissedLevel] = useState<string | null>(() => sessionStorage.getItem('dismissedPrize'));

  // ── Ingreso / Gasto quick-entry (vendedora) ─────────────────────────────
  const [cashModal, setCashModal] = useState<'ingreso' | 'gasto' | null>(null);
  const [cashDesc, setCashDesc] = useState('');
  const [cashAmt, setCashAmt] = useState('');
  const [cashMethod, setCashMethod] = useState<'efectivo' | 'transferencia' | 'tarjeta'>('efectivo');
  const [savingCash, setSavingCash] = useState(false);
  const [cashMsg, setCashMsg] = useState('');

  useEffect(() => {
    loadDashboard();
    loadMyPoints();

    // Reload whenever a sale is saved from POSPage (same tab)
    const onUpdate = () => loadDashboard();
    window.addEventListener('optica_ventas_updated', onUpdate);
    // Also reload when tab becomes visible again (user switched away and back)
    const onVisible = () => { if (document.visibilityState === 'visible') loadDashboard(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('optica_ventas_updated', onUpdate);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  function loadDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 7);

    const allVentas = getSales();
    const isVendedor = profile?.role === 'vendedor';
    const ventas = isVendedor
      ? allVentas.filter(v => v.vendedora === profile?.full_name)
      : allVentas;

    const todaySalesData = ventas.filter(v => (v.fecha || '').startsWith(today));
    const monthlySalesData = ventas.filter(v => (v.fecha || '').startsWith(monthStart));

    const totalFacturado = monthlySalesData.reduce((a, v) => a + (Number(v.total) || 0), 0);
    const totalCobradoHoy = todaySalesData.reduce((a, v) => a + ((Number(v.total) || 0) - (Number(v.saldo) || 0)), 0);
    setTodayCash(totalCobradoHoy);

    // Branch aggregation (month)
    const bMap: Record<string, { name: string; count: number; total: number }> = {};
    monthlySalesData.forEach(v => {
      const bn = v.sucursalVenta || 'N/A';
      if (!bMap[bn]) bMap[bn] = { name: bn, count: 0, total: 0 };
      bMap[bn].count++;
      bMap[bn].total += Number(v.total) || 0;
    });
    setBranchStats(Object.values(bMap));

    setStats({
      totalSales: ventas.length,
      totalCustomers: isVendedor ? ventas.length : 0,
      pendingLab: 0,
      readyLab: 0,
      todaySales: todaySalesData.length,
      monthlySales: totalFacturado,
    });

    // Recent sales: last 8, newest first
    const recent = ventas.slice(-8).reverse().map(v => ({
      id: String(v.id),
      sale_number: `VTA-${v.id}`,
      created_at: v.fecha,
      total: v.total,
      deposit: v.sena,
      balance: v.saldo,
      status: v.estadoTrabajo || 'pendiente',
      seller_name: v.vendedora,
      customer_first_name: v.cliente?.nombre || '',
      customer_last_name: v.cliente?.apellido || '',
      customers: v.cliente ? { full_name: `${v.cliente.nombre} ${v.cliente.apellido}`.trim(), ci: v.cliente.ci || '' } : null,
      branches: v.sucursalVenta ? { name: v.sucursalVenta } : null,
    }));
    setRecentSales(recent as any);

    // Lab orders still from Supabase
    supabase.from('lab_orders').select('*, sales(sale_number, customers(full_name))').order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => { setLabOrders((data || []) as any); });

    if (!isVendedor) {
      supabase.from('customers').select('id', { count: 'exact', head: true })
        .then(({ count }) => { setStats(s => ({ ...s, totalCustomers: count || 0 })); });
    }

    setLoading(false);
  }

  function createDemoSale() {
    saveSale({
      id: Date.now(),
      fecha: new Date().toISOString(),
      cliente: { nombre: 'Cliente', apellido: 'Demo', telefono: '0981000000', ci: '1234567' },
      sucursalVenta: 'Azara',
      sucursalEntrega: 'Azara',
      sucursalCobro: 'Azara',
      vendedora: 'Vendedora Demo',
      total: 500000,
      sena: 200000,
      saldo: 300000,
      metodoPago: 'efectivo',
      estadoTrabajo: 'pendiente',
      anteojos: [],
      observaciones: 'Venta demo para prueba',
    });
    loadDashboard();
    alert('Venta demo creada. Verificar Dashboard, Ventas recientes y Reportes.');
  }

  async function loadMyPoints() {
    if (!profile) return;
    const { data } = await supabase
      .from('monthly_seller_summary')
      .select('total_points, prize_level')
      .eq('seller_id', profile.id)
      .eq('sale_month', CURRENT_MONTH)
      .maybeSingle();
    if (data) {
      setMyPoints(Number(data.total_points));
      setPrizeLevel(data.prize_level as any);
    }
  }

  const isVendedora = profile?.role === 'vendedora';

  const statCards = [
    { label: 'Ventas del Mes', value: `Gs. ${stats.monthlySales.toLocaleString()}`, icon: <TrendingUp size={20} />, sub: `${stats.todaySales} hoy` },
    { label: 'Cobrado Hoy', value: `Gs. ${todayCash.toLocaleString()}`, icon: <DollarSign size={20} />, sub: 'Todos los métodos' },
    { label: 'Total Clientes', value: stats.totalCustomers.toLocaleString(), icon: <Users size={20} />, sub: 'Registrados' },
    { label: 'En Laboratorio', value: stats.pendingLab.toString(), icon: <FlaskConical size={20} />, sub: `${stats.readyLab} listos` },
  ];

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pendiente: { label: 'Pendiente', color: '#f59e0b', icon: <Clock size={12} /> },
    en_proceso: { label: 'En Proceso', color: '#3b82f6', icon: <AlertCircle size={12} /> },
    en_laboratorio: { label: 'Laboratorio', color: '#3b82f6', icon: <AlertCircle size={12} /> },
    listo: { label: 'Listo', color: '#10b981', icon: <CheckCircle size={12} /> },
    entregado: { label: 'Entregado', color: '#6b7280', icon: <CheckCircle size={12} /> },
    cancelado: { label: 'Cancelado', color: '#ef4444', icon: <AlertCircle size={12} /> },
  };

  const labStatusConfig: Record<string, { label: string; color: string }> = {
    enviado: { label: 'Enviado', color: '#f59e0b' },
    proceso: { label: 'En Proceso', color: '#3b82f6' },
    listo: { label: 'Listo', color: '#10b981' },
    entregado: { label: 'Entregado', color: '#6b7280' },
  };

  async function saveCashEntry() {
    const amt = parseFloat(cashAmt);
    if (!amt || amt <= 0 || !cashDesc.trim()) return;
    setSavingCash(true);
    const branchId = profile?.branch_id?.toLowerCase() ?? '';
    const today = new Date().toISOString().split('T')[0];
    if (cashModal === 'gasto') {
      await supabase.from('expenses').insert([{
        branch_id: branchId,
        amount: amt,
        method: cashMethod,
        description: cashDesc.trim(),
        registered_by: profile?.id ?? null,
        expense_date: today,
      }]);
    } else {
      // For "ingreso manual" we just fire the global event so CashPage refreshes
      window.dispatchEvent(new CustomEvent('optica_ventas_updated'));
    }
    setSavingCash(false);
    setCashModal(null);
    setCashDesc(''); setCashAmt('');
    setCashMsg(cashModal === 'gasto' ? 'Gasto registrado.' : 'Ingreso registrado.');
    setTimeout(() => setCashMsg(''), 4000);
  }

  // ── Vendedora view ─────────────────────────────────────────────────────
  if (isVendedora) {
    const today = new Date().toISOString().split('T')[0];
    const allMySales = getSales().filter(v => v.vendedora === profile?.full_name);
    const myTodaySales = allMySales.filter(v => (v.fecha || '').startsWith(today));
    const myTodayTotal = myTodaySales.reduce((a, v) => a + (Number(v.total) || 0), 0);
    const myPending = allMySales.filter(v =>
      v.estadoTrabajo === 'pendiente' || v.estadoTrabajo === 'en_laboratorio'
    ).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    function buildWaLink(clientName: string, phone: string, branchName: string) {
      if (!phone) return null;
      const msg = `Hola ${clientName}, te saludamos de Óptica Yolanda. Te avisamos que tus lentes ya están listos en la sucursal de ${branchName}. ¡Te esperamos!`;
      return `https://wa.me/595${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
    }

    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl text-white font-light tracking-wider">Mi Panel</h1>
            <p className="text-sm font-light mt-1" style={{ color: 'rgba(197,160,89,0.7)' }}>
              {profile?.full_name} · {new Date().toLocaleDateString('es-PY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          {/* Quick-action buttons */}
          <div className="flex items-center gap-2">
            <button onClick={() => { setCashModal('ingreso'); setCashDesc(''); setCashAmt(''); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-light transition-opacity hover:opacity-80"
              style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.28)', color: '#22c55e' }}>
              <Plus size={13} />Ingreso Caja
            </button>
            <button onClick={() => { setCashModal('gasto'); setCashDesc(''); setCashAmt(''); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-light transition-opacity hover:opacity-80"
              style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
              <Minus size={13} />Registrar Gasto
            </button>
          </div>
        </div>

        {/* Feedback message */}
        {cashMsg && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-light"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
            <CheckCircle size={13} />{cashMsg}
          </div>
        )}

        {/* Ingreso / Gasto modal inline */}
        {cashModal && (
          <div className="rounded-2xl border p-5 space-y-4"
            style={{
              background: cashModal === 'gasto' ? 'rgba(239,68,68,0.05)' : 'rgba(34,197,94,0.05)',
              borderColor: cashModal === 'gasto' ? 'rgba(239,68,68,0.28)' : 'rgba(34,197,94,0.28)',
            }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-light text-white">
                {cashModal === 'gasto' ? 'Registrar Gasto' : 'Registrar Ingreso'}
              </p>
              <button onClick={() => setCashModal(null)} className="opacity-40 hover:opacity-100 transition-opacity" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <X size={14} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={cashDesc} onChange={e => setCashDesc(e.target.value)}
                placeholder={cashModal === 'gasto' ? 'Descripción (ej. limpieza, refrigerio)' : 'Descripción del ingreso'}
                className="px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border"
                style={{ borderColor: 'rgba(197,160,89,0.22)' }} />
              <input value={cashAmt} onChange={e => setCashAmt(e.target.value)}
                type="number" placeholder="Monto Gs."
                className="px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border"
                style={{ borderColor: 'rgba(197,160,89,0.22)' }} />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {([
                { id: 'efectivo' as const, label: 'Efectivo', icon: <Banknote size={12} />, color: '#22c55e' },
                { id: 'transferencia' as const, label: 'Transfer.', icon: <DollarSign size={12} />, color: '#3b82f6' },
                { id: 'tarjeta' as const, label: 'POS', icon: <CreditCard size={12} />, color: '#f59e0b' },
              ]).map(m => (
                <button key={m.id} onClick={() => setCashMethod(m.id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-light"
                  style={{
                    background: cashMethod === m.id ? `${m.color}18` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${cashMethod === m.id ? m.color + '44' : 'rgba(255,255,255,0.10)'}`,
                    color: cashMethod === m.id ? m.color : 'rgba(255,255,255,0.45)',
                  }}>
                  {m.icon}{m.label}
                </button>
              ))}
              <button onClick={saveCashEntry} disabled={savingCash || !cashAmt || !cashDesc.trim()}
                className="ml-auto px-5 py-1.5 rounded-lg text-xs font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: cashModal === 'gasto' ? '#ef4444' : '#22c55e' }}>
                {savingCash ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        {/* Prize banner */}
        {prizeLevel !== 'sin_nivel' && dismissedLevel !== prizeLevel && (
          <div className="relative rounded-2xl border p-5 overflow-hidden"
            style={{
              background: prizeLevel === 'oro'
                ? 'linear-gradient(135deg, rgba(197,160,89,0.12), rgba(139,105,20,0.08))'
                : 'linear-gradient(135deg, rgba(205,127,50,0.12), rgba(205,127,50,0.05))',
              borderColor: prizeLevel === 'oro' ? 'rgba(197,160,89,0.5)' : 'rgba(205,127,50,0.5)',
            }}>
            <button
              onClick={() => { setDismissedLevel(prizeLevel); sessionStorage.setItem('dismissedPrize', prizeLevel); }}
              className="absolute top-3 right-3 opacity-40 hover:opacity-100 transition-opacity"
              style={{ color: 'rgba(255,255,255,0.6)' }}>
              <X size={14} />
            </button>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                style={{ background: prizeLevel === 'oro' ? 'rgba(197,160,89,0.2)' : 'rgba(205,127,50,0.2)', border: `2px solid ${prizeLevel === 'oro' ? '#C5A059' : '#cd7f32'}` }}>
                {prizeLevel === 'oro' ? <Trophy size={22} style={{ color: '#C5A059' }} /> : <Medal size={22} style={{ color: '#cd7f32' }} />}
              </div>
              <div>
                <p className="text-white font-medium text-sm tracking-wide">
                  {prizeLevel === 'oro' ? `Felicitaciones, ${profile?.full_name?.split(' ')[0]}!` : `Excelente trabajo, ${profile?.full_name?.split(' ')[0]}!`}
                </p>
                <p className="text-xs font-light mt-0.5" style={{ color: prizeLevel === 'oro' ? 'rgba(197,160,89,0.9)' : 'rgba(205,127,50,0.9)' }}>
                  {prizeLevel === 'oro'
                    ? `Nivel Oro — ${myPoints.toFixed(1)} puntos este mes. Premio mayor desbloqueado!`
                    : `Nivel Bronce — ${myPoints.toFixed(1)} puntos. A 2 puntos del Nivel Oro!`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Mis Ventas Hoy', value: myTodaySales.length.toString(), icon: <ShoppingCart size={18} />, sub: 'registradas hoy' },
            { label: 'Total Facturado Hoy', value: `Gs. ${myTodayTotal.toLocaleString()}`, icon: <TrendingUp size={18} />, sub: 'mis ventas' },
            { label: 'Pendientes de Entrega', value: myPending.length.toString(), icon: <Clock size={18} />, sub: 'en taller o pendiente' },
          ].map((card, i) => (
            <div key={i} className="stat-card p-5">
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full -translate-y-6 translate-x-6 pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(197,160,89,0.13) 0%, transparent 70%)' }} />
              <div className="flex items-start justify-between relative">
                <div>
                  <p className="section-label">{card.label}</p>
                  <p className="text-2xl text-white font-light mt-1.5">{card.value}</p>
                  <p className="text-xs mt-1 text-gold-muted capitalize">{card.sub}</p>
                </div>
                <div className="p-2.5 rounded-xl" style={{ background: 'rgba(197,160,89,0.10)', color: '#C5A059' }}>
                  {card.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pendientes de Entrega */}
        <div className="premium-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 soft-border-bottom">
            <div>
              <h2 className="text-white text-sm font-light tracking-wider">Pendientes de Entrega</h2>
              <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Estado: En Taller o Pendiente — clic en WhatsApp para avisar al cliente
              </p>
            </div>
            <Clock size={16} className="text-gold gold-glow-sm" />
          </div>
          {myPending.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Clock size={22} /></div>
              <p className="text-sm font-light">Sin pendientes de entrega</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              {myPending.map(v => {
                const clientName = `${v.cliente.nombre} ${v.cliente.apellido}`.trim() || '—';
                const phone = v.cliente.telefono || '';
                const waLink = buildWaLink(clientName, phone, v.sucursalEntrega);
                const statusColor = v.estadoTrabajo === 'en_laboratorio' ? '#3b82f6' : '#f59e0b';
                const statusLabel = v.estadoTrabajo === 'en_laboratorio' ? 'En Taller' : 'Pendiente';
                return (
                  <div key={v.id} className="flex items-center gap-3 px-5 py-3.5"
                    style={{ transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(197,160,89,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-white font-light truncate">{clientName}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full shrink-0 font-light"
                          style={{ background: `${statusColor}18`, color: statusColor }}>
                          {statusLabel}
                        </span>
                      </div>
                      <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {new Date(v.fecha).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })} · {v.sucursalEntrega} · Gs. {Number(v.total).toLocaleString()}
                      </p>
                    </div>
                    {waLink ? (
                      <a href={waLink} target="_blank" rel="noreferrer"
                        title={`Avisar a ${clientName} por WhatsApp`}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light transition-opacity hover:opacity-75"
                        style={{ background: 'rgba(37,211,102,0.12)', color: '#25D366', border: '1px solid rgba(37,211,102,0.25)' }}>
                        <MessageCircle size={12} />
                        WhatsApp
                      </a>
                    ) : (
                      <span className="text-xs font-light shrink-0" style={{ color: 'rgba(255,255,255,0.22)' }}>Sin teléfono</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* My today sales table */}
        <div className="premium-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 soft-border-bottom">
            <h2 className="text-white text-sm font-light tracking-wider">Mis Ventas de Hoy</h2>
            <ShoppingCart size={16} className="text-gold gold-glow-sm" />
          </div>
          {loading ? (
            <div className="p-5 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-8 rounded shimmer" />)}</div>
          ) : myTodaySales.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><ShoppingCart size={22} /></div>
              <p className="text-sm font-light">Aún no registraste ventas hoy</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="soft-border-bottom">
                    {['N° Venta', 'Cliente', 'WhatsApp', 'Total', 'Estado'].map(h => (
                      <th key={h} className="px-4 py-3 text-left section-label">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {myTodaySales.map(v => {
                    const sc = statusConfig[v.estadoTrabajo] || statusConfig.pendiente;
                    const clientName = `${v.cliente.nombre} ${v.cliente.apellido}`.trim() || '—';
                    const phone = v.cliente.telefono || '';
                    const waLink = buildWaLink(clientName, phone, v.sucursalEntrega);
                    return (
                      <tr key={v.id} className="table-row">
                        <td className="px-4 py-3 font-mono text-gold">VTA-{v.id}</td>
                        <td className="px-4 py-3 text-white font-light">{clientName}</td>
                        <td className="px-4 py-3">
                          {waLink ? (
                            <a href={waLink} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1.5 transition-opacity hover:opacity-75"
                              style={{ color: '#25D366' }}>
                              <MessageCircle size={13} />
                              {phone}
                            </a>
                          ) : <span style={{ color: 'rgba(255,255,255,0.28)' }}>—</span>}
                        </td>
                        <td className="px-4 py-3 text-white font-light">Gs. {Number(v.total).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className="status-badge" style={{ background: `${sc.color}1e`, color: sc.color }}>
                            {sc.icon}{sc.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }
  // ── End vendedora view ──────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-white font-light tracking-wider">Dashboard</h1>
          <p className="text-sm font-light mt-1" style={{ color: 'rgba(197,160,89,0.7)' }}>
            Bienvenido, {profile?.full_name || 'Usuario'} · {new Date().toLocaleDateString('es-PY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {import.meta.env.DEV && (
            <button
              onClick={createDemoSale}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light"
              style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.30)', color: '#22c55e' }}>
              + Venta demo
            </button>
          )}
          <div className="luxury-button-ghost flex items-center gap-2">
            <Building2 size={14} />
            Todas las Sucursales
          </div>
        </div>
      </div>

      {/* Prize congratulations banner */}
      {prizeLevel !== 'sin_nivel' && dismissedLevel !== prizeLevel && (
        <div className="relative rounded-2xl border p-5 overflow-hidden"
          style={{
            background: prizeLevel === 'oro'
              ? 'linear-gradient(135deg, rgba(197,160,89,0.12), rgba(139,105,20,0.08))'
              : 'linear-gradient(135deg, rgba(205,127,50,0.12), rgba(205,127,50,0.05))',
            borderColor: prizeLevel === 'oro' ? 'rgba(197,160,89,0.5)' : 'rgba(205,127,50,0.5)',
            boxShadow: prizeLevel === 'oro' ? '0 0 30px rgba(197,160,89,0.15)' : '0 0 20px rgba(205,127,50,0.12)',
          }}>
          {/* Shimmer */}
          <div className="absolute inset-0 opacity-10 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at top right, ${prizeLevel === 'oro' ? '#C5A059' : '#cd7f32'}, transparent 60%)` }} />

          <button
            onClick={() => { setDismissedLevel(prizeLevel); sessionStorage.setItem('dismissedPrize', prizeLevel); }}
            className="absolute top-3 right-3 opacity-40 hover:opacity-100 transition-opacity"
            style={{ color: 'rgba(255,255,255,0.6)' }}>
            <X size={14} />
          </button>

          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 text-2xl"
              style={{
                background: prizeLevel === 'oro' ? 'rgba(197,160,89,0.2)' : 'rgba(205,127,50,0.2)',
                border: `2px solid ${prizeLevel === 'oro' ? '#C5A059' : '#cd7f32'}`,
              }}>
              {prizeLevel === 'oro' ? <Trophy size={24} style={{ color: '#C5A059' }} /> : <Medal size={24} style={{ color: '#cd7f32' }} />}
            </div>
            <div>
              <p className="text-white font-medium text-base tracking-wide">
                {prizeLevel === 'oro'
                  ? `Felicitaciones, ${profile?.full_name?.split(' ')[0]}!`
                  : `Excelente trabajo, ${profile?.full_name?.split(' ')[0]}!`}
              </p>
              <p className="text-sm font-light mt-0.5"
                style={{ color: prizeLevel === 'oro' ? 'rgba(197,160,89,0.9)' : 'rgba(205,127,50,0.9)' }}>
                {prizeLevel === 'oro'
                  ? `Alcanzaste el Nivel Oro con ${myPoints.toFixed(1)} puntos este mes. Premio mayor desbloqueado!`
                  : `Alcanzaste el Nivel Bronce con ${myPoints.toFixed(1)} puntos este mes. A 2 puntos del Nivel Oro!`}
              </p>
            </div>
            <div className="ml-auto text-right shrink-0 hidden sm:block">
              <p className="text-2xl font-light" style={{ color: prizeLevel === 'oro' ? '#C5A059' : '#cd7f32' }}>
                {myPoints.toFixed(1)}
              </p>
              <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>puntos del mes</p>
            </div>
          </div>
        </div>
      )}

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl shimmer" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card, i) => (
            <div key={i} className="stat-card p-5">
              {/* Ambient radial glow in top-right corner */}
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full -translate-y-6 translate-x-6 pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(197,160,89,0.13) 0%, transparent 70%)' }} />
              <div className="flex items-start justify-between relative">
                <div>
                  <p className="section-label">{card.label}</p>
                  <p className="text-2xl text-white font-light mt-1.5">{card.value}</p>
                  <p className="text-xs mt-1 text-gold-muted">{card.sub}</p>
                </div>
                <div className="p-2.5 rounded-xl"
                  style={{ background: 'rgba(197,160,89,0.10)', color: '#C5A059',
                    boxShadow: '0 0 14px rgba(197,160,89,0.14)' }}>
                  {card.icon}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Sales */}
        <div className="premium-card lg:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 soft-border-bottom">
            <h2 className="text-white text-sm font-light tracking-wider">Ventas Recientes</h2>
            <ShoppingCart size={16} className="text-gold gold-glow-sm" />
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-8 rounded shimmer" />)}
            </div>
          ) : recentSales.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><ShoppingCart size={22} /></div>
              <p className="text-sm font-light">No hay ventas registradas aún</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="soft-border-bottom">
                    {['N° Venta', 'Cliente', 'Sucursal', 'Total', 'Estado'].map(h => (
                      <th key={h} className="px-4 py-3 text-left section-label">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map(sale => {
                    const sc = statusConfig[sale.status] || statusConfig.pendiente;
                    return (
                      <tr key={sale.id} className="table-row">
                        <td className="px-4 py-3 font-mono text-gold">{sale.sale_number}</td>
                        <td className="px-4 py-3 text-white font-light">{(sale as any).customers?.full_name || '-'}</td>
                        <td className="px-4 py-3 font-light" style={{ color: 'rgba(255,255,255,0.48)' }}>{(sale as any).branches?.name || '-'}</td>
                        <td className="px-4 py-3 text-white font-light">Gs. {Number(sale.total).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className="status-badge"
                            style={{ background: `${sc.color}1e`, color: sc.color }}>
                            {sc.icon}{sc.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Lab orders */}
          <div className="premium-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 soft-border-bottom">
              <h2 className="text-white text-sm font-light tracking-wider">Laboratorio</h2>
              <FlaskConical size={16} className="text-gold gold-glow-sm" />
            </div>
            <div className="p-3 space-y-2">
              {labOrders.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px' }}>
                  <div className="empty-state-icon" style={{ width: 36, height: 36 }}><FlaskConical size={16} /></div>
                  <p className="text-xs font-light">Sin pedidos</p>
                </div>
              ) : labOrders.slice(0, 5).map(order => {
                const lsc = labStatusConfig[order.status] || labStatusConfig.enviado;
                return (
                  <div key={order.id} className="flex items-center justify-between p-2.5 rounded-lg transition-colors"
                    style={{ background: 'rgba(255,255,255,0.025)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(197,160,89,0.055)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}>
                    <div>
                      <p className="text-xs text-white font-light">{order.order_number}</p>
                      <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
                        {(order as any).sales?.customers?.full_name || '-'}
                      </p>
                    </div>
                    <span className="status-badge"
                      style={{ background: `${lsc.color}1e`, color: lsc.color }}>{lsc.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Branch performance */}
          <div className="premium-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 soft-border-bottom">
              <h2 className="text-white text-sm font-light tracking-wider">Sucursales (mes)</h2>
              <Building2 size={16} className="text-gold gold-glow-sm" />
            </div>
            <div className="p-4 space-y-3">
              {branchStats.length === 0 ? (
                <p className="text-xs text-center py-2 font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>Sin datos</p>
              ) : branchStats.map((b, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-white font-light">{b.name}</span>
                    <span className="text-gold">{b.count} ventas</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.055)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (b.count / Math.max(...branchStats.map(x => x.count), 1)) * 100)}%`,
                        background: 'linear-gradient(to right, #E2C070, #C5A059, #8B6914)',
                        boxShadow: '0 0 8px rgba(197,160,89,0.40)',
                      }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Pendientes de Entrega — all branches for admin */}
      {(() => {
        const allSales = getSales();
        const pendingSales = allSales
          .filter(v => v.estadoTrabajo === 'pendiente' || v.estadoTrabajo === 'en_laboratorio')
          .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
          .slice(0, 20);

        function buildWaLinkAdmin(clientName: string, phone: string, branchName: string) {
          if (!phone) return null;
          const msg = `Hola ${clientName}, te saludamos de Óptica Yolanda. Te avisamos que tus lentes ya están listos en la sucursal de ${branchName}. ¡Te esperamos!`;
          return `https://wa.me/595${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
        }

        return (
          <div className="premium-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 soft-border-bottom">
              <div>
                <h2 className="text-white text-sm font-light tracking-wider">Pendientes de Entrega</h2>
                <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Todas las sucursales — En Taller o Pendiente
                </p>
              </div>
              <Clock size={16} className="text-gold gold-glow-sm" />
            </div>
            {pendingSales.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Clock size={22} /></div>
                <p className="text-sm font-light">Sin pendientes de entrega</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="soft-border-bottom">
                      {['Cliente', 'Vendedora', 'Sucursal', 'Fecha', 'Total', 'Estado', 'WhatsApp'].map(h => (
                        <th key={h} className="px-4 py-3 text-left section-label">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingSales.map(v => {
                      const clientName = `${v.cliente.nombre} ${v.cliente.apellido}`.trim() || '—';
                      const phone = v.cliente.telefono || '';
                      const waLink = buildWaLinkAdmin(clientName, phone, v.sucursalEntrega);
                      const statusColor = v.estadoTrabajo === 'en_laboratorio' ? '#3b82f6' : '#f59e0b';
                      const statusLabel = v.estadoTrabajo === 'en_laboratorio' ? 'En Taller' : 'Pendiente';
                      return (
                        <tr key={v.id} className="table-row">
                          <td className="px-4 py-3 text-white font-light">{clientName}</td>
                          <td className="px-4 py-3 font-light" style={{ color: 'rgba(255,255,255,0.48)' }}>{v.vendedora}</td>
                          <td className="px-4 py-3 font-light" style={{ color: 'rgba(255,255,255,0.48)' }}>{v.sucursalEntrega}</td>
                          <td className="px-4 py-3 font-light" style={{ color: 'rgba(255,255,255,0.48)' }}>
                            {new Date(v.fecha).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 text-white font-light">Gs. {Number(v.total).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className="status-badge" style={{ background: `${statusColor}18`, color: statusColor }}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {waLink ? (
                              <a href={waLink} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1 transition-opacity hover:opacity-75"
                                style={{ color: '#25D366' }}>
                                <MessageCircle size={13} />
                                Avisar
                              </a>
                            ) : <span style={{ color: 'rgba(255,255,255,0.22)' }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
