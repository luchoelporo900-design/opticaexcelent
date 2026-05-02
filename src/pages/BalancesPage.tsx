import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, Check, X, Search, ChevronDown, DollarSign, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSales, updateSaleBalance, recordPayment } from '../lib/salesStorage';

type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'qr' | 'giro';

const PAYMENT_METHODS: { id: PaymentMethod; label: string; color: string }[] = [
  { id: 'efectivo',      label: 'Efectivo',     color: '#22c55e' },
  { id: 'transferencia', label: 'Transferencia', color: '#3b82f6' },
  { id: 'tarjeta',       label: 'POS',          color: '#f59e0b' },
  { id: 'qr',            label: 'QR',           color: '#C5A059' },
  { id: 'giro',          label: 'Giro',         color: '#a78bfa' },
];

const SUCURSALES = ['Azara', 'Centro', 'Caacupé', 'Fernando'];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pendiente:      { label: 'Pendiente',   color: '#f59e0b' },
  en_laboratorio: { label: 'Laboratorio', color: '#3b82f6' },
  listo:          { label: 'Listo',       color: '#10b981' },
  entregado:      { label: 'Entregado',   color: '#6b7280' },
  cancelado:      { label: 'Cancelado',   color: '#ef4444' },
};

function fmt(n: number) {
  return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function BalancesPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'gerente';
  const isVendedora = profile?.role === 'vendedora';

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [addPayFor, setAddPayFor] = useState<string | null>(null);
  const [payAmt, setPayAmt] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('efectivo');
  const [payBranch, setPayBranch] = useState('');
  const [payRef, setPayRef] = useState('');
  const [savingPay, setSavingPay] = useState(false);
  const [paySuccess, setPaySuccess] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const all = getSales().filter(v => {
      if ((Number(v.saldo) || 0) <= 0) return false;
      if (v.estadoTrabajo === 'entregado' || v.estadoTrabajo === 'cancelado') return false;
      // Vendedora solo ve sus propios saldos
      if (isVendedora && v.vendedora !== profile?.full_name) return false;
      return true;
    });

    const mapped = all.map(v => ({
      id: String(v.id),
      sale_number: `VTA-${v.id}`,
      created_at: v.fecha,
      total: Number(v.total),
      deposit: Number(v.sena),
      balance: Number(v.saldo),
      status: v.estadoTrabajo,
      seller_name: v.vendedora,
      customer_first_name: v.cliente.nombre,
      customer_last_name: v.cliente.apellido,
      customer_phone: v.cliente.telefono,
      branch_name: v.sucursalVenta,
      cobro_branch: v.sucursalCobro,
    }));

    setRows(mapped);
    setLoading(false);
  }, [profile, isVendedora]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('optica_ventas_updated', handler);
    return () => window.removeEventListener('optica_ventas_updated', handler);
  }, [load]);

  function registerPayment(row: any) {
    const amt = parseFloat(payAmt);
    if (!amt || amt <= 0) return;
    setSavingPay(true);

    const saleIdNum = Number(row.id);
    const newDeposit = row.deposit + amt;
    const newBalance = Math.max(0, row.total - newDeposit);
    updateSaleBalance(saleIdNum, newBalance, newDeposit);

    recordPayment({
      id: Date.now(),
      saleId: saleIdNum,
      fecha: new Date().toISOString(),
      monto: amt,
      metodo: payMethod,
      sucursal: payBranch || row.cobro_branch || row.branch_name,
      vendedora: row.seller_name || '',
      cliente: `${row.customer_first_name} ${row.customer_last_name}`.trim(),
      tipo: 'abono',
    });

    setPaySuccess(`Pago de Gs. ${fmt(amt)} registrado correctamente.`);
    setAddPayFor(null);
    setPayAmt('');
    setPayRef('');
    setSavingPay(false);
    setTimeout(() => setPaySuccess(''), 5000);
    load();
  }

  const filtered = rows.filter(r => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    const name = `${r.customer_first_name} ${r.customer_last_name}`;
    return name.toLowerCase().includes(q) || r.sale_number.toLowerCase().includes(q) || (r.seller_name ?? '').toLowerCase().includes(q);
  });

  const totalPending = filtered.reduce((s, r) => s + Number(r.balance), 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-light tracking-wider text-white">Saldos Pendientes</h1>
          <p className="text-xs text-gold-muted mt-0.5 tracking-wide">
            {isVendedora ? `Mis saldos pendientes · ${profile?.full_name}` : 'Clientes con balance pendiente de cobro'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border"
            style={{ borderColor: 'rgba(197,160,89,0.2)', background: 'rgba(255,255,255,0.02)' }}>
            <Search size={13} style={{ color: 'rgba(197,160,89,0.5)' }} />
            <input value={searchText} onChange={e => setSearchText(e.target.value)}
              placeholder="Cliente, venta, vendedora..."
              className="bg-transparent text-xs text-white outline-none w-44" />
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {paySuccess && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.28)' }}>
          <Check size={14} style={{ color: '#22c55e' }} />
          <p className="text-sm font-light" style={{ color: '#22c55e' }}>{paySuccess}</p>
        </div>
      )}

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(245,158,11,0.22)' }}>
          <p className="text-xs font-light mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Ventas con saldo</p>
          <p className="text-2xl font-light" style={{ color: '#f59e0b' }}>{filtered.length}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(239,68,68,0.22)' }}>
          <p className="text-xs font-light mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Total pendiente</p>
          <p className="text-xl font-light" style={{ color: '#ef4444' }}>Gs. {fmt(totalPending)}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(16,185,129,0.22)' }}>
          <p className="text-xs font-light mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Promedio por cliente</p>
          <p className="text-xl font-light" style={{ color: '#10b981' }}>
            Gs. {filtered.length ? fmt(Math.round(totalPending / filtered.length)) : '—'}
          </p>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        {loading ? (
          <div className="p-6 space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded shimmer" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Check size={32} style={{ color: 'rgba(16,185,129,0.3)', margin: '0 auto 12px' }} />
            <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {searchText ? 'Sin resultados' : 'No hay saldos pendientes'}
            </p>
          </div>
        ) : (
          <div>
            <div className="grid px-5 py-2.5 text-xs font-light"
              style={{ gridTemplateColumns: '1fr 130px 90px 110px 36px', borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.30)' }}>
              <span>Cliente / Venta</span><span>Total / Pagado</span><span>Saldo</span><span>Estado</span><span />
            </div>
            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              {filtered.map(row => {
                const sc = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.pendiente;
                const isExp = expandedId === row.id;
                const isPayOpen = addPayFor === row.id;
                const clientName = `${row.customer_first_name} ${row.customer_last_name}`.trim() || '—';

                return (
                  <div key={row.id}>
                    <div className="grid items-center gap-3 px-5 py-3.5 cursor-pointer"
                      style={{ gridTemplateColumns: '1fr 130px 90px 110px 36px', background: isExp ? 'rgba(197,160,89,0.03)' : 'transparent' }}
                      onMouseEnter={e => { if (!isExp) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.015)'; }}
                      onMouseLeave={e => { if (!isExp) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      onClick={() => setExpandedId(isExp ? null : row.id)}>
                      <div className="min-w-0">
                        <p className="text-sm text-white font-light truncate">{clientName}</p>
                        <p className="text-xs font-light mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.36)' }}>
                          <span style={{ color: '#C5A059' }}>#{row.sale_number}</span>
                          {row.branch_name ? ` · ${row.branch_name}` : ''}
                          {isAdmin && row.seller_name ? ` · ${row.seller_name}` : ''}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-white font-light">Gs. {fmt(Number(row.total))}</p>
                        <p className="text-xs font-light mt-0.5" style={{ color: '#10b981' }}>Pagó {fmt(Number(row.deposit))}</p>
                      </div>
                      <p className="text-sm font-light" style={{ color: '#f59e0b' }}>Gs. {fmt(Number(row.balance))}</p>
                      <span className="px-2 py-1 rounded text-xs font-light inline-block"
                        style={{ background: `${sc.color}18`, color: sc.color }}>{sc.label}</span>
                      <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)', transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </div>

                    {isExp && (
                      <div className="px-5 pb-5 space-y-4" style={{ background: 'rgba(197,160,89,0.02)' }}>
                        {row.customer_phone && (
                          <p className="text-xs font-light flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.44)' }}>
                            <Phone size={10} />{row.customer_phone}
                          </p>
                        )}
                        <div className="pt-3" style={{ borderTop: '1px solid rgba(197,160,89,0.10)' }}>
                          {isPayOpen ? (
                            <div className="space-y-3">
                              <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.6)' }}>
                                Registrar abono — saldo Gs. {fmt(Number(row.balance))}
                              </p>
                              <div className="flex gap-1.5 flex-wrap">
                                {PAYMENT_METHODS.map(m => (
                                  <button key={m.id} onClick={() => setPayMethod(m.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-light"
                                    style={{
                                      background: payMethod === m.id ? `${m.color}18` : 'rgba(255,255,255,0.03)',
                                      border: `1px solid ${payMethod === m.id ? m.color + '44' : 'rgba(255,255,255,0.07)'}`,
                                      color: payMethod === m.id ? m.color : 'rgba(255,255,255,0.38)',
                                    }}>
                                    {m.label}
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-2 items-center flex-wrap">
                                <input value={payAmt} onChange={e => setPayAmt(e.target.value)}
                                  type="number" placeholder={`Monto (máx. Gs. ${fmt(Number(row.balance))})`}
                                  className="flex-1 min-w-36 px-3 py-2 rounded-lg bg-transparent text-white text-xs outline-none border"
                                  style={{ borderColor: 'rgba(197,160,89,0.22)' }} />
                                <select value={payBranch} onChange={e => setPayBranch(e.target.value)}
                                  className="px-2 py-2 rounded-lg text-xs outline-none border"
                                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(197,160,89,0.18)', color: 'rgba(255,255,255,0.6)' }}>
                                  <option value="">Sucursal cobro</option>
                                  {SUCURSALES.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => registerPayment(row)} disabled={savingPay || !payAmt}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium"
                                  style={{ background: !payAmt ? 'rgba(197,160,89,0.08)' : '#C5A059', color: !payAmt ? 'rgba(197,160,89,0.4)' : '#000', cursor: !payAmt ? 'not-allowed' : 'pointer' }}>
                                  <DollarSign size={12} />{savingPay ? 'Guardando...' : 'Confirmar pago'}
                                </button>
                                <button onClick={() => { setAddPayFor(null); setPayAmt(''); setPayRef(''); }}
                                  className="px-4 py-2 rounded-lg text-xs font-light"
                                  style={{ color: 'rgba(255,255,255,0.4)' }}>
                                  <X size={12} className="inline mr-1" />Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={e => { e.stopPropagation(); setAddPayFor(row.id); setPayAmt(''); }}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium"
                              style={{ background: 'rgba(197,160,89,0.10)', color: '#C5A059', border: '1px solid rgba(197,160,89,0.28)' }}>
                              <Plus size={12} />Registrar Pago de Saldo
                            </button>
                          )}
                        </div>
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
