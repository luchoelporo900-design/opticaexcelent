import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, Check, X, Calendar, Search, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import { getSales } from '../lib/salesStorage';

type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'qr' | 'giro';

const PAYMENT_METHODS: { id: PaymentMethod; label: string; color: string }[] = [
  { id: 'efectivo',      label: 'Efectivo',     color: '#22c55e' },
  { id: 'transferencia', label: 'Transferencia', color: '#3b82f6' },
  { id: 'tarjeta',       label: 'POS',          color: '#f59e0b' },
  { id: 'qr',            label: 'QR',           color: '#C5A059' },
  { id: 'giro',          label: 'Giro',         color: '#a78bfa' },
];

type BalanceRow = {
  id: string;
  sale_number: string;
  created_at: string;
  total: number;
  deposit: number;
  balance: number;
  status: string;
  seller_name: string;
  customer_first_name: string;
  customer_last_name: string;
  estimated_delivery: string | null;
  delivered_at: string | null;
  customers: { full_name: string; ci: string; phone: string } | null;
  branches: { name: string } | null;
  last_payment_date?: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pendiente:      { label: 'Pendiente',      color: '#f59e0b' },
  en_laboratorio: { label: 'En Laboratorio', color: '#3b82f6' },
  listo:          { label: 'Listo',          color: '#10b981' },
  entregado:      { label: 'Entregado',      color: '#6b7280' },
  cancelado:      { label: 'Cancelado',      color: '#ef4444' },
};

function fmt(n: number) {
  return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function BalancesPage() {
  const { profile } = useAuth();
  const { activeBranch, branches } = useBranch();

  const [rows,          setRows]          = useState<BalanceRow[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [searchText,    setSearchText]    = useState('');
  const [expandedId,    setExpandedId]    = useState<string | null>(null);

  // Extra payment
  const [addPayFor,      setAddPayFor]      = useState<string | null>(null);
  const [payAmt,         setPayAmt]         = useState('');
  const [payMethod,      setPayMethod]      = useState<PaymentMethod>('efectivo');
  const [payBranch,      setPayBranch]      = useState('');
  const [payRef,         setPayRef]         = useState('');
  const [savingPay,      setSavingPay]      = useState(false);

  useEffect(() => {
    if (activeBranch && !payBranch) setPayBranch(activeBranch.id);
  }, [activeBranch, payBranch]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('sales')
      .select('id, sale_number, created_at, total, deposit, balance, status, seller_name, customer_first_name, customer_last_name, estimated_delivery, delivered_at, customers(full_name, ci, phone), branches(name)')
      .gt('balance', 0)
      .not('status', 'eq', 'cancelado')
      .order('created_at', { ascending: false });

    // For each, find last payment date
    const saleIds = (data ?? []).map((r: any) => r.id);
    let lastPayMap: Record<string, string> = {};
    if (saleIds.length > 0) {
      const { data: lastPays } = await supabase
        .from('sale_payments')
        .select('sale_id, paid_at')
        .in('sale_id', saleIds)
        .order('paid_at', { ascending: false });
      (lastPays ?? []).forEach((p: any) => {
        if (!lastPayMap[p.sale_id]) lastPayMap[p.sale_id] = p.paid_at;
      });
    }

    const supabaseRows: BalanceRow[] = ((data ?? []) as BalanceRow[]).map(r => ({
      ...r, last_payment_date: lastPayMap[r.id] ?? null,
    }));

    // Merge localStorage sales with pending balance
    const localRows: BalanceRow[] = getSales()
      .filter(v => (Number(v.saldo) || 0) > 0 && v.estadoTrabajo !== 'cancelado')
      .map(v => ({
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
        estimated_delivery: null,
        delivered_at: null,
        customers: { full_name: `${v.cliente.nombre} ${v.cliente.apellido}`.trim(), ci: v.cliente.ci, phone: v.cliente.telefono },
        branches: { name: v.sucursalVenta },
        last_payment_date: undefined,
      }));

    setRows([...supabaseRows, ...localRows]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function registerPayment(saleId: string) {
    const amt = parseFloat(payAmt);
    if (!amt || amt <= 0) return;
    setSavingPay(true);
    await supabase.from('sale_payments').insert([{
      sale_id: saleId,
      amount: amt,
      method: payMethod,
      branch_id: payBranch || activeBranch?.id,
      reference: payRef,
      registered_by: profile?.id ?? null,
    }]);
    const { data: allPays } = await supabase.from('sale_payments').select('amount').eq('sale_id', saleId);
    const totalPaid = (allPays || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
    const { data: saleRow } = await supabase.from('sales').select('total').eq('id', saleId).maybeSingle();
    if (saleRow) {
      await supabase.from('sales').update({
        deposit: totalPaid,
        balance: Math.max(0, Number(saleRow.total) - totalPaid),
      }).eq('id', saleId);
    }
    setAddPayFor(null); setPayAmt(''); setPayRef('');
    setSavingPay(false);
    load();
  }

  const filtered = rows.filter(r => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    const name = r.customers?.full_name || `${r.customer_first_name} ${r.customer_last_name}`;
    return name.toLowerCase().includes(q) || r.sale_number.toLowerCase().includes(q) || (r.seller_name ?? '').toLowerCase().includes(q);
  });

  const totalPending = filtered.reduce((s, r) => s + Number(r.balance), 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-light tracking-wider text-white">Saldos Pendientes</h1>
          <p className="text-xs text-gold-muted mt-0.5 tracking-wide">
            Clientes con balance pendiente de pago
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border"
            style={{ borderColor: 'rgba(197,160,89,0.2)', background: 'rgba(255,255,255,0.02)' }}>
            <Search size={13} style={{ color: 'rgba(197,160,89,0.5)' }} />
            <input value={searchText} onChange={e => setSearchText(e.target.value)}
              placeholder="Buscar cliente, venta..."
              className="bg-transparent text-xs text-white outline-none w-40" />
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(245,158,11,0.22)' }}>
          <p className="text-xs font-light mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Ventas con saldo</p>
          <p className="text-2xl font-light" style={{ color: '#f59e0b' }}>{filtered.length}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(239,68,68,0.22)' }}>
          <p className="text-xs font-light mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Total pendiente</p>
          <p className="text-xl font-light" style={{ color: '#ef4444' }}>Gs. {fmt(totalPending)}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(16,185,129,0.22)' }}>
          <p className="text-xs font-light mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Promedio por venta</p>
          <p className="text-xl font-light" style={{ color: '#10b981' }}>
            Gs. {filtered.length ? fmt(Math.round(totalPending / filtered.length)) : 0}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        {loading ? (
          <div className="p-6 space-y-2">
            {[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded shimmer" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Check size={32} style={{ color: 'rgba(16,185,129,0.3)', margin: '0 auto 12px' }} />
            <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {searchText ? 'Sin resultados' : 'No hay saldos pendientes'}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {filtered.map(row => {
              const sc = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.pendiente;
              const isExp = expandedId === row.id;
              const clientName = row.customers?.full_name
                || [row.customer_first_name, row.customer_last_name].filter(Boolean).join(' ')
                || '—';

              return (
                <div key={row.id}>
                  <div
                    className="grid items-center gap-3 px-5 py-3.5 cursor-pointer"
                    style={{
                      gridTemplateColumns: '1fr 120px 90px 100px 90px 36px',
                      background: isExp ? 'rgba(197,160,89,0.03)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!isExp) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.015)'; }}
                    onMouseLeave={e => { if (!isExp) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                    onClick={() => setExpandedId(isExp ? null : row.id)}>

                    {/* Client + sale + branch */}
                    <div className="min-w-0">
                      <p className="text-sm text-white font-light truncate">{clientName}</p>
                      <p className="text-xs font-light mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.36)' }}>
                        <span style={{ color: '#C5A059' }}>#{row.sale_number}</span>
                        {' · '}{row.branches?.name ?? ''}
                        {row.seller_name ? ` · ${row.seller_name}` : ''}
                      </p>
                    </div>

                    {/* Total vs paid */}
                    <div>
                      <p className="text-xs text-white font-light">Gs. {fmt(Number(row.total))}</p>
                      <p className="text-xs font-light mt-0.5" style={{ color: '#10b981' }}>
                        Pagó {fmt(Number(row.deposit))}
                      </p>
                    </div>

                    {/* Balance */}
                    <p className="text-sm font-light" style={{ color: '#f59e0b' }}>
                      Gs. {fmt(Number(row.balance))}
                    </p>

                    {/* Status */}
                    <span className="px-2 py-1 rounded text-xs font-light"
                      style={{ background: `${sc.color}18`, color: sc.color }}>
                      {sc.label}
                    </span>

                    {/* Last payment */}
                    <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.32)' }}>
                      {row.last_payment_date
                        ? new Date(row.last_payment_date).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })
                        : '—'}
                    </p>

                    <ChevronDown size={14} style={{
                      color: 'rgba(255,255,255,0.3)',
                      transform: isExp ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s',
                    }} />
                  </div>

                  {/* Expanded: extra info + add payment */}
                  {isExp && (
                    <div className="px-5 pb-5 space-y-4" style={{ background: 'rgba(197,160,89,0.02)' }}>
                      {/* Customer contact */}
                      {row.customers?.phone && (
                        <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.42)' }}>
                          Tel: {row.customers.phone}
                          {row.customers.ci ? ` · CI: ${row.customers.ci}` : ''}
                        </p>
                      )}

                      {/* Delivery */}
                      {row.estimated_delivery && (
                        <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.42)' }}>
                          <Calendar size={10} className="inline mr-1" />
                          Entrega estimada: {new Date(row.estimated_delivery + 'T12:00:00').toLocaleDateString('es-PY')}
                          {row.delivered_at
                            ? ` · Entregado: ${new Date(row.delivered_at + 'T12:00:00').toLocaleDateString('es-PY')}`
                            : ''}
                        </p>
                      )}

                      {/* Add payment form */}
                      <div className="border-t pt-4" style={{ borderColor: 'rgba(197,160,89,0.12)' }}>
                        <p className="text-xs font-light tracking-widest uppercase mb-3" style={{ color: 'rgba(197,160,89,0.6)' }}>
                          Registrar pago
                        </p>

                        {addPayFor === row.id ? (
                          <div className="space-y-3">
                            {/* Method */}
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
                                type="number" placeholder={`Saldo: Gs. ${fmt(Number(row.balance))}`}
                                className="flex-1 min-w-28 px-3 py-2 rounded-lg bg-transparent text-white text-xs outline-none border"
                                style={{ borderColor: 'rgba(197,160,89,0.2)' }} />

                              {/* Branch where received */}
                              <select value={payBranch} onChange={e => setPayBranch(e.target.value)}
                                className="px-2 py-2 rounded-lg text-xs outline-none border"
                                style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(197,160,89,0.18)', color: 'rgba(255,255,255,0.6)' }}>
                                {branches.map(b => (
                                  <option key={b.id} value={b.id} style={{ background: '#111' }}>{b.name}</option>
                                ))}
                              </select>
                            </div>

                            {(payMethod === 'transferencia' || payMethod === 'giro') && (
                              <input value={payRef} onChange={e => setPayRef(e.target.value)}
                                placeholder="Banco / referencia / comprobante"
                                className="w-full px-3 py-1.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                                style={{ borderColor: 'rgba(197,160,89,0.14)' }} />
                            )}

                            <div className="flex gap-2">
                              <button onClick={() => registerPayment(row.id)} disabled={savingPay}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs text-black font-medium"
                                style={{ background: '#C5A059' }}>
                                <Check size={12} />
                                {savingPay ? 'Guardando...' : 'Confirmar pago'}
                              </button>
                              <button onClick={() => { setAddPayFor(null); setPayAmt(''); setPayRef(''); }}
                                className="px-4 py-2 rounded-lg text-xs font-light"
                                style={{ color: 'rgba(255,255,255,0.4)' }}>
                                <X size={12} className="inline mr-1" />Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); setAddPayFor(row.id); setPayBranch(activeBranch?.id ?? ''); }}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light"
                            style={{ background: 'rgba(197,160,89,0.08)', color: '#C5A059', border: '1px solid rgba(197,160,89,0.22)' }}>
                            <Plus size={12} /> Registrar pago de saldo
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
