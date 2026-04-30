import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, Banknote, CreditCard, ArrowRightLeft, RefreshCw,
  CheckCircle, TrendingUp, Calendar, QrCode, Send, Minus, Plus, X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBranch } from '../context/BranchContext';
import { useAuth } from '../context/AuthContext';
import { getSales } from '../lib/salesStorage';

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

const METHODS: { id: PaymentMethod; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'efectivo',      label: 'Efectivo',      icon: <Banknote      size={16} />, color: '#22c55e' },
  { id: 'transferencia', label: 'Transferencia',  icon: <ArrowRightLeft size={16} />, color: '#3b82f6' },
  { id: 'tarjeta',       label: 'POS',           icon: <CreditCard    size={16} />, color: '#f59e0b' },
  { id: 'qr',            label: 'QR',            icon: <QrCode        size={16} />, color: '#C5A059' },
  { id: 'giro',          label: 'Giro',          icon: <Send          size={16} />, color: '#a78bfa' },
];

function fmt(n: number) {
  return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function CashPage() {
  const { activeBranch, branches } = useBranch();
  const { profile } = useAuth();

  const [selectedDate,   setSelectedDate]   = useState(new Date().toISOString().slice(0, 10));
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [summary,        setSummary]        = useState<DailySummary>({ efectivo: 0, transferencia: 0, tarjeta: 0, qr: 0, giro: 0, expenses: 0, total: 0, count: 0 });
  const [payments,       setPayments]       = useState<PaymentRow[]>([]);
  const [expenses,       setExpenses]       = useState<Expense[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [closing,        setClosing]        = useState(false);
  const [closedAt,       setClosedAt]       = useState<string | null>(null);
  const [methodFilter,   setMethodFilter]   = useState<string>('all');

  // Expense entry
  const [showAddExp,  setShowAddExp]  = useState(false);
  const [expDesc,     setExpDesc]     = useState('');
  const [expAmount,   setExpAmount]   = useState('');
  const [expMethod,   setExpMethod]   = useState<PaymentMethod>('efectivo');
  const [savingExp,   setSavingExp]   = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'gerente';

  // Set default branch
  useEffect(() => {
    if (activeBranch && !selectedBranch) setSelectedBranch(activeBranch.id);
  }, [activeBranch, selectedBranch]);

  const load = useCallback(async () => {
    if (!selectedBranch) return;
    setLoading(true);

    const dayStart = `${selectedDate}T00:00:00`;
    const dayEnd   = `${selectedDate}T23:59:59`;

    // Payments received at this branch on this date
    const { data: pData } = await supabase
      .from('sale_payments')
      .select(`id, amount, method, paid_at, reference, branches(name), sales(sale_number, seller_name, customers(full_name))`)
      .eq('branch_id', selectedBranch)
      .gte('paid_at', dayStart)
      .lte('paid_at', dayEnd)
      .order('paid_at', { ascending: false });

    const supabaseRows: PaymentRow[] = (pData ?? []).map((p: any) => ({
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

    // Merge localStorage sales for this date/branch into rows
    const localSales = getSales().filter(v => (v.fecha || '').startsWith(selectedDate) && v.sucursalCobro === selectedBranch);
    const localRows: PaymentRow[] = localSales.map(v => ({
      id: String(v.id),
      sale_number: `VTA-${v.id}`,
      customer_name: `${v.cliente.nombre} ${v.cliente.apellido}`.trim(),
      amount: Number(v.sena) > 0 ? Number(v.sena) : Number(v.total),
      method: v.metodoPago as PaymentMethod,
      paid_at: v.fecha,
      seller_name: v.vendedora,
      reference: '',
      branch_name: v.sucursalCobro,
    }));

    const rows = [...supabaseRows, ...localRows];
    setPayments(rows);

    // Aggregate by method
    const agg = rows.reduce(
      (acc, r) => {
        const m = r.method as PaymentMethod;
        if (m in acc) (acc as any)[m] += r.amount;
        acc.total += r.amount;
        acc.count++;
        return acc;
      },
      { efectivo: 0, transferencia: 0, tarjeta: 0, qr: 0, giro: 0, expenses: 0, total: 0, count: 0 }
    );

    // Expenses for this branch/date
    const { data: expData } = await supabase
      .from('expenses')
      .select('id, description, amount, method, expense_date')
      .eq('branch_id', selectedBranch)
      .eq('expense_date', selectedDate)
      .order('created_at', { ascending: false });

    const expList = (expData ?? []) as Expense[];
    setExpenses(expList);
    agg.expenses = expList.reduce((s, e) => s + Number(e.amount), 0);

    setSummary(agg);

    // Check closing
    const { data: cr } = await supabase
      .from('cash_register')
      .select('closed_at')
      .eq('branch_id', selectedBranch)
      .eq('register_date', selectedDate)
      .maybeSingle();
    setClosedAt(cr?.closed_at ?? null);

    setLoading(false);
  }, [selectedBranch, selectedDate]);

  useEffect(() => { load(); }, [load]);

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

  const filtered = methodFilter === 'all' ? payments : payments.filter(p => p.method === methodFilter);
  const netTotal = summary.total - summary.expenses;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-light tracking-wider text-white">Caja del Día</h1>
          <p className="text-xs text-gold-muted mt-0.5 tracking-wide">
            Registro de cobros por sede
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Branch selector */}
          <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
            className="px-3 py-2 rounded-lg text-xs outline-none border"
            style={{ background: 'rgba(197,160,89,0.07)', borderColor: 'rgba(197,160,89,0.22)', color: '#C5A059' }}>
            {branches.map(b => (
              <option key={b.id} value={b.id} style={{ background: '#111' }}>{b.name}</option>
            ))}
          </select>
          {/* Date picker */}
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

      {/* Summary cards */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {METHODS.map(m => (
          <div key={m.id} className="rounded-xl p-3"
            style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${m.color}22` }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>{m.label}</span>
              <span style={{ color: m.color }}>{m.icon}</span>
            </div>
            <p className="text-lg font-light" style={{ color: m.color }}>
              {fmt((summary as any)[m.id])}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.22)' }}>Gs.</p>
          </div>
        ))}
      </div>

      {/* Net totals row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl p-4"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.18)' }}>
          <p className="text-xs font-light mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <DollarSign size={11} className="inline mr-1" />Total cobrado
          </p>
          <p className="text-2xl font-light" style={{ color: '#C5A059' }}>{fmt(summary.total)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.24)' }}>{summary.count} movimientos</p>
        </div>
        <div className="rounded-xl p-4"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(239,68,68,0.18)' }}>
          <p className="text-xs font-light mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <Minus size={11} className="inline mr-1" />Egresos
          </p>
          <p className="text-2xl font-light" style={{ color: '#ef4444' }}>{fmt(summary.expenses)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.24)' }}>{expenses.length} gastos</p>
        </div>
        <div className="rounded-xl p-4"
          style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${netTotal >= 0 ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)'}` }}>
          <p className="text-xs font-light mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Neto del día
          </p>
          <p className="text-2xl font-light" style={{ color: netTotal >= 0 ? '#22c55e' : '#ef4444' }}>
            {fmt(netTotal)}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.24)' }}>Gs.</p>
        </div>
      </div>

      {/* Cash closing */}
      {isAdmin && (
        <div className="flex items-center justify-between px-5 py-4 rounded-xl"
          style={{
            background: closedAt ? 'rgba(34,197,94,0.06)' : 'rgba(197,160,89,0.05)',
            border: closedAt ? '1px solid rgba(34,197,94,0.22)' : '1px solid rgba(197,160,89,0.20)',
          }}>
          <div>
            <p className="text-sm font-light" style={{ color: closedAt ? '#22c55e' : 'rgba(255,255,255,0.68)' }}>
              {closedAt ? 'Caja cerrada' : 'Caja abierta — pendiente de cierre'}
            </p>
            {closedAt && (
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
                Cerrada el {new Date(closedAt).toLocaleString('es-PY')}
              </p>
            )}
          </div>
          {!closedAt && (
            <button onClick={handleClose} disabled={closing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium"
              style={{ background: 'rgba(197,160,89,0.12)', border: '1px solid rgba(197,160,89,0.35)', color: '#C5A059' }}>
              <CheckCircle size={14} />
              {closing ? 'Cerrando...' : 'Cerrar Caja'}
            </button>
          )}
        </div>
      )}

      {/* Expenses section */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <Minus size={14} style={{ color: '#ef4444' }} />
            <span className="text-xs font-light tracking-wider text-white">Egresos del día</span>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
              {expenses.length}
            </span>
          </div>
          <button onClick={() => setShowAddExp(!showAddExp)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {showAddExp ? <X size={12} /> : <Plus size={12} />}
            {showAddExp ? 'Cancelar' : 'Agregar'}
          </button>
        </div>

        {showAddExp && (
          <div className="px-5 py-4 flex flex-wrap gap-2 items-end"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
            <div className="flex-1 min-w-40">
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
                  className="px-2 py-2 rounded text-xs"
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
              Guardar
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
                <span style={{ color: '#ef4444' }}>- Gs. {fmt(Number(e.amount))}</span>
                <span style={{ color: 'rgba(255,255,255,0.32)' }}>{e.method}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Movements table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-gold-muted" />
            <span className="text-xs font-light tracking-wider text-white">Cobros del día</span>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(197,160,89,0.12)', color: '#C5A059' }}>
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
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Sin cobros para este día y sede</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['Hora', 'Venta', 'Cliente', 'Vendedor', 'Método', 'Ref.', 'Monto'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-light"
                    style={{ color: 'rgba(255,255,255,0.32)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const mc = METHODS.find(m => m.id === p.method)?.color ?? '#C5A059';
                return (
                  <tr key={p.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    }}>
                    <td className="px-4 py-3 text-xs font-light" style={{ color: 'rgba(255,255,255,0.38)' }}>
                      {new Date(p.paid_at).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: '#C5A059' }}>#{p.sale_number}</td>
                    <td className="px-4 py-3 text-xs font-light text-white">{p.customer_name}</td>
                    <td className="px-4 py-3 text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>{p.seller_name}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: `${mc}18`, color: mc }}>
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
