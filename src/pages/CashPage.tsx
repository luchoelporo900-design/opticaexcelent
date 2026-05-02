import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, Banknote, CreditCard, ArrowRightLeft, RefreshCw,
  CheckCircle, TrendingUp, Calendar, QrCode, Send, Minus, Plus, X,
  User, Lock, Unlock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBranch } from '../context/BranchContext';
import { useAuth } from '../context/AuthContext';
import { getSales, getPaymentsForDate } from '../lib/salesStorage';

type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'qr' | 'giro';

type DailySummary = {
  efectivo: number;
  transferencia: number;
  tarjeta: number;
  qr: number;
  giro: number;
  expenses: number;
  total: number;
  count: number;
};

type PaymentRow = {
  id: string;
  sale_number: string;
  customer_name: string;
  amount: number;
  method: PaymentMethod;
  paid_at: string;
  seller_name: string;
  reference: string;
  branch_name: string;
};

type Expense = {
  id: string;
  description: string;
  amount: number;
  method: string;
  expense_date: string;
};

type SellerRow = { seller: string; efectivo: number; transferencia: number; tarjeta: number; qr: number; giro: number; total: number; count: number };

const METHODS: { id: PaymentMethod; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'efectivo',      label: 'Efectivo',     icon: <Banknote       size={16} />, color: '#22c55e' },
  { id: 'transferencia', label: 'Transferencia', icon: <ArrowRightLeft size={16} />, color: '#3b82f6' },
  { id: 'tarjeta',       label: 'POS',          icon: <CreditCard     size={16} />, color: '#f59e0b' },
  { id: 'qr',            label: 'QR',           icon: <QrCode         size={16} />, color: '#C5A059' },
  { id: 'giro',          label: 'Giro',         icon: <Send           size={16} />, color: '#a78bfa' },
];

function fmt(n: number) {
  return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function emptyAgg(): DailySummary {
  return { efectivo: 0, transferencia: 0, tarjeta: 0, qr: 0, giro: 0, expenses: 0, total: 0, count: 0 };
}

function addToAgg(agg: DailySummary, method: string, amount: number): DailySummary {
  const m = method as PaymentMethod;
  const next = { ...agg };
  if (m in next) (next as any)[m] += amount;
  next.total += amount;
  next.count++;
  return next;
}

export default function CashPage() {
  const { activeBranch, branches } = useBranch();
  const { profile } = useAuth();

  const [selectedDate,   setSelectedDate]   = useState(new Date().toISOString().slice(0, 10));
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [summary,        setSummary]        = useState<DailySummary>(emptyAgg());
  const [payments,       setPayments]       = useState<PaymentRow[]>([]);
  const [expenses,       setExpenses]       = useState<Expense[]>([]);
  const [bySeller,       setBySeller]       = useState<SellerRow[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [closing,        setClosing]        = useState(false);
  const [closedAt,       setClosedAt]       = useState<string | null>(null);
  const [methodFilter,   setMethodFilter]   = useState<string>('all');

  // Expense entry
  const [showAddExp, setShowAddExp] = useState(false);
  const [expDesc,    setExpDesc]    = useState('');
  const [expAmount,  setExpAmount]  = useState('');
  const [expMethod,  setExpMethod]  = useState<PaymentMethod>('efectivo');
  const [savingExp,  setSavingExp]  = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'gerente';
  const isVendedora = profile?.role === 'vendedora';

  useEffect(() => {
    // Vendedora: auto-select her assigned branch and lock it
    if (isVendedora && profile?.branch_id && !selectedBranch) {
      setSelectedBranch(profile.branch_id.toLowerCase());
    } else if (activeBranch && !selectedBranch) {
      setSelectedBranch(activeBranch.id);
    }
  }, [activeBranch, selectedBranch, isVendedora, profile?.branch_id]);

  const load = useCallback(async () => {
    setLoading(true);

    const dayStart = `${selectedDate}T00:00:00`;
    const dayEnd   = `${selectedDate}T23:59:59`;

    // ── Supabase payments ──────────────────────────────────────────────────
    let supabaseRows: PaymentRow[] = [];
    {
      let pQuery = supabase
        .from('sale_payments')
        .select('id, amount, method, paid_at, reference, branches(name), sales(sale_number, seller_name, customers(full_name))')
        .gte('paid_at', dayStart)
        .lte('paid_at', dayEnd)
        .order('paid_at', { ascending: false });

      if (selectedBranch) pQuery = pQuery.eq('branch_id', selectedBranch);

      const { data: pData } = await pQuery;
      supabaseRows = (pData ?? []).map((p: any) => ({
        id: p.id,
        sale_number: p.sales?.sale_number ?? '',
        customer_name: p.sales?.customers?.full_name ?? '',
        amount: Number(p.amount),
        method: p.method as PaymentMethod,
        paid_at: p.paid_at,
        seller_name: p.sales?.seller_name ?? '',
        reference: p.reference ?? '',
        branch_name: p.branches?.name ?? '',
      }));
    }

    // ── localStorage payments (seña + abonos) ─────────────────────────────
    const localPayments = getPaymentsForDate(selectedDate).filter(p =>
      !selectedBranch || p.sucursal === selectedBranch
    );
    const localRows: PaymentRow[] = localPayments.map(p => ({
      id: String(p.id),
      sale_number: `VTA-${p.saleId}`,
      customer_name: p.cliente,
      amount: Number(p.monto),
      method: p.metodo as PaymentMethod,
      paid_at: p.fecha,
      seller_name: p.vendedora,
      reference: p.tipo === 'abono' ? 'Abono' : '',
      branch_name: p.sucursal,
    }));

    // Also include sales from localStorage that have no separate payment record yet
    const localSales = getSales().filter(v =>
      (v.fecha || '').startsWith(selectedDate) &&
      (!selectedBranch || v.sucursalCobro === selectedBranch)
    );
    // Deduplicate: only add if no payment already recorded for this saleId
    const recordedSaleIds = new Set(localPayments.map(p => p.saleId));
    const fallbackRows: PaymentRow[] = localSales
      .filter(v => !recordedSaleIds.has(v.id))
      .map(v => ({
        id: `ls-${v.id}`,
        sale_number: `VTA-${v.id}`,
        customer_name: `${v.cliente.nombre} ${v.cliente.apellido}`.trim(),
        amount: Number(v.sena) > 0 ? Number(v.sena) : Number(v.total),
        method: v.metodoPago as PaymentMethod,
        paid_at: v.fecha,
        seller_name: v.vendedora,
        reference: '',
        branch_name: v.sucursalCobro,
      }));

    const rows = [...supabaseRows, ...localRows, ...fallbackRows];
    setPayments(rows);

    // ── Aggregate totals ───────────────────────────────────────────────────
    let agg = emptyAgg();
    for (const r of rows) agg = addToAgg(agg, r.method, r.amount);

    // ── Expenses ──────────────────────────────────────────────────────────
    let expList: Expense[] = [];
    {
      let expQuery = supabase
        .from('expenses')
        .select('id, description, amount, method, expense_date')
        .eq('expense_date', selectedDate)
        .order('created_at', { ascending: false });
      if (selectedBranch) expQuery = expQuery.eq('branch_id', selectedBranch);
      const { data: expData } = await expQuery;
      expList = (expData ?? []) as Expense[];
    }
    setExpenses(expList);
    agg.expenses = expList.reduce((s, e) => s + Number(e.amount), 0);
    setSummary(agg);

    // ── By seller ─────────────────────────────────────────────────────────
    const sellerMap: Record<string, SellerRow> = {};
    for (const r of rows) {
      const s = r.seller_name || 'Sin vendedor';
      if (!sellerMap[s]) sellerMap[s] = { seller: s, efectivo: 0, transferencia: 0, tarjeta: 0, qr: 0, giro: 0, total: 0, count: 0 };
      const m = r.method as PaymentMethod;
      if (m in sellerMap[s]) (sellerMap[s] as any)[m] += r.amount;
      sellerMap[s].total += r.amount;
      sellerMap[s].count++;
    }
    setBySeller(Object.values(sellerMap).sort((a, b) => b.total - a.total));

    // ── Cash register close status ─────────────────────────────────────────
    if (selectedBranch) {
      const { data: cr } = await supabase
        .from('cash_register')
        .select('closed_at')
        .eq('branch_id', selectedBranch)
        .eq('register_date', selectedDate)
        .maybeSingle();
      setClosedAt(cr?.closed_at ?? null);
    } else {
      setClosedAt(null);
    }

    setLoading(false);
  }, [selectedBranch, selectedDate]);

  useEffect(() => { load(); }, [load]);

  // React to new sales/payments saved from POSPage or BalancesPage
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('optica_ventas_updated', handler);
    return () => window.removeEventListener('optica_ventas_updated', handler);
  }, [load]);

  async function handleClose() {
    if (!selectedBranch || !profile) return;
    setClosing(true);
    await supabase.from('cash_register').upsert({
      branch_id: selectedBranch,
      register_date: selectedDate,
      efectivo: summary.efectivo,
      transferencia: summary.transferencia,
      tarjeta: summary.tarjeta,
      qr: summary.qr,
      giro: summary.giro,
      expenses: summary.expenses,
      closed_by: profile.id,
      closed_at: new Date().toISOString(),
    }, { onConflict: 'branch_id,register_date' });
    await load();
    setClosing(false);
  }

  async function addExpense() {
    const amt = parseFloat(expAmount);
    if (!amt || !expDesc.trim() || !selectedBranch) return;
    setSavingExp(true);
    await supabase.from('expenses').insert([{
      branch_id: selectedBranch,
      amount: amt,
      method: expMethod,
      description: expDesc.trim(),
      registered_by: profile?.id ?? null,
      expense_date: selectedDate,
    }]);
    setExpDesc(''); setExpAmount(''); setShowAddExp(false);
    setSavingExp(false);
    load();
  }

  // Vendedora only sees her own payments
  const visiblePayments = isVendedora
    ? payments.filter(p => p.seller_name === profile?.full_name)
    : payments;
  const filtered = methodFilter === 'all' ? visiblePayments : visiblePayments.filter(p => p.method === methodFilter);

  // Recompute summary for vendedora's filtered view
  const visibleSummary: DailySummary = isVendedora
    ? (() => {
        let agg = emptyAgg();
        for (const r of visiblePayments) agg = addToAgg(agg, r.method, r.amount);
        agg.expenses = summary.expenses; // expenses are shared per branch
        return agg;
      })()
    : summary;
  const netTotal = visibleSummary.total - visibleSummary.expenses;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-light tracking-wider text-white">Mi Caja del Día</h1>
          <p className="text-xs text-gold-muted mt-0.5 tracking-wide">
            {isVendedora
              ? `${profile?.full_name} · ${activeBranch?.name ?? ''}`
              : 'Ingresos y movimientos por sede'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
              className="px-3 py-2 rounded-lg text-xs outline-none border"
              style={{ background: 'rgba(197,160,89,0.07)', borderColor: 'rgba(197,160,89,0.22)', color: '#C5A059' }}>
              <option value="" style={{ background: '#111' }}>Todas las sedes</option>
              {branches.map(b => (
                <option key={b.id} value={b.id} style={{ background: '#111' }}>{b.name}</option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(197,160,89,0.07)', border: '1px solid rgba(197,160,89,0.18)' }}>
            <Calendar size={13} className="text-gold-muted" />
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs text-white border-none outline-none" />
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Method cards */}
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
        {METHODS.map(m => (
          <div key={m.id} className="rounded-xl p-4 transition-all"
            style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${m.color}28` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-light tracking-wide" style={{ color: 'rgba(255,255,255,0.44)' }}>{m.label}</span>
              <span style={{ color: m.color, opacity: 0.8 }}>{m.icon}</span>
            </div>
            <p className="text-xl font-light" style={{ color: m.color }}>{fmt((visibleSummary as any)[m.id])}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.22)' }}>Gs.</p>
          </div>
        ))}
      </div>

      {/* Net totals */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.20)' }}>
          <p className="text-xs font-light mb-2 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.44)' }}>
            <DollarSign size={11} />{isVendedora ? 'Mis cobros de hoy' : 'Total cobrado'}
          </p>
          <p className="text-2xl font-light" style={{ color: '#C5A059' }}>{fmt(visibleSummary.total)}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.24)' }}>{visibleSummary.count} movimientos</p>
        </div>
        <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(239,68,68,0.20)' }}>
          <p className="text-xs font-light mb-2 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.44)' }}>
            <Minus size={11} />Egresos
          </p>
          <p className="text-2xl font-light" style={{ color: '#ef4444' }}>{fmt(visibleSummary.expenses)}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.24)' }}>{expenses.length} gastos</p>
        </div>
        <div className="rounded-xl p-5"
          style={{ background: netTotal >= 0 ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)', border: `1px solid ${netTotal >= 0 ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)'}` }}>
          <p className="text-xs font-light mb-2" style={{ color: 'rgba(255,255,255,0.44)' }}>Neto del día</p>
          <p className="text-2xl font-light" style={{ color: netTotal >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(netTotal)}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.24)' }}>Gs.</p>
        </div>
      </div>

      {/* By seller breakdown — admin only */}
      {isAdmin && bySeller.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <User size={14} className="text-gold-muted" />
            <span className="text-xs font-light tracking-wider text-white">Ingresos por vendedora</span>
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['Vendedora', 'Efectivo', 'POS', 'Transfer.', 'QR', 'Giro', 'Total', 'Movs.'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-light" style={{ color: 'rgba(255,255,255,0.32)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bySeller.map((r, i) => (
                <tr key={r.seller}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td className="px-4 py-3 text-xs font-light text-white">{r.seller}</td>
                  <td className="px-4 py-3 text-xs font-light" style={{ color: '#22c55e' }}>{fmt(r.efectivo)}</td>
                  <td className="px-4 py-3 text-xs font-light" style={{ color: '#f59e0b' }}>{fmt(r.tarjeta)}</td>
                  <td className="px-4 py-3 text-xs font-light" style={{ color: '#3b82f6' }}>{fmt(r.transferencia)}</td>
                  <td className="px-4 py-3 text-xs font-light" style={{ color: '#C5A059' }}>{fmt(r.qr)}</td>
                  <td className="px-4 py-3 text-xs font-light" style={{ color: '#a78bfa' }}>{fmt(r.giro)}</td>
                  <td className="px-4 py-3 text-sm font-light" style={{ color: '#C5A059' }}>{fmt(r.total)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'rgba(255,255,255,0.36)' }}>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cash close + day summary */}
      {isAdmin && (
        <div className="rounded-xl overflow-hidden" style={{ border: closedAt ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(197,160,89,0.22)' }}>
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 py-4"
            style={{ background: closedAt ? 'rgba(34,197,94,0.05)' : 'rgba(197,160,89,0.04)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-2.5">
              {closedAt
                ? <Lock size={14} style={{ color: '#22c55e' }} />
                : <Unlock size={14} style={{ color: '#C5A059' }} />}
              <div>
                <p className="text-sm font-light" style={{ color: closedAt ? '#22c55e' : 'rgba(255,255,255,0.75)' }}>
                  {closedAt ? 'Caja cerrada' : 'Caja abierta — pendiente de cierre'}
                </p>
                {closedAt && (
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.36)' }}>
                    Cerrada el {new Date(closedAt).toLocaleString('es-PY')}
                  </p>
                )}
              </div>
            </div>
            {!closedAt && (
              <button onClick={handleClose} disabled={closing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(197,160,89,0.14)', border: '1px solid rgba(197,160,89,0.38)', color: '#C5A059' }}>
                <CheckCircle size={14} />
                {closing ? 'Cerrando...' : 'Cerrar Caja'}
              </button>
            )}
          </div>

          {/* Day close summary */}
          <div className="px-5 py-5">
            <p className="text-xs font-light tracking-widest uppercase mb-4" style={{ color: 'rgba(197,160,89,0.55)' }}>
              Resumen del cierre
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Total Efectivo en Caja', value: summary.efectivo, color: '#22c55e', icon: <Banknote size={14} /> },
                { label: 'Total Ventas POS',        value: summary.tarjeta,  color: '#f59e0b', icon: <CreditCard size={14} /> },
                { label: 'Transferencias',          value: summary.transferencia, color: '#3b82f6', icon: <ArrowRightLeft size={14} /> },
                { label: 'Total General',           value: summary.total,    color: '#C5A059', icon: <TrendingUp size={14} /> },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-4"
                  style={{ background: `${item.color}08`, border: `1px solid ${item.color}28` }}>
                  <div className="flex items-center gap-2 mb-2.5" style={{ color: item.color, opacity: 0.7 }}>
                    {item.icon}
                    <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.44)' }}>{item.label}</span>
                  </div>
                  <p className="text-xl font-light" style={{ color: item.color }}>Gs. {fmt(item.value)}</p>
                </div>
              ))}
            </div>
            {summary.expenses > 0 && (
              <div className="mt-3 flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)' }}>
                <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.44)' }}>
                  Menos egresos del día
                </span>
                <span className="text-sm font-light" style={{ color: '#ef4444' }}>— Gs. {fmt(summary.expenses)}</span>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between px-4 py-3 rounded-xl"
              style={{ background: netTotal >= 0 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${netTotal >= 0 ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
              <span className="text-sm font-light text-white">Neto final del día</span>
              <span className="text-lg font-light" style={{ color: netTotal >= 0 ? '#22c55e' : '#ef4444' }}>Gs. {fmt(netTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Expenses section */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <Minus size={14} style={{ color: '#ef4444' }} />
            <span className="text-xs font-light tracking-wider text-white">Egresos del día</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
              {expenses.length}
            </span>
          </div>
          <button onClick={() => setShowAddExp(!showAddExp)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {showAddExp ? <X size={12} /> : <Plus size={12} />}
            {showAddExp ? 'Cancelar' : 'Agregar egreso'}
          </button>
        </div>

        {showAddExp && (
          <div className="px-5 py-4 flex flex-wrap gap-2 items-end"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
            <div className="flex-1 min-w-44">
              <input value={expDesc} onChange={e => setExpDesc(e.target.value)}
                placeholder="Descripción del gasto"
                className="w-full px-3 py-2 rounded-lg bg-transparent text-white text-xs outline-none border"
                style={{ borderColor: 'rgba(197,160,89,0.2)' }} />
            </div>
            <input value={expAmount} onChange={e => setExpAmount(e.target.value)}
              type="number" placeholder="Monto Gs."
              className="w-32 px-3 py-2 rounded-lg bg-transparent text-white text-xs outline-none border"
              style={{ borderColor: 'rgba(197,160,89,0.2)' }} />
            <div className="flex gap-1">
              {METHODS.slice(0, 3).map(m => (
                <button key={m.id} onClick={() => setExpMethod(m.id)}
                  className="px-2.5 py-2 rounded text-xs"
                  style={{
                    background: expMethod === m.id ? `${m.color}18` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${expMethod === m.id ? m.color + '44' : 'rgba(255,255,255,0.07)'}`,
                    color: expMethod === m.id ? m.color : 'rgba(255,255,255,0.38)',
                  }}>
                  {m.icon}
                </button>
              ))}
            </div>
            <button onClick={addExpense} disabled={savingExp}
              className="px-4 py-2 rounded-lg text-xs text-black font-medium"
              style={{ background: '#C5A059' }}>
              {savingExp ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        )}

        {expenses.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>Sin egresos registrados</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {expenses.map(e => (
              <div key={e.id} className="flex items-center gap-4 px-5 py-3 text-xs font-light">
                <span className="text-white flex-1">{e.description}</span>
                <span style={{ color: '#ef4444' }}>— Gs. {fmt(Number(e.amount))}</span>
                <span className="px-2 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>{e.method}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Movements table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-gold-muted" />
            <span className="text-xs font-light tracking-wider text-white">Cobros del día</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(197,160,89,0.12)', color: '#C5A059' }}>
              {filtered.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {['all', ...METHODS.map(m => m.id)].map(m => (
              <button key={m} onClick={() => setMethodFilter(m)}
                className="px-2 py-1 rounded text-xs font-light"
                style={{
                  background: methodFilter === m ? 'rgba(197,160,89,0.14)' : 'transparent',
                  color: methodFilter === m ? '#C5A059' : 'rgba(255,255,255,0.36)',
                  border: methodFilter === m ? '1px solid rgba(197,160,89,0.30)' : '1px solid transparent',
                }}>
                {m === 'all' ? 'Todos' : METHODS.find(x => x.id === m)?.label ?? m}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-14">
            <DollarSign size={28} style={{ color: 'rgba(255,255,255,0.08)', margin: '0 auto 10px' }} />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
              {selectedBranch ? 'Sin cobros para este día y sede' : 'Sin cobros para esta fecha'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['Hora', 'Venta', 'Cliente', 'Vendedor', 'Método', 'Ref.', 'Monto'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-light" style={{ color: 'rgba(255,255,255,0.32)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const mc = METHODS.find(m => m.id === p.method)?.color ?? '#C5A059';
                return (
                  <tr key={p.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td className="px-4 py-3 text-xs font-light" style={{ color: 'rgba(255,255,255,0.38)' }}>
                      {new Date(p.paid_at).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: '#C5A059' }}>#{p.sale_number}</td>
                    <td className="px-4 py-3 text-xs font-light text-white">{p.customer_name || '—'}</td>
                    <td className="px-4 py-3 text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>{p.seller_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${mc}18`, color: mc }}>
                        {METHODS.find(m => m.id === p.method)?.label ?? p.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-light" style={{ color: 'rgba(255,255,255,0.36)' }}>
                      {p.reference || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-light text-right" style={{ color: '#22c55e' }}>
                      {fmt(p.amount)}
                      <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.28)' }}>Gs.</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
