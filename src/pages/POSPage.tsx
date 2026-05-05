import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, X, Save, ChevronDown, ChevronUp, Glasses, Banknote, CreditCard, Smartphone, QrCode, Send, MapPin, Truck, Store, Package, User, FileText, Check, CheckCircle, AlertCircle, Trash2, ShoppingBag, Hash, Clock, Building2, Camera, Receipt, ZoomIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { saveSale as saveToStorage, getSales, getPayments, updateSaleBalance, recordPayment, closeSaleLocal, compressImage } from '../lib/salesStorage';
import { supabase } from '../lib/supabase';

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
  saleType: 'completa' | 'media';
  stock_frame_id?: string; // ID del armazón del stock si fue seleccionado
};

type PaymentEntry = {
  _id: string;
  method: PaymentMethod;
  amount: string;
  reference: string;
};

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

function newEyeglass(): EyeglassItem {
  return { _id: uid(), frame_description: '', photo_url: '', crystals: '', treatments: '', showReceta: false, prescription: emptyRx(), price: '', saleType: 'completa', stock_frame_id: undefined };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-light mb-1.5 tracking-wide" style={{ color: 'rgba(255,255,255,0.42)' }}>{children}</p>;
}

function GoldInput({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border"
      style={{ borderColor: 'rgba(197,160,89,0.22)' }} />
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
  const [paidToast, setPaidToast] = useState('');
  const [saved,     setSaved]     = useState('');
  const [saveErr,   setSaveErr]   = useState('');

  const [addPayFor,   setAddPayFor]   = useState<string | null>(null);
  const [xPayAmt,     setXPayAmt]     = useState('');
  const [xPayMethod,  setXPayMethod]  = useState<PaymentMethod>('efectivo');
  const [xPayBranch,  setXPayBranch]  = useState('');
  const [xPayRef,     setXPayRef]     = useState('');
  const [xPayReceipt, setXPayReceipt] = useState('');
  const [xPayWarn,    setXPayWarn]    = useState(false);

  type DeliveryMode = 'retiro' | 'delivery' | 'encomienda';
  const [closeFor,         setCloseFor]         = useState<string | null>(null);
  const [closeMethod,      setCloseMethod]      = useState<PaymentMethod>('efectivo');
  const [closeAmt,         setCloseAmt]         = useState('');
  const [closeRef,         setCloseRef]         = useState('');
  const [closeReceipt,     setCloseReceipt]     = useState('');
  const [closeReceiptWarn, setCloseReceiptWarn] = useState(false);
  const [closeDelivery,    setCloseDelivery]    = useState<DeliveryMode>('retiro');
  const [closingSale,      setClosingSale]      = useState(false);

  const [saleTotal,   setSaleTotal]   = useState('');
  const [saleDeposit, setSaleDeposit] = useState('');
  const totalNum   = parseFloat(saleTotal)   || 0;
  const depositNum = parseFloat(saleDeposit) || 0;
  const balanceNum = Math.max(0, totalNum - depositNum);

  useEffect(() => {
    if (profile?.branch_id) {
      const bid = profile.branch_id.toLowerCase().replace(/ /g, '_').replace(/é/g, 'e').replace(/á/g, 'a');
      setSaleBranch(bid); setDelBranch(bid); setPayBranch(bid);
    }
  }, [profile?.branch_id]);

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
      const sellerName     = profile?.full_name ?? 'Sin nombre';
      const saleId         = Date.now();
      const saleNum        = `VTA-${saleId}`;
      const primaryMethod  = payments[0].method;
      const saleBranchName = FIXED_BRANCHES.find(b => b.id === saleBranch)?.name ?? saleBranch;
      const delBranchName  = FIXED_BRANCHES.find(b => b.id === delBranch)?.name  ?? delBranch;
      const payBranchName  = FIXED_BRANCHES.find(b => b.id === payBranch)?.name  ?? payBranch;

      await saveToStorage({
        id: saleId,
        fecha: new Date().toISOString(),
        cliente: { nombre: nFirst.trim(), apellido: nLast.trim(), telefono: nPhone.trim(), ci: nCi.trim() },
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

      // ── Descontar stock y registrar movimiento ──
      for (const eg of eyeglasses) {
        if (eg.stock_frame_id) {
          // Buscar el armazón y descontar según la sede de venta
          const { data: frame } = await supabase
            .from('armazones')
            .select('*')
            .eq('id', eg.stock_frame_id)
            .single();

          if (frame) {
            // Determinar qué columna de stock descontar según la sede
            const sedeKey = (() => {
              const n = saleBranchName.toLowerCase().replace(/á/g,'a').replace(/é/g,'e').replace(/ú/g,'u');
              if (n.includes('azara'))    return 'stock_azara';
              if (n.includes('fernando')) return 'stock_fernando';
              if (n.includes('caacupe') || n.includes('caacupé')) return 'stock_caacupe';
              if (n.includes('fina'))     return 'stock_la_fina';
              return 'stock_azara';
            })();
            const current = frame[sedeKey] || 0;
            await supabase
              .from('armazones')
              .update({ [sedeKey]: Math.max(0, current - 1), updated_at: new Date().toISOString() })
              .eq('id', eg.stock_frame_id);

            // Registrar movimiento en historial
            await supabase.from('stock_movimientos').insert([{
              armazon_id:     eg.stock_frame_id,
              armazon_nombre: frame.nombre,
              armazon_codigo: frame.codigo,
              cantidad:       1,
              tipo:           'venta',
              sucursal:       saleBranchName,
              vendedora:      sellerName,
              venta_id:       String(saleId),
            }]);
          }
        }
      }

      setSaved(`Venta ${saleNum} guardada con éxito.`);
      resetForm();
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

  async function registerXPay(saleId: string) {
    const amt = parseFloat(xPayAmt);
    if (!amt || amt <= 0) return;
    if (saleId.startsWith('local-')) {
      const numId = Number(saleId.replace('local-', ''));
      const localSale = getSales().find(s => s.id === numId);
      if (localSale) {
        const newDeposit = localSale.sena + amt;
        const newBalance = Math.max(0, localSale.total - newDeposit);
        await updateSaleBalance(numId, newBalance, newDeposit);
        await recordPayment({
          id: Date.now(), saleId: numId, fecha: new Date().toISOString(),
          monto: amt, metodo: xPayMethod,
          sucursal: (FIXED_BRANCHES.find(b => b.id === xPayBranch)?.name ?? xPayBranch) || FIXED_BRANCHES[0].name,
          vendedora: profile?.full_name ?? '',
          cliente: `${localSale.cliente.nombre} ${localSale.cliente.apellido}`.trim(),
          tipo: 'abono', receipt_url: xPayReceipt || undefined,
        });
        if (newBalance <= 0) {
          setPaidToast(`Venta saldada · ${localSale.cliente.nombre} ${localSale.cliente.apellido} — Saldo en 0`);
          setTimeout(() => setPaidToast(''), 6000);
        }
      }
    }
    setAddPayFor(null); setXPayAmt(''); setXPayRef(''); setXPayReceipt(''); setXPayWarn(false);
  }

  async function closeSale(saleId: string, balance: number) {
    const finalAmt = balance > 0 ? parseFloat(closeAmt) || 0 : 0;
    setClosingSale(true);
    if (saleId.startsWith('local-')) {
      const numId = Number(saleId.replace('local-', ''));
      const localSale = getSales().find(s => s.id === numId);
      if (localSale) {
        if (finalAmt > 0) {
          await recordPayment({
            id: Date.now(), saleId: numId, fecha: new Date().toISOString(),
            monto: finalAmt, metodo: closeMethod,
            sucursal: FIXED_BRANCHES[0].name,
            vendedora: profile?.full_name ?? '',
            cliente: `${localSale.cliente.nombre} ${localSale.cliente.apellido}`.trim(),
            tipo: 'abono', receipt_url: closeReceipt || undefined,
          });
        }
        await closeSaleLocal(numId, closeDelivery);
      }
    }
    setCloseFor(null); setCloseAmt(''); setCloseRef('');
    setCloseReceipt(''); setCloseReceiptWarn(false); setCloseDelivery('retiro');
    setClosingSale(false);
  }

  const branchOpts = [
    <option key="" value="" style={{ background: '#0a0908' }}>— Seleccionar —</option>,
    ...FIXED_BRANCHES.map(b => <option key={b.id} value={b.id} style={{ background: '#0a0908' }}>{b.name}</option>),
  ];

  return (
    <div className="min-h-screen">
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
              style={{ color: 'rgba(239,68,68,0.65)', border: '1px solid rgba(239,68,68,0.2)' }}>
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
            <div><FieldLabel>Teléfono / WhatsApp</FieldLabel><GoldInput value={nPhone} onChange={setNPhone} placeholder="0981-000000" /></div>
            <div><FieldLabel>C.I.</FieldLabel><GoldInput value={nCi} onChange={setNCi} placeholder="Número de cédula" /></div>
          </div>
        </Section>

        {/* Sucursales */}
        <Section title="Sucursales" icon={<Building2 size={15} />}>
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.20)' }}>
              <User size={13} style={{ color: '#C5A059', flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>Vendedora</p>
                <p className="text-sm text-white font-light truncate">{profile?.full_name ?? '—'}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><FieldLabel>Sucursal de venta *</FieldLabel><GoldSelect value={saleBranch} onChange={setSaleBranch}>{branchOpts}</GoldSelect></div>
              <div><FieldLabel>Sucursal de entrega *</FieldLabel><GoldSelect value={delBranch} onChange={setDelBranch}>{branchOpts}</GoldSelect></div>
              <div><FieldLabel>Sucursal de cobro *</FieldLabel><GoldSelect value={payBranch} onChange={setPayBranch}>{branchOpts}</GoldSelect></div>
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
                  { v: 'retiro' as const,     l: 'Retiro en sucursal', ic: <Store size={12} /> },
                  { v: 'delivery' as const,   l: 'Delivery',           ic: <MapPin size={12} /> },
                  { v: 'encomienda' as const, l: 'Encomienda',         ic: <Package size={12} /> },
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
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-light border-dashed border"
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
                <FieldLabel>Total venta *</FieldLabel>
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
                  { label: 'TOTAL',       value: fmt(totalNum),   color: '#C5A059' },
                  { label: 'ENTREGADO',   value: fmt(depositNum), color: '#10b981' },
                  { label: 'SALDO PEND.', value: fmt(balanceNum), color: balanceNum > 0 ? '#f59e0b' : '#6b7280' },
                ].map(item => (
                  <div key={item.label} className="flex flex-col items-center py-4 px-3">
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
                  {status === k && <Check size={12} />}{v.label}
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
          <button onClick={() => onChange('')} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#ef4444' }}>
            <X size={10} color="#fff" />
          </button>
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
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searching, setSearching]     = useState(false);
  const [stockFrame, setStockFrame]   = useState<any | null>(null);

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => { const c = await compressImage(ev.target?.result as string); onUpdate({ photo_url: c }); };
    reader.readAsDataURL(file);
  }

  async function handleFrameInput(val: string) {
    onUpdate({ frame_description: val, stock_frame_id: undefined });
    setStockFrame(null);
    if (val.trim().length < 2) { setSuggestions([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from('armazones')
      .select('id, codigo, nombre, foto_url, precio, stock_azara, stock_fernando, stock_caacupe, stock_la_fina')
      .or(`codigo.ilike.%${val.trim()}%,nombre.ilike.%${val.trim()}%`)
      .limit(5);
    setSuggestions(data || []);
    setSearching(false);
  }

  function selectFrame(frame: any) {
    onUpdate({ frame_description: frame.codigo, photo_url: frame.foto_url || '', stock_frame_id: frame.id });
    setStockFrame(frame);
    setSuggestions([]);
  }

  function updateRx(field: keyof Prescription, val: string) {
    onUpdate({ prescription: { ...eg.prescription, [field]: val } });
  }

  const totalStockFrame = stockFrame
    ? (stockFrame.stock_azara || 0) + (stockFrame.stock_fernando || 0) + (stockFrame.stock_caacupe || 0) + (stockFrame.stock_la_fina || 0)
    : 0;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(197,160,89,0.16)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(197,160,89,0.09)' }}>
        <div className="flex items-center gap-2.5">
          <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium text-black shrink-0" style={{ background: '#C5A059' }}>{idx + 1}</span>
          <span className="text-sm font-light text-white truncate max-w-[150px]">{eg.frame_description || `Anteojo ${idx + 1}`}</span>
        </div>
        <button onClick={onRemove} style={{ color: 'rgba(239,68,68,0.45)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.45)')}>
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-4 space-y-3">

        {/* Campo armazón con buscador */}
        <div>
          <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Armazón</p>
          <div className="flex gap-3 items-start">
            <div className="flex-1 relative">
              <input
                type="text"
                value={eg.frame_description}
                onChange={e => handleFrameInput(e.target.value)}
                placeholder="Código del stock o descripción libre"
                className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border"
                style={{ borderColor: eg.stock_frame_id ? 'rgba(34,197,94,0.4)' : 'rgba(197,160,89,0.22)' }}
              />
              {searching && (
                <p className="text-xs mt-1 px-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Buscando...</p>
              )}
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-50"
                  style={{ background: '#0d0d0d', border: '1px solid rgba(197,160,89,0.25)', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                  {suggestions.map(s => {
                    const tot = (s.stock_azara||0)+(s.stock_fernando||0)+(s.stock_caacupe||0)+(s.stock_la_fina||0);
                    return (
                      <button key={s.id} onClick={() => selectFrame(s)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(197,160,89,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {s.foto_url ? (
                          <img src={s.foto_url} alt={s.nombre} className="w-10 h-8 rounded object-cover shrink-0" style={{ border: '1px solid rgba(197,160,89,0.2)' }} />
                        ) : (
                          <div className="w-10 h-8 rounded shrink-0 flex items-center justify-center" style={{ background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.12)' }}>
                            <Glasses size={12} style={{ color: 'rgba(197,160,89,0.4)' }} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white font-light truncate">{s.nombre}</p>
                          <p className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.6)' }}>
                            #{s.codigo} · Stock total: {tot} uds.
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Foto */}
            <div className="shrink-0">
              {eg.photo_url ? (
                <div className="relative">
                  <img src={eg.photo_url} alt="armazón" className="w-16 h-12 object-cover rounded-lg border" style={{ borderColor: 'rgba(197,160,89,0.25)' }} />
                  <button onClick={() => { onUpdate({ photo_url: '', stock_frame_id: undefined }); setStockFrame(null); }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#ef4444' }}>
                    <X size={8} color="#fff" />
                  </button>
                </div>
              ) : (
                <button onClick={() => photoRef.current?.click()}
                  className="w-16 h-12 rounded-lg flex flex-col items-center justify-center gap-0.5 border"
                  style={{ borderColor: 'rgba(197,160,89,0.22)', background: 'rgba(197,160,89,0.04)', color: 'rgba(197,160,89,0.55)' }}>
                  <Camera size={14} /><span style={{ fontSize: 9 }}>Foto</span>
                </button>
              )}
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </div>
          </div>

          {/* Armazón del stock seleccionado */}
          {eg.stock_frame_id && stockFrame && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.22)' }}>
              <Check size={12} style={{ color: '#22c55e', flexShrink: 0 }} />
              <span className="text-xs font-light" style={{ color: '#22c55e' }}>
                {stockFrame.nombre} · Stock disponible: {totalStockFrame} uds. · Se descontará 1 al guardar
              </span>
            </div>
          )}

          {/* Armazón propio del cliente */}
          {!eg.stock_frame_id && eg.frame_description.trim() && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.15)' }}>
              <span className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.6)' }}>
                Armazón propio del cliente — no descuenta stock
              </span>
            </div>
          )}
        </div>

        {/* Cristales y Tratamiento */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Cristales</p>
            <input type="text" value={eg.crystals} onChange={e => onUpdate({ crystals: e.target.value })} placeholder="monofocal, multifocal..."
              className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border"
              style={{ borderColor: 'rgba(197,160,89,0.22)' }} />
          </div>
          <div>
            <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Tratamiento</p>
            <input type="text" value={eg.treatments} onChange={e => onUpdate({ treatments: e.target.value })} placeholder="antirreflejo, filtro azul..."
              className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border"
              style={{ borderColor: 'rgba(197,160,89,0.22)' }} />
          </div>
        </div>

        {/* Tipo de venta */}
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-light shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>Tipo de venta:</p>
          <button onClick={() => onUpdate({ saleType: 'completa' })}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: (eg.saleType ?? 'completa') === 'completa' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${(eg.saleType ?? 'completa') === 'completa' ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.08)'}`, color: (eg.saleType ?? 'completa') === 'completa' ? '#10b981' : 'rgba(255,255,255,0.38)' }}>
            ✓ 1 venta completa
          </button>
          <button onClick={() => onUpdate({ saleType: 'media' })}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: eg.saleType === 'media' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${eg.saleType === 'media' ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.08)'}`, color: eg.saleType === 'media' ? '#f59e0b' : 'rgba(255,255,255,0.38)' }}>
            ½ media venta
          </button>
        </div>

        {/* Receta */}
        <button onClick={() => onUpdate({ showReceta: !eg.showReceta })}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-light"
          style={{ color: 'rgba(197,160,89,0.7)', border: '1px solid rgba(197,160,89,0.20)' }}>
          {eg.showReceta ? <ChevronUp size={11} /> : <Plus size={11} />}
          {eg.showReceta ? 'Ocultar receta' : '+ Completar receta'}
        </button>

        {eg.showReceta && (
          <div className="rounded-xl p-3 space-y-3" style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.14)' }}>
            <div>
              <p className="text-xs font-light mb-2" style={{ color: '#C5A059' }}>OD — Ojo Derecho</p>
              <div className="grid grid-cols-3 gap-2">
                <RxInput label="Esfera"   value={eg.prescription.od_esfera}   onChange={v => updateRx('od_esfera', v)}   placeholder="-2.00" />
                <RxInput label="Cilindro" value={eg.prescription.od_cilindro} onChange={v => updateRx('od_cilindro', v)} placeholder="-0.50" />
                <RxInput label="Eje"      value={eg.prescription.od_eje}      onChange={v => updateRx('od_eje', v)}      placeholder="180" />
              </div>
            </div>
            <div>
              <p className="text-xs font-light mb-2" style={{ color: '#C5A059' }}>OI — Ojo Izquierdo</p>
              <div className="grid grid-cols-3 gap-2">
                <RxInput label="Esfera"   value={eg.prescription.oi_esfera}   onChange={v => updateRx('oi_esfera', v)}   placeholder="-1.75" />
                <RxInput label="Cilindro" value={eg.prescription.oi_cilindro} onChange={v => updateRx('oi_cilindro', v)} placeholder="-0.25" />
                <RxInput label="Eje"      value={eg.prescription.oi_eje}      onChange={v => updateRx('oi_eje', v)}      placeholder="175" />
              </div>
            </div>
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

const DELIVERY_OPTIONS: { id: 'retiro' | 'delivery' | 'encomienda'; label: string; icon: React.ReactNode }[] = [
  { id: 'retiro',     label: 'Retirado en local', icon: <Store size={13} /> },
  { id: 'delivery',   label: 'Delivery',          icon: <Truck size={13} /> },
  { id: 'encomienda', label: 'Encomienda',        icon: <Package size={13} /> },
];

function ReceiptLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.94)' }} onClick={onClose}>
      <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <Receipt size={14} style={{ color: '#C5A059' }} />
          <span className="text-sm font-light tracking-wider" style={{ color: '#C5A059' }}>Comprobante de Pago</span>
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

function PaymentHistory({ saleId, isLocal, isAdmin }: { saleId: string; isLocal?: boolean; isAdmin?: boolean }) {
  type PayRow = { id: string; amount: number; method: string; paid_at: string; reference: string; receipt_url?: string; branches: { name: string } | null };
  const [payments, setPayments] = useState<PayRow[]>([]);
  const [loading, setLoading]   = useState(true);
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

  if (loading) return <div className="h-4 w-20 rounded" />;
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
                <span className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center font-medium text-black" style={{ background: mc, fontSize: 9 }}>{i + 1}</span>
                <span className="px-2 py-0.5 rounded-full shrink-0" style={{ background: `${mc}18`, color: mc }}>{p.method}</span>
                <span className="text-white font-medium">Gs. {Number(p.amount).toLocaleString()}</span>
                {p.reference && <span className="truncate" style={{ color: 'rgba(255,255,255,0.38)' }}>{p.reference}</span>}
                <span className="ml-auto shrink-0" style={{ color: 'rgba(255,255,255,0.28)' }}>
                  {dt.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })}
                  {' '}<span style={{ color: 'rgba(255,255,255,0.18)' }}>{dt.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}</span>
                </span>
              </div>
              {isAdmin && p.receipt_url && (
                <div className="px-3 pb-2 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <Receipt size={9} style={{ color: 'rgba(197,160,89,0.45)', flexShrink: 0 }} />
                  <button onClick={() => setViewReceipt(p.receipt_url!)}
                    className="relative group rounded-lg overflow-hidden shrink-0" style={{ width: 44, height: 44, border: '1px solid rgba(197,160,89,0.30)' }}>
                    <img src={p.receipt_url} alt="comprobante" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.6)' }}>
                      <ZoomIn size={12} style={{ color: '#C5A059' }} />
                    </div>
                  </button>
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
