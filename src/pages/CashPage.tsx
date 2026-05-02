import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, Banknote, CreditCard, ArrowRightLeft, RefreshCw,
  CheckCircle, TrendingUp, Calendar, QrCode, Send, Minus, Plus, X,
  User, Lock, Unlock, Tag, MapPin, Clock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBranch } from '../context/BranchContext';
import { useAuth } from '../context/AuthContext';
import { getSales, getPaymentsForDate, saveExpense, getExpensesForDate } from '../lib/salesStorage';

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
  category: string;
  amount: number;
  method: string;
  expense_date: string;
  branch_name?: string;
};

type SellerRow = { seller: string; efectivo: number; transferencia: number; tarjeta: number; qr: number; giro: number; total: number; count: number };

const METHODS: { id: PaymentMethod; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'efectivo',      label: 'Efectivo',     icon: <Banknote       size={16} />, color: '#22c55e' },
  { id: 'transferencia', label: 'Transferencia', icon: <ArrowRightLeft size={16} />, color: '#3b82f6' },
  { id: 'tarjeta',       label: 'POS',          icon: <CreditCard     size={16} />, color: '#f59e0b' },
  { id: 'qr',            label: 'QR',           icon: <QrCode         size={16} />, color: '#C5A059' },
  { id: 'giro',          label: 'Giro',         icon: <Send           size={16} />, color: '#a78bfa' },
];

const EXPENSE_CATEGORIES: { id: string; label: string }[] = [
  { id: 'alquiler',    label: 'Alquiler' },
  { id: 'servicios',   label: 'Servicios' },
  { id: 'insumos',     label: 'Insumos' },
  { id: 'comisiones',  label: 'Comisiones' },
  { id: 'limpieza',    label: 'Limpieza' },
  { id: 'transporte',  label: 'Transporte' },
  { id: 'reparacion',  label: 'Reparación' },
  { id: 'otros',       label: 'Otros' },
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
  const [showAddExp,  setShowAddExp]  = useState(false);
  const [expDesc,     setExpDesc]     = useState('');
  const [expAmount,   setExpAmount]   = useState('');
  const [expMethod,   setExpMethod]   = useState<PaymentMethod>('efectivo');
  const [expCategory, setExpCategory] = useState('otros');
  const [expBranch,   setExpBranch]   = useState('');
  const [savingExp,   setSavingExp]   = useState(false);
  const [expSuccess,  setExpSuccess]  = useState(false);

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

  // Keep expBranch in sync with selectedBranch
  useEffect(() => {
    if (selectedBranch && !expBranch) setExpBranch(selectedBranch);
  }, [selectedBranch, expBranch]);

  function buildAndCommit(rows: PaymentRow[], expList: Expense[]) {
    let agg = emptyAgg();
    for (const r of rows) agg = addToAgg(agg, r.method, r.amount);
    agg.expenses = expList.reduce((s, e) => s + Number(e.amount), 0);
    setPayments(rows);
    setExpenses(expList);
    setSummary(agg);
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
  }

  const load = useCallback(async () => {
    setLoading(true);

    // Branch stored as name slug in localStorage (e.g. 'centro', 'azara')
    const branchFilter = (selectedBranch || '').toLowerCase();

    // ── Step 1: Build from localStorage immediately ────────────────────────
    const localPayments = getPaymentsForDate(selectedDate).filter(p =>
      !branchFilter || (p.sucursal || '').toLowerCase() === branchFilter
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

    const localSales = getSales().filter(v =>
      (v.fecha || '').startsWith(selectedDate) &&
      (!branchFilter || (v.sucursalCobro || '').toLowerCase() === branchFilter)
    );
    // Sales that have NO payment record in LS_PAYMENTS_KEY get a synthetic row.
    // Use (total - saldo) as the real paid amount — never sena alone, which
    // doesn't grow when abonos are added.
    const recordedSaleIds = new Set(localPayments.map(p => p.saleId));
    const fallbackRows: PaymentRow[] = localSales
      .filter(v => !recordedSaleIds.has(v.id))
      .map(v => {
        const paid = Math.max(0, (Number(v.total) || 0) - (Number(v.saldo) || 0));
        return {
          id: `ls-${v.id}`,
          sale_number: `VTA-${v.id}`,
          customer_name: `${v.cliente.nombre} ${v.cliente.apellido}`.trim(),
          amount: paid > 0 ? paid : (Number(v.sena) || 0),
          method: v.metodoPago as PaymentMethod,
          paid_at: v.fecha,
          seller_name: v.vendedora,
          reference: '',
          branch_name: v.sucursalCobro,
        };
      });

    const localExpenses = getExpensesForDate(selectedDate).filter(e =>
      !branchFilter || (e.sucursal || '').toLowerCase() === branchFilter
    );
    const localExpList: Expense[] = localExpenses.map(e => ({
      id: String(e.id),
      description: e.descripcion,
      category: e.categoria,
      amount: Number(e.monto),
      method: e.metodo,
      expense_date: e.fecha,
      branch_name: e.sucursal,
    }));

    // Render local data right away — no waiting
    buildAndCommit([...localRows, ...fallbackRows], localExpList);
    setLoading(false);

    // ── Step 2: Enrich with Supabase (max 2 seconds, non-blocking) ─────────
    try {
      const TIMEOUT = 2000;
      const dayStart = `${selectedDate}T00:00:00`;
      const dayEnd   = `${selectedDate}T23:59:59`;
      const race = (p: Promise<unknown>) => Promise.race([p, new Promise<null>(res => setTimeout(() => res(null), TIMEOUT))]);

      let pQuery = supabase
        .from('sale_payments')
        .select('id, amount, method, paid_at, reference, branches(name), sales(sale_number, seller_name, customers(full_name))')
        .gte('paid_at', dayStart).lte('paid_at', dayEnd)
        .order('paid_at', { ascending: false });
      if (selectedBranch) pQuery = pQuery.eq('branch_id', selectedBranch);
      const pResult = await race(pQuery);
      const pData = (pResult as any)?.data;

      let expQuery = supabase
        .from('expenses')
        .select('id, description, category, amount, method, expense_date, branches(name)')
        .eq('expense_date', selectedDate)
        .order('created_at', { ascending: false });
      if (selectedBranch) expQuery = expQuery.eq('branch_id', selectedBranch);
      const eResult = await race(expQuery);
      const eData = (eResult as any)?.data;

      const sbRows: PaymentRow[] = (pData ?? []).map((p: any) => ({
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

      const sbExp: Expense[] = (eData ?? []).map((e: any) => ({
        id: e.id,
        description: e.description,
        category: e.category ?? 'otros',
        amount: Number(e.amount),
        method: e.method,
        expense_date: e.expense_date,
        branch_name: e.branches?.name ?? '',
      }));

      // Only update if Supabase returned something new
      if (sbRows.length > 0 || sbExp.length > 0) {
        const sbIds = new Set(sbRows.map(r => r.id));
        const merged = [...sbRows, ...[...localRows, ...fallbackRows].filter(r => !sbIds.has(r.id))];
        const sbExpIds = new Set(sbExp.map(e => e.id));
        const mergedExp = [...sbExp, ...localExpList.filter(e => !sbExpIds.has(e.id))];
        buildAndCommit(merged, mergedExp);
      }

      // Cash register close status
      if (selectedBranch) {
        const crResult = await race(
          supabase.from('cash_register').select('closed_at')
            .eq('branch_id', selectedBranch).eq('register_date', selectedDate).maybeSingle()
        );
        setClosedAt((crResult as any)?.data?.closed_at ?? null);
      } else {
        setClosedAt(null);
      }
    } catch { /* Supabase unavailable — local data already shown */ }
  }, [selectedBranch, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const branchName = expBranch || selectedBranch || activeBranch?.id || '';
    if (!amt || !expDesc.trim() || !branchName) return;
    setSavingExp(true);

    // Save to localStorage immediately — always works
    saveExpense({
      id: Date.now(),
      fecha: selectedDate,
      descripcion: expDesc.trim(),
      categoria: expCategory,
      monto: Number(amt),
      metodo: expMethod,
      sucursal: branchName,
      vendedora: profile?.full_name || '',
    });

    // Also try Supabase (branch_id may be slug or UUID — best effort)
    supabase.from('expenses').insert([{
      branch_id: branchName,
      amount: Number(amt),
      method: expMethod,
      description: expDesc.trim(),
      category: expCategory,
      registered_by: null,
      expense_date: selectedDate,
    }]).then(() => {}).catch(() => {});

    setExpDesc('');
    setExpAmount('');
    setExpCategory('otros');
    setExpMethod('efectivo');
    setShowAddExp(false);
    setExpSuccess(true);
    setTimeout(() => setExpSuccess(false), 4000);
    setSavingExp(false);
    load();
  }

  // Vendedora only sees her own payments
  const visiblePayments = isVendedora
    ? payments.filter(p => p.seller_name === profile?.full_name)
    : payments;
  const filtered = methodFilter === 'all' ? visiblePayments : visiblePayments.filter(p => p.method === methodFilter);

  // Recompute summary directly from visible rows and current expenses list
  const visibleSummary: DailySummary = (() => {
    let agg = emptyAgg();
    for (const r of visiblePayments) agg = addToAgg(agg, r.method, r.amount);
    agg.expenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
    return agg;
  })();

  // Net = total ingresos - egresos
  const netTotal = visibleSummary.total - visibleSummary.expenses;

  // Efectivo neto = efectivo cobrado - todos los egresos (gastos salen de caja física)
  const efectivoNeto = visibleSummary.efectivo - visibleSummary.expenses;

  // Total pendiente = suma de saldos de TODAS las ventas activas (no entregadas/canceladas),
  // filtrado por sucursal si hay una seleccionada. No depende de la fecha seleccionada.
  const totalPendiente = getSales()
    .filter(v => {
      if ((Number(v.saldo) || 0) <= 0) return false;
      if (v.estadoTrabajo === 'entregado' || v.estadoTrabajo === 'cancelado') return false;
      const branch = (v.sucursalCobro || v.sucursalVenta || '').toLowerCase();
      if (selectedBranch && branch !== selectedBranch) return false;
      return true;
    })
    .reduce((s, v) => s + (Number(v.saldo) || 0), 0);

  // Effective branch for expense form
  const expFormBranch = expBranch || selectedBranch || activeBranch?.id || '';

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

      {/* Expense success toast */}
      {expSuccess && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.30)' }}>
          <CheckCircle size={14} style={{ color: '#ef4444' }} />
          <p className="text-sm font-light" style={{ color: '#ef4444' }}>Gasto registrado correctamente</p>
        </div>
      )}

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.20)' }}>
          <p className="text-xs font-light mb-2 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.44)' }}>
            <DollarSign size={11} />{isVendedora ? 'Mis cobros de hoy' : 'Total cobrado'}
          </p>
          <p className="text-2xl font-light" style={{ color: '#C5A059' }}>{fmt(visibleSummary.total)}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.24)' }}>{visibleSummary.count} movimientos</p>
        </div>
        <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(239,68,68,0.20)' }}>
          <p className="text-xs font-light mb-2 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.44)' }}>
            <Minus size={11} />Egresos del día
          </p>
          <p className="text-2xl font-light" style={{ color: '#ef4444' }}>{fmt(visibleSummary.expenses)}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.24)' }}>{expenses.length} gastos</p>
        </div>
        <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(59,130,246,0.20)' }}>
          <p className="text-xs font-light mb-2 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.44)' }}>
            <Banknote size={11} />Efectivo neto
          </p>
          <p className="text-2xl font-light" style={{ color: efectivoNeto >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(efectivoNeto)}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.24)' }}>Efectivo — Gastos · Gs.</p>
        </div>
        <div className="rounded-xl p-5"
          style={{ background: netTotal >= 0 ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)', border: `1px solid ${netTotal >= 0 ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)'}` }}>
          <p className="text-xs font-light mb-2" style={{ color: 'rgba(255,255,255,0.44)' }}>Total en Caja</p>
          <p className="text-2xl font-light" style={{ color: netTotal >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(netTotal)}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.24)' }}>Cobros — Gastos · Gs.</p>
        </div>
      </div>

      {/* Pending balance summary */}
      {totalPendiente > 0 && (
        <div className="flex items-center justify-between px-5 py-3.5 rounded-xl"
          style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.20)' }}>
          <p className="text-xs font-light flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
            <Clock size={12} style={{ color: '#f59e0b' }} />
            Total Pendiente de cobro
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>(saldo de ventas no entregadas)</span>
          </p>
          <p className="text-lg font-light" style={{ color: '#f59e0b' }}>Gs. {fmt(totalPendiente)}</p>
        </div>
      )}

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
          <div className="flex items-center justify-between px-5 py-4"
            style={{ background: closedAt ? 'rgba(34,197,94,0.05)' : 'rgba(197,160,89,0.04)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-2.5">
              {closedAt
                ? <Lock size={14} style={{ color: '#22c55e' }} />
                : <Unlock size={14} style={{ color: '#C5A059' }} />}
              <div>
                <p className="text-sm font-light" style={{ color: closedAt ? '#22c55e' : 'rgba(255,255,255,0.75)' }}>
                  {closedAt ? 'Caja cerrada' : selectedBranch ? 'Caja abierta — pendiente de cierre' : 'Seleccioná una sede para cerrar caja'}
                </p>
                {closedAt && (
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.36)' }}>
                    Cerrada el {new Date(closedAt).toLocaleString('es-PY')}
                  </p>
                )}
              </div>
            </div>
            {!closedAt && selectedBranch && (
              <button onClick={handleClose} disabled={closing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(197,160,89,0.14)', border: '1px solid rgba(197,160,89,0.38)', color: '#C5A059' }}>
                <CheckCircle size={14} />
                {closing ? 'Cerrando...' : 'Cerrar Caja'}
              </button>
            )}
          </div>

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
            {expenses.length > 0 && (
              <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.32)' }}>
                · Total: Gs. {fmt(expenses.reduce((s, e) => s + e.amount, 0))}
              </span>
            )}
          </div>
          <button onClick={() => { setShowAddExp(!showAddExp); setExpBranch(selectedBranch || activeBranch?.id || ''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {showAddExp ? <X size={12} /> : <Plus size={12} />}
            {showAddExp ? 'Cancelar' : 'Registrar Gasto'}
          </button>
        </div>

        {showAddExp && (
          <div className="px-5 py-4 space-y-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(239,68,68,0.02)' }}>
            <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(239,68,68,0.55)' }}>
              Nuevo Egreso
            </p>

            {/* Description */}
            <input value={expDesc} onChange={e => setExpDesc(e.target.value)}
              placeholder="Motivo del gasto (ej: compra de insumos)"
              className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border"
              style={{ borderColor: 'rgba(239,68,68,0.25)' }} />

            <div className="flex gap-2 flex-wrap">
              {/* Amount */}
              <input value={expAmount} onChange={e => setExpAmount(e.target.value)}
                type="number" placeholder="Monto Gs."
                className="w-36 px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                style={{ borderColor: 'rgba(239,68,68,0.25)' }} />

              {/* Category */}
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border flex-1 min-w-36"
                style={{ borderColor: 'rgba(239,68,68,0.20)', background: 'rgba(255,255,255,0.02)' }}>
                <Tag size={11} style={{ color: 'rgba(239,68,68,0.6)', flexShrink: 0 }} />
                <select value={expCategory} onChange={e => setExpCategory(e.target.value)}
                  className="bg-transparent text-xs outline-none flex-1"
                  style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {EXPENSE_CATEGORIES.map(c => (
                    <option key={c.id} value={c.id} style={{ background: '#111' }}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Branch for admin with "all branches" selected */}
              {isAdmin && !selectedBranch && (
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border flex-1 min-w-36"
                  style={{ borderColor: 'rgba(239,68,68,0.20)', background: 'rgba(255,255,255,0.02)' }}>
                  <MapPin size={11} style={{ color: 'rgba(239,68,68,0.6)', flexShrink: 0 }} />
                  <select value={expFormBranch} onChange={e => setExpBranch(e.target.value)}
                    className="bg-transparent text-xs outline-none flex-1"
                    style={{ color: expFormBranch ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.38)' }}>
                    <option value="" style={{ background: '#111' }}>Sede del gasto...</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id} style={{ background: '#111' }}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Payment method — all 5 */}
            <div className="flex gap-1.5 flex-wrap">
              {METHODS.map(m => (
                <button key={m.id} onClick={() => setExpMethod(m.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-light"
                  style={{
                    background: expMethod === m.id ? `${m.color}18` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${expMethod === m.id ? m.color + '44' : 'rgba(255,255,255,0.07)'}`,
                    color: expMethod === m.id ? m.color : 'rgba(255,255,255,0.38)',
                  }}>
                  {m.icon}
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            {/* Validation hint */}
            {isAdmin && !selectedBranch && !expFormBranch && (
              <p className="text-xs font-light" style={{ color: 'rgba(245,158,11,0.8)' }}>
                Seleccioná la sede para continuar.
              </p>
            )}

            <div className="flex items-center gap-2">
              <button onClick={addExpense}
                disabled={savingExp || !expDesc.trim() || !expAmount || (isAdmin && !selectedBranch && !expFormBranch)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: (!expDesc.trim() || !expAmount || (isAdmin && !selectedBranch && !expFormBranch))
                    ? 'rgba(239,68,68,0.08)' : '#ef4444',
                  color: (!expDesc.trim() || !expAmount || (isAdmin && !selectedBranch && !expFormBranch))
                    ? 'rgba(239,68,68,0.4)' : '#fff',
                  cursor: (!expDesc.trim() || !expAmount) ? 'not-allowed' : 'pointer',
                }}>
                <Minus size={12} />
                {savingExp ? 'Guardando...' : 'Registrar Gasto'}
              </button>
              <button onClick={() => { setShowAddExp(false); setExpDesc(''); setExpAmount(''); setExpCategory('otros'); }}
                className="px-3 py-2 rounded-lg text-xs font-light"
                style={{ color: 'rgba(255,255,255,0.36)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {expenses.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>Sin egresos registrados</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {expenses.map(e => {
              const catLabel = EXPENSE_CATEGORIES.find(c => c.id === e.category)?.label ?? e.category;
              return (
                <div key={e.id} className="flex items-center gap-4 px-5 py-3 text-xs font-light">
                  <div className="flex-1 min-w-0">
                    <p className="text-white truncate">{e.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded text-xs"
                        style={{ background: 'rgba(239,68,68,0.08)', color: 'rgba(239,68,68,0.7)' }}>{catLabel}</span>
                      {e.branch_name && (
                        <span style={{ color: 'rgba(255,255,255,0.28)' }}>{e.branch_name}</span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0" style={{ color: '#ef4444' }}>— Gs. {fmt(Number(e.amount))}</span>
                  <span className="px-2 py-0.5 rounded shrink-0" style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>{e.method}</span>
                </div>
              );
            })}
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
