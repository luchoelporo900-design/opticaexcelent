import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, Banknote, CreditCard, ArrowRightLeft, RefreshCw,
  CheckCircle, TrendingUp, Calendar, QrCode, Send, Minus, Plus, X,
  User, Unlock, Tag, MapPin, Clock, ChevronDown, Heart, Eye,
} from 'lucide-react';
import { useBranch } from '../context/BranchContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { saveExpense } from '../lib/salesStorage';
import { supabase } from '../lib/supabase';

type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'qr' | 'giro';

type DailySummary = {
  efectivo: number; transferencia: number; tarjeta: number;
  qr: number; giro: number; expenses: number; ingresos: number;
  total: number; count: number;
};

type PaymentRow = {
  id: string; sale_number: string; customer_name: string; amount: number;
  method: PaymentMethod; paid_at: string; seller_name: string;
  reference: string; branch_name: string; sale_id?: number;
};

type Expense = {
  id: string; description: string; category: string; amount: number;
  method: string; expense_date: string; branch_name?: string;
};

type Ingreso = {
  id: string; description: string; amount: number;
  method: string; date: string; branch_name?: string;
};

type SellerRow = {
  seller: string; efectivo: number; transferencia: number; tarjeta: number;
  qr: number; giro: number; total: number; count: number;
};

const METHODS: { id: PaymentMethod; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'efectivo',      label: 'Efectivo',     icon: <Banknote       size={16} />, color: '#22c55e' },
  { id: 'transferencia', label: 'Transferencia', icon: <ArrowRightLeft size={16} />, color: '#3b82f6' },
  { id: 'tarjeta',       label: 'POS',          icon: <CreditCard     size={16} />, color: '#f59e0b' },
  { id: 'qr',            label: 'QR',           icon: <QrCode         size={16} />, color: '#C5A059' },
  { id: 'giro',          label: 'Giro',         icon: <Send           size={16} />, color: '#a78bfa' },
];

const SUCURSALES = ['Azara', 'Fernando', 'Caacupé', 'La Fina'];

const EXPENSE_CATEGORIES = [
  { id: 'alquiler', label: 'Alquiler' }, { id: 'servicios', label: 'Servicios' },
  { id: 'insumos', label: 'Insumos' }, { id: 'comisiones', label: 'Comisiones' },
  { id: 'limpieza', label: 'Limpieza' }, { id: 'transporte', label: 'Transporte' },
  { id: 'reparacion', label: 'Reparación' }, { id: 'otros', label: 'Otros' },
];

const LS_REVIEWED_KEY = 'optica_pagos_revisados';

function getReviewed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_REVIEWED_KEY) || '[]')); }
  catch { return new Set(); }
}
function markReviewed(id: string) {
  const s = getReviewed(); s.add(id);
  localStorage.setItem(LS_REVIEWED_KEY, JSON.stringify([...s]));
}

function fmt(n: number) {
  return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function emptyAgg(): DailySummary {
  return { efectivo: 0, transferencia: 0, tarjeta: 0, qr: 0, giro: 0, expenses: 0, ingresos: 0, total: 0, count: 0 };
}
function addToAgg(agg: DailySummary, method: string, amount: number): DailySummary {
  const next = { ...agg };
  if (method in next) (next as any)[method] += amount;
  next.total += amount; next.count++;
  return next;
}
function branchMatch(stored: string, selected: string): boolean {
  if (!selected) return true;
  const n = (s: string) => s.toLowerCase().replace(/[áàä]/g,'a').replace(/[éèë]/g,'e').replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u');
  return n(stored).includes(n(selected)) || n(selected).includes(n(stored));
}

function getWeekRange(): { start: string; end: string; isClosed: boolean } {
  const now  = new Date();
  const day  = now.getDay();
  const hour = now.getHours() + now.getMinutes() / 60;
  const isClosed = day === 0 || (day === 6 && hour >= 13.5);
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmtDate(monday), end: fmtDate(saturday), isClosed };
}

export default function CashPage() {
  const { activeBranch } = useBranch();
  const { profile } = useAuth();
  const { sales: allSales, payments: allPayments, expenses: allExpenses, refresh } = useData();

const [selectedDate, setSelectedDate] = useState(() => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
});
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedSeller, setSelectedSeller] = useState<string>('');
  const [summary,        setSummary]        = useState<DailySummary>(emptyAgg());
  const [payments,       setPayments]       = useState<PaymentRow[]>([]);
  const [expenses,       setExpenses]       = useState<Expense[]>([]);
  const [ingresos,       setIngresos]       = useState<Ingreso[]>([]);
  const [bySeller,       setBySeller]       = useState<SellerRow[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [methodFilter,   setMethodFilter]   = useState<string>('all');
  const [expandedPay,    setExpandedPay]    = useState<string | null>(null);
  const [reviewed,       setReviewed]       = useState<Set<string>>(getReviewed());
  const [lightboxUrl,    setLightboxUrl]    = useState<string | null>(null);

  // Egreso
  const [showAddExp,  setShowAddExp]  = useState(false);
  const [expDesc,     setExpDesc]     = useState('');
  const [expAmount,   setExpAmount]   = useState('');
  const [expMethod,   setExpMethod]   = useState<PaymentMethod>('efectivo');
  const [expCategory, setExpCategory] = useState('otros');
  const [expBranch,   setExpBranch]   = useState('');
  const [savingExp,   setSavingExp]   = useState(false);
  const [expSuccess,  setExpSuccess]  = useState(false);

  // Ingreso manual
  const [showAddIng,  setShowAddIng]  = useState(false);
  const [ingDesc,     setIngDesc]     = useState('');
  const [ingAmount,   setIngAmount]   = useState('');
  const [ingMethod,   setIngMethod]   = useState<PaymentMethod>('efectivo');
  const [ingBranch,   setIngBranch]   = useState('');
  const [savingIng,   setSavingIng]   = useState(false);
  const [ingSuccess,  setIngSuccess]  = useState(false);

  const isAdmin     = profile?.role === 'admin' || profile?.role === 'gerente';
  const isVendedora = profile?.role === 'vendedora';
  const weekRange   = isVendedora ? getWeekRange() : null;

  const allSellers = [...new Set(allSales.map(v => v.vendedora).filter(Boolean))].sort();

  useEffect(() => {
    if (isVendedora && profile?.branch_id && !selectedBranch) setSelectedBranch(profile.branch_id);
    else if (activeBranch && !selectedBranch) setSelectedBranch(activeBranch.name);
    if (isVendedora) setSelectedDate(new Date().toISOString().slice(0, 10));
  }, [activeBranch, selectedBranch, isVendedora, profile?.branch_id]);

  useEffect(() => {
    if (selectedBranch && !expBranch) setExpBranch(selectedBranch);
    if (selectedBranch && !ingBranch) setIngBranch(selectedBranch);
  }, [selectedBranch, expBranch, ingBranch]);

  function buildAndCommit(rows: PaymentRow[], expList: Expense[], ingList: Ingreso[]) {
    let agg = emptyAgg();
    for (const r of rows) agg = addToAgg(agg, r.method, r.amount);
    agg.expenses = expList.reduce((s, e) => s + Number(e.amount), 0);
    agg.ingresos = ingList.reduce((s, i) => s + Number(i.amount), 0);
    setPayments(rows); setExpenses(expList); setIngresos(ingList); setSummary(agg);

    const sellerMap: Record<string, SellerRow> = {};
    for (const r of rows) {
      const s = r.seller_name || 'Sin vendedor';
      if (!sellerMap[s]) sellerMap[s] = { seller: s, efectivo: 0, transferencia: 0, tarjeta: 0, qr: 0, giro: 0, total: 0, count: 0 };
      if (r.method in sellerMap[s]) (sellerMap[s] as any)[r.method] += r.amount;
      sellerMap[s].total += r.amount; sellerMap[s].count++;
    }
    setBySeller(Object.values(sellerMap).sort((a, b) => b.total - a.total));
  }

const load = useCallback(async () => {
    setLoading(true);
    const sellerFilter = isVendedora ? profile?.full_name : selectedSeller || null;

    // ── Filtro mejorado: si hay vendedora Y sucursal, filtra por AMBAS ──
    const dayPayments = allPayments.filter(p => {
      if (!(p.fecha || '').startsWith(selectedDate)) return false;
      if (sellerFilter && p.vendedora !== sellerFilter) return false;
      if (selectedBranch && !branchMatch(p.sucursal || '', selectedBranch)) return false;
      return true;
    });

    const payRows: PaymentRow[] = dayPayments.map(p => ({
      id: String(p.id), sale_number: `VTA-${p.saleId}`, customer_name: p.cliente,
      amount: Number(p.monto), method: p.metodo as PaymentMethod, paid_at: p.fecha,
      seller_name: p.vendedora, reference: p.tipo === 'abono' ? 'Abono' : '',
      branch_name: p.sucursal, sale_id: p.saleId,
    }));

    const daySales = allSales.filter(v => {
      if (!(v.fecha || '').startsWith(selectedDate)) return false;
      if (sellerFilter && v.vendedora !== sellerFilter) return false;
      // Filtrar por sucursal de COBRO específicamente
      if (selectedBranch && !branchMatch(v.sucursalCobro || v.sucursalVenta || '', selectedBranch)) return false;
      return true;
    });

    const recordedIds = new Set(dayPayments.map(p => p.saleId));
    const fallbackRows: PaymentRow[] = daySales.filter(v => !recordedIds.has(v.id)).map(v => {
      const paid = Math.max(0, (Number(v.total) || 0) - (Number(v.saldo) || 0));
      return {
        id: `ls-${v.id}`, sale_number: `VTA-${v.id}`,
        customer_name: `${v.cliente.nombre} ${v.cliente.apellido}`.trim(),
        amount: paid > 0 ? paid : (Number(v.sena) || 0),
        method: v.metodoPago as PaymentMethod, paid_at: v.fecha,
        seller_name: v.vendedora, reference: '', branch_name: v.sucursalCobro,
        sale_id: v.id,
      };
    });

    const dayExpenses = allExpenses.filter(e => {
      if ((e.fecha || '') !== selectedDate) return false;
      if (sellerFilter && e.vendedora !== sellerFilter) return false;
      if (selectedBranch && !branchMatch(e.sucursal || '', selectedBranch)) return false;
      return true;
    });

// Cargar ingresos manuales desde Supabase
    let ingQuery = supabase
      .from('cash_ingresos')
      .select('*')
      .eq('fecha', selectedDate);
    if (selectedBranch) ingQuery = ingQuery.ilike('sucursal', `%${selectedBranch}%`);
    if (sellerFilter)   ingQuery = ingQuery.eq('vendedora', sellerFilter);
    const { data: ingData } = await ingQuery;

    buildAndCommit(
      [...payRows, ...fallbackRows],
      dayExpenses.map(e => ({
        id: String(e.id), description: e.descripcion, category: e.categoria,
        amount: Number(e.monto), method: e.metodo, expense_date: e.fecha, branch_name: e.sucursal,
      })),
      (ingData || []).map((i: any) => ({
        id: String(i.id), description: i.descripcion, amount: Number(i.monto),
        method: i.metodo, date: i.fecha, branch_name: i.sucursal,
      }))
    );
    setLoading(false);
  }, [selectedBranch, selectedDate, selectedSeller, isVendedora, profile?.full_name, allPayments, allSales, allExpenses]);

  useEffect(() => { load(); }, [load]);

  function handleReview(payId: string) {
    markReviewed(payId);
    setReviewed(getReviewed());
  }

  function getSaleDetail(saleId?: number) {
    if (!saleId) return null;
    return allSales.find(v => v.id === saleId) ?? null;
  }

  async function addExpense() {
    const amt = parseFloat(expAmount);
    const branchName = expBranch || selectedBranch || activeBranch?.name || '';
    if (!amt || !expDesc.trim() || !branchName) return;
    setSavingExp(true);
    await saveExpense({
      id: Date.now(), fecha: selectedDate, descripcion: expDesc.trim(),
      categoria: expCategory, monto: Number(amt), metodo: expMethod,
      sucursal: branchName, vendedora: profile?.full_name || '',
    });
    setExpDesc(''); setExpAmount(''); setExpCategory('otros');
    setExpMethod('efectivo'); setShowAddExp(false);
    setExpSuccess(true);
    setTimeout(() => setExpSuccess(false), 4000);
    setSavingExp(false);
    await refresh();
  }

  async function addIngreso() {
    const amt = parseFloat(ingAmount);
    const branchName = ingBranch || selectedBranch || activeBranch?.name || '';
    if (!amt || !ingDesc.trim() || !branchName) return;
    setSavingIng(true);
    // Guardar ingreso en Supabase
    await supabase.from('cash_ingresos').insert([{
      fecha: selectedDate,
      descripcion: ingDesc.trim(),
      monto: Number(amt),
      metodo: ingMethod,
      sucursal: branchName,
      vendedora: profile?.full_name || '',
    }]);
    setIngDesc(''); setIngAmount('');
    setIngMethod('efectivo'); setShowAddIng(false);
    setIngSuccess(true);
    setTimeout(() => setIngSuccess(false), 4000);
    setSavingIng(false);
    load();
  }

  const visiblePayments = isVendedora
    ? payments.filter(p => p.seller_name === profile?.full_name)
    : payments;
  const filtered = methodFilter === 'all' ? visiblePayments : visiblePayments.filter(p => p.method === methodFilter);

  const visibleSummary = (() => {
    let agg = emptyAgg();
    for (const r of visiblePayments) agg = addToAgg(agg, r.method, r.amount);
    agg.expenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
    agg.ingresos = ingresos.reduce((s, i) => s + Number(i.amount), 0);
    return agg;
  })();

  const netTotal     = visibleSummary.total + visibleSummary.ingresos - visibleSummary.expenses;
  const efectivoNeto = visibleSummary.efectivo + visibleSummary.ingresos - visibleSummary.expenses;

  const totalPendiente = allSales.filter(v => {
    if ((Number(v.saldo) || 0) <= 0) return false;
    if (v.estadoTrabajo === 'entregado' || v.estadoTrabajo === 'cancelado') return false;
    if (selectedBranch && !branchMatch(v.sucursalCobro || v.sucursalVenta || '', selectedBranch)) return false;
    if (selectedSeller && v.vendedora !== selectedSeller) return false;
    return true;
  }).reduce((s, v) => s + (Number(v.saldo) || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-light tracking-wider text-white">Mi Caja del Día</h1>
          <p className="text-xs text-gold-muted mt-0.5 tracking-wide">
            {isVendedora ? `${profile?.full_name} · mis cobros del día` : 'Ingresos y movimientos por sede'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <>
              <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
                className="px-3 py-2 rounded-lg text-xs outline-none border"
                style={{ background: 'rgba(197,160,89,0.07)', borderColor: 'rgba(197,160,89,0.22)', color: '#C5A059' }}>
                <option value="" style={{ background: '#111' }}>Todas las sedes</option>
                {SUCURSALES.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
              </select>
              <select value={selectedSeller} onChange={e => setSelectedSeller(e.target.value)}
                className="px-3 py-2 rounded-lg text-xs outline-none border"
                style={{ background: 'rgba(197,160,89,0.07)', borderColor: 'rgba(197,160,89,0.22)', color: selectedSeller ? '#C5A059' : 'rgba(255,255,255,0.5)' }}>
                <option value="" style={{ background: '#111' }}>Todas las vendedoras</option>
                {allSellers.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
              </select>
            </>
          )}
          {!isVendedora && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'rgba(197,160,89,0.07)', border: '1px solid rgba(197,160,89,0.18)' }}>
              <Calendar size={13} className="text-gold-muted" />
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs text-white border-none outline-none" />
            </div>
          )}
          {isVendedora && weekRange && !weekRange.isClosed && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'rgba(197,160,89,0.07)', border: '1px solid rgba(197,160,89,0.18)' }}>
              <Calendar size={13} className="text-gold-muted" />
              <span className="text-xs text-white font-light">
                {new Date().toLocaleDateString('es-PY', { weekday: 'long', day: '2-digit', month: '2-digit', year: '2-digit' })}
              </span>
            </div>
          )}
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {(expSuccess || ingSuccess) && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: ingSuccess ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${ingSuccess ? 'rgba(34,197,94,0.30)' : 'rgba(239,68,68,0.30)'}` }}>
          <CheckCircle size={14} style={{ color: ingSuccess ? '#22c55e' : '#ef4444' }} />
          <p className="text-sm font-light" style={{ color: ingSuccess ? '#22c55e' : '#ef4444' }}>
            {ingSuccess ? 'Ingreso registrado correctamente' : 'Gasto registrado correctamente'}
          </p>
        </div>
      )}

      {isVendedora && weekRange?.isClosed && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl"
          style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.2)' }}>
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-light text-white mb-2">Caja Cerrada</h2>
          <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>La caja se cierra los sábados a las 13:30 hs.</p>
          <p className="text-sm font-light mt-1" style={{ color: 'rgba(197,160,89,0.7)' }}>Volvé el lunes para comenzar una nueva semana 📅</p>
        </div>
      )}

      {/* Tarjetas por método */}
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
        {METHODS.map(m => (
          <div key={m.id} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${m.color}28` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.44)' }}>{m.label}</span>
              <span style={{ color: m.color, opacity: 0.8 }}>{m.icon}</span>
            </div>
            <p className="text-xl font-light" style={{ color: m.color }}>{fmt((visibleSummary as any)[m.id])}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.22)' }}>Gs.</p>
          </div>
        ))}
      </div>

      {/* Totales netos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.20)' }}>
          <p className="text-xs font-light mb-2 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.44)' }}>
            <DollarSign size={11} />{isVendedora ? 'Mis cobros de hoy' : 'Total cobrado'}
          </p>
          <p className="text-2xl font-light" style={{ color: '#C5A059' }}>{fmt(visibleSummary.total)}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.24)' }}>{visibleSummary.count} movimientos</p>
        </div>
        <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(34,197,94,0.20)' }}>
          <p className="text-xs font-light mb-2 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.44)' }}>
            <Plus size={11} />Ingresos manuales
          </p>
          <p className="text-2xl font-light" style={{ color: '#22c55e' }}>{fmt(visibleSummary.ingresos)}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.24)' }}>{ingresos.length} ingreso{ingresos.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(239,68,68,0.20)' }}>
          <p className="text-xs font-light mb-2 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.44)' }}>
            <Minus size={11} />Egresos del día
          </p>
          <p className="text-2xl font-light" style={{ color: '#ef4444' }}>{fmt(visibleSummary.expenses)}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.24)' }}>{expenses.length} gastos</p>
        </div>
        <div className="rounded-xl p-5"
          style={{ background: netTotal >= 0 ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)', border: `1px solid ${netTotal >= 0 ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)'}` }}>
          <p className="text-xs font-light mb-2" style={{ color: 'rgba(255,255,255,0.44)' }}>Total en Caja</p>
          <p className="text-2xl font-light" style={{ color: netTotal >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(netTotal)}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.24)' }}>Cobros + Ingresos — Gastos</p>
        </div>
      </div>

      {totalPendiente > 0 && (
        <div className="flex items-center justify-between px-5 py-3.5 rounded-xl"
          style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.20)' }}>
          <p className="text-xs font-light flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
            <Clock size={12} style={{ color: '#f59e0b' }} />Total Pendiente de cobro
          </p>
          <p className="text-lg font-light" style={{ color: '#f59e0b' }}>Gs. {fmt(totalPendiente)}</p>
        </div>
      )}

      {/* Por vendedora — admin */}
      {isAdmin && bySeller.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <User size={14} className="text-gold-muted" />
            <span className="text-xs font-light tracking-wider text-white">Ingresos por vendedora</span>
            {selectedBranch && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(197,160,89,0.12)', color: '#C5A059' }}>{selectedBranch}</span>}
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['Vendedora','Efectivo','POS','Transfer.','QR','Giro','Total','Movs.'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-light" style={{ color: 'rgba(255,255,255,0.32)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bySeller.map((r, i) => (
                <tr key={r.seller} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
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

      {/* Resumen admin */}
      {isAdmin && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(197,160,89,0.22)' }}>
          <div className="flex items-center gap-2.5 px-5 py-4"
            style={{ background: 'rgba(197,160,89,0.04)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <Unlock size={14} style={{ color: '#C5A059' }} />
            <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.75)' }}>Resumen del día{selectedBranch ? ` — ${selectedBranch}` : ''}{selectedSeller ? ` · ${selectedSeller}` : ''}</p>
          </div>
          <div className="px-5 py-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Total Efectivo',  value: summary.efectivo,      color: '#22c55e', icon: <Banknote size={14} /> },
                { label: 'Total POS',       value: summary.tarjeta,       color: '#f59e0b', icon: <CreditCard size={14} /> },
                { label: 'Transferencias',  value: summary.transferencia, color: '#3b82f6', icon: <ArrowRightLeft size={14} /> },
                { label: 'Total General',   value: summary.total,         color: '#C5A059', icon: <TrendingUp size={14} /> },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-4" style={{ background: `${item.color}08`, border: `1px solid ${item.color}28` }}>
                  <div className="flex items-center gap-2 mb-2.5" style={{ color: item.color, opacity: 0.7 }}>
                    {item.icon}
                    <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.44)' }}>{item.label}</span>
                  </div>
                  <p className="text-xl font-light" style={{ color: item.color }}>Gs. {fmt(item.value)}</p>
                </div>
              ))}
            </div>
            {summary.ingresos > 0 && (
              <div className="mt-3 flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.18)' }}>
                <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.44)' }}>Más ingresos manuales</span>
                <span className="text-sm font-light" style={{ color: '#22c55e' }}>+ Gs. {fmt(summary.ingresos)}</span>
              </div>
            )}
            {summary.expenses > 0 && (
              <div className="mt-3 flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)' }}>
                <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.44)' }}>Menos egresos del día</span>
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

      {/* ── Ingresos manuales ──────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(34,197,94,0.15)' }}>
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <Plus size={14} style={{ color: '#22c55e' }} />
            <span className="text-xs font-light tracking-wider text-white">Ingresos manuales</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>{ingresos.length}</span>
            {ingresos.length > 0 && <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.32)' }}>· Gs. {fmt(ingresos.reduce((s,i) => s+i.amount, 0))}</span>}
          </div>
          <button onClick={() => { setShowAddIng(!showAddIng); setIngBranch(selectedBranch || activeBranch?.name || ''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light"
            style={{ background: 'rgba(34,197,94,0.08)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.22)' }}>
            {showAddIng ? <X size={12} /> : <Plus size={12} />}
            {showAddIng ? 'Cancelar' : 'Registrar Ingreso'}
          </button>
        </div>

        {showAddIng && (
          <div className="px-5 py-4 space-y-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(34,197,94,0.02)' }}>
            <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(34,197,94,0.55)' }}>Nuevo Ingreso</p>
            <input value={ingDesc} onChange={e => setIngDesc(e.target.value)} placeholder="Ej: Fondo de caja, cambio, ingreso extra..."
              className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border" style={{ borderColor: 'rgba(34,197,94,0.25)' }} />
            <div className="flex gap-2 flex-wrap">
              <input value={ingAmount} onChange={e => setIngAmount(e.target.value)} type="number" placeholder="Monto Gs."
                className="w-36 px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border" style={{ borderColor: 'rgba(34,197,94,0.25)' }} />
              {isAdmin && !selectedBranch && (
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border flex-1 min-w-36" style={{ borderColor: 'rgba(34,197,94,0.20)', background: 'rgba(255,255,255,0.02)' }}>
                  <MapPin size={11} style={{ color: 'rgba(34,197,94,0.6)', flexShrink: 0 }} />
                  <select value={ingBranch} onChange={e => setIngBranch(e.target.value)} className="bg-transparent text-xs outline-none flex-1" style={{ color: ingBranch ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.38)' }}>
                    <option value="" style={{ background: '#111' }}>Sede...</option>
                    {SUCURSALES.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {METHODS.map(m => (
                <button key={m.id} onClick={() => setIngMethod(m.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-light"
                  style={{ background: ingMethod === m.id ? `${m.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${ingMethod === m.id ? m.color+'44' : 'rgba(255,255,255,0.07)'}`, color: ingMethod === m.id ? m.color : 'rgba(255,255,255,0.38)' }}>
                  {m.icon}<span>{m.label}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={addIngreso} disabled={savingIng || !ingDesc.trim() || !ingAmount}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-medium"
                style={{ background: (!ingDesc.trim() || !ingAmount) ? 'rgba(34,197,94,0.08)' : '#22c55e', color: (!ingDesc.trim() || !ingAmount) ? 'rgba(34,197,94,0.4)' : '#000', cursor: (!ingDesc.trim() || !ingAmount) ? 'not-allowed' : 'pointer' }}>
                <Plus size={12} />{savingIng ? 'Guardando...' : 'Registrar Ingreso'}
              </button>
              <button onClick={() => { setShowAddIng(false); setIngDesc(''); setIngAmount(''); }}
                className="px-3 py-2 rounded-lg text-xs font-light"
                style={{ color: 'rgba(255,255,255,0.36)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {ingresos.length === 0 ? (
          <div className="text-center py-6"><p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>Sin ingresos manuales registrados</p></div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {ingresos.map(ing => (
              <div key={ing.id} className="flex items-center gap-4 px-5 py-3 text-xs font-light">
                <div className="flex-1 min-w-0">
                  <p className="text-white truncate">{ing.description}</p>
                  {ing.branch_name && <span style={{ color: 'rgba(255,255,255,0.28)' }}>{ing.branch_name}</span>}
                </div>
                <span className="shrink-0" style={{ color: '#22c55e' }}>+ Gs. {fmt(Number(ing.amount))}</span>
                <span className="px-2 py-0.5 rounded shrink-0" style={{ background: 'rgba(34,197,94,0.10)', color: '#22c55e' }}>{ing.method}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Egresos ───────────────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <Minus size={14} style={{ color: '#ef4444' }} />
            <span className="text-xs font-light tracking-wider text-white">Egresos del día</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>{expenses.length}</span>
            {expenses.length > 0 && <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.32)' }}>· Total: Gs. {fmt(expenses.reduce((s,e) => s+e.amount,0))}</span>}
          </div>
          <button onClick={() => { setShowAddExp(!showAddExp); setExpBranch(selectedBranch || activeBranch?.name || ''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {showAddExp ? <X size={12} /> : <Plus size={12} />}
            {showAddExp ? 'Cancelar' : 'Registrar Gasto'}
          </button>
        </div>

        {showAddExp && (
          <div className="px-5 py-4 space-y-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(239,68,68,0.02)' }}>
            <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(239,68,68,0.55)' }}>Nuevo Egreso</p>
            <input value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="Motivo del gasto"
              className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border" style={{ borderColor: 'rgba(239,68,68,0.25)' }} />
            <div className="flex gap-2 flex-wrap">
              <input value={expAmount} onChange={e => setExpAmount(e.target.value)} type="number" placeholder="Monto Gs."
                className="w-36 px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border" style={{ borderColor: 'rgba(239,68,68,0.25)' }} />
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border flex-1 min-w-36" style={{ borderColor: 'rgba(239,68,68,0.20)', background: 'rgba(255,255,255,0.02)' }}>
                <Tag size={11} style={{ color: 'rgba(239,68,68,0.6)', flexShrink: 0 }} />
                <select value={expCategory} onChange={e => setExpCategory(e.target.value)} className="bg-transparent text-xs outline-none flex-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id} style={{ background: '#111' }}>{c.label}</option>)}
                </select>
              </div>
              {isAdmin && !selectedBranch && (
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border flex-1 min-w-36" style={{ borderColor: 'rgba(239,68,68,0.20)', background: 'rgba(255,255,255,0.02)' }}>
                  <MapPin size={11} style={{ color: 'rgba(239,68,68,0.6)', flexShrink: 0 }} />
                  <select value={expBranch} onChange={e => setExpBranch(e.target.value)} className="bg-transparent text-xs outline-none flex-1" style={{ color: expBranch ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.38)' }}>
                    <option value="" style={{ background: '#111' }}>Sede del gasto...</option>
                    {SUCURSALES.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {METHODS.map(m => (
                <button key={m.id} onClick={() => setExpMethod(m.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-light"
                  style={{ background: expMethod === m.id ? `${m.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${expMethod === m.id ? m.color+'44' : 'rgba(255,255,255,0.07)'}`, color: expMethod === m.id ? m.color : 'rgba(255,255,255,0.38)' }}>
                  {m.icon}<span>{m.label}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={addExpense} disabled={savingExp || !expDesc.trim() || !expAmount}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-medium"
                style={{ background: (!expDesc.trim() || !expAmount) ? 'rgba(239,68,68,0.08)' : '#ef4444', color: (!expDesc.trim() || !expAmount) ? 'rgba(239,68,68,0.4)' : '#fff', cursor: (!expDesc.trim() || !expAmount) ? 'not-allowed' : 'pointer' }}>
                <Minus size={12} />{savingExp ? 'Guardando...' : 'Registrar Gasto'}
              </button>
              <button onClick={() => { setShowAddExp(false); setExpDesc(''); setExpAmount(''); }}
                className="px-3 py-2 rounded-lg text-xs font-light"
                style={{ color: 'rgba(255,255,255,0.36)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {expenses.length === 0 ? (
          <div className="text-center py-6"><p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>Sin egresos registrados</p></div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {expenses.map(e => {
              const catLabel = EXPENSE_CATEGORIES.find(c => c.id === e.category)?.label ?? e.category;
              return (
                <div key={e.id} className="flex items-center gap-4 px-5 py-3 text-xs font-light">
                  <div className="flex-1 min-w-0">
                    <p className="text-white truncate">{e.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(239,68,68,0.08)', color: 'rgba(239,68,68,0.7)' }}>{catLabel}</span>
                      {e.branch_name && <span style={{ color: 'rgba(255,255,255,0.28)' }}>{e.branch_name}</span>}
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

      {/* ── Cobros del día ────────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-gold-muted" />
            <span className="text-xs font-light tracking-wider text-white">Cobros del día</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(197,160,89,0.12)', color: '#C5A059' }}>{filtered.length}</span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {['all', ...METHODS.map(m => m.id)].map(m => (
              <button key={m} onClick={() => setMethodFilter(m)}
                className="px-2 py-1 rounded text-xs font-light"
                style={{ background: methodFilter === m ? 'rgba(197,160,89,0.14)' : 'transparent', color: methodFilter === m ? '#C5A059' : 'rgba(255,255,255,0.36)', border: methodFilter === m ? '1px solid rgba(197,160,89,0.30)' : '1px solid transparent' }}>
                {m === 'all' ? 'Todos' : METHODS.find(x => x.id === m)?.label ?? m}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-14">
            <DollarSign size={28} style={{ color: 'rgba(255,255,255,0.08)', margin: '0 auto 10px' }} />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Sin cobros para este día</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {filtered.map((p, i) => {
              const mc    = METHODS.find(m => m.id === p.method)?.color ?? '#C5A059';
              const isExp = expandedPay === p.id;
              const isRev = reviewed.has(p.id);
              const sale  = isExp ? getSaleDetail(p.sale_id) : null;
              const allAnteojos = sale ? (sale.anteojos as any[]) : [];

              return (
                <div key={p.id}>
                  <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                    style={{ background: isExp ? 'rgba(197,160,89,0.03)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                    onClick={() => setExpandedPay(isExp ? null : p.id)}>
                    <div className="shrink-0 w-6 text-center">
                      <span className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.5)' }}>{i + 1}</span>
                    </div>
                    <div className="text-xs font-light w-14 shrink-0" style={{ color: 'rgba(255,255,255,0.38)' }}>
                      {new Date(p.paid_at).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-xs font-mono shrink-0 hidden lg:block" style={{ color: '#C5A059', width: 120 }}>#{p.sale_number}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-light truncate">{p.customer_name || '—'}</p>
                      <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>{p.seller_name || '—'}{p.branch_name ? ` · ${p.branch_name}` : ''}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: `${mc}18`, color: mc }}>
                      {METHODS.find(m => m.id === p.method)?.label ?? p.method}
                    </span>
                    {isRev && <Heart size={13} fill="#ef4444" style={{ color: '#ef4444', flexShrink: 0 }} />}
                    <div className="text-sm font-light text-right shrink-0" style={{ color: '#22c55e', minWidth: 80 }}>
                      {fmt(p.amount)} <span className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Gs.</span>
                    </div>
                    <ChevronDown size={13} style={{ color: 'rgba(255,255,255,0.3)', transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                  </div>

                  {isExp && (
                    <div className="px-5 pb-5 pt-3 space-y-4" style={{ background: 'rgba(197,160,89,0.02)', borderTop: '1px solid rgba(197,160,89,0.08)' }}>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-lg p-3" style={{ background: `${mc}10`, border: `1px solid ${mc}30` }}>
                          <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Método</p>
                          <p className="text-sm font-light" style={{ color: mc }}>{METHODS.find(m => m.id === p.method)?.label}</p>
                        </div>
                        <div className="rounded-lg p-3" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                          <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Monto</p>
                          <p className="text-sm font-light" style={{ color: '#22c55e' }}>Gs. {fmt(p.amount)}</p>
                        </div>
                        <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Vendedora</p>
                          <p className="text-sm font-light text-white">{p.seller_name || '—'}</p>
                        </div>
                        <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Sucursal</p>
                          <p className="text-sm font-light text-white">{p.branch_name || '—'}</p>
                        </div>
                      </div>

                      {(() => {
                        const salePays = allPayments.filter((pay: any) => pay.saleId === p.sale_id);
                        return salePays.length > 0 ? (
                          <div>
                            <p className="text-xs font-light tracking-widest uppercase mb-2" style={{ color: 'rgba(197,160,89,0.55)' }}>Comprobantes</p>
                            {salePays.map((pay: any, idx: number) => {
                              const mc2 = METHODS.find(m => m.id === pay.metodo)?.color ?? '#C5A059';
                              return (
                                <div key={pay.id} className="mb-2 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(197,160,89,0.12)', background: 'rgba(255,255,255,0.02)' }}>
                                  <div className="flex items-center gap-2 px-3 py-2">
                                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${mc2}18`, color: mc2 }}>{pay.metodo}</span>
                                    <span className="text-xs text-white font-light">Gs. {Number(pay.monto).toLocaleString('es-PY')}</span>
                                    <span className="text-xs px-1.5 py-0.5 rounded-full ml-auto" style={{ background: 'rgba(197,160,89,0.08)', color: 'rgba(197,160,89,0.6)' }}>{pay.tipo === 'sena' ? 'Seña' : 'Abono'}</span>
                                  </div>
                                  {pay.receipt_url ? (
                                    <div className="p-2">
                                      <img src={pay.receipt_url} alt={`comprobante ${idx+1}`}
                                        className="h-32 object-contain rounded-lg border cursor-pointer w-full"
                                        style={{ borderColor: 'rgba(197,160,89,0.2)', background: '#111', maxWidth: 280 }}
                                        onClick={() => setLightboxUrl(pay.receipt_url)} />
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 px-3 py-2">
                                      <Eye size={11} style={{ color: 'rgba(255,255,255,0.2)' }} />
                                      <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.25)' }}>Sin comprobante</p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : null;
                      })()}

                      {allAnteojos.length > 0 && (
                        <div>
                          <p className="text-xs font-light tracking-widest uppercase mb-2" style={{ color: 'rgba(197,160,89,0.55)' }}>Lentes vendidos</p>
                          <div className="space-y-2">
                            {allAnteojos.map((eg: any, idx: number) => (
                              <div key={idx} className="flex items-start gap-3 rounded-xl p-3"
                                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(197,160,89,0.12)' }}>
                                {eg.photo_url ? (
                                  <img src={eg.photo_url} alt="armazón"
                                    className="h-16 w-20 object-cover rounded-lg border cursor-pointer shrink-0"
                                    style={{ borderColor: 'rgba(197,160,89,0.3)' }}
                                    onClick={() => setLightboxUrl(eg.photo_url)} />
                                ) : (
                                  <div className="h-16 w-20 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(197,160,89,0.1)' }}>
                                    <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.2)' }}>Sin foto</span>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0 space-y-1">
                                  {eg.frame_description && <p className="text-xs text-white font-light">📦 {eg.frame_description}</p>}
                                  {eg.crystals   && <p className="text-xs font-light" style={{ color: '#3b82f6' }}>🔬 {eg.crystals}</p>}
                                  {eg.treatments && <p className="text-xs font-light" style={{ color: '#10b981' }}>✨ {eg.treatments}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="pt-2" style={{ borderTop: '1px solid rgba(197,160,89,0.08)' }}>
                        {isRev ? (
                          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl w-fit"
                            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                            <Heart size={14} fill="#ef4444" style={{ color: '#ef4444' }} />
                            <p className="text-xs font-light" style={{ color: '#ef4444' }}>Pago revisado y confirmado</p>
                          </div>
                        ) : (
                          <button onClick={() => handleReview(p.id)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium"
                            style={{ background: 'rgba(239,68,68,0.08)', color: 'rgba(239,68,68,0.7)', border: '1px solid rgba(239,68,68,0.25)' }}>
                            <Heart size={14} />Marcar como revisado
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

      {lightboxUrl && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.92)' }} onClick={() => setLightboxUrl(null)}>
          <div className="relative max-w-xl w-full" onClick={e => e.stopPropagation()}>
            <img src={lightboxUrl} alt="comprobante" className="w-full rounded-2xl"
              style={{ border: '1px solid rgba(197,160,89,0.3)', maxHeight: '80vh', objectFit: 'contain', background: '#111' }} />
          </div>
        </div>
      )}
    </div>
  );
}
