import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, X, Save, ChevronDown, ChevronUp, Glasses, Banknote, CreditCard, Smartphone, QrCode, Send, MapPin, Truck, Store, Package, User, FileText, Check, CheckCircle, AlertCircle, Trash2, ShoppingBag, Hash, Clock, Building2, Camera, MessageCircle, Receipt, ZoomIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { saveSale as saveToStorage, getSales, getPayments, updateSaleBalance, recordPayment, closeSaleLocal, compressImage } from '../lib/salesStorage';

type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'qr' | 'giro';
type SaleStatus = 'pendiente' | 'en_proceso' | 'en_laboratorio' | 'listo' | 'pagado_total' | 'entregado' | 'cancelado';
type DeliveryType = 'retiro' | 'delivery' | 'encomienda';
type Channel = 'local' | 'online';

type Prescription = {
  od_esfera: string; od_cilindro: string; od_eje: string; od_altura: string;
  oi_esfera: string; oi_cilindro: string; oi_eje: string; oi_altura: string;
  add: string; dp: string; obs: string;
};

type EyeglassItem = {
  _id: string;
  frame_description: string;
  photo_url: string;
  crystals: string;
  treatments: string;
  showReceta: boolean;
  prescription: Prescription;
  price: string;
  saleType: 'completa' | 'media';  // 1 punto o 0.5 puntos
};

type PaymentEntry = {
  _id: string;
  method: PaymentMethod;
  amount: string;
  reference: string;
};

type RecentSale = {
  id: string; sale_number: string; created_at: string;
  total: number; deposit: number; balance: number; status: SaleStatus;
  seller_name: string; customer_first_name: string; customer_last_name: string;
  customers: { full_name: string; ci: string; phone?: string } | null;
  branches: { name: string } | null;
  delivered_at?: string | null;
  delivery_type?: 'retiro' | 'delivery' | 'encomienda' | null;
  _local?: boolean;
  _phone?: string;
};

// ── Sucursales fijas ───────────────────────────────────────────────────────────
const FIXED_BRANCHES = [
  { id: 'azara',    name: 'Azara' },
  { id: 'la_fina',  name: 'La Fina' },
  { id: 'caacupe',  name: 'Caacupé' },
  { id: 'fernando', name: 'Fernando' },
];

const PAY_METHODS: { id: PaymentMethod; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'efectivo',      label: 'Efectivo',    icon: <Banknote   size={13} />, color: '#22c55e' },
  { id: 'transferencia', label: 'Transfer.',   icon: <Smartphone size={13} />, color: '#3b82f6' },
  { id: 'tarjeta',       label: 'POS',         icon: <CreditCard size={13} />, color: '#f59e0b' },
  { id: 'qr',            label: 'QR',          icon: <QrCode     size={13} />, color: '#C5A059' },
  { id: 'giro',          label: 'Giro',        icon: <Send       size={13} />, color: '#a78bfa' },
];

const STATUS_CFG: Record<SaleStatus, { label: string; color: string }> = {
  pendiente:      { label: 'Pendiente',      color: '#f59e0b' },
  en_proceso:     { label: 'En Proceso',     color: '#f59e0b' },
  en_laboratorio: { label: 'En Laboratorio', color: '#3b82f6' },
  listo:          { label: 'Listo',          color: '#10b981' },
  pagado_total:   { label: 'Pagado Total',   color: '#22c55e' },
  entregado:      { label: 'Entregado',      color: '#6b7280' },
  cancelado:      { label: 'Cancelado',      color: '#ef4444' },
};

function uid() { return crypto.randomUUID(); }
function fmt(n: number) { return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

function emptyRx(): Prescription {
  return {
    od_esfera: '', od_cilindro: '', od_eje: '', od_altura: '',
    oi_esfera: '', oi_cilindro: '', oi_eje: '', oi_altura: '',
    add: '', dp: '', obs: '',
  };
}

function rxToText(rx: Prescription): string {
  const od = `OD: ${rx.od_esfera || '—'} / ${rx.od_cilindro || '—'} x ${rx.od_eje || '—'}${rx.od_altura ? ` Alt:${rx.od_altura}` : ''}`;
  const oi = `OI: ${rx.oi_esfera || '—'} / ${rx.oi_cilindro || '—'} x ${rx.oi_eje || '—'}${rx.oi_altura ? ` Alt:${rx.oi_altura}` : ''}`;
  const extras = [rx.add && `ADD ${rx.add}`, rx.dp && `DP ${rx.dp}`, rx.obs].filter(Boolean).join(' | ');
  return [od, oi, extras].filter(Boolean).join(' | ');
}

function newEyeglass(): EyeglassItem {
  return { _id: uid(), frame_description: '', photo_url: '', crystals: '', treatments: '', showReceta: false, prescription: emptyRx(), price: '', saleType: 'completa' };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-light mb-1.5 tracking-wide" style={{ color: 'rgba(255,255,255,0.42)' }}>{children}</p>;
}

function GoldInput({ value, onChange, placeholder, type = 'text', mono = false }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; mono?: boolean }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border"
      style={{ borderColor: 'rgba(197,160,89,0.22)', fontFamily: mono ? 'monospace' : undefined }} />
  );
}

function GoldSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2.5 rounded-xl text-sm font-light outline-none border"
      style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(197,160,89,0.22)', color: 'rgba(255,255,255,0.75)' }}>
      {children}
    </select>
  );
}

function Section({ title, icon, children, accent }: { title: string; icon: React.ReactNode; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: accent ? 'rgba(197,160,89,0.04)' : 'rgba(255,255,255,0.018)', border: `1px solid ${accent ? 'rgba(197,160,89,0.22)' : 'rgba(197,160,89,0.12)'}` }}>
      <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(197,160,89,0.09)' }}>
        <span style={{ color: '#C5A059' }}>{icon}</span>
        <span className="text-sm font-light tracking-wide text-white">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function POSPage() {
  const { profile } = useAuth();
  const [saleNumber] = useState(`VTA-${Date.now().toString().slice(-8)}`);
  const today = new Date().toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const [nFirst,  setNFirst]  = useState('');
  const [nLast,   setNLast]   = useState('');
  const [nCi,     setNCi]     = useState('');
  const [nPhone,  setNPhone]  = useState('');

  const [saleBranch, setSaleBranch] = useState('');
  const [delBranch,  setDelBranch]  = useState('');
  const [payBranch,  setPayBranch]  = useState('');

  const [channel,    setChannel]    = useState<Channel>('local');
  const [delType,    setDelType]    = useState<DeliveryType>('retiro');
  const [delAddress, setDelAddress] = useState('');
  const [delRef,     setDelRef]     = useState('');
  const [delPhone,   setDelPhone]   = useState('');
  const [shipCo,     setShipCo]     = useState('');
  const [shipCity,   setShipCity]   = useState('');
  const [shipRec,    setShipRec]    = useState('');
  const [shipPhone,  setShipPhone]  = useState('');
  const [shipTrack,  setShipTrack]  = useState('');

  const [eyeglasses, setEyeglasses] = useState<EyeglassItem[]>([]);
  const [payments,   setPayments]   = useState<PaymentEntry[]>([{ _id: uid(), method: 'efectivo', amount: '', reference: '' }]);
  const [paymentReceipt, setPaymentReceipt] = useState('');

  const [status, setStatus] = useState<SaleStatus>('pendiente');
  const [notes,  setNotes]  = useState('');

  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState('');
  const [saveErr,   setSaveErr]   = useState('');
  const [paidToast, setPaidToast] = useState('');

  const [sales,        setSales]        = useState<RecentSale[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);
  const [sfFilter,     setSfFilter]     = useState<SaleStatus | 'todos'>('todos');
  const [expanded,     setExpanded]     = useState<string | null>(null);
  const [listSearch,   setListSearch]   = useState('');

  const [addPayFor,      setAddPayFor]      = useState<string | null>(null);
  const [xPayAmt,        setXPayAmt]        = useState('');
  const [xPayMethod,     setXPayMethod]     = useState<PaymentMethod>('efectivo');
  const [xPayBranch,     setXPayBranch]     = useState('');
  const [xPayRef,        setXPayRef]        = useState('');
  const [xPayReceipt,    setXPayReceipt]    = useState('');
  const [xPayWarn,       setXPayWarn]       = useState(false);
  const [updStatus,      setUpdStatus]      = useState<string | null>(null);

  type DeliveryMode = 'retiro' | 'delivery' | 'encomienda';
  const [closeFor,           setCloseFor]           = useState<string | null>(null);
  const [closeMethod,        setCloseMethod]        = useState<PaymentMethod>('efectivo');
  const [closeAmt,           setCloseAmt]           = useState('');
  const [closeRef,           setCloseRef]           = useState('');
  const [closeReceipt,       setCloseReceipt]       = useState('');
  const [closeReceiptWarn,   setCloseReceiptWarn]   = useState(false);
  const [closeDelivery,      setCloseDelivery]      = useState<DeliveryMode>('retiro');
  const [closingSale,        setClosingSale]        = useState(false);

  const [saleTotal,   setSaleTotal]   = useState('');
  const [saleDeposit, setSaleDeposit] = useState('');
  const totalNum   = parseFloat(saleTotal)   || 0;
  const depositNum = parseFloat(saleDeposit) || 0;
  const balanceNum = Math.max(0, totalNum - depositNum);

  useEffect(() => { loadSales(); }, []);

  useEffect(() => {
    if (profile?.branch_id) {
      const bid = profile.branch_id.toLowerCase().replace(/ /g, '_').replace(/é/g, 'e').replace(/á/g, 'a');
      setSaleBranch(bid); setDelBranch(bid); setPayBranch(bid);
    }
  }, [profile?.branch_id]);

  const loadSales = useCallback(async () => {
    setLoadingSales(true);
    const localRows: RecentSale[] = getSales()
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .map(v => ({
        id: `local-${v.id}`,
        sale_number: `VTA-${v.id}`,
        created_at: v.fecha,
        total: v.total, deposit: v.sena, balance: v.saldo,
        status: (v.estadoTrabajo as SaleStatus) ?? 'pendiente',
        seller_name: v.vendedora,
        customer_first_name: v.cliente.nombre,
        customer_last_name: v.cliente.apellido,
        customers: null,
        branches: v.sucursalEntrega ? { name: v.sucursalEntrega } : null,
        delivered_at: v.delivered_at ?? null,
        delivery_type: v.delivery_type ?? null,
        _local: true,
        _phone: v.cliente.telefono,
      }));
    setSales(localRows);
    setLoadingSales(false);
  }, []);

  function addEyeglass() { setEyeglasses(prev => [...prev, newEyeglass()]); }
  function removeEyeglass(id: string) { setEyeglasses(prev => prev.filter(eg => eg._id !== id)); }
  function updateEg(id: string, patch: Partial<EyeglassItem>) {
    setEyeglasses(prev => prev.map(eg => eg._id === id ? { ...eg, ...patch } : eg));
  }
  function updatePay(id: string, k: keyof PaymentEntry, v: string) {
    setPayments(prev => prev.map(p => p._id === id ? { ...p, [k]: v } : p));
  }

  async function handleSaveSale() {
    setSaveErr('');
    if (!nFirst.trim()) { setSaveErr('El campo Nombre es obligatorio.'); return; }
    if (!nLast.trim())  { setSaveErr('El campo Apellido es obligatorio.'); return; }
    if (!totalNum)      { setSaveErr('El campo Total venta es obligatorio.'); return; }
    if (!saleBranch)    { setSaveErr('Seleccioná la Sucursal de venta.'); return; }
    if (!delBranch)     { setSaveErr('Seleccioná la Sucursal de entrega.'); return; }
    if (!payBranch)     { setSaveErr('Seleccioná la Sucursal de cobro.'); return; }

    setSaving(true);
    try {
      const sellerName    = profile?.full_name ?? 'Sin nombre';
      const saleId        = Date.now();
      const saleNum       = `VTA-${saleId}`;
      const firstName     = nFirst.trim();
      const lastName      = nLast.trim();
      const phone         = nPhone.trim();
      const ci            = nCi.trim();

      // ── FIX: usar el método seleccionado, no buscar por amount ──
      const primaryMethod = payments[0].method;

      const saleBranchName = FIXED_BRANCHES.find(b => b.id === saleBranch)?.name ?? saleBranch;
      const delBranchName  = FIXED_BRANCHES.find(b => b.id === delBranch)?.name  ?? delBranch;
      const payBranchName  = FIXED_BRANCHES.find(b => b.id === payBranch)?.name  ?? payBranch;

      saveToStorage({
        id: saleId,
        fecha: new Date().toISOString(),
        cliente: { nombre: firstName, apellido: lastName, telefono: phone, ci },
        sucursalVenta:   saleBranchName,
        sucursalEntrega: delBranchName,
        sucursalCobro:   payBranchName,
        vendedora: sellerName,
        total:   totalNum,
        sena:    depositNum,
        saldo:   balanceNum,
        metodoPago:    primaryMethod,
        estadoTrabajo: status,
        anteojos:      eyeglasses,
        observaciones: notes,
        receipt_url:   paymentReceipt || undefined,
      } as any);

      setSaved(`Venta ${saleNum} guardada con éxito.`);
      resetForm();
      loadSales();
      window.dispatchEvent(new Event('optica_ventas_updated'));
      setTimeout(() => setSaved(''), 6000);
    } catch (err: any) {
      setSaveErr(`Error al guardar: ${err?.message ?? 'Error desconocido'}.`);
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setNFirst(''); setNLast(''); setNCi(''); setNPhone('');
    setEyeglasses([]);
    setSaleTotal(''); setSaleDeposit('');
    setPayments([{ _id: uid(), method: 'efectivo', amount: '', reference: '' }]);
    setPaymentReceipt('');
    setNotes(''); setStatus('pendiente');
    setChannel('local'); setDelType('retiro');
    setDelAddress(''); setDelRef(''); setDelPhone('');
    setShipCo(''); setShipCity(''); setShipRec(''); setShipPhone(''); setShipTrack('');
    setSaveErr('');
    if (profile?.branch_id) {
      const bid = profile.branch_id.toLowerCase().replace(/ /g, '_').replace(/é/g, 'e').replace(/á/g, 'a');
      setSaleBranch(bid); setDelBranch(bid); setPayBranch(bid);
    }
  }

  function updateSaleStatus(saleId: string, s: SaleStatus) {
    setSales(prev => prev.map(sale => sale.id === saleId ? { ...sale, status: s } : sale));
    if (saleId.startsWith('local-')) {
      // update localStorage
      const numId = Number(saleId.replace('local-', ''));
      const all = getSales();
      const updated = all.map(v => v.id === numId ? { ...v, estadoTrabajo: s } : v);
      localStorage.setItem('optica_yolanda_ventas', JSON.stringify(updated));
      return;
    }
    setUpdStatus(saleId);
    setTimeout(() => setUpdStatus(null), 1000);
  }

  async function registerXPay(saleId: string) {
    const amt = parseFloat(xPayAmt);
    if (!amt || amt <= 0) return;

    if (saleId.startsWith('local-')) {
      const numId = Number(saleId.replace('local-', ''));
      const localSale = getSales().find(s => s.id === numId);
      if (localSale) {
        const newDeposit = localSale.sena + amt;
        const newBalance = Math.max(0, localSale.total - newDeposit);
        updateSaleBalance(numId, newBalance, newDeposit);
        recordPayment({
          id: Date.now(), saleId: numId, fecha: new Date().toISOString(),
          monto: amt, metodo: xPayMethod,
          sucursal: (FIXED_BRANCHES.find(b => b.id === xPayBranch)?.name ?? xPayBranch) || FIXED_BRANCHES[0].name,
          vendedora: profile?.full_name ?? '',
          cliente: `${localSale.cliente.nombre} ${localSale.cliente.apellido}`.trim(),
          tipo: 'abono', receipt_url: xPayReceipt || undefined,
        });
        setSales(prev => prev.map(s =>
          s.id === saleId ? { ...s, deposit: newDeposit, balance: newBalance, status: newBalance <= 0 && s.status !== 'entregado' ? 'pagado_total' : s.status } : s
        ));
        if (newBalance <= 0) {
          setPaidToast(`Venta saldada · ${localSale.cliente.nombre} ${localSale.cliente.apellido} — Saldo en 0`);
          setTimeout(() => setPaidToast(''), 6000);
        }
      }
    }
    setAddPayFor(null); setXPayAmt(''); setXPayRef(''); setXPayReceipt(''); setXPayWarn(false); loadSales();
  }

  async function closeSale(saleId: string, balance: number) {
    const finalAmt = balance > 0 ? parseFloat(closeAmt) || 0 : 0;
    setClosingSale(true);
    if (saleId.startsWith('local-')) {
      const numId = Number(saleId.replace('local-', ''));
      const localSale = getSales().find(s => s.id === numId);
      if (localSale) {
        if (finalAmt > 0) {
          recordPayment({
            id: Date.now(), saleId: numId, fecha: new Date().toISOString(),
            monto: finalAmt, metodo: closeMethod,
            sucursal: FIXED_BRANCHES[0].name,
            vendedora: profile?.full_name ?? '',
            cliente: `${localSale.cliente.nombre} ${localSale.cliente.apellido}`.trim(),
            tipo: 'abono', receipt_url: closeReceipt || undefined,
          });
        }
        closeSaleLocal(numId, closeDelivery);
      }
    }
    setCloseFor(null); setCloseAmt(''); setCloseRef('');
    setCloseReceipt(''); setCloseReceiptWarn(false); setCloseDelivery('retiro');
    setClosingSale(false); loadSales();
  }

  const filtered = sales.filter(s => {
    if (sfFilter !== 'todos' && s.status !== sfFilter) return false;
    if (listSearch) {
      const q = listSearch.toLowerCase();
      const name = (s.customers?.full_name ?? `${s.customer_first_name} ${s.customer_last_name}`).toLowerCase();
      return name.includes(q) || s.sale_number.includes(q) || (s.seller_name ?? '').toLowerCase().includes(q);
    }
    return true;
  });
  const countBy = Object.fromEntries(Object.keys(STATUS_CFG).map(k => [k, sales.filter(s => s.status === k).length])) as Record<SaleStatus, number>;

  const branchOpts = [
    <option key="" value="" style={{ background: '#0a0908' }}>— Seleccionar —</option>,
    ...FIXED_BRANCHES.map(b => <option key={b.id} value={b.id} style={{ background: '#0a0908' }}>{b.name}</option>),
  ];

  return (
    <div className="flex h-full min-h-screen">
      {/* ── LEFT: Formulario nueva venta ── */}
      <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-4" style={{ maxWidth: 680 }}>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-light tracking-wider text-white">Nueva Venta</h1>
            <p className="text-xs font-light mt-1 capitalize tracking-wide" style={{ color: 'rgba(197,160,89,0.65)' }}>{today}</p>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-light"
              style={{ background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.2)', color: '#C5A059' }}>
              <Hash size={11} />{saleNumber}
            </div>
            <button onClick={resetForm}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-light"
              style={{ color: 'rgba(239,68,68,0.65)', border: '1px solid rgba(239,68,68,0.2)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.4)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(239,68,68,0.65)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.2)'; }}>
              <X size={13} /> Cancelar
            </button>
          </div>
        </div>

        {saveErr && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl border text-sm font-light"
            style={{ background: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.28)', color: '#ef4444' }}>
            <AlertCircle size={15} /> {saveErr}
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl border text-sm font-light"
            style={{ background: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.28)', color: '#10b981' }}>
            <Check size={15} /> {saved}
          </div>
        )}
        {paidToast && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl border text-sm font-light"
            style={{ background: 'rgba(34,197,94,0.10)', borderColor: 'rgba(34,197,94,0.40)', color: '#22c55e' }}>
            <CheckCircle size={15} /> {paidToast}
          </div>
        )}

        {/* Cliente */}
        <Section title="Cliente" icon={<User size={15} />}>
          <div className="grid grid-cols-2 gap-3">
            <div><FieldLabel>Nombre <span style={{ color: '#C5A059' }}>*</span></FieldLabel><GoldInput value={nFirst} onChange={setNFirst} placeholder="Nombre" /></div>
            <div><FieldLabel>Apellido <span style={{ color: '#C5A059' }}>*</span></FieldLabel><GoldInput value={nLast} onChange={setNLast} placeholder="Apellido" /></div>
            <div><FieldLabel>Teléfono / WhatsApp <span style={{ color: 'rgba(255,255,255,0.28)' }}>(opcional)</span></FieldLabel><GoldInput value={nPhone} onChange={setNPhone} placeholder="0981-000000" /></div>
            <div><FieldLabel>C.I. <span style={{ color: 'rgba(255,255,255,0.28)' }}>(opcional)</span></FieldLabel><GoldInput value={nCi} onChange={setNCi} placeholder="Número de cédula" /></div>
          </div>
        </Section>

        {/* Sucursales */}
        <Section title="Sucursales" icon={<Building2 size={15} />}>
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.20)' }}>
              <User size={13} style={{ color: '#C5A059', flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>Vendedora (usuario actual)</p>
                <p className="text-sm text-white font-light truncate">{profile?.full_name ?? '—'}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><FieldLabel>Sucursal de venta <span style={{ color: '#C5A059' }}>*</span></FieldLabel><GoldSelect value={saleBranch} onChange={setSaleBranch}>{branchOpts}</GoldSelect></div>
              <div><FieldLabel>Sucursal de entrega <span style={{ color: '#C5A059' }}>*</span></FieldLabel><GoldSelect value={delBranch} onChange={setDelBranch}>{branchOpts}</GoldSelect></div>
              <div><FieldLabel>Sucursal de cobro <span style={{ color: '#C5A059' }}>*</span></FieldLabel><GoldSelect value={payBranch} onChange={setPayBranch}>{branchOpts}</GoldSelect></div>
            </div>
          </div>
        </Section>

        {/* Canal y Entrega */}
        <Section title="Canal de Venta y Entrega" icon={<Truck size={15} />}>
          <div className="space-y-4">
            <div className="flex gap-2">
              {([{ v: 'local', l: 'Local', ic: <Store size={13} /> }, { v: 'online', l: 'Online', ic: <ShoppingBag size={13} /> }] as const).map(opt => (
                <button key={opt.v} onClick={() => setChannel(opt.v)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-light flex-1 justify-center"
                  style={{ background: channel === opt.v ? 'rgba(197,160,89,0.14)' : 'rgba(255,255,255,0.03)', border: `1px solid ${channel === opt.v ? 'rgba(197,160,89,0.44)' : 'rgba(255,255,255,0.08)'}`, color: channel === opt.v ? '#C5A059' : 'rgba(255,255,255,0.44)' }}>
                  {opt.ic}{opt.l}
                </button>
              ))}
            </div>
            <div>
              <FieldLabel>Tipo de entrega</FieldLabel>
              <div className="flex gap-2 flex-wrap">
                {([
                  { v: 'retiro' as const, l: 'Retiro en sucursal', ic: <Store size={12} /> },
                  { v: 'delivery' as const, l: 'Delivery', ic: <MapPin size={12} /> },
                  { v: 'encomienda' as const, l: 'Encomienda', ic: <Package size={12} /> },
                ]).map(opt => (
                  <button key={opt.v} onClick={() => setDelType(opt.v)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-light"
                    style={{ background: delType === opt.v ? 'rgba(197,160,89,0.14)' : 'rgba(255,255,255,0.03)', border: `1px solid ${delType === opt.v ? 'rgba(197,160,89,0.44)' : 'rgba(255,255,255,0.08)'}`, color: delType === opt.v ? '#C5A059' : 'rgba(255,255,255,0.44)' }}>
                    {opt.ic}{opt.l}
                  </button>
                ))}
              </div>
            </div>
            {delType === 'retiro' && (<div><FieldLabel>Sucursal de retiro</FieldLabel><GoldSelect value={delBranch} onChange={setDelBranch}>{branchOpts}</GoldSelect></div>)}
            {delType === 'delivery' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><FieldLabel>Dirección</FieldLabel><GoldInput value={delAddress} onChange={setDelAddress} placeholder="Calle y número" /></div>
                <div><FieldLabel>Referencia</FieldLabel><GoldInput value={delRef} onChange={setDelRef} placeholder="Entre calles..." /></div>
                <div><FieldLabel>Teléfono</FieldLabel><GoldInput value={delPhone} onChange={setDelPhone} placeholder="0981-000000" /></div>
              </div>
            )}
            {delType === 'encomienda' && (
              <div className="grid grid-cols-2 gap-3">
                <div><FieldLabel>Empresa de transporte</FieldLabel><GoldInput value={shipCo} onChange={setShipCo} placeholder="Rysa, Cometa..." /></div>
                <div><FieldLabel>Ciudad destino</FieldLabel><GoldInput value={shipCity} onChange={setShipCity} placeholder="Ciudad" /></div>
                <div><FieldLabel>Nombre de quien recibe</FieldLabel><GoldInput value={shipRec} onChange={setShipRec} placeholder="Nombre completo" /></div>
                <div><FieldLabel>Teléfono</FieldLabel><GoldInput value={shipPhone} onChange={setShipPhone} placeholder="0981-000000" /></div>
                <div className="col-span-2"><FieldLabel>Número de guía (opcional)</FieldLabel><GoldInput value={shipTrack} onChange={setShipTrack} placeholder="Número de seguimiento" /></div>
              </div>
            )}
          </div>
        </Section>

        {/* Anteojos */}
        <Section title="Anteojos" icon={<Glasses size={15} />}>
          <div className="space-y-3">
            {eyeglasses.map((eg, idx) => (
              <SimpleEyeglassCard key={eg._id} eg={eg} idx={idx} onUpdate={patch => updateEg(eg._id, patch)} onRemove={() => removeEyeglass(eg._id)} />
            ))}
            <button onClick={addEyeglass}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-light border-dashed border transition-colors"
              style={{ borderColor: 'rgba(197,160,89,0.30)', color: '#C5A059', background: 'rgba(197,160,89,0.03)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(197,160,89,0.09)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(197,160,89,0.03)')}>
              <Plus size={15} /> Agregar anteojo
            </button>
          </div>
        </Section>

        {/* Pago y Totales */}
        <Section title="Pago y Totales" icon={<Banknote size={15} />}>
          <div className="space-y-5">
            <div>
              <FieldLabel>Método de pago</FieldLabel>
              <div className="flex gap-1.5 flex-wrap">
                {PAY_METHODS.map(m => (
                  <button key={m.id} onClick={() => updatePay(payments[0]._id, 'method', m.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-light"
                    style={{ background: payments[0].method === m.id ? `${m.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${payments[0].method === m.id ? m.color + '44' : 'rgba(255,255,255,0.08)'}`, color: payments[0].method === m.id ? m.color : 'rgba(255,255,255,0.42)' }}>
                    {m.icon}{m.label}
                  </button>
                ))}
              </div>
              {(payments[0].method === 'transferencia' || payments[0].method === 'giro') && (
                <div className="mt-2"><GoldInput value={payments[0].reference} onChange={v => updatePay(payments[0]._id, 'reference', v)} placeholder="Banco / referencia" /></div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Total venta <span style={{ color: '#C5A059' }}>*</span></FieldLabel>
                <input type="number" value={saleTotal} onChange={e => setSaleTotal(e.target.value)} placeholder="500000"
                  className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border text-right"
                  style={{ borderColor: 'rgba(197,160,89,0.30)' }} />
              </div>
              <div>
                <FieldLabel>Seña / Monto entregado</FieldLabel>
                <input type="number" value={saleDeposit} onChange={e => setSaleDeposit(e.target.value)} placeholder="0"
                  className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border text-right"
                  style={{ borderColor: 'rgba(197,160,89,0.22)' }} />
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.20)' }}>
              <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'rgba(197,160,89,0.14)' }}>
                {[
                  { label: 'TOTAL',      value: fmt(totalNum),   color: '#C5A059' },
                  { label: 'ENTREGADO',  value: fmt(depositNum), color: '#10b981' },
                  { label: 'SALDO PEND.',value: fmt(balanceNum), color: balanceNum > 0 ? '#f59e0b' : '#6b7280' },
                ].map(item => (
                  <div key={item.label} className="flex flex-col items-center py-4 px-3" style={{ borderColor: 'rgba(197,160,89,0.14)' }}>
                    <p className="text-xs font-light tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.label}</p>
                    <p className="text-xl font-light" style={{ color: item.color }}>{item.value}</p>
                    <p className="text-xs mt-0.5 font-light" style={{ color: 'rgba(255,255,255,0.22)' }}>Gs.</p>
                  </div>
                ))}
              </div>
            </div>
            <ReceiptUpload value={paymentReceipt} onChange={setPaymentReceipt} />
          </div>
        </Section>

        {/* Estado */}
        <Section title="Estado del Trabajo" icon={<Clock size={15} />}>
          <div className="flex gap-2 flex-wrap">
            {(Object.entries(STATUS_CFG) as [SaleStatus, { label: string; color: string }][])
              .filter(([k]) => k !== 'cancelado')
              .map(([k, v]) => (
                <button key={k} onClick={() => setStatus(k)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-light"
                  style={{ background: status === k ? `${v.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${status === k ? v.color + '55' : 'rgba(255,255,255,0.08)'}`, color: status === k ? v.color : 'rgba(255,255,255,0.44)' }}>
                  {status === k && <Check size={12} />}
                  {v.label}
                </button>
              ))}
          </div>
        </Section>

        {/* Observaciones */}
        <Section title="Observaciones" icon={<FileText size={15} />}>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Notas internas, instrucciones especiales..."
            className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm outline-none border resize-none font-light"
            style={{ borderColor: 'rgba(197,160,89,0.22)' }} />
        </Section>

        <button onClick={handleSaveSale} disabled={saving}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-base font-medium disabled:opacity-40"
          style={{ background: '#C5A059', color: '#000' }}>
          {saving ? <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />Guardando...</> : <><Save size={18} />Guardar Venta</>}
        </button>
        <div className="h-6" />
      </div>

      {/* ── RIGHT: Lista de ventas ── */}
      <div className="w-[420px] shrink-0 border-l flex flex-col h-screen sticky top-0 overflow-hidden"
        style={{ borderColor: 'rgba(197,160,89,0.10)', background: 'rgba(0,0,0,0.18)' }}>

        {paidToast && (
          <div className="mx-4 mt-3 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-light"
            style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.40)', color: '#22c55e' }}>
            <CheckCircle size={14} /><span>{paidToast}</span>
          </div>
        )}

        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(197,160,89,0.10)' }}>
          <p className="text-sm font-light tracking-wide text-white mb-3">Ventas recientes</p>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border" style={{ borderColor: 'rgba(197,160,89,0.18)', background: 'rgba(255,255,255,0.02)' }}>
            <Search size={12} style={{ color: 'rgba(197,160,89,0.45)' }} />
            <input value={listSearch} onChange={e => setListSearch(e.target.value)} placeholder="Buscar..."
              className="flex-1 bg-transparent text-white text-xs outline-none font-light" />
          </div>
          <div className="flex gap-1 mt-3 flex-wrap">
            {([
              { id: 'todos', label: 'Todas', count: sales.length, color: 'rgba(255,255,255,0.5)' },
              ...Object.entries(STATUS_CFG).map(([k, v]) => ({ id: k, label: v.label, count: countBy[k as SaleStatus] ?? 0, color: v.color })),
            ] as { id: string; label: string; count: number; color: string }[]).map(opt => (
              <button key={opt.id} onClick={() => setSfFilter(opt.id as any)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-light"
                style={{ background: sfFilter === opt.id ? `${opt.color}18` : 'transparent', border: `1px solid ${sfFilter === opt.id ? opt.color + '55' : 'transparent'}`, color: sfFilter === opt.id ? opt.color : 'rgba(255,255,255,0.38)' }}>
                {opt.label}<span className="ml-0.5 text-xs opacity-60">{opt.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          {loadingSales ? (
            <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl shimmer" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-xs font-light" style={{ color: 'rgba(255,255,255,0.28)' }}>Sin ventas</div>
          ) : filtered.map(sale => {
            const sc = STATUS_CFG[sale.status] ?? STATUS_CFG.pendiente;
            const isExp = expanded === sale.id;
            const name = sale.customers?.full_name || [sale.customer_first_name, sale.customer_last_name].filter(Boolean).join(' ') || '—';
            const clientPhone = sale._phone ?? '';
            const branchName = sale.branches?.name ?? '';
            const waMsg = `Hola ${name}, te saludamos de Óptica Yolanda. Tus lentes ya están listos en la sucursal ${branchName}. ¡Te esperamos!`;
            const waLink = clientPhone ? `https://wa.me/595${clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(waMsg)}` : null;

            return (
              <div key={sale.id}>
                <div className="px-4 py-3 cursor-pointer" style={{ background: isExp ? 'rgba(197,160,89,0.03)' : 'transparent' }}
                  onClick={() => setExpanded(isExp ? null : sale.id)}
                  onMouseEnter={e => { if (!isExp) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.012)'; }}
                  onMouseLeave={e => { if (!isExp) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono" style={{ color: '#C5A059' }}>{sale.sale_number}</span>
                    <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.28)' }}>
                      {new Date(sale.created_at).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })}
                    </span>
                    <select value={sale.status} onClick={e => e.stopPropagation()}
                      onChange={e => updateSaleStatus(sale.id, e.target.value as SaleStatus)}
                      disabled={updStatus === sale.id}
                      className="ml-auto px-2 py-0.5 rounded-lg text-xs font-light outline-none"
                      style={{ background: `${sc.color}18`, border: `1px solid ${sc.color}44`, color: sc.color }}>
                      {Object.entries(STATUS_CFG).map(([k, v]) => (
                        <option key={k} value={k} style={{ background: '#111', color: v.color }}>{v.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} style={{ color: 'rgba(255,255,255,0.28)', flexShrink: 0, transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white font-light truncate flex-1">{name}</p>
                    {waLink && (
                      <a href={waLink} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} title="Enviar WhatsApp"
                        className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full"
                        style={{ background: 'rgba(37,211,102,0.15)', color: '#25D366' }}>
                        <MessageCircle size={12} />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs font-light truncate" style={{ color: 'rgba(255,255,255,0.32)' }}>
                      {sale.seller_name || '—'} · {branchName}
                    </p>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-xs text-white font-light">Gs. {fmt(Number(sale.total))}</p>
                      {Number(sale.balance) > 0 && <p className="text-xs font-light" style={{ color: '#f59e0b' }}>Debe {fmt(Number(sale.balance))}</p>}
                    </div>
                  </div>
                </div>

                {isExp && (
                  <div className="px-4 pb-4 space-y-3" style={{ background: 'rgba(197,160,89,0.02)' }}>
                    {waLink && (
                      <div className="border-t pt-3" style={{ borderColor: 'rgba(197,160,89,0.1)' }}>
                        <a href={waLink} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light"
                          style={{ background: 'rgba(37,211,102,0.10)', color: '#25D366', border: '1px solid rgba(37,211,102,0.25)' }}>
                          <MessageCircle size={13} />Enviar WhatsApp a {name}
                        </a>
                      </div>
                    )}

                    <PaymentHistory saleId={sale.id} isLocal={sale._local} isAdmin={profile?.role === 'admin' || profile?.role === 'gerente'} />

                    {Number(sale.balance) > 0 && (
                      <div className="border-t pt-3 space-y-2" style={{ borderColor: 'rgba(197,160,89,0.1)' }}>
                        <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.55)' }}>Registrar pago</p>
                        {addPayFor === sale.id ? (
                          <div className="space-y-2.5">
                            <div className="flex gap-1 flex-wrap">
                              {PAY_METHODS.map(m => (
                                <button key={m.id} onClick={() => setXPayMethod(m.id)}
                                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-light"
                                  style={{ background: xPayMethod === m.id ? `${m.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${xPayMethod === m.id ? m.color + '44' : 'rgba(255,255,255,0.07)'}`, color: xPayMethod === m.id ? m.color : 'rgba(255,255,255,0.38)' }}>
                                  {m.icon}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <input value={xPayAmt} onChange={e => { setXPayAmt(e.target.value); setXPayWarn(false); }}
                                type="number" placeholder={`Saldo: Gs. ${fmt(Number(sale.balance))}`}
                                className="flex-1 px-3 py-2 rounded-xl bg-transparent text-white text-xs outline-none border"
                                style={{ borderColor: 'rgba(197,160,89,0.2)' }} />
                              <select value={xPayBranch} onChange={e => setXPayBranch(e.target.value)}
                                className="px-2 py-2 rounded-xl text-xs outline-none border"
                                style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(197,160,89,0.18)', color: 'rgba(255,255,255,0.6)' }}>
                                {FIXED_BRANCHES.map(b => <option key={b.id} value={b.id} style={{ background: '#111' }}>{b.name}</option>)}
                              </select>
                            </div>
                            {(xPayMethod === 'transferencia' || xPayMethod === 'giro') && (
                              <input value={xPayRef} onChange={e => setXPayRef(e.target.value)} placeholder="Banco / referencia"
                                className="w-full px-3 py-2 rounded-xl bg-transparent text-white text-xs outline-none border"
                                style={{ borderColor: 'rgba(197,160,89,0.18)' }} />
                            )}
                            <div className="rounded-xl p-2.5 space-y-2"
                              style={{ background: 'rgba(197,160,89,0.04)', border: `1px solid ${xPayWarn && !xPayReceipt ? 'rgba(245,158,11,0.55)' : 'rgba(197,160,89,0.12)'}` }}>
                              <div className="flex items-center gap-1.5">
                                <Receipt size={11} style={{ color: '#C5A059' }} />
                                <span className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.8)' }}>Comprobante de Pago</span>
                                {xPayMethod !== 'efectivo' && <span className="text-xs font-light" style={{ color: '#f59e0b' }}>recomendado</span>}
                              </div>
                              {xPayReceipt ? (
                                <div className="relative inline-block">
                                  <img src={xPayReceipt} alt="comprobante" className="h-20 rounded-lg object-cover" style={{ border: '1px solid rgba(197,160,89,0.3)' }} />
                                  <button onClick={() => setXPayReceipt('')} className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#ef4444' }}><X size={8} color="#fff" /></button>
                                </div>
                              ) : (
                                <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light cursor-pointer"
                                  style={{ background: 'rgba(197,160,89,0.07)', border: '1px dashed rgba(197,160,89,0.3)', color: 'rgba(197,160,89,0.7)' }}>
                                  <Camera size={12} />Subir foto del comprobante
                                  <input type="file" accept="image/*" className="hidden"
                                    onChange={async e => {
                                      const file = e.target.files?.[0]; if (!file) return;
                                      const reader = new FileReader();
                                      reader.onload = async ev => { const c = await compressImage(ev.target?.result as string); setXPayReceipt(c); setXPayWarn(false); };
                                      reader.readAsDataURL(file);
                                    }} />
                                </label>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => { if (!xPayReceipt && xPayMethod !== 'efectivo') { setXPayWarn(true); return; } registerXPay(sale.id); }}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-black font-medium" style={{ background: '#C5A059' }}>
                                <Check size={11} />Guardar abono
                              </button>
                              <button onClick={() => { setAddPayFor(null); setXPayAmt(''); setXPayReceipt(''); setXPayWarn(false); }}
                                className="px-3 py-2 rounded-lg text-xs font-light" style={{ color: 'rgba(255,255,255,0.38)' }}>Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={e => { e.stopPropagation(); setAddPayFor(sale.id); setXPayBranch(FIXED_BRANCHES[0].id); setXPayWarn(false); }}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light"
                            style={{ background: 'rgba(197,160,89,0.08)', color: '#C5A059', border: '1px solid rgba(197,160,89,0.22)' }}>
                            <Plus size={11} />Cliente viene a pagar saldo
                          </button>
                        )}
                      </div>
                    )}

                    {sale.status !== 'entregado' && sale.status !== 'cancelado' && (
                      <div className="border-t pt-3" style={{ borderColor: 'rgba(197,160,89,0.1)' }}>
                        {closeFor === sale.id ? (
                          <CloseSaleForm
                            balance={Number(sale.balance)}
                            closeAmt={closeAmt} setCloseAmt={setCloseAmt}
                            closeMethod={closeMethod} setCloseMethod={setCloseMethod}
                            closeRef={closeRef} setCloseRef={setCloseRef}
                            closeReceipt={closeReceipt} setCloseReceipt={setCloseReceipt}
                            closeReceiptWarn={closeReceiptWarn} setCloseReceiptWarn={setCloseReceiptWarn}
                            closeDelivery={closeDelivery} setCloseDelivery={setCloseDelivery}
                            closingSale={closingSale}
                            onConfirm={() => closeSale(sale.id, Number(sale.balance))}
                            onCancel={() => { setCloseFor(null); setCloseAmt(''); setCloseRef(''); setCloseReceipt(''); setCloseReceiptWarn(false); }}
                          />
                        ) : (
                          <button onClick={e => { e.stopPropagation(); setCloseFor(sale.id); setAddPayFor(null); }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium"
                            style={{ background: 'rgba(34,197,94,0.10)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.30)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.18)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.10)'; }}>
                            <Package size={14} />Entregar Lentes y Cobrar Saldo
                          </button>
                        )}
                      </div>
                    )}

                    {sale.status === 'entregado' && (sale.delivery_type || sale.delivered_at) && (
                      <div className="border-t pt-3 flex items-center gap-3 flex-wrap" style={{ borderColor: 'rgba(34,197,94,0.12)' }}>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)' }}>
                          {sale.delivery_type === 'retiro' && <Store size={11} style={{ color: '#22c55e' }} />}
                          {sale.delivery_type === 'delivery' && <Truck size={11} style={{ color: '#22c55e' }} />}
                          {sale.delivery_type === 'encomienda' && <Package size={11} style={{ color: '#22c55e' }} />}
                          <span className="text-xs font-light" style={{ color: '#22c55e' }}>
                            {sale.delivery_type === 'retiro' && 'Retirado en local'}
                            {sale.delivery_type === 'delivery' && 'Enviado por delivery'}
                            {sale.delivery_type === 'encomienda' && 'Enviado por encomienda'}
                          </span>
                        </div>
                        {sale.delivered_at && (
                          <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.38)' }}>
                            <Clock size={10} className="inline mr-1" />
                            {new Date(sale.delivered_at).toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RxInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? ''}
        className="w-full px-2.5 py-2 rounded-lg bg-transparent text-white text-xs font-light outline-none border text-center"
        style={{ borderColor: 'rgba(197,160,89,0.20)', fontFamily: 'monospace' }} />
    </div>
  );
}

function ReceiptUpload({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement | null>(null);
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => { const c = await compressImage(ev.target?.result as string); onChange(c); };
    reader.readAsDataURL(file);
  }
  return (
    <div>
      <p className="text-xs font-light mb-2 tracking-wide" style={{ color: 'rgba(255,255,255,0.42)' }}>
        Foto / comprobante de pago <span style={{ color: 'rgba(255,255,255,0.25)' }}>(opcional)</span>
      </p>
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt="comprobante" className="h-28 rounded-xl object-cover border" style={{ borderColor: 'rgba(197,160,89,0.25)' }} />
          <button onClick={() => onChange('')} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#ef4444' }}><X size={10} color="#fff" /></button>
        </div>
      ) : (
        <button onClick={() => ref.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-light border"
          style={{ borderColor: 'rgba(197,160,89,0.22)', color: 'rgba(197,160,89,0.7)', background: 'rgba(197,160,89,0.04)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(197,160,89,0.09)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(197,160,89,0.04)')}>
          <Camera size={14} />Subir comprobante
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

function SimpleEyeglassCard({ eg, idx, onUpdate, onRemove }: { eg: EyeglassItem; idx: number; onUpdate: (p: Partial<EyeglassItem>) => void; onRemove: () => void }) {
  const photoRef = useRef<HTMLInputElement | null>(null);
  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => { const c = await compressImage(ev.target?.result as string); onUpdate({ photo_url: c }); };
    reader.readAsDataURL(file);
  }
  function updateRx(field: keyof Prescription, val: string) {
    onUpdate({ prescription: { ...eg.prescription, [field]: val } });
  }
  const textInp = (value: string, onChange: (v: string) => void, placeholder: string, opts?: { type?: string; right?: boolean }) => (
    <input type={opts?.type ?? 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className={`w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border${opts?.right ? ' text-right' : ''}`}
      style={{ borderColor: 'rgba(197,160,89,0.22)' }} />
  );

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(197,160,89,0.16)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(197,160,89,0.09)' }}>
        <div className="flex items-center gap-2.5">
          <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium text-black shrink-0" style={{ background: '#C5A059' }}>{idx + 1}</span>
          <span className="text-sm font-light text-white truncate max-w-[150px]">{eg.frame_description || `Anteojo ${idx + 1}`}</span>
          {eg.price && <span className="text-xs font-light" style={{ color: '#C5A059' }}>Gs. {(parseFloat(eg.price) || 0).toLocaleString('es-PY')}</span>}
        </div>
        <button onClick={onRemove} style={{ color: 'rgba(239,68,68,0.45)' }} onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.45)')}><Trash2 size={14} /></button>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex gap-3 items-start">
          <div className="flex-1">
            <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Armazón</p>
            {textInp(eg.frame_description, v => onUpdate({ frame_description: v }), 'Código o modelo del armazón')}
          </div>
          <div className="shrink-0 mt-5">
            {eg.photo_url ? (
              <div className="relative">
                <img src={eg.photo_url} alt="armazón" className="w-16 h-12 object-cover rounded-lg border" style={{ borderColor: 'rgba(197,160,89,0.25)' }} />
                <button onClick={() => onUpdate({ photo_url: '' })} className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#ef4444' }}><X size={8} color="#fff" /></button>
              </div>
            ) : (
              <button onClick={() => photoRef.current?.click()}
                className="w-16 h-12 rounded-lg flex flex-col items-center justify-center gap-0.5 border"
                style={{ borderColor: 'rgba(197,160,89,0.22)', background: 'rgba(197,160,89,0.04)', color: 'rgba(197,160,89,0.55)' }}>
                <Camera size={14} /><span className="text-xs font-light leading-none" style={{ fontSize: 9 }}>Foto</span>
              </button>
            )}
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Cristales</p>{textInp(eg.crystals, v => onUpdate({ crystals: v }), 'monofocal, multifocal...')}</div>
          <div><p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Tratamiento</p>{textInp(eg.treatments, v => onUpdate({ treatments: v }), 'antirreflejo, filtro azul...')}</div>
        </div>
        {/* Tipo de venta */}
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-light shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>Tipo de venta:</p>
          <button
            onClick={() => onUpdate({ saleType: 'completa' })}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: (eg.saleType ?? 'completa') === 'completa' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${(eg.saleType ?? 'completa') === 'completa' ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.08)'}`,
              color: (eg.saleType ?? 'completa') === 'completa' ? '#10b981' : 'rgba(255,255,255,0.38)',
            }}>
            ✓ 1 venta completa
          </button>
          <button
            onClick={() => onUpdate({ saleType: 'media' })}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: eg.saleType === 'media' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${eg.saleType === 'media' ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.08)'}`,
              color: eg.saleType === 'media' ? '#f59e0b' : 'rgba(255,255,255,0.38)',
            }}>
            ½ media venta
          </button>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <button onClick={() => onUpdate({ showReceta: !eg.showReceta })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-light"
              style={{ color: 'rgba(197,160,89,0.7)', border: '1px solid rgba(197,160,89,0.20)' }}>
              {eg.showReceta ? <ChevronUp size={11} /> : <Plus size={11} />}
              {eg.showReceta ? 'Ocultar receta' : '+ Completar receta'}
            </button>
          </div>
          <div className="w-36">
            <p className="text-xs font-light mb-1.5 text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>Precio <span style={{ color: '#C5A059' }}>*</span></p>
            {textInp(eg.price, v => onUpdate({ price: v }), 'Gs.', { type: 'number', right: true })}
          </div>
        </div>

        {eg.showReceta && (
          <div className="rounded-xl p-3 space-y-3" style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.14)' }}>
            {/* OD — 3 columnas sin Altura */}
            <div>
              <p className="text-xs font-light mb-2" style={{ color: '#C5A059' }}>OD — Ojo Derecho</p>
              <div className="grid grid-cols-3 gap-2">
                <RxInput label="Esfera"   value={eg.prescription.od_esfera}   onChange={v => updateRx('od_esfera', v)}   placeholder="-2.00" />
                <RxInput label="Cilindro" value={eg.prescription.od_cilindro} onChange={v => updateRx('od_cilindro', v)} placeholder="-0.50" />
                <RxInput label="Eje"      value={eg.prescription.od_eje}      onChange={v => updateRx('od_eje', v)}      placeholder="180" />
              </div>
            </div>
            {/* OI — 3 columnas sin Altura */}
            <div>
              <p className="text-xs font-light mb-2" style={{ color: '#C5A059' }}>OI — Ojo Izquierdo</p>
              <div className="grid grid-cols-3 gap-2">
                <RxInput label="Esfera"   value={eg.prescription.oi_esfera}   onChange={v => updateRx('oi_esfera', v)}   placeholder="-1.75" />
                <RxInput label="Cilindro" value={eg.prescription.oi_cilindro} onChange={v => updateRx('oi_cilindro', v)} placeholder="-0.25" />
                <RxInput label="Eje"      value={eg.prescription.oi_eje}      onChange={v => updateRx('oi_eje', v)}      placeholder="175" />
              </div>
            </div>
            {/* ADD / DP / Altura / Obs */}
            <div className="grid grid-cols-4 gap-2">
              <RxInput label="ADD"    value={eg.prescription.add}       onChange={v => updateRx('add', v)}       placeholder="+2.00" />
              <RxInput label="DP"     value={eg.prescription.dp}        onChange={v => updateRx('dp', v)}        placeholder="64" />
              <RxInput label="Altura" value={eg.prescription.od_altura} onChange={v => updateRx('od_altura', v)} placeholder="20" />
              <div>
                <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Obs</p>
                <input type="text" value={eg.prescription.obs} onChange={e => updateRx('obs', e.target.value)} placeholder="Notas..."
                  className="w-full px-2.5 py-2 rounded-lg bg-transparent text-white text-xs font-light outline-none border"
                  style={{ borderColor: 'rgba(197,160,89,0.20)' }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type CloseSaleFormProps = {
  balance: number;
  closeAmt: string; setCloseAmt: (v: string) => void;
  closeMethod: PaymentMethod; setCloseMethod: (v: PaymentMethod) => void;
  closeRef: string; setCloseRef: (v: string) => void;
  closeReceipt: string; setCloseReceipt: (v: string) => void;
  closeReceiptWarn: boolean; setCloseReceiptWarn: (v: boolean) => void;
  closeDelivery: 'retiro' | 'delivery' | 'encomienda'; setCloseDelivery: (v: 'retiro' | 'delivery' | 'encomienda') => void;
  closingSale: boolean; onConfirm: () => void; onCancel: () => void;
};

const DELIVERY_OPTIONS: { id: 'retiro' | 'delivery' | 'encomienda'; label: string; icon: React.ReactNode }[] = [
  { id: 'retiro',     label: 'Retirado en local', icon: <Store size={13} /> },
  { id: 'delivery',   label: 'Delivery',          icon: <Truck size={13} /> },
  { id: 'encomienda', label: 'Encomienda',        icon: <Package size={13} /> },
];

function CloseSaleForm({ balance, closeAmt, setCloseAmt, closeMethod, setCloseMethod, closeRef, setCloseRef, closeReceipt, setCloseReceipt, closeReceiptWarn, setCloseReceiptWarn, closeDelivery, setCloseDelivery, closingSale, onConfirm, onCancel }: CloseSaleFormProps) {
  const hasPendingBalance = balance > 0;
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.22)' }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(34,197,94,0.07)', borderBottom: '1px solid rgba(34,197,94,0.15)' }}>
        <Package size={14} style={{ color: '#22c55e' }} />
        <span className="text-sm font-light tracking-wide" style={{ color: '#22c55e' }}>Entregar Lentes y Cerrar Venta</span>
      </div>
      <div className="p-4 space-y-4">
        {hasPendingBalance && (
          <div className="space-y-3 pb-3" style={{ borderBottom: '1px solid rgba(34,197,94,0.12)' }}>
            <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.38)' }}>Cobrar saldo — Gs. {fmt(balance)}</p>
            <div className="flex gap-1 flex-wrap">
              {PAY_METHODS.map(m => (
                <button key={m.id} onClick={() => setCloseMethod(m.id)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-light"
                  style={{ background: closeMethod === m.id ? `${m.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${closeMethod === m.id ? m.color + '44' : 'rgba(255,255,255,0.07)'}`, color: closeMethod === m.id ? m.color : 'rgba(255,255,255,0.38)' }}>
                  {m.icon}
                </button>
              ))}
            </div>
            <input value={closeAmt} onChange={e => setCloseAmt(e.target.value)} type="number" placeholder={`Monto recibido (Gs. ${fmt(balance)})`}
              className="w-full px-3 py-2 rounded-xl bg-transparent text-white text-xs outline-none border" style={{ borderColor: 'rgba(34,197,94,0.25)' }} />
            {(closeMethod === 'transferencia' || closeMethod === 'giro') && (
              <input value={closeRef} onChange={e => setCloseRef(e.target.value)} placeholder="Banco / referencia"
                className="w-full px-3 py-2 rounded-xl bg-transparent text-white text-xs outline-none border" style={{ borderColor: 'rgba(34,197,94,0.18)' }} />
            )}
          </div>
        )}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Receipt size={11} style={{ color: '#22c55e' }} />
            <span className="text-xs font-light" style={{ color: 'rgba(34,197,94,0.8)' }}>Comprobante de entrega</span>
            <span className="text-xs font-medium" style={{ color: '#f59e0b' }}>obligatorio</span>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${closeReceiptWarn && !closeReceipt ? 'rgba(245,158,11,0.6)' : 'rgba(34,197,94,0.18)'}` }}>
            {closeReceipt ? (
              <div className="p-2 flex items-start gap-2">
                <div className="relative inline-block shrink-0">
                  <img src={closeReceipt} alt="comprobante" className="h-20 rounded-lg object-cover" style={{ border: '1px solid rgba(34,197,94,0.3)' }} />
                  <button onClick={() => setCloseReceipt('')} className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#ef4444' }}><X size={8} color="#fff" /></button>
                </div>
                <div className="flex items-center gap-1.5 mt-1"><Check size={12} style={{ color: '#22c55e' }} /><span className="text-xs font-light" style={{ color: '#22c55e' }}>Comprobante cargado</span></div>
              </div>
            ) : (
              <label className="flex items-center gap-2 px-4 py-3 cursor-pointer" style={{ background: 'rgba(34,197,94,0.04)' }}>
                <Camera size={13} style={{ color: 'rgba(34,197,94,0.6)' }} />
                <span className="text-xs font-light" style={{ color: 'rgba(34,197,94,0.7)' }}>Subir foto del recibo / ticket de entrega</span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={async e => {
                    const file = e.target.files?.[0]; if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async ev => { const c = await compressImage(ev.target?.result as string); setCloseReceipt(c); setCloseReceiptWarn(false); };
                    reader.readAsDataURL(file);
                  }} />
              </label>
            )}
          </div>
          {closeReceiptWarn && !closeReceipt && <p className="text-xs font-light px-1" style={{ color: '#f59e0b' }}>Se requiere foto del comprobante.</p>}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.38)' }}>Tipo de entrega</p>
          <div className="flex gap-2 flex-wrap">
            {DELIVERY_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => setCloseDelivery(opt.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-light flex-1 justify-center"
                style={{ background: closeDelivery === opt.id ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${closeDelivery === opt.id ? 'rgba(34,197,94,0.45)' : 'rgba(255,255,255,0.07)'}`, color: closeDelivery === opt.id ? '#22c55e' : 'rgba(255,255,255,0.42)' }}>
                {opt.icon}{opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={() => { if (!closeReceipt) { setCloseReceiptWarn(true); return; } onConfirm(); }}
            disabled={closingSale || (hasPendingBalance && !closeAmt)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium"
            style={{ background: (closingSale || (hasPendingBalance && !closeAmt)) ? 'rgba(34,197,94,0.08)' : '#22c55e', color: (closingSale || (hasPendingBalance && !closeAmt)) ? 'rgba(34,197,94,0.4)' : '#000', cursor: (closingSale || (hasPendingBalance && !closeAmt)) ? 'not-allowed' : 'pointer' }}>
            <Check size={15} />{closingSale ? 'Guardando...' : 'Confirmar Entrega'}
          </button>
          <button onClick={onCancel} className="px-4 py-3 rounded-xl text-xs font-light" style={{ color: 'rgba(255,255,255,0.38)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function ReceiptLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.94)' }} onClick={onClose}>
      <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <Receipt size={14} style={{ color: '#C5A059' }} />
          <span className="text-sm font-light tracking-wider" style={{ color: '#C5A059' }}>Comprobante de Pago</span>
        </div>
        <img src={url} alt="comprobante" className="w-full rounded-2xl" style={{ border: '1px solid rgba(197,160,89,0.3)', maxHeight: '75vh', objectFit: 'contain' }} />
        <button onClick={onClose} className="absolute top-8 right-3 p-2 rounded-full" style={{ background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.7)' }}><X size={16} /></button>
      </div>
    </div>
  );
}

function PaymentHistory({ saleId, isLocal, isAdmin }: { saleId: string; isLocal?: boolean; isAdmin?: boolean }) {
  type PayRow = { id: string; amount: number; method: string; paid_at: string; reference: string; receipt_url?: string; branches: { name: string } | null };
  const [payments, setPayments] = useState<PayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewReceipt, setViewReceipt] = useState<string | null>(null);

  useEffect(() => {
    if (isLocal) {
      const numId = Number(saleId.replace('local-', ''));
      const rows: PayRow[] = getPayments()
        .filter((p: any) => p.saleId === numId)
        .sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
        .map((p: any) => ({
          id: String(p.id), amount: p.monto, method: p.metodo, paid_at: p.fecha,
          reference: p.tipo === 'abono' ? 'Abono' : 'Seña inicial',
          receipt_url: p.receipt_url ?? undefined,
          branches: p.sucursal ? { name: p.sucursal } : null,
        }));
      setPayments(rows); setLoading(false);
    } else {
      setPayments([]); setLoading(false);
    }
  }, [saleId, isLocal]);

  if (loading) return <div className="h-4 w-20 rounded shimmer" />;
  if (payments.length === 0) return <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.28)' }}>Sin pagos registrados</p>;

  const total = payments.reduce((s, p) => s + Number(p.amount), 0);
  return (
    <>
      {viewReceipt && <ReceiptLightbox url={viewReceipt} onClose={() => setViewReceipt(null)} />}
      <div className="space-y-1.5">
        <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.45)' }}>Historial de abonos</p>
        {payments.map((p, i) => {
          const mc = PAY_METHODS.find(m => m.id === p.method)?.color ?? '#C5A059';
          const dt = new Date(p.paid_at);
          return (
            <div key={p.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.015)' }}>
              <div className="flex items-center gap-2 px-3 py-2 text-xs font-light">
                <span className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-xs font-medium text-black" style={{ background: mc, fontSize: 9 }}>{i + 1}</span>
                <span className="px-2 py-0.5 rounded-full shrink-0" style={{ background: `${mc}18`, color: mc }}>{p.method}</span>
                <span className="text-white font-medium">Gs. {Number(p.amount).toLocaleString()}</span>
                {p.reference && <span className="truncate" style={{ color: 'rgba(255,255,255,0.38)' }}>{p.reference}</span>}
                <span className="ml-auto shrink-0" style={{ color: 'rgba(255,255,255,0.28)' }}>
                  {dt.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })}
                  {' '}<span style={{ color: 'rgba(255,255,255,0.18)' }}>{dt.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}</span>
                </span>
              </div>
              {isAdmin && (
                <div className="px-3 pb-2 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <Receipt size={9} style={{ color: 'rgba(197,160,89,0.45)', flexShrink: 0 }} />
                  <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10 }}>Comprobante:</span>
                  {p.receipt_url ? (
                    <button onClick={() => setViewReceipt(p.receipt_url!)}
                      className="relative group rounded-lg overflow-hidden shrink-0" style={{ width: 44, height: 44, border: '1px solid rgba(197,160,89,0.30)' }}>
                      <img src={p.receipt_url} alt="comprobante" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.6)' }}>
                        <ZoomIn size={12} style={{ color: '#C5A059' }} />
                      </div>
                    </button>
                  ) : (
                    <span className="text-xs font-light px-2 py-0.5 rounded-md"
                      style={{ background: p.method !== 'efectivo' ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)', color: p.method !== 'efectivo' ? 'rgba(245,158,11,0.55)' : 'rgba(255,255,255,0.2)', border: `1px solid ${p.method !== 'efectivo' ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.06)'}` }}>
                      {p.method !== 'efectivo' ? 'Sin comprobante' : 'Efectivo — sin foto'}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div className="flex justify-between pt-1.5 border-t text-xs font-light" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <span style={{ color: 'rgba(255,255,255,0.35)' }}>Total abonado</span>
          <span style={{ color: '#10b981' }}>Gs. {total.toLocaleString()}</span>
        </div>
      </div>
    </>
  );
}
