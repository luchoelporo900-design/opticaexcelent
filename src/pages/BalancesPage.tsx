import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, Check, X, Calendar, Search, ChevronDown, DollarSign, Phone, ZoomIn, Camera, Receipt, Eye, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import { getSales, getPayments, updateSaleBalance, recordPayment, compressImage } from '../lib/salesStorage';

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
  isLocal: boolean;             // true = from localStorage
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
  en_laboratorio: { label: 'Laboratorio',    color: '#3b82f6' },
  listo:          { label: 'Listo',          color: '#10b981' },
  entregado:      { label: 'Entregado',      color: '#6b7280' },
  cancelado:      { label: 'Cancelado',      color: '#ef4444' },
};

function fmt(n: number) {
  return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── Receipt lightbox ─────────────────────────────────────────────────────────
function ReceiptLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.94)' }} onClick={onClose}>
      <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <Receipt size={14} style={{ color: '#C5A059' }} />
          <span className="text-sm font-light tracking-wider" style={{ color: '#C5A059' }}>Comprobante de Pago</span>
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(197,160,89,0.15)', color: '#C5A059', border: '1px solid rgba(197,160,89,0.3)' }}>
            Solo Admin
          </span>
        </div>
        <img src={url} alt="comprobante" className="w-full rounded-2xl"
          style={{ border: '1px solid rgba(197,160,89,0.3)', maxHeight: '75vh', objectFit: 'contain' }} />
        <button onClick={onClose} className="absolute top-8 right-3 p-2 rounded-full"
          style={{ background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.7)' }}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Mini payment history for expanded row ─────────────────────────────────────
function RowPaymentHistory({ row, isAdmin }: { row: any; isAdmin: boolean }) {
  type HPay = { id: string; amount: number; method: string; paid_at: string; receipt_url?: string };
  const [pays, setPays] = useState<HPay[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewReceipt, setViewReceipt] = useState<string | null>(null);

  useEffect(() => {
    if (row.isLocal) {
      const items: HPay[] = getPayments()
        .filter((p: any) => p.saleId === Number(row.id))
        .sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
        .map((p: any) => ({
          id: String(p.id), amount: p.monto, method: p.metodo, paid_at: p.fecha,
          receipt_url: p.receipt_url,
        }));
      setPays(items); setLoading(false);
    } else {
      supabase.from('sale_payments')
        .select('id,amount,method,paid_at,receipt_url')
        .eq('sale_id', row.id).order('paid_at')
        .then(({ data }) => { setPays((data ?? []) as any); setLoading(false); });
    }
  }, [row.id, row.isLocal]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || pays.length === 0) return null;

  return (
    <>
      {viewReceipt && <ReceiptLightbox url={viewReceipt} onClose={() => setViewReceipt(null)} />}
      <div className="rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(197,160,89,0.10)', background: 'rgba(197,160,89,0.02)' }}>
        <p className="px-3 py-2 text-xs font-light tracking-widest uppercase border-b"
          style={{ color: 'rgba(197,160,89,0.55)', borderColor: 'rgba(197,160,89,0.08)' }}>
          Historial de abonos
        </p>
        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          {pays.map((p, i) => {
            const dt = new Date(p.paid_at);
            return (
              <div key={p.id} className="flex items-center gap-2 px-3 py-2 text-xs font-light">
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-black shrink-0"
                  style={{ background: '#C5A059', fontSize: 9 }}>{i + 1}</span>
                <span className="text-white">Gs. {Number(p.amount).toLocaleString()}</span>
                <span style={{ color: 'rgba(255,255,255,0.38)' }}>{p.method}</span>
                {isAdmin && p.receipt_url && (
                  <button onClick={() => setViewReceipt(p.receipt_url!)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md"
                    style={{ background: 'rgba(197,160,89,0.10)', color: '#C5A059', border: '1px solid rgba(197,160,89,0.28)' }}>
                    <Eye size={9} /><span>Ver ticket</span>
                  </button>
                )}
                {isAdmin && !p.receipt_url && p.method !== 'efectivo' && (
                  <span className="px-1.5 py-0.5 rounded-md"
                    style={{ background: 'rgba(245,158,11,0.08)', color: 'rgba(245,158,11,0.6)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    Sin ticket
                  </span>
                )}
                <span className="ml-auto" style={{ color: 'rgba(255,255,255,0.28)' }}>
                  {dt.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })}
                  {' '}<span style={{ color: 'rgba(255,255,255,0.18)' }}>{dt.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  const t = normalize(text);
  const q = normalize(query);
  if (t.includes(q)) return true;
  if (q.length < 3) return false;
  for (let i = 0; i <= t.length - q.length + 1; i++) {
    const win = t.slice(i, i + q.length);
    let diffs = 0;
    for (let k = 0; k < win.length; k++) { if (win[k] !== q[k]) diffs++; }
    if (diffs <= 1) return true;
  }
  return false;
}

export default function BalancesPage() {
  const { profile } = useAuth();
  const { activeBranch, branches } = useBranch();

  const [rows,       setRows]       = useState<BalanceRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [searchText, setSearchText] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Payment form state
  const [addPayFor,     setAddPayFor]     = useState<string | null>(null);
  const [payAmt,        setPayAmt]        = useState('');
  const [payMethod,     setPayMethod]     = useState<PaymentMethod>('efectivo');
  const [payBranch,     setPayBranch]     = useState('');
  const [payRef,        setPayRef]        = useState('');
  const [payReceipt,    setPayReceipt]    = useState('');
  const [payReceiptWarn,setPayReceiptWarn]= useState(false);
  const [savingPay,     setSavingPay]     = useState(false);
  const [paySuccess,    setPaySuccess]    = useState('');

  useEffect(() => {
    if (activeBranch && !payBranch) setPayBranch(activeBranch.id);
  }, [activeBranch, payBranch]);

  const isVendedora = profile?.role === 'vendedora';

  const load = useCallback(async () => {
    setLoading(true);

    // Supabase sales with balance — vendedora only sees her own branch
    let query = supabase
      .from('sales')
      .select('id, sale_number, created_at, total, deposit, balance, status, seller_name, customer_first_name, customer_last_name, estimated_delivery, delivered_at, customers(full_name, ci, phone), branches(name)')
      .gt('balance', 0)
      .not('status', 'eq', 'cancelado')
      .order('created_at', { ascending: false });

    if (isVendedora && profile?.branch_id) {
      query = query.eq('branch_id', profile.branch_id.toLowerCase());
    }
    const { data } = await query;

    const saleIds = (data ?? []).map((r: any) => r.id);
    const lastPayMap: Record<string, string> = {};
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

    const supabaseRows: BalanceRow[] = ((data ?? []) as any[]).map(r => ({
      ...r,
      isLocal: false,
      last_payment_date: lastPayMap[r.id] ?? null,
    }));

    // localStorage sales with pending balance — vendedora only sees her own branch
    const localRows: BalanceRow[] = getSales()
      .filter(v => {
        if ((Number(v.saldo) || 0) <= 0 || v.estadoTrabajo === 'cancelado') return false;
        if (isVendedora && profile?.branch_id) {
          const branchMatch =
            (v.sucursalVenta || '').toLowerCase() === profile.branch_id.toLowerCase() ||
            (v.sucursalCobro || '').toLowerCase() === profile.branch_id.toLowerCase();
          return branchMatch;
        }
        return true;
      })
      .map(v => ({
        id: String(v.id),
        isLocal: true,
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
        customers: {
          full_name: `${v.cliente.nombre} ${v.cliente.apellido}`.trim(),
          ci: v.cliente.ci,
          phone: v.cliente.telefono,
        },
        branches: { name: v.sucursalVenta },
        last_payment_date: undefined,
      }));

    setRows([...supabaseRows, ...localRows]);
    setLoading(false);
  }, [isVendedora, profile?.branch_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function registerPayment(row: BalanceRow) {
    const amt = parseFloat(payAmt);
    if (!amt || amt <= 0) return;
    setSavingPay(true);

    const branchId = payBranch || activeBranch?.id || '';
    const branchName = branches.find(b => b.id === branchId)?.name || branchId;
    const clientName = row.customers?.full_name ||
      [row.customer_first_name, row.customer_last_name].filter(Boolean).join(' ');

    if (row.isLocal) {
      // Update balance in localStorage
      const saleIdNum = Number(row.id);
      const newDeposit = row.deposit + amt;
      const newBalance = Math.max(0, row.total - newDeposit);
      updateSaleBalance(saleIdNum, newBalance, newDeposit);

      // Record this abono as a cash movement
      recordPayment({
        id: Date.now(),
        saleId: saleIdNum,
        fecha: new Date().toISOString(),
        monto: amt,
        metodo: payMethod,
        sucursal: branchName,
        vendedora: row.seller_name || '',
        cliente: clientName,
        tipo: 'abono',
        receipt_url: payReceipt || undefined,
      });
    } else {
      // Supabase sale
      await supabase.from('sale_payments').insert([{
        sale_id: row.id,
        amount: amt,
        method: payMethod,
        branch_id: branchId || null,
        reference: payRef || null,
        registered_by: profile?.id ?? null,
        receipt_url: payReceipt || null,
      }]);
      const { data: allPays } = await supabase.from('sale_payments').select('amount').eq('sale_id', row.id);
      const totalPaid = (allPays || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
      const { data: saleRow } = await supabase.from('sales').select('total').eq('id', row.id).maybeSingle();
      if (saleRow) {
        await supabase.from('sales').update({
          deposit: totalPaid,
          balance: Math.max(0, Number(saleRow.total) - totalPaid),
        }).eq('id', row.id);
      }
    }

    setPaySuccess(`Pago de Gs. ${fmt(amt)} registrado correctamente.`);
    setAddPayFor(null);
    setPayAmt('');
    setPayRef('');
    setPayReceipt('');
    setPayReceiptWarn(false);
    setSavingPay(false);
    setTimeout(() => setPaySuccess(''), 5000);
    load();
  }

  const filtered = rows.filter(r => {
    if (!searchText) return true;
    const name = r.customers?.full_name || `${r.customer_first_name} ${r.customer_last_name}`;
    const ci = r.customers?.ci || '';
    const phone = r.customers?.phone || '';
    return (
      fuzzyMatch(name, searchText) ||
      fuzzyMatch(r.sale_number, searchText) ||
      fuzzyMatch(r.seller_name ?? '', searchText) ||
      fuzzyMatch(ci, searchText) ||
      phone.includes(searchText.replace(/\D/g, ''))
    );
  });

  const totalPending = filtered.reduce((s, r) => s + Number(r.balance), 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-light tracking-wider text-white">Saldos Pendientes</h1>
          <p className="text-xs text-gold-muted mt-0.5 tracking-wide">
            {isVendedora
              ? `Mi sucursal · ${activeBranch?.name ?? profile?.branch_id ?? ''}`
              : 'Clientes con balance pendiente de cobro'}
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

      {/* Pay success toast */}
      {paySuccess && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.28)' }}>
          <Check size={14} style={{ color: '#22c55e' }} />
          <p className="text-sm font-light" style={{ color: '#22c55e' }}>{paySuccess}</p>
        </div>
      )}

      {/* Summary cards */}
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

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        {loading ? (
          <div className="p-6 space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded shimmer" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Check size={32} style={{ color: 'rgba(16,185,129,0.3)', margin: '0 auto 12px' }} />
            <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {searchText ? 'Sin resultados' : 'No hay saldos pendientes'}
            </p>
          </div>
        ) : (
          <div>
            {/* Column headers */}
            <div className="grid px-5 py-2.5 text-xs font-light" style={{
              gridTemplateColumns: '1fr 130px 90px 110px 80px 36px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.30)',
            }}>
              <span>Cliente / Venta</span>
              <span>Total / Pagado</span>
              <span>Saldo</span>
              <span>Estado</span>
              <span>Últ. pago</span>
              <span />
            </div>

            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              {filtered.map(row => {
                const sc = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.pendiente;
                const isExp = expandedId === row.id;
                const isPayOpen = addPayFor === row.id;
                const clientName = row.customers?.full_name ||
                  [row.customer_first_name, row.customer_last_name].filter(Boolean).join(' ') || '—';

                return (
                  <div key={row.id}>
                    {/* Main row */}
                    <div
                      className="grid items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors"
                      style={{
                        gridTemplateColumns: '1fr 130px 90px 110px 80px 36px',
                        background: isExp ? 'rgba(197,160,89,0.03)' : 'transparent',
                      }}
                      onMouseEnter={e => { if (!isExp) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.015)'; }}
                      onMouseLeave={e => { if (!isExp) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      onClick={() => setExpandedId(isExp ? null : row.id)}>

                      <div className="min-w-0">
                        <p className="text-sm text-white font-light truncate">{clientName}</p>
                        <p className="text-xs font-light mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.36)' }}>
                          <span style={{ color: '#C5A059' }}>#{row.sale_number}</span>
                          {row.branches?.name ? ` · ${row.branches.name}` : ''}
                          {row.seller_name ? ` · ${row.seller_name}` : ''}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-white font-light">Gs. {fmt(Number(row.total))}</p>
                        <p className="text-xs font-light mt-0.5" style={{ color: '#10b981' }}>
                          Pagó {fmt(Number(row.deposit))}
                        </p>
                      </div>

                      <p className="text-sm font-light" style={{ color: '#f59e0b' }}>
                        Gs. {fmt(Number(row.balance))}
                      </p>

                      <span className="px-2 py-1 rounded text-xs font-light inline-block"
                        style={{ background: `${sc.color}18`, color: sc.color }}>
                        {sc.label}
                      </span>

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

                    {/* Expanded panel */}
                    {isExp && (
                      <div className="px-5 pb-5 space-y-4" style={{ background: 'rgba(197,160,89,0.02)' }}>

                        {/* Contact info */}
                        {(row.customers?.phone || row.customers?.ci) && (
                          <div className="flex items-center gap-4">
                            {row.customers?.phone && (
                              <p className="text-xs font-light flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.44)' }}>
                                <Phone size={10} />
                                {row.customers.phone}
                              </p>
                            )}
                            {row.customers?.ci && (
                              <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.44)' }}>
                                CI: {row.customers.ci}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Delivery info */}
                        {row.estimated_delivery && (
                          <p className="text-xs font-light flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.44)' }}>
                            <Calendar size={10} />
                            Entrega estimada: {new Date(row.estimated_delivery + 'T12:00:00').toLocaleDateString('es-PY')}
                            {row.delivered_at
                              ? ` · Entregado: ${new Date(row.delivered_at + 'T12:00:00').toLocaleDateString('es-PY')}`
                              : ''}
                          </p>
                        )}

                        {/* Payment history (admin sees receipts) */}
                        <RowPaymentHistory row={row} isAdmin={profile?.role === 'admin'} />

                        {/* Payment form */}
                        <div className="pt-3" style={{ borderTop: '1px solid rgba(197,160,89,0.10)' }}>
                          {isPayOpen ? (
                            <div className="space-y-3">
                              <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.6)' }}>
                                Registrar abono — saldo actual Gs. {fmt(Number(row.balance))}
                              </p>

                              {/* Method selector */}
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
                                  {branches.map(b => (
                                    <option key={b.id} value={b.id} style={{ background: '#111' }}>{b.name}</option>
                                  ))}
                                </select>
                              </div>

                              {(payMethod === 'transferencia' || payMethod === 'giro') && (
                                <input value={payRef} onChange={e => setPayRef(e.target.value)}
                                  placeholder="Banco / referencia"
                                  className="w-full px-3 py-1.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                                  style={{ borderColor: 'rgba(197,160,89,0.14)' }} />
                              )}

                              {/* Comprobante upload */}
                              <div className="rounded-xl p-2.5 space-y-2"
                                style={{ background: 'rgba(197,160,89,0.04)', border: `1px solid ${payReceiptWarn && !payReceipt ? 'rgba(245,158,11,0.55)' : 'rgba(197,160,89,0.12)'}` }}>
                                <div className="flex items-center gap-1.5">
                                  <Receipt size={11} style={{ color: '#C5A059' }} />
                                  <span className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.8)' }}>
                                    Comprobante de Pago
                                  </span>
                                  {payMethod === 'efectivo'
                                    ? <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.28)' }}>(opcional)</span>
                                    : <span className="text-xs font-light" style={{ color: '#f59e0b' }}>recomendado</span>
                                  }
                                </div>
                                {payReceipt ? (
                                  <div className="relative inline-block">
                                    <img src={payReceipt} alt="comprobante" className="h-20 rounded-lg object-cover"
                                      style={{ border: '1px solid rgba(197,160,89,0.3)' }} />
                                    <button onClick={e => { e.stopPropagation(); setPayReceipt(''); }}
                                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                                      style={{ background: '#ef4444' }}>
                                      <X size={8} color="#fff" />
                                    </button>
                                    <div className="mt-1 flex items-center gap-1">
                                      <Check size={10} style={{ color: '#22c55e' }} />
                                      <span className="text-xs font-light" style={{ color: '#22c55e' }}>Comprobante listo</span>
                                    </div>
                                  </div>
                                ) : (
                                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light cursor-pointer"
                                    style={{ background: 'rgba(197,160,89,0.07)', border: '1px dashed rgba(197,160,89,0.3)', color: 'rgba(197,160,89,0.7)' }}
                                    onClick={e => e.stopPropagation()}>
                                    <Camera size={12} />
                                    Subir foto del ticket / transferencia
                                    <input type="file" accept="image/*" className="hidden"
                                      onChange={async e => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = async ev => {
                                          const compressed = await compressImage(ev.target?.result as string);
                                          setPayReceipt(compressed);
                                          setPayReceiptWarn(false);
                                        };
                                        reader.readAsDataURL(file);
                                      }} />
                                  </label>
                                )}
                              </div>

                              {/* Missing receipt warning with force-confirm */}
                              {payReceiptWarn && !payReceipt && (
                                <div className="flex items-start gap-2 px-3 py-2 rounded-lg"
                                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
                                  <AlertCircle size={12} style={{ color: '#f59e0b', marginTop: 1, flexShrink: 0 }} />
                                  <div>
                                    <p className="text-xs font-medium" style={{ color: '#f59e0b' }}>Sin comprobante</p>
                                    <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                      El administrador podrá auditar este pago. ¿Confirmar sin foto?
                                    </p>
                                    <button
                                      onClick={e => { e.stopPropagation(); registerPayment(row); }}
                                      className="mt-1.5 px-2.5 py-1 rounded text-xs font-medium"
                                      style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)' }}>
                                      Sí, guardar igual
                                    </button>
                                  </div>
                                </div>
                              )}

                              <div className="flex gap-2">
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    if (!payReceipt && payMethod !== 'efectivo') {
                                      setPayReceiptWarn(true);
                                      return;
                                    }
                                    registerPayment(row);
                                  }}
                                  disabled={savingPay || !payAmt}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium"
                                  style={{
                                    background: !payAmt ? 'rgba(197,160,89,0.08)' : '#C5A059',
                                    color: !payAmt ? 'rgba(197,160,89,0.4)' : '#000',
                                    cursor: !payAmt ? 'not-allowed' : 'pointer',
                                  }}>
                                  <DollarSign size={12} />
                                  {savingPay ? 'Guardando...' : 'Confirmar pago'}
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); setAddPayFor(null); setPayAmt(''); setPayRef(''); setPayReceipt(''); setPayReceiptWarn(false); }}
                                  className="px-4 py-2 rounded-lg text-xs font-light"
                                  style={{ color: 'rgba(255,255,255,0.4)' }}>
                                  <X size={12} className="inline mr-1" />Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setAddPayFor(row.id);
                                setPayBranch(activeBranch?.id ?? '');
                                setPayAmt('');
                              }}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all"
                              style={{
                                background: 'rgba(197,160,89,0.10)',
                                color: '#C5A059',
                                border: '1px solid rgba(197,160,89,0.28)',
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(197,160,89,0.18)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(197,160,89,0.10)'; }}>
                              <Plus size={12} />
                              Registrar Pago de Saldo
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
