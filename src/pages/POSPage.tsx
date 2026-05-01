import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, X, Save, ChevronDown, ChevronUp, Glasses, Banknote, CreditCard, Smartphone, QrCode, Send, MapPin, Truck, Store, Package, User, FileText, Check, AlertCircle, Trash2, ShoppingBag, Hash, Clock, Building2, Camera, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { saveSale as saveToStorage } from '../lib/salesStorage';

// ── Types ──────────────────────────────────────────────────────────────────────
type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'qr' | 'giro';
type SaleStatus = 'pendiente' | 'en_laboratorio' | 'listo' | 'entregado' | 'cancelado';
type DeliveryType = 'retiro' | 'delivery' | 'encomienda';
type Channel = 'local' | 'online';

type Seller = { id: string; full_name: string };

type Prescription = {
  od_esfera: string; od_cilindro: string; od_eje: string;
  oi_esfera: string; oi_cilindro: string; oi_eje: string;
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
  customers: { full_name: string; ci: string } | null;
  branches: { name: string } | null;
};

// ── Fixed branches (UUIDs match the branches table) ────────────────────────────
const FIXED_BRANCHES = [
  { id: '9b7288f2-b57f-4ccf-972a-4bc1e0af2fe7', name: 'Azara' },
  { id: '2da32f67-fb1d-457d-aad6-4f84ce684182', name: 'Fernando' },
  { id: '1fc790cc-642b-48d5-aa75-ec69c194d74c', name: 'Caacupé' },
  { id: '4d0d60c2-f28d-4566-abb5-046453685b7f', name: 'La Fina' },
];

// Fallback sellers used when profiles table has no matching rows
const FALLBACK_SELLERS: Seller[] = [
  { id: '__v1', full_name: 'Vendedora 1' },
  { id: '__v2', full_name: 'Vendedora 2' },
  { id: '__admin', full_name: 'Administradora' },
];

// ── Constants ──────────────────────────────────────────────────────────────────
const PAY_METHODS: { id: PaymentMethod; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'efectivo',      label: 'Efectivo',    icon: <Banknote   size={13} />, color: '#22c55e' },
  { id: 'transferencia', label: 'Transfer.',   icon: <Smartphone size={13} />, color: '#3b82f6' },
  { id: 'tarjeta',       label: 'POS',         icon: <CreditCard size={13} />, color: '#f59e0b' },
  { id: 'qr',            label: 'QR',          icon: <QrCode     size={13} />, color: '#C5A059' },
  { id: 'giro',          label: 'Giro',        icon: <Send       size={13} />, color: '#a78bfa' },
];

const STATUS_CFG: Record<SaleStatus, { label: string; color: string }> = {
  pendiente:      { label: 'Pendiente',      color: '#f59e0b' },
  en_laboratorio: { label: 'En Laboratorio', color: '#3b82f6' },
  listo:          { label: 'Listo',          color: '#10b981' },
  entregado:      { label: 'Entregado',      color: '#6b7280' },
  cancelado:      { label: 'Cancelado',      color: '#ef4444' },
};

function uid() { return crypto.randomUUID(); }
function fmt(n: number) { return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

function emptyRx(): Prescription {
  return { od_esfera: '', od_cilindro: '', od_eje: '', oi_esfera: '', oi_cilindro: '', oi_eje: '', add: '', dp: '', obs: '' };
}

function rxToText(rx: Prescription): string {
  const od = `OD: ${rx.od_esfera || '—'} / ${rx.od_cilindro || '—'} x ${rx.od_eje || '—'}`;
  const oi = `OI: ${rx.oi_esfera || '—'} / ${rx.oi_cilindro || '—'} x ${rx.oi_eje || '—'}`;
  const extras = [rx.add && `ADD ${rx.add}`, rx.dp && `DP ${rx.dp}`, rx.obs].filter(Boolean).join(' | ');
  return [od, oi, extras].filter(Boolean).join(' | ');
}

function newEyeglass(): EyeglassItem {
  return {
    _id: uid(), frame_description: '', photo_url: '',
    crystals: '', treatments: '', showReceta: false,
    prescription: emptyRx(), price: '',
  };
}

// ── Tiny shared components ─────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-light mb-1.5 tracking-wide" style={{ color: 'rgba(255,255,255,0.42)' }}>
      {children}
    </p>
  );
}

function GoldInput({ value, onChange, placeholder, type = 'text', mono = false }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; mono?: boolean;
}) {
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border"
      style={{ borderColor: 'rgba(197,160,89,0.22)', fontFamily: mono ? 'monospace' : undefined }}
    />
  );
}

function GoldSelect({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2.5 rounded-xl text-sm font-light outline-none border"
      style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(197,160,89,0.22)', color: 'rgba(255,255,255,0.75)' }}>
      {children}
    </select>
  );
}

function Section({ title, icon, children, accent }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{
        background: accent ? 'rgba(197,160,89,0.04)' : 'rgba(255,255,255,0.018)',
        border: `1px solid ${accent ? 'rgba(197,160,89,0.22)' : 'rgba(197,160,89,0.12)'}`,
      }}>
      <div className="flex items-center gap-3 px-5 py-3.5"
        style={{ borderBottom: '1px solid rgba(197,160,89,0.09)' }}>
        <span style={{ color: '#C5A059' }}>{icon}</span>
        <span className="text-sm font-light tracking-wide text-white">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Main POS Component ─────────────────────────────────────────────────────────
export default function POSPage() {
  const { profile } = useAuth();

  // Sale meta
  const [saleNumber]  = useState(`VTA-${Date.now().toString().slice(-8)}`);
  const today         = new Date().toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Customer
  const [nFirst,  setNFirst]  = useState('');
  const [nLast,   setNLast]   = useState('');
  const [nCi,     setNCi]     = useState('');
  const [nPhone,  setNPhone]  = useState('');

  // Branches / Seller
  const [saleBranch,  setSaleBranch]  = useState('');
  const [delBranch,   setDelBranch]   = useState('');
  const [payBranch,   setPayBranch]   = useState('');
  const [sellerId,    setSellerId]    = useState('');
  const [sellers,     setSellers]     = useState<Seller[]>(FALLBACK_SELLERS);

  // Channel / Delivery
  const [channel,     setChannel]     = useState<Channel>('local');
  const [delType,     setDelType]     = useState<DeliveryType>('retiro');
  const [delAddress,  setDelAddress]  = useState('');
  const [delRef,      setDelRef]      = useState('');
  const [delPhone,    setDelPhone]    = useState('');
  const [shipCo,      setShipCo]      = useState('');
  const [shipCity,    setShipCity]    = useState('');
  const [shipRec,     setShipRec]     = useState('');
  const [shipPhone,   setShipPhone]   = useState('');
  const [shipTrack,   setShipTrack]   = useState('');

  // Eyeglasses
  const [eyeglasses, setEyeglasses] = useState<EyeglassItem[]>([]);

  // Payments
  const [payments,    setPayments]    = useState<PaymentEntry[]>([
    { _id: uid(), method: 'efectivo', amount: '', reference: '' },
  ]);
  const [paymentReceipt, setPaymentReceipt] = useState('');

  // Status / Notes
  const [status,      setStatus]      = useState<SaleStatus>('pendiente');
  const [notes,       setNotes]       = useState('');

  // Save
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState('');
  const [saveErr,     setSaveErr]     = useState('');

  // Sales list (right panel)
  const [sales,       setSales]       = useState<RecentSale[]>([]);
  const [loadingSales,setLoadingSales]= useState(true);
  const [sfFilter,    setSfFilter]    = useState<SaleStatus | 'todos'>('todos');
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [listSearch,  setListSearch]  = useState('');

  // Add payment for existing sale
  const [addPayFor,   setAddPayFor]   = useState<string | null>(null);
  const [xPayAmt,     setXPayAmt]     = useState('');
  const [xPayMethod,  setXPayMethod]  = useState<PaymentMethod>('efectivo');
  const [xPayBranch,  setXPayBranch]  = useState('');
  const [xPayRef,     setXPayRef]     = useState('');
  const [updStatus,   setUpdStatus]   = useState<string | null>(null);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    loadSellers();
    loadSales();
  }, []);

  async function loadSellers() {
    const { data } = await supabase.from('profiles').select('id, full_name').order('full_name');
    const dbSellers = (data ?? []) as Seller[];
    setSellers(dbSellers.length > 0 ? dbSellers : FALLBACK_SELLERS);
  }

  const loadSales = useCallback(async () => {
    setLoadingSales(true);
    const { data } = await supabase
      .from('sales')
      .select('id,sale_number,created_at,total,deposit,balance,status,seller_name,customer_first_name,customer_last_name,customers(full_name,ci),branches(name)')
      .order('created_at', { ascending: false })
      .limit(80);
    setSales((data ?? []) as RecentSale[]);
    setLoadingSales(false);
  }, []);


  // ── Eyeglass helpers ───────────────────────────────────────────────────────
  function addEyeglass() { setEyeglasses(prev => [...prev, newEyeglass()]); }
  function removeEyeglass(id: string) { setEyeglasses(prev => prev.filter(eg => eg._id !== id)); }
  function updateEg(id: string, patch: Partial<EyeglassItem>) {
    setEyeglasses(prev => prev.map(eg => eg._id === id ? { ...eg, ...patch } : eg));
  }

  // ── Payment helpers ────────────────────────────────────────────────────────
  function updatePay(id: string, k: keyof PaymentEntry, v: string) {
    setPayments(prev => prev.map(p => p._id === id ? { ...p, [k]: v } : p));
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  const [saleTotal,   setSaleTotal]   = useState('');
  const [saleDeposit, setSaleDeposit] = useState('');
  const totalNum   = parseFloat(saleTotal)   || 0;
  const depositNum = parseFloat(saleDeposit) || 0;
  const balanceNum = Math.max(0, totalNum - depositNum);

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSaveSale() {
    setSaveErr('');

    // ── Validation ──────────────────────────────────────────────────────────
    if (!nFirst.trim()) { setSaveErr('El campo Nombre es obligatorio.');     return; }
    if (!nLast.trim())  { setSaveErr('El campo Apellido es obligatorio.');   return; }
    if (!totalNum)      { setSaveErr('El campo Total venta es obligatorio.'); return; }
    if (!saleBranch)    { setSaveErr('Seleccioná la Sucursal de venta.');    return; }
    if (!delBranch)     { setSaveErr('Seleccioná la Sucursal de entrega.');  return; }
    if (!payBranch)     { setSaveErr('Seleccioná la Sucursal de cobro.');    return; }
    if (!sellerId)      { setSaveErr('Seleccioná la Vendedora.');            return; }

    setSaving(true);

    const sellerObj  = sellers.find(s => s.id === sellerId);
    const sellerName = sellerObj?.full_name ?? '';
    const sellerUuid = (sellerId && !sellerId.startsWith('__')) ? sellerId : (profile?.id ?? null);
    const saleId     = Date.now();
    const saleNum    = `VTA-${saleId}`;
    const firstName  = nFirst.trim();
    const lastName   = nLast.trim();
    const phone      = nPhone.trim();
    const ci         = nCi.trim();
    const primaryMethod = payments.find(p => parseFloat(p.amount) > 0)?.method ?? 'efectivo';
    const deliveredAt   = status === 'entregado' ? new Date().toISOString().split('T')[0] : null;

    // ── Step 1: Save to localStorage immediately (guaranteed, no network) ──
    const nuevaVenta = {
      id: saleId,
      fecha: new Date().toISOString(),
      cliente: { nombre: firstName, apellido: lastName, telefono: phone, ci },
      sucursalVenta: saleBranch,
      sucursalEntrega: delBranch,
      sucursalCobro: payBranch,
      vendedora: sellerName,
      total: totalNum,
      sena: depositNum,
      saldo: balanceNum,
      metodoPago: primaryMethod,
      estadoTrabajo: status,
      anteojos: eyeglasses,
      observaciones: notes,
    };
    saveToStorage(nuevaVenta as any);

    // ── Step 2: Show success immediately after localStorage write ──────────
    setSaved(`Venta ${saleNum} guardada con éxito.`);
    resetForm();
    loadSales();
    setSaving(false);
    setTimeout(() => setSaved(''), 6000);

    // ── Step 3: Persist to Supabase in background (best-effort) ───────────
    let resolvedCustomerId: string | null = null;
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Cliente';

    if (firstName || lastName) {
      // Try phone lookup first to avoid duplicates
      if (phone) {
        const { data: ex } = await supabase.from('customers').select('id')
          .or(`phone.eq.${phone},whatsapp.eq.${phone}`).maybeSingle();
        resolvedCustomerId = ex?.id ?? null;
      }
      // Try CI lookup if still not found
      if (!resolvedCustomerId && ci) {
        const { data: ex2 } = await supabase.from('customers').select('id')
          .eq('ci', ci).maybeSingle();
        resolvedCustomerId = ex2?.id ?? null;
      }
      if (resolvedCustomerId) {
        await supabase.from('customers').update({
          full_name: fullName,
          ...(phone && { phone, whatsapp: phone }),
          ...(ci && { ci }),
        }).eq('id', resolvedCustomerId);
      } else {
        const { data: newCx } = await supabase.from('customers').insert([{
          full_name: fullName,
          phone: phone || null,
          whatsapp: phone || null,
          ci: ci || null,
          branch_id: saleBranch || null,
        }]).select('id').maybeSingle();
        resolvedCustomerId = newCx?.id ?? null;
      }
    }

    const { data: sd, error: se } = await supabase.from('sales').insert([{
      sale_number: saleNum,
      customer_id: resolvedCustomerId,
      branch_id: saleBranch,
      delivery_branch_id: delBranch,
      payment_branch_id: payBranch,
      seller_id: sellerUuid,
      seller_name: sellerName,
      customer_first_name: firstName,
      customer_last_name: lastName,
      total: totalNum,
      deposit: depositNum,
      balance: balanceNum,
      status,
      payment_method: primaryMethod,
      sale_channel: channel,
      delivery_type: delType,
      delivery_address: delAddress || null,
      delivery_reference: delRef || null,
      delivery_phone: delPhone || null,
      shipping_company: shipCo || null,
      shipping_city: shipCity || null,
      shipping_recipient: shipRec || null,
      shipping_phone: shipPhone || null,
      shipping_tracking: shipTrack || null,
      notes: notes || null,
      delivered_at: deliveredAt,
    }]).select('id').maybeSingle();

    if (se) {
      console.error('Supabase sales insert error:', se.message, se.details, se.hint);
      return;
    }
    if (!sd) return;

    const sid = sd.id;

    eyeglasses.forEach((eg, i) => {
      supabase.from('sale_eyeglasses').insert([{
        sale_id: sid, frame_id: null,
        frame_description: eg.frame_description || null,
        crystals: eg.crystals || null, treatments: eg.treatments || null,
        prescription_text: eg.showReceta ? rxToText(eg.prescription) : null,
        photo_url: eg.photo_url || null, price: parseFloat(eg.price) || 0, sort_order: i,
      }]).then(({ error: e }) => { if (e) console.error('sale_eyeglasses:', e.message); });
    });

    const payAmt = depositNum > 0 ? depositNum : totalNum;
    supabase.from('sale_payments').insert([{
      sale_id: sid, amount: payAmt, method: payments[0].method, branch_id: payBranch,
      reference: [payments[0].reference, paymentReceipt ? '[comprobante]' : ''].filter(Boolean).join(' | ') || null,
      registered_by: sellerUuid,
    }]).then(({ error: e }) => { if (e) console.error('sale_payments:', e.message); });

    if (sellerUuid) {
      supabase.from('seller_points').insert([{
        seller_id: sellerUuid, sale_id: sid, points: 1.0, point_type: 'completa',
        sale_month: new Date().toISOString().slice(0, 7), branch_id: saleBranch,
      }]).then(({ error: e }) => { if (e) console.error('seller_points:', e.message); });
    }

    if (resolvedCustomerId) {
      const d6 = new Date(); d6.setMonth(d6.getMonth() + 6);
      const d12 = new Date(); d12.setMonth(d12.getMonth() + 12);
      supabase.from('reminders').insert([
        { customer_id: resolvedCustomerId, sale_id: sid, reminder_type: '6_meses', scheduled_date: d6.toISOString().split('T')[0] },
        { customer_id: resolvedCustomerId, sale_id: sid, reminder_type: '12_meses', scheduled_date: d12.toISOString().split('T')[0] },
      ]).then(({ error: e }) => { if (e) console.error('reminders:', e.message); });
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
  }

  // ── Update status for existing sale ───────────────────────────────────────
  async function updateSaleStatus(saleId: string, s: SaleStatus) {
    setUpdStatus(saleId);
    const upd: Record<string, unknown> = { status: s };
    if (s === 'entregado') upd.delivered_at = new Date().toISOString().split('T')[0];
    await supabase.from('sales').update(upd).eq('id', saleId);
    setUpdStatus(null); loadSales();
  }

  // ── Extra payment on existing sale ────────────────────────────────────────
  async function registerXPay(saleId: string) {
    const amt = parseFloat(xPayAmt);
    if (!amt || amt <= 0) return;
    await supabase.from('sale_payments').insert([{
      sale_id: saleId, amount: amt, method: xPayMethod,
      branch_id: xPayBranch || FIXED_BRANCHES[0].id, reference: xPayRef,
      registered_by: profile?.id ?? null,
    }]);
    const { data: allPays } = await supabase.from('sale_payments').select('amount').eq('sale_id', saleId);
    const tp = (allPays ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
    const { data: sr } = await supabase.from('sales').select('total').eq('id', saleId).maybeSingle();
    if (sr) await supabase.from('sales').update({ deposit: tp, balance: Math.max(0, Number(sr.total) - tp) }).eq('id', saleId);
    setAddPayFor(null); setXPayAmt(''); setXPayRef(''); loadSales();
  }

  // ── Filtered sales list ────────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-screen">

      {/* ── LEFT: New Sale Form ──────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-4"
        style={{ maxWidth: 680 }}>

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-light tracking-wider text-white">Nueva Venta</h1>
            <p className="text-xs font-light mt-1 capitalize tracking-wide" style={{ color: 'rgba(197,160,89,0.65)' }}>
              {today}
            </p>
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

        {/* Alerts */}
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

        {/* ── 1. Cliente ── */}
        <Section title="Cliente" icon={<User size={15} />}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Nombre <span style={{ color: '#C5A059' }}>*</span></FieldLabel>
              <GoldInput value={nFirst} onChange={setNFirst} placeholder="Nombre" />
            </div>
            <div>
              <FieldLabel>Apellido <span style={{ color: '#C5A059' }}>*</span></FieldLabel>
              <GoldInput value={nLast} onChange={setNLast} placeholder="Apellido" />
            </div>
            <div>
              <FieldLabel>Teléfono / WhatsApp <span style={{ color: 'rgba(255,255,255,0.28)' }}>(opcional)</span></FieldLabel>
              <GoldInput value={nPhone} onChange={setNPhone} placeholder="0981-000000" />
            </div>
            <div>
              <FieldLabel>C.I. <span style={{ color: 'rgba(255,255,255,0.28)' }}>(opcional)</span></FieldLabel>
              <GoldInput value={nCi} onChange={setNCi} placeholder="Número de cédula" />
            </div>
          </div>
        </Section>

        {/* ── 2. Sucursales y Vendedora ── */}
        <Section title="Sucursales y Vendedora" icon={<Building2 size={15} />}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Sucursal de venta <span style={{ color: '#C5A059' }}>*</span></FieldLabel>
              <GoldSelect value={saleBranch} onChange={setSaleBranch}>{branchOpts}</GoldSelect>
            </div>
            <div>
              <FieldLabel>Sucursal de entrega <span style={{ color: '#C5A059' }}>*</span></FieldLabel>
              <GoldSelect value={delBranch} onChange={setDelBranch}>{branchOpts}</GoldSelect>
            </div>
            <div>
              <FieldLabel>Sucursal de cobro <span style={{ color: '#C5A059' }}>*</span></FieldLabel>
              <GoldSelect value={payBranch} onChange={setPayBranch}>{branchOpts}</GoldSelect>
            </div>
            <div>
              <FieldLabel>Vendedora <span style={{ color: '#C5A059' }}>*</span></FieldLabel>
              <GoldSelect value={sellerId} onChange={setSellerId}>
                <option value="" style={{ background: '#0a0908' }}>— Seleccionar —</option>
                {sellers.map(s => <option key={s.id} value={s.id} style={{ background: '#0a0908' }}>{s.full_name}</option>)}
              </GoldSelect>
            </div>
          </div>
        </Section>

        {/* ── 3. Canal y Entrega ── */}
        <Section title="Canal de Venta y Entrega" icon={<Truck size={15} />}>
          <div className="space-y-4">
            {/* Channel toggle */}
            <div className="flex gap-2">
              {([{ v: 'local', l: 'Local', ic: <Store size={13} /> }, { v: 'online', l: 'Online', ic: <ShoppingBag size={13} /> }] as const).map(opt => (
                <button key={opt.v} onClick={() => setChannel(opt.v)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-light flex-1 justify-center"
                  style={{
                    background: channel === opt.v ? 'rgba(197,160,89,0.14)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${channel === opt.v ? 'rgba(197,160,89,0.44)' : 'rgba(255,255,255,0.08)'}`,
                    color: channel === opt.v ? '#C5A059' : 'rgba(255,255,255,0.44)',
                  }}>
                  {opt.ic}{opt.l}
                </button>
              ))}
            </div>

            {/* Delivery type */}
            <div>
              <FieldLabel>Tipo de entrega</FieldLabel>
              <div className="flex gap-2 flex-wrap">
                {([
                  { v: 'retiro'     as const, l: 'Retiro en sucursal', ic: <Store   size={12} /> },
                  { v: 'delivery'   as const, l: 'Delivery',           ic: <MapPin  size={12} /> },
                  { v: 'encomienda' as const, l: 'Encomienda',         ic: <Package size={12} /> },
                ]).map(opt => (
                  <button key={opt.v} onClick={() => setDelType(opt.v)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-light"
                    style={{
                      background: delType === opt.v ? 'rgba(197,160,89,0.14)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${delType === opt.v ? 'rgba(197,160,89,0.44)' : 'rgba(255,255,255,0.08)'}`,
                      color: delType === opt.v ? '#C5A059' : 'rgba(255,255,255,0.44)',
                    }}>
                    {opt.ic}{opt.l}
                  </button>
                ))}
              </div>
            </div>

            {delType === 'retiro' && (
              <div><FieldLabel>Sucursal de retiro</FieldLabel><GoldSelect value={delBranch} onChange={setDelBranch}>{branchOpts}</GoldSelect></div>
            )}
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

        {/* ── 4. Anteojos ── */}
        <Section title="Anteojos" icon={<Glasses size={15} />}>
          <div className="space-y-3">
            {eyeglasses.map((eg, idx) => (
              <SimpleEyeglassCard
                key={eg._id}
                eg={eg}
                idx={idx}
                onUpdate={patch => updateEg(eg._id, patch)}
                onRemove={() => removeEyeglass(eg._id)}
              />
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

        {/* ── 6. Pagos y Totales ── */}
        <Section title="Pago y Totales" icon={<Banknote size={15} />}>
          <div className="space-y-5">
            {/* Método de pago */}
            <div>
              <FieldLabel>Método de pago</FieldLabel>
              <div className="flex gap-1.5 flex-wrap">
                {PAY_METHODS.map(m => (
                  <button key={m.id} onClick={() => updatePay(payments[0]._id, 'method', m.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-light"
                    style={{
                      background: payments[0].method === m.id ? `${m.color}18` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${payments[0].method === m.id ? m.color + '44' : 'rgba(255,255,255,0.08)'}`,
                      color: payments[0].method === m.id ? m.color : 'rgba(255,255,255,0.42)',
                    }}>
                    {m.icon}{m.label}
                  </button>
                ))}
              </div>
              {(payments[0].method === 'transferencia' || payments[0].method === 'giro') && (
                <div className="mt-2">
                  <GoldInput value={payments[0].reference} onChange={v => updatePay(payments[0]._id, 'reference', v)} placeholder="Banco / referencia" />
                </div>
              )}
            </div>

            {/* Total / Seña / Saldo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Total venta <span style={{ color: '#C5A059' }}>*</span></FieldLabel>
                <input
                  type="number" value={saleTotal} onChange={e => setSaleTotal(e.target.value)}
                  placeholder="500000"
                  className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border text-right"
                  style={{ borderColor: 'rgba(197,160,89,0.30)' }}
                />
              </div>
              <div>
                <FieldLabel>Seña <span style={{ color: 'rgba(255,255,255,0.28)' }}>(opcional)</span></FieldLabel>
                <input
                  type="number" value={saleDeposit} onChange={e => setSaleDeposit(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border text-right"
                  style={{ borderColor: 'rgba(197,160,89,0.22)' }}
                />
              </div>
            </div>

            {/* Summary strip */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.20)' }}>
              <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'rgba(197,160,89,0.14)' }}>
                {[
                  { label: 'TOTAL', value: fmt(totalNum), color: '#C5A059' },
                  { label: 'SEÑA',  value: fmt(depositNum), color: '#10b981' },
                  { label: 'SALDO', value: fmt(balanceNum), color: balanceNum > 0 ? '#f59e0b' : '#6b7280' },
                ].map(item => (
                  <div key={item.label} className="flex flex-col items-center py-4 px-3"
                    style={{ borderColor: 'rgba(197,160,89,0.14)' }}>
                    <p className="text-xs font-light tracking-widest mb-1.5"
                      style={{ color: 'rgba(255,255,255,0.35)' }}>{item.label}</p>
                    <p className="text-xl font-light" style={{ color: item.color }}>
                      {item.value}
                    </p>
                    <p className="text-xs mt-0.5 font-light" style={{ color: 'rgba(255,255,255,0.22)' }}>Gs.</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Comprobante de pago */}
            <ReceiptUpload value={paymentReceipt} onChange={setPaymentReceipt} />
          </div>
        </Section>

        {/* ── 7. Estado del trabajo ── */}
        <Section title="Estado del Trabajo" icon={<Clock size={15} />}>
          <div className="flex gap-2 flex-wrap">
            {(Object.entries(STATUS_CFG) as [SaleStatus, { label: string; color: string }][])
              .filter(([k]) => k !== 'cancelado')
              .map(([k, v]) => (
                <button key={k} onClick={() => setStatus(k)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-light"
                  style={{
                    background: status === k ? `${v.color}18` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${status === k ? v.color + '55' : 'rgba(255,255,255,0.08)'}`,
                    color: status === k ? v.color : 'rgba(255,255,255,0.44)',
                  }}>
                  {status === k && <Check size={12} />}
                  {v.label}
                </button>
              ))}
          </div>
          {status === 'entregado' && (
            <p className="text-xs font-light mt-3" style={{ color: 'rgba(255,255,255,0.38)' }}>
              La fecha de entrega se registrará automáticamente.
            </p>
          )}
        </Section>

        {/* ── 8. Observaciones ── */}
        <Section title="Observaciones" icon={<FileText size={15} />}>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            rows={3} placeholder="Notas internas, instrucciones especiales..."
            className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm outline-none border resize-none font-light"
            style={{ borderColor: 'rgba(197,160,89,0.22)' }} />
        </Section>

        {/* ── Save button ── */}
        <button onClick={handleSaveSale} disabled={saving}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-base font-medium disabled:opacity-40"
          style={{ background: '#C5A059', color: '#000' }}>
          {saving ? (
            <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />Guardando...</>
          ) : (
            <><Save size={18} />Guardar Venta</>
          )}
        </button>
        <div className="h-6" />
      </div>

      {/* ── RIGHT: Sales List ──────────────────────────────────────────────────── */}
      <div className="w-[420px] shrink-0 border-l flex flex-col h-screen sticky top-0 overflow-hidden"
        style={{ borderColor: 'rgba(197,160,89,0.10)', background: 'rgba(0,0,0,0.18)' }}>

        {/* Header */}
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(197,160,89,0.10)' }}>
          <p className="text-sm font-light tracking-wide text-white mb-3">Ventas recientes</p>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border"
            style={{ borderColor: 'rgba(197,160,89,0.18)', background: 'rgba(255,255,255,0.02)' }}>
            <Search size={12} style={{ color: 'rgba(197,160,89,0.45)' }} />
            <input value={listSearch} onChange={e => setListSearch(e.target.value)}
              placeholder="Buscar..."
              className="flex-1 bg-transparent text-white text-xs outline-none font-light" />
          </div>
          {/* Status tabs */}
          <div className="flex gap-1 mt-3 flex-wrap">
            {([
              { id: 'todos', label: 'Todas', count: sales.length, color: 'rgba(255,255,255,0.5)' },
              ...Object.entries(STATUS_CFG).map(([k, v]) => ({ id: k, label: v.label, count: countBy[k as SaleStatus] ?? 0, color: v.color })),
            ] as { id: string; label: string; count: number; color: string }[]).map(opt => (
              <button key={opt.id} onClick={() => setSfFilter(opt.id as any)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-light"
                style={{
                  background: sfFilter === opt.id ? `${opt.color}18` : 'transparent',
                  border: `1px solid ${sfFilter === opt.id ? opt.color + '55' : 'transparent'}`,
                  color: sfFilter === opt.id ? opt.color : 'rgba(255,255,255,0.38)',
                }}>
                {opt.label}
                <span className="ml-0.5 text-xs opacity-60">{opt.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sales */}
        <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          {loadingSales ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl shimmer" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-xs font-light" style={{ color: 'rgba(255,255,255,0.28)' }}>
              Sin ventas
            </div>
          ) : (
            filtered.map(sale => {
              const sc = STATUS_CFG[sale.status] ?? STATUS_CFG.pendiente;
              const isExp = expanded === sale.id;
              const name = sale.customers?.full_name
                || [sale.customer_first_name, sale.customer_last_name].filter(Boolean).join(' ')
                || '—';
              return (
                <div key={sale.id}>
                  <div
                    className="px-4 py-3 cursor-pointer"
                    style={{ background: isExp ? 'rgba(197,160,89,0.03)' : 'transparent' }}
                    onClick={() => setExpanded(isExp ? null : sale.id)}
                    onMouseEnter={e => { if (!isExp) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.012)'; }}
                    onMouseLeave={e => { if (!isExp) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono" style={{ color: '#C5A059' }}>{sale.sale_number}</span>
                      <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.28)' }}>
                        {new Date(sale.created_at).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })}
                      </span>
                      <select
                        value={sale.status}
                        onClick={e => e.stopPropagation()}
                        onChange={e => updateSaleStatus(sale.id, e.target.value as SaleStatus)}
                        disabled={updStatus === sale.id}
                        className="ml-auto px-2 py-0.5 rounded-lg text-xs font-light outline-none"
                        style={{ background: `${sc.color}18`, border: `1px solid ${sc.color}44`, color: sc.color }}>
                        {Object.entries(STATUS_CFG).map(([k, v]) => (
                          <option key={k} value={k} style={{ background: '#111', color: v.color }}>{v.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={12} style={{
                        color: 'rgba(255,255,255,0.28)', flexShrink: 0,
                        transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
                      }} />
                    </div>
                    <p className="text-sm text-white font-light truncate">{name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs font-light truncate" style={{ color: 'rgba(255,255,255,0.32)' }}>
                        {sale.seller_name || '—'} · {sale.branches?.name ?? ''}
                      </p>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-xs text-white font-light">Gs. {fmt(Number(sale.total))}</p>
                        {Number(sale.balance) > 0 && (
                          <p className="text-xs font-light" style={{ color: '#f59e0b' }}>Debe {fmt(Number(sale.balance))}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {isExp && (
                    <div className="px-4 pb-4 space-y-3" style={{ background: 'rgba(197,160,89,0.02)' }}>
                      <PaymentHistory saleId={sale.id} />
                      {Number(sale.balance) > 0 && (
                        <div className="border-t pt-3 space-y-2" style={{ borderColor: 'rgba(197,160,89,0.1)' }}>
                          <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.55)' }}>
                            Registrar pago
                          </p>
                          {addPayFor === sale.id ? (
                            <div className="space-y-2">
                              <div className="flex gap-1 flex-wrap">
                                {PAY_METHODS.map(m => (
                                  <button key={m.id} onClick={() => setXPayMethod(m.id)}
                                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-light"
                                    style={{
                                      background: xPayMethod === m.id ? `${m.color}18` : 'rgba(255,255,255,0.03)',
                                      border: `1px solid ${xPayMethod === m.id ? m.color + '44' : 'rgba(255,255,255,0.07)'}`,
                                      color: xPayMethod === m.id ? m.color : 'rgba(255,255,255,0.38)',
                                    }}>
                                    {m.icon}
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <input value={xPayAmt} onChange={e => setXPayAmt(e.target.value)}
                                  type="number" placeholder={`Saldo: Gs. ${fmt(Number(sale.balance))}`}
                                  className="flex-1 px-3 py-2 rounded-xl bg-transparent text-white text-xs outline-none border"
                                  style={{ borderColor: 'rgba(197,160,89,0.2)' }} />
                                <select value={xPayBranch} onChange={e => setXPayBranch(e.target.value)}
                                  className="px-2 py-2 rounded-xl text-xs outline-none border"
                                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(197,160,89,0.18)', color: 'rgba(255,255,255,0.6)' }}>
                                  {FIXED_BRANCHES.map(b => <option key={b.id} value={b.id} style={{ background: '#111' }}>{b.name}</option>)}
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => registerXPay(sale.id)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-black font-medium"
                                  style={{ background: '#C5A059' }}>
                                  <Check size={11} />Guardar
                                </button>
                                <button onClick={() => { setAddPayFor(null); setXPayAmt(''); }}
                                  className="px-3 py-2 rounded-lg text-xs font-light"
                                  style={{ color: 'rgba(255,255,255,0.38)' }}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={e => { e.stopPropagation(); setAddPayFor(sale.id); setXPayBranch(FIXED_BRANCHES[0].id); }}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light"
                              style={{ background: 'rgba(197,160,89,0.08)', color: '#C5A059', border: '1px solid rgba(197,160,89,0.22)' }}>
                              <Plus size={11} />Cliente viene a pagar saldo
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tiny helper: small labeled text input ──────────────────────────────────────
function RxInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? ''}
        className="w-full px-2.5 py-2 rounded-lg bg-transparent text-white text-xs font-light outline-none border text-center"
        style={{ borderColor: 'rgba(197,160,89,0.20)', fontFamily: 'monospace' }} />
    </div>
  );
}

// ── ReceiptUpload ──────────────────────────────────────────────────────────────
function ReceiptUpload({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onChange(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <p className="text-xs font-light mb-2 tracking-wide" style={{ color: 'rgba(255,255,255,0.42)' }}>
        Foto / comprobante de pago <span style={{ color: 'rgba(255,255,255,0.25)' }}>(opcional)</span>
      </p>
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt="comprobante" className="h-28 rounded-xl object-cover border"
            style={{ borderColor: 'rgba(197,160,89,0.25)' }} />
          <button onClick={() => onChange('')}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: '#ef4444' }}>
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

// ── SimpleEyeglassCard ─────────────────────────────────────────────────────────
function SimpleEyeglassCard({
  eg, idx, onUpdate, onRemove,
}: {
  eg: EyeglassItem; idx: number;
  onUpdate: (p: Partial<EyeglassItem>) => void;
  onRemove: () => void;
}) {
  const photoRef = useRef<HTMLInputElement | null>(null);

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onUpdate({ photo_url: ev.target?.result as string });
    reader.readAsDataURL(file);
  }

  function updateRx(field: keyof Prescription, val: string) {
    onUpdate({ prescription: { ...eg.prescription, [field]: val } });
  }

  const textInp = (value: string, onChange: (v: string) => void, placeholder: string, opts?: { type?: string; right?: boolean }) => (
    <input
      type={opts?.type ?? 'text'} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border${opts?.right ? ' text-right' : ''}`}
      style={{ borderColor: 'rgba(197,160,89,0.22)' }}
    />
  );

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(197,160,89,0.16)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(197,160,89,0.09)' }}>
        <div className="flex items-center gap-2.5">
          <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium text-black shrink-0"
            style={{ background: '#C5A059' }}>{idx + 1}</span>
          <span className="text-sm font-light text-white truncate max-w-[150px]">
            {eg.frame_description || `Anteojo ${idx + 1}`}
          </span>
          {eg.price && (
            <span className="text-xs font-light" style={{ color: '#C5A059' }}>
              Gs. {(parseFloat(eg.price) || 0).toLocaleString('es-PY')}
            </span>
          )}
        </div>
        <button onClick={onRemove} style={{ color: 'rgba(239,68,68,0.45)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.45)')}>
          <Trash2 size={14} />
        </button>
      </div>

      {/* Fields */}
      <div className="p-4 space-y-3">

        {/* Armazón + foto */}
        <div className="flex gap-3 items-start">
          <div className="flex-1">
            <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Armazón</p>
            {textInp(eg.frame_description, v => onUpdate({ frame_description: v }), 'Código o modelo del armazón')}
          </div>
          {/* Photo slot */}
          <div className="shrink-0 mt-5">
            {eg.photo_url ? (
              <div className="relative">
                <img src={eg.photo_url} alt="armazón" className="w-16 h-12 object-cover rounded-lg border"
                  style={{ borderColor: 'rgba(197,160,89,0.25)' }} />
                <button onClick={() => onUpdate({ photo_url: '' })}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: '#ef4444' }}>
                  <X size={8} color="#fff" />
                </button>
              </div>
            ) : (
              <button onClick={() => photoRef.current?.click()}
                className="w-16 h-12 rounded-lg flex flex-col items-center justify-center gap-0.5 border"
                style={{ borderColor: 'rgba(197,160,89,0.22)', background: 'rgba(197,160,89,0.04)', color: 'rgba(197,160,89,0.55)' }}
                title="Subir foto del armazón">
                <Camera size={14} />
                <span className="text-xs font-light leading-none" style={{ fontSize: 9 }}>Foto</span>
              </button>
            )}
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>
        </div>

        {/* Cristales + Tratamiento */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Cristales</p>
            {textInp(eg.crystals, v => onUpdate({ crystals: v }), 'monofocal, multifocal...')}
          </div>
          <div>
            <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Tratamiento</p>
            {textInp(eg.treatments, v => onUpdate({ treatments: v }), 'antirreflejo, filtro azul...')}
          </div>
        </div>

        {/* Receta toggle + Precio */}
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
            <p className="text-xs font-light mb-1.5 text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Precio <span style={{ color: '#C5A059' }}>*</span>
            </p>
            {textInp(eg.price, v => onUpdate({ price: v }), 'Gs.', { type: 'number', right: true })}
          </div>
        </div>

        {/* Receta estructurada */}
        {eg.showReceta && (
          <div className="rounded-xl p-3 space-y-3"
            style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.14)' }}>

            {/* OD */}
            <div>
              <p className="text-xs font-light mb-2" style={{ color: '#C5A059' }}>OD — Ojo Derecho</p>
              <div className="grid grid-cols-3 gap-2">
                <RxInput label="Esfera"   value={eg.prescription.od_esfera}   onChange={v => updateRx('od_esfera', v)}   placeholder="-2.00" />
                <RxInput label="Cilindro" value={eg.prescription.od_cilindro} onChange={v => updateRx('od_cilindro', v)} placeholder="-0.50" />
                <RxInput label="Eje"      value={eg.prescription.od_eje}      onChange={v => updateRx('od_eje', v)}      placeholder="180" />
              </div>
            </div>

            {/* OI */}
            <div>
              <p className="text-xs font-light mb-2" style={{ color: '#C5A059' }}>OI — Ojo Izquierdo</p>
              <div className="grid grid-cols-3 gap-2">
                <RxInput label="Esfera"   value={eg.prescription.oi_esfera}   onChange={v => updateRx('oi_esfera', v)}   placeholder="-1.75" />
                <RxInput label="Cilindro" value={eg.prescription.oi_cilindro} onChange={v => updateRx('oi_cilindro', v)} placeholder="-0.25" />
                <RxInput label="Eje"      value={eg.prescription.oi_eje}      onChange={v => updateRx('oi_eje', v)}      placeholder="175" />
              </div>
            </div>

            {/* Adicionales */}
            <div className="grid grid-cols-3 gap-2">
              <RxInput label="ADD"  value={eg.prescription.add} onChange={v => updateRx('add', v)} placeholder="+2.00" />
              <RxInput label="DP"   value={eg.prescription.dp}  onChange={v => updateRx('dp', v)}  placeholder="64" />
              <div className="col-span-1">
                <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Observación</p>
                <input type="text" value={eg.prescription.obs} onChange={e => updateRx('obs', e.target.value)}
                  placeholder="Notas..."
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

// ── PaymentHistory ─────────────────────────────────────────────────────────────
function PaymentHistory({ saleId }: { saleId: string }) {
  const [payments, setPayments] = useState<{ id: string; amount: number; method: string; paid_at: string; reference: string; branches: { name: string } | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('sale_payments').select('id,amount,method,paid_at,reference,branches(name)')
      .eq('sale_id', saleId).order('paid_at')
      .then(({ data }) => { setPayments((data ?? []) as any); setLoading(false); });
  }, [saleId]);

  if (loading) return <div className="h-4 w-20 rounded shimmer" />;
  if (payments.length === 0) return <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.28)' }}>Sin pagos registrados</p>;

  const total = payments.reduce((s, p) => s + Number(p.amount), 0);
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.45)' }}>Historial de pagos</p>
      {payments.map(p => {
        const mc = PAY_METHODS.find(m => m.id === p.method)?.color ?? '#C5A059';
        return (
          <div key={p.id} className="flex items-center gap-2 text-xs font-light">
            <span className="px-2 py-0.5 rounded-full shrink-0" style={{ background: `${mc}18`, color: mc }}>{p.method}</span>
            <span className="text-white">Gs. {Number(p.amount).toLocaleString()}</span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>{p.branches?.name ?? '—'}</span>
            {p.reference && <span style={{ color: 'rgba(255,255,255,0.28)' }}>{p.reference}</span>}
            <span className="ml-auto" style={{ color: 'rgba(255,255,255,0.28)' }}>{new Date(p.paid_at).toLocaleDateString('es-PY')}</span>
          </div>
        );
      })}
      <div className="flex justify-between pt-1.5 border-t text-xs font-light" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <span style={{ color: 'rgba(255,255,255,0.35)' }}>Total pagado</span>
        <span style={{ color: '#10b981' }}>Gs. {total.toLocaleString()}</span>
      </div>
    </div>
  );
}
