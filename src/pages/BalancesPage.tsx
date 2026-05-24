import { useState, useRef } from 'react';
import { RefreshCw, Plus, Check, X, Search, ChevronDown, DollarSign, Phone, Camera, Package, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { updateSaleBalance, recordPayment, closeSaleLocal } from '../lib/salesStorage';

type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'qr' | 'giro';

const PAYMENT_METHODS: { id: PaymentMethod; label: string; color: string }[] = [
  { id: 'efectivo',      label: 'Efectivo',     color: '#22c55e' },
  { id: 'transferencia', label: 'Transferencia', color: '#3b82f6' },
  { id: 'tarjeta',       label: 'POS',          color: '#f59e0b' },
  { id: 'qr',            label: 'QR',           color: '#C5A059' },
  { id: 'giro',          label: 'Giro',         color: '#a78bfa' },
];

const SUCURSALES = ['Pettirossi', 'Azara', 'Lambaré', 'Acceso Sur', 'Capiatá'];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pendiente:      { label: 'Pendiente',   color: '#f59e0b' },
  en_proceso:     { label: 'En Proceso',  color: '#f59e0b' },
  en_laboratorio: { label: 'Laboratorio', color: '#3b82f6' },
  listo:          { label: 'Listo',       color: '#10b981' },
  pagado_total:   { label: 'Pagado',      color: '#22c55e' },
  entregado:      { label: 'Entregado',   color: '#6b7280' },
  cancelado:      { label: 'Cancelado',   color: '#ef4444' },
};

function fmt(n: number) {
  return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

async function compressImage(dataUrl: string): Promise<string> {
  return new Promise(resolve => {
    if (!dataUrl.startsWith('data:image')) { resolve(dataUrl); return; }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, Math.sqrt((300 * 1024) / (dataUrl.length * 0.75)));
      canvas.width  = Math.max(1, Math.floor(img.width  * scale));
      canvas.height = Math.max(1, Math.floor(img.height * scale));
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function buildWaLink(clientName: string, phone: string, branchName: string, saldo: number) {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, '');
  const msg = saldo > 0
    ? `Hola ${clientName}! Te contactamos de Óptica Excelent 👓. Te recordamos que tenés un saldo pendiente de Gs. ${fmt(saldo)} en nuestra sucursal ${branchName}. Podés pasar cuando gustes. ¡Gracias!`
    : `Hola ${clientName}! Te contactamos de Óptica Excelent 👓. Tus lentes ya están listos para retirar en nuestra sucursal ${branchName}. ¡Te esperamos!`;
  return `https://wa.me/595${clean}?text=${encodeURIComponent(msg)}`;
}

export default function BalancesPage() {
  const { profile } = useAuth();
  const { sales, payments, refresh } = useData();
  const isAdmin     = profile?.role === 'admin' || profile?.role === 'gerente';
  const isVendedora = profile?.role === 'vendedora';

  const [searchText,  setSearchText]  = useState('');
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [dateFilter,  setDateFilter]  = useState<'hoy' | 'semana' | 'mes' | 'todos'>('todos');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const [addPayFor,  setAddPayFor]  = useState<string | null>(null);
  const [payAmt,     setPayAmt]     = useState('');
  const [payMethod,  setPayMethod]  = useState<PaymentMethod>('efectivo');
  const [payBranch,  setPayBranch]  = useState('');
  const [payReceipt, setPayReceipt] = useState('');
  const [savingPay,  setSavingPay]  = useState(false);
  const [paySuccess, setPaySuccess] = useState('');
  const receiptRef = useRef<HTMLInputElement | null>(null);

  const [deliverFor,     setDeliverFor]     = useState<string | null>(null);
  const [deliverAmt,     setDeliverAmt]     = useState('');
  const [deliverMethod,  setDeliverMethod]  = useState<PaymentMethod>('efectivo');
  const [deliverReceipt, setDeliverReceipt] = useState('');
  const [deliverBranch,  setDeliverBranch]  = useState('');
  const [savingDeliver,  setSavingDeliver]  = useState(false);
  const [deliverError,   setDeliverError]   = useState('');
  const deliverReceiptRef = useRef<HTMLInputElement | null>(null);

  const rows = sales
    .filter(v => {
      if (v.estadoTrabajo === 'entregado' || v.estadoTrabajo === 'cancelado') return false;
      if (isVendedora && v.vendedora !== profile?.full_name) return false;
      return true;
    })
    .map((v, idx) => ({
      num:                 idx + 1,
      id:                  String(v.id),
      sale_number:         `VTA-${v.id}`,
      created_at:          v.fecha,
      total:               Number(v.total),
      deposit:             Number(v.sena),
      balance:             Number(v.saldo),
      status:              v.estadoTrabajo,
      seller_name:         v.vendedora,
      customer_first_name: v.cliente.nombre,
      customer_last_name:  v.cliente.apellido,
      customer_phone:      v.cliente.telefono,
      customer_ci:         v.cliente.ci,
      branch_name:         v.sucursalVenta,
      cobro_branch:        v.sucursalCobro,
      anteojos:            v.anteojos || [],
      observaciones:       v.observaciones || '',
    }));

  // ── Filtro por fecha ──────────────────────────────────────────────────────
  function inPeriod(fechaStr: string) {
    const fecha = new Date(fechaStr);
    const now   = new Date();
    if (dateFilter === 'hoy') return fecha.toDateString() === now.toDateString();
    if (dateFilter === 'semana') {
      const lunes = new Date(now);
      lunes.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
      lunes.setHours(0, 0, 0, 0);
      return fecha >= lunes;
    }
    if (dateFilter === 'mes') return fecha.getMonth() === now.getMonth() && fecha.getFullYear() === now.getFullYear();
    return true;
  }

  async function handleReceiptPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const compressed = await compressImage(ev.target?.result as string);
      setPayReceipt(compressed);
    };
    reader.readAsDataURL(file);
  }

  async function registerPayment(row: any) {
    const amt = parseFloat(payAmt);
    if (!amt || amt <= 0) return;
    setSavingPay(true);
    const saleIdNum  = Number(row.id);
    const newDeposit = row.deposit + amt;
    const newBalance = Math.max(0, row.total - newDeposit);
    await updateSaleBalance(saleIdNum, newBalance, newDeposit);
    await recordPayment({
      id: Date.now(), saleId: saleIdNum, fecha: new Date().toISOString(),
      monto: amt, metodo: payMethod,
      sucursal: payBranch || row.cobro_branch || row.branch_name,
      vendedora: row.seller_name || '',
      cliente: `${row.customer_first_name} ${row.customer_last_name}`.trim(),
      tipo: 'abono', receipt_url: payReceipt || undefined,
    });
    setPaySuccess(`Pago de Gs. ${fmt(amt)} registrado.`);
    setAddPayFor(null); setPayAmt(''); setPayReceipt('');
    setSavingPay(false);
    setTimeout(() => setPaySuccess(''), 4000);
    await refresh();
  }

  async function markDelivered(rowId: string) {
    const row = rows.find(r => r.id === rowId);
    if (row && row.balance > 0) {
      setDeliverFor(rowId);
      setDeliverAmt(String(row.balance));
      setDeliverBranch(row.cobro_branch || row.branch_name || '');
      setDeliverReceipt('');
      setDeliverError('');
      return;
    }
    const saleIdNum = Number(rowId);
    await closeSaleLocal(saleIdNum, 'retiro');
    setPaySuccess('✓ Lentes entregados — venta cerrada.');
    setExpandedId(null);
    setTimeout(() => setPaySuccess(''), 5000);
    await refresh();
  }

  async function handleDeliverReceiptPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const compressed = await compressImage(ev.target?.result as string);
      setDeliverReceipt(compressed);
    };
    reader.readAsDataURL(file);
  }

  async function handleDeliverWithPayment() {
    if (!deliverReceipt) { setDeliverError('Debés cargar el comprobante para poder entregar.'); return; }
    const row = rows.find(r => r.id === deliverFor);
    if (!row) return;
    setSavingDeliver(true);
    const clientName = `${row.customer_first_name} ${row.customer_last_name}`.trim();
    await closeSaleLocal(Number(deliverFor), 'retiro', {
      monto:     parseFloat(deliverAmt) || row.balance,
      metodo:    deliverMethod,
      sucursal:  deliverBranch || row.cobro_branch || row.branch_name,
      vendedora: row.seller_name || '',
      cliente:   clientName,
      receipt_url: deliverReceipt,
    });
    setSavingDeliver(false);
    setDeliverFor(null);
    setPaySuccess('✓ Lentes entregados — venta cerrada.');
    setExpandedId(null);
    setTimeout(() => setPaySuccess(''), 5000);
    await refresh();
  }

  function getPayHistory(saleId: string) {
    return payments.filter(p => String(p.saleId) === saleId);
  }

  const filtered = rows.filter(r => {
    if (!inPeriod(r.created_at)) return false;
    if (!searchText) return true;
    const q    = searchText.toLowerCase();
    const name = `${r.customer_first_name} ${r.customer_last_name}`;
    return name.toLowerCase().includes(q) || r.sale_number.toLowerCase().includes(q) || (r.seller_name ?? '').toLowerCase().includes(q);
  });

  const totalPending = rows.filter(r => Number(r.balance) > 0).reduce((s, r) => s + Number(r.balance), 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayPayments = isVendedora
    ? payments.filter(p => p.vendedora === profile?.full_name && (p.fecha || '').startsWith(today))
    : [];
  const todayTotal = todayPayments.reduce((s, p) => s + Number(p.monto), 0);

  // Contar por período para el botón "Todos"
  const countHoy    = rows.filter(r => { const f = new Date(r.created_at); const n = new Date(); return f.toDateString() === n.toDateString(); }).length;
  const countSemana = rows.filter(r => { const f = new Date(r.created_at); const n = new Date(); const l = new Date(n); l.setDate(n.getDate() - (n.getDay()===0?6:n.getDay()-1)); l.setHours(0,0,0,0); return f >= l; }).length;
  const countMes    = rows.filter(r => { const f = new Date(r.created_at); const n = new Date(); return f.getMonth()===n.getMonth()&&f.getFullYear()===n.getFullYear(); }).length;

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-5xl mx-auto">

      {/* Modal cobro pendiente al entregar */}
      {deliverFor && (() => {
        const row = rows.find(r => r.id === deliverFor);
        if (!row) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4"
            style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) setDeliverFor(null); }}>
            <div className="w-full lg:max-w-md rounded-t-3xl lg:rounded-2xl overflow-hidden"
              style={{ background: '#0e0e0e', border: '1px solid rgba(197,160,89,0.25)', maxHeight: '92vh', overflowY: 'auto' }}>
              <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
                style={{ background: '#0e0e0e', borderBottom: '1px solid rgba(197,160,89,0.12)' }}>
                <div>
                  <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.55)' }}>Cobrar y entregar</p>
                  <p className="text-sm font-light text-white mt-0.5">
                    VTA-{row.id} · {row.customer_first_name} {row.customer_last_name}
                  </p>
                </div>
                <button onClick={() => setDeliverFor(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                  <X size={14} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {/* Resumen saldo */}
                <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(245,158,11,0.20)' }}>
                  <div className="flex justify-between text-xs font-light">
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>Total venta</span>
                    <span className="text-white">Gs. {fmt(row.total)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-light">
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>Ya cobrado</span>
                    <span style={{ color: '#10b981' }}>Gs. {fmt(row.deposit)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-medium border-t pt-2" style={{ borderColor: 'rgba(245,158,11,0.15)' }}>
                    <span style={{ color: '#f59e0b' }}>Saldo pendiente</span>
                    <span style={{ color: '#f59e0b' }}>Gs. {fmt(row.balance)}</span>
                  </div>
                </div>
                {/* Error */}
                {deliverError && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                    ⚠ {deliverError}
                  </div>
                )}
                {/* Monto */}
                <div>
                  <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Monto a cobrar</p>
                  <input type="number" value={deliverAmt} onChange={e => setDeliverAmt(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border text-right"
                    style={{ borderColor: 'rgba(245,158,11,0.4)' }} />
                </div>
                {/* Método */}
                <div>
                  <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Método de pago</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {PAYMENT_METHODS.map(m => (
                      <button key={m.id} onClick={() => setDeliverMethod(m.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-light"
                        style={{ background: deliverMethod === m.id ? `${m.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${deliverMethod === m.id ? m.color + '44' : 'rgba(255,255,255,0.08)'}`, color: deliverMethod === m.id ? m.color : 'rgba(255,255,255,0.42)' }}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Sucursal */}
                <div>
                  <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Sucursal de cobro</p>
                  <select value={deliverBranch} onChange={e => setDeliverBranch(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm font-light outline-none border"
                    style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(197,160,89,0.22)', color: 'rgba(255,255,255,0.8)' }}>
                    <option value="" style={{ background: '#111' }}>— Sucursal —</option>
                    {SUCURSALES.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
                  </select>
                </div>
                {/* Foto comprobante — obligatoria */}
                <div>
                  <p className="text-xs font-light mb-1.5">
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>Comprobante de pago </span>
                    <span style={{ color: '#ef4444' }}>*obligatorio</span>
                  </p>
                  <input ref={deliverReceiptRef} type="file" accept="image/*" capture="environment"
                    className="hidden" onChange={handleDeliverReceiptPhoto} />
                  {deliverReceipt ? (
                    <div className="relative">
                      <img src={deliverReceipt} alt="comprobante"
                        className="w-full rounded-xl object-cover"
                        style={{ maxHeight: 140, border: '1px solid rgba(16,185,129,0.35)', background: '#111' }} />
                      <button onClick={() => setDeliverReceipt('')}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.7)' }}>
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => deliverReceiptRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-light"
                      style={{ background: 'rgba(239,68,68,0.06)', border: '1px dashed rgba(239,68,68,0.4)', color: 'rgba(239,68,68,0.8)' }}>
                      <Camera size={14} />Tocar para agregar foto del comprobante
                    </button>
                  )}
                </div>
                {/* Acciones */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={handleDeliverWithPayment}
                    disabled={savingDeliver || !deliverReceipt}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
                    style={{ background: savingDeliver || !deliverReceipt ? 'rgba(16,185,129,0.35)' : '#10b981', color: '#000', cursor: !deliverReceipt ? 'not-allowed' : 'pointer' }}>
                    <Package size={14} />{savingDeliver ? 'Guardando...' : 'Cobrar y entregar'}
                  </button>
                  <button onClick={() => setDeliverFor(null)}
                    className="px-5 py-3 rounded-xl text-sm font-light"
                    style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
          onClick={() => setLightboxSrc(null)}>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <img src={lightboxSrc} alt="Vista ampliada"
              className="rounded-xl shadow-2xl"
              style={{ maxWidth: '90vw', maxHeight: '88vh', objectFit: 'contain' }} />
            <button onClick={() => setLightboxSrc(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center font-bold text-black"
              style={{ background: '#C5A059', fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-light tracking-wider text-white">
            {isVendedora ? 'Mis Ventas Activas' : 'Saldos Pendientes'}
          </h1>
          <p className="text-xs text-gold-muted mt-0.5 tracking-wide" style={{ color: 'rgba(197,160,89,0.6)' }}>
            {isVendedora ? `${profile?.full_name} · ventas no entregadas` : 'Ventas activas pendientes de entrega o cobro'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border"
            style={{ borderColor: 'rgba(197,160,89,0.2)', background: 'rgba(255,255,255,0.02)' }}>
            <Search size={13} style={{ color: 'rgba(197,160,89,0.5)' }} />
            <input value={searchText} onChange={e => setSearchText(e.target.value)}
              placeholder="Cliente, venta..."
              className="bg-transparent text-xs text-white outline-none w-36" />
          </div>
          <button onClick={() => refresh()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)' }}>
            <RefreshCw size={13} />
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

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.22)' }}>
          <p className="text-xs font-light mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {isVendedora ? 'Mis cobros de hoy' : 'Ventas activas'}
          </p>
          <p className="text-2xl font-light" style={{ color: '#C5A059' }}>
            {isVendedora ? `Gs. ${fmt(todayTotal)}` : rows.length}
          </p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(239,68,68,0.22)' }}>
          <p className="text-xs font-light mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Saldo pendiente total</p>
          <p className="text-xl font-light" style={{ color: '#ef4444' }}>Gs. {fmt(totalPending)}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(245,158,11,0.22)' }}>
          <p className="text-xs font-light mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Pendientes de entrega</p>
          <p className="text-xl font-light" style={{ color: '#f59e0b' }}>{rows.length}</p>
        </div>
      </div>

      {/* Filtros por fecha */}
      <div className="flex gap-2 flex-wrap">
        {([
          { id: 'hoy'    as const, label: `Hoy (${countHoy})` },
          { id: 'semana' as const, label: `Esta semana (${countSemana})` },
          { id: 'mes'    as const, label: `Este mes (${countMes})` },
          { id: 'todos'  as const, label: `Todos (${rows.length})` },
        ]).map(opt => (
          <button key={opt.id} onClick={() => setDateFilter(opt.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-light"
            style={{
              background: dateFilter === opt.id ? 'rgba(197,160,89,0.15)' : 'rgba(255,255,255,0.03)',
              border:     `1px solid ${dateFilter === opt.id ? 'rgba(197,160,89,0.4)' : 'rgba(255,255,255,0.08)'}`,
              color:      dateFilter === opt.id ? '#C5A059' : 'rgba(255,255,255,0.4)',
            }}>
            {opt.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Check size={32} style={{ color: 'rgba(16,185,129,0.3)', margin: '0 auto 12px' }} />
            <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {searchText ? 'Sin resultados' : 'No hay ventas activas en este período'}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {filtered.map(row => {
              const sc         = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.pendiente;
              const isExp      = expandedId === row.id;
              const isPayOpen  = addPayFor === row.id;
              const clientName = `${row.customer_first_name} ${row.customer_last_name}`.trim() || '—';
              const payHistory = isExp ? getPayHistory(row.id) : [];
              const lensPhotos = isExp ? (row.anteojos as any[]).filter((eg: any) => eg.photo_url && eg.tipo !== 'insumo') : [];
              const isPaid     = Number(row.balance) <= 0;
              const waLink     = buildWaLink(clientName, row.customer_phone || '', row.branch_name || '', Number(row.balance));

              return (
                <div key={row.id}>
                  {/* Fila principal */}
                  <div className="px-4 py-3.5 cursor-pointer"
                    style={{ background: isExp ? 'rgba(197,160,89,0.03)' : 'transparent' }}
                    onClick={() => setExpandedId(isExp ? null : row.id)}>

                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0"
                        style={{ background: '#C5A059', fontSize: 10 }}>{row.num}</span>
                      <p className="text-sm text-white font-light flex-1 truncate">{clientName}</p>
                      <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)', transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pl-8 mb-1">
                      <span className="text-xs font-mono" style={{ color: '#C5A059' }}>#{row.sale_number}</span>
                      {row.branch_name && <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>· {row.branch_name}</span>}
                      {isAdmin && row.seller_name && <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>· {row.seller_name}</span>}
                    </div>

                    {(row.customer_ci || row.customer_phone) && (
                      <div className="flex items-center gap-3 pl-8 mb-1">
                        {row.customer_ci && <span className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.6)' }}>CI: {row.customer_ci}</span>}
                        {row.customer_phone && <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>📞 {row.customer_phone}</span>}
                      </div>
                    )}

                    <div className="flex items-center gap-3 pl-8 flex-wrap">
                      <div>
                        <span className="text-xs text-white font-light">Gs. {fmt(Number(row.total))}</span>
                        <span className="text-xs font-light ml-1.5" style={{ color: '#10b981' }}>Pagó {fmt(Number(row.deposit))}</span>
                      </div>
                      <span className="text-sm font-light" style={{ color: isPaid ? '#10b981' : '#f59e0b' }}>
                        {isPaid ? '✓ Pagado' : `Debe Gs. ${fmt(Number(row.balance))}`}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-light"
                        style={{ background: `${sc.color}18`, color: sc.color }}>
                        {sc.label}
                      </span>
                    </div>
                  </div>

                  {isExp && (
                    <div className="px-4 pb-5 space-y-4" style={{ background: 'rgba(197,160,89,0.02)' }}>

                      {row.customer_phone && (
                        <div className="flex items-center gap-3 pt-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <Phone size={11} style={{ color: 'rgba(255,255,255,0.4)' }} />
                            <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>{row.customer_phone}</span>
                          </div>
                          {waLink && (
                            <a href={waLink} target="_blank" rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light"
                              style={{ background: 'rgba(37,211,102,0.12)', color: '#25D366', border: '1px solid rgba(37,211,102,0.28)' }}>
                              <MessageCircle size={12} />
                              {Number(row.balance) > 0 ? 'Recordar pago por WhatsApp' : 'Avisar que está listo por WhatsApp'}
                            </a>
                          )}
                        </div>
                      )}

                      {lensPhotos.length > 0 && (
                        <div>
                          <p className="text-xs font-light tracking-widest uppercase mb-2" style={{ color: 'rgba(197,160,89,0.55)' }}>Fotos del lente</p>
                          <div className="flex gap-2 flex-wrap">
                            {lensPhotos.map((eg: any, i: number) => (
                              <img key={i} src={eg.photo_url} alt={`lente ${i+1}`}
                                className="h-20 w-24 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                                style={{ borderColor: 'rgba(197,160,89,0.25)' }}
                                onClick={e => { e.stopPropagation(); setLightboxSrc(eg.photo_url); }} />
                            ))}
                          </div>
                        </div>
                      )}

                      {payHistory.length > 0 && (
                        <div>
                          <p className="text-xs font-light tracking-widest uppercase mb-2" style={{ color: 'rgba(197,160,89,0.55)' }}>Historial de pagos</p>
                          <div className="space-y-2">
                            {payHistory.map(p => {
                              const mc = PAYMENT_METHODS.find(m => m.id === p.metodo)?.color ?? '#C5A059';
                              return (
                                <div key={p.id} className="flex items-center gap-3 flex-wrap">
                                  <span className="px-2 py-0.5 rounded-full text-xs font-light" style={{ background: `${mc}18`, color: mc }}>{p.metodo}</span>
                                  <span className="text-xs text-white font-light">Gs. {fmt(Number(p.monto))}</span>
                                  <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>
                                    {new Date(p.fecha).toLocaleDateString('es-PY')} · {p.sucursal}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(197,160,89,0.08)', color: 'rgba(197,160,89,0.7)' }}>
                                    {p.tipo === 'abono' ? 'Abono' : 'Seña'}
                                  </span>
                                  {(p as any).receipt_url && (
                                    <img src={(p as any).receipt_url} alt="comprobante"
                                      className="h-10 w-14 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                      style={{ borderColor: 'rgba(197,160,89,0.25)' }}
                                      onClick={e => { e.stopPropagation(); setLightboxSrc((p as any).receipt_url); }} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {!isPaid && (
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
                                    style={{ background: payMethod === m.id ? `${m.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${payMethod === m.id ? m.color + '44' : 'rgba(255,255,255,0.07)'}`, color: payMethod === m.id ? m.color : 'rgba(255,255,255,0.38)' }}>
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
                              <div>
                                <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                  Foto del comprobante <span style={{ color: 'rgba(255,255,255,0.25)' }}>(opcional)</span>
                                </p>
                                {payReceipt ? (
                                  <div className="relative inline-block">
                                    <img src={payReceipt} alt="comprobante"
                                      className="h-24 w-32 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                                      style={{ borderColor: 'rgba(197,160,89,0.25)' }}
                                      onClick={() => setLightboxSrc(payReceipt)} />
                                    <button onClick={() => setPayReceipt('')} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#ef4444' }}>
                                      <X size={10} color="#fff" />
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => receiptRef.current?.click()}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light border"
                                    style={{ borderColor: 'rgba(197,160,89,0.22)', color: 'rgba(197,160,89,0.7)', background: 'rgba(197,160,89,0.04)' }}>
                                    <Camera size={13} />Subir comprobante
                                  </button>
                                )}
                                <input ref={receiptRef} type="file" accept="image/*" className="hidden" onChange={handleReceiptPhoto} />
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => registerPayment(row)} disabled={savingPay || !payAmt}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium"
                                  style={{ background: !payAmt ? 'rgba(197,160,89,0.08)' : '#C5A059', color: !payAmt ? 'rgba(197,160,89,0.4)' : '#000', cursor: !payAmt ? 'not-allowed' : 'pointer' }}>
                                  <DollarSign size={12} />{savingPay ? 'Guardando...' : 'Confirmar pago'}
                                </button>
                                <button onClick={() => { setAddPayFor(null); setPayAmt(''); setPayReceipt(''); }}
                                  className="px-4 py-2 rounded-lg text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                  <X size={12} className="inline mr-1" />Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={e => { e.stopPropagation(); setAddPayFor(row.id); setPayAmt(''); setPayReceipt(''); }}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium"
                              style={{ background: 'rgba(197,160,89,0.10)', color: '#C5A059', border: '1px solid rgba(197,160,89,0.28)' }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(197,160,89,0.18)'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(197,160,89,0.10)'}>
                              <Plus size={12} />Registrar Pago de Saldo
                            </button>
                          )}
                        </div>
                      )}

                      <div className="pt-3 space-y-2" style={{ borderTop: '1px solid rgba(197,160,89,0.10)' }}>
                        {(row.status === 'en_laboratorio' || row.status === 'listo') && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                            style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
                            <span>🔬</span>
                            <p className="text-xs font-light" style={{ color: 'rgba(59,130,246,0.8)' }}>
                              {row.status === 'listo' ? 'Listo en laboratorio' : 'En laboratorio'}
                            </p>
                          </div>
                        )}
                        {isPaid && row.status !== 'en_laboratorio' && row.status !== 'listo' && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
                            <Check size={14} style={{ color: '#10b981' }} />
                            <p className="text-xs font-light" style={{ color: '#10b981' }}>Pago completo — marcar cuando retiren los lentes</p>
                          </div>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); markDelivered(row.id); }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium"
                          style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.35)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.22)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.12)'; }}>
                          <Package size={15} />✓ Marcar como Entregado
                        </button>
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
