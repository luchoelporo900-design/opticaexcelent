import { useState, useEffect, useRef } from 'react';
import {
  Search, RefreshCw, ChevronDown, Package, Clock, CheckCircle,
  XCircle, FlaskConical, ShoppingBag, MessageCircle, Pencil, X, Save,
  Banknote, CreditCard, Smartphone, QrCode, Send, Store, Truck,
  AlertTriangle, Camera, Image, Plus, ChevronUp, Wrench, Check, Trash2, Glasses,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import { closeSaleLocal, uploadToCloudinary } from '../lib/salesStorage';

type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'qr' | 'giro';
type DeliveryMode  = 'retiro' | 'delivery' | 'encomienda';
type SaleType      = 'completa' | 'media' | 'reparacion';

type Prescription = {
  od_esfera: string; od_cilindro: string; od_eje: string; od_altura: string;
  oi_esfera: string; oi_cilindro: string; oi_eje: string; oi_altura: string;
  add: string; dp: string; obs: string;
};

type EyeglassItem = {
  _id: string;
  frame_description: string;
  photo_url: string;
  receta_url?: string;
  crystals: string;
  treatments: string;
  showReceta: boolean;
  prescription: Prescription;
  price: string;
  saleType: SaleType;
  stock_frame_id?: string;
  receta_a_confirmar?: boolean;
};

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendiente:      { label: 'Pendiente',      color: '#f59e0b', icon: <Clock         size={11} /> },
  en_proceso:     { label: 'En Proceso',     color: '#f59e0b', icon: <Clock         size={11} /> },
  en_laboratorio: { label: 'Laboratorio',    color: '#3b82f6', icon: <FlaskConical  size={11} /> },
  listo:          { label: 'Listo',          color: '#10b981', icon: <CheckCircle   size={11} /> },
  pagado_total:   { label: 'Pagado Total',   color: '#22c55e', icon: <CheckCircle   size={11} /> },
  entregado:      { label: 'Entregado',      color: '#6b7280', icon: <Package       size={11} /> },
  cancelado:      { label: 'Cancelado',      color: '#ef4444', icon: <XCircle       size={11} /> },
  a_confirmar:    { label: 'A confirmar',    color: '#f97316', icon: <AlertTriangle size={11} /> },
};

const PAY_METHODS: { id: PaymentMethod; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'efectivo',      label: 'Efectivo',    icon: <Banknote   size={13} />, color: '#22c55e' },
  { id: 'transferencia', label: 'Transfer.',   icon: <Smartphone size={13} />, color: '#3b82f6' },
  { id: 'tarjeta',       label: 'POS',         icon: <CreditCard size={13} />, color: '#f59e0b' },
  { id: 'qr',            label: 'QR',          icon: <QrCode     size={13} />, color: '#C5A059' },
  { id: 'giro',          label: 'Giro',        icon: <Send       size={13} />, color: '#a78bfa' },
];

const DELIVERY_OPTIONS: { id: DeliveryMode; label: string; icon: React.ReactNode }[] = [
  { id: 'retiro',     label: 'Retiro en local', icon: <Store   size={13} /> },
  { id: 'delivery',   label: 'Delivery',        icon: <Truck   size={13} /> },
  { id: 'encomienda', label: 'Encomienda',      icon: <Package size={13} /> },
];

const SALE_TYPES: { id: SaleType; label: string; color: string; icon: React.ReactNode }[] = [
  { id: 'completa',   label: '1 venta completa',   color: '#10b981', icon: <Check  size={11} /> },
  { id: 'media',      label: '½ media venta',       color: '#f59e0b', icon: <span style={{ fontSize: 11, fontWeight: 600 }}>½</span> },
  { id: 'reparacion', label: 'Reparación / Insumo', color: '#a78bfa', icon: <Wrench size={11} /> },
];

const SUCURSALES     = ['Pettirossi', 'Azara', 'Lambaré', 'Acceso Sur', 'Capiatá'];
const FIXED_BRANCHES = [
  { id: 'pettirossi', name: 'Pettirossi' },
  { id: 'azara',      name: 'Azara'      },
  { id: 'lambere',    name: 'Lambaré'    },
  { id: 'acceso_sur', name: 'Acceso Sur' },
  { id: 'capiata',    name: 'Capiatá'    },
];

function fmt(n: number) { return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function normalize(s: string) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function branchMatch(stored: string, selected: string): boolean {
  if (!selected) return true;
  const n = (s: string) => s.toLowerCase().replace(/[áàä]/g,'a').replace(/[éèë]/g,'e').replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u');
  return n(stored).includes(n(selected)) || n(selected).includes(n(stored));
}
function uid() { return Math.random().toString(36).slice(2); }
function emptyRx(): Prescription {
  return { od_esfera:'', od_cilindro:'', od_eje:'', od_altura:'', oi_esfera:'', oi_cilindro:'', oi_eje:'', oi_altura:'', add:'', dp:'', obs:'' };
}
function newEyeglass(): EyeglassItem {
  return { _id: uid(), frame_description:'', photo_url:'', receta_url:'', crystals:'', treatments:'', showReceta:false, prescription:emptyRx(), price:'', saleType:'completa', receta_a_confirmar: false };
}

function hasRxData(rx: any): boolean {
  if (!rx) return false;
  return !!(rx.od_esfera || rx.od_cilindro || rx.od_eje || rx.od_altura ||
            rx.oi_esfera || rx.oi_cilindro || rx.oi_eje || rx.oi_altura ||
            rx.add || rx.dp);
}

function isoToDateInput(iso: string): string {
  return iso ? iso.slice(0, 10) : new Date().toISOString().slice(0, 10);
}
function isoToTimeInput(iso: string): string {
  if (!iso) return '00:00';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function buildIso(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

function PhotoBtn({ onFile, label = 'Foto' }: { onFile: (url: string) => void; label?: string }) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    try { const url = await uploadToCloudinary(file); onFile(url); }
    catch { alert('Error al subir la foto. Intentá de nuevo.'); }
  }
  return (
    <div className="flex gap-1.5 flex-wrap">
      <button onClick={() => camRef.current?.click()}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border"
        style={{ borderColor: 'rgba(197,160,89,0.25)', color: 'rgba(197,160,89,0.8)', background: 'rgba(197,160,89,0.05)' }}>
        <Camera size={12} />{label} Cám.
      </button>
      <button onClick={() => galRef.current?.click()}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border"
        style={{ borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.03)' }}>
        <Image size={12} />Gal.
      </button>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handle} />
      <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={handle} />
    </div>
  );
}

function PhotoInputCompact({ onChange }: { onChange: (v: string) => void }) {
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    try { const url = await uploadToCloudinary(file); onChange(url); }
    catch { alert('Error al subir la foto. Intentá de nuevo.'); }
  }
  return (
    <div className="flex flex-col gap-1">
      <button onClick={() => cameraRef.current?.click()}
        className="w-16 h-6 rounded flex items-center justify-center gap-1 text-xs border"
        style={{ borderColor: 'rgba(197,160,89,0.22)', background: 'rgba(197,160,89,0.06)', color: 'rgba(197,160,89,0.7)' }}>
        <Camera size={10} /><span style={{ fontSize: 9 }}>Cám.</span>
      </button>
      <button onClick={() => galleryRef.current?.click()}
        className="w-16 h-6 rounded flex items-center justify-center gap-1 text-xs border"
        style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.4)' }}>
        <Image size={10} /><span style={{ fontSize: 9 }}>Gal.</span>
      </button>
      <input ref={cameraRef}  type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
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

function EyeglassEditCard({ eg, idx, onUpdate, onRemove }: {
  eg: EyeglassItem; idx: number;
  onUpdate: (p: Partial<EyeglassItem>) => void;
  onRemove: () => void;
}) {
  const currentType = eg.saleType ?? 'completa';
  const activeCfg   = SALE_TYPES.find(t => t.id === currentType) ?? SALE_TYPES[0];

  function updateRx(field: keyof Prescription, val: string) {
    onUpdate({ prescription: { ...eg.prescription, [field]: val } });
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(197,160,89,0.18)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(197,160,89,0.09)' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0" style={{ background: '#C5A059' }}>{idx + 1}</span>
          <span className="text-sm font-light text-white truncate max-w-[130px]">{eg.frame_description || `Armazón ${idx + 1}`}</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-light inline-flex items-center gap-1 shrink-0"
            style={{ background: `${activeCfg.color}15`, color: activeCfg.color, border: `1px solid ${activeCfg.color}30` }}>
            {activeCfg.icon}<span className="hidden sm:inline">{activeCfg.label}</span>
          </span>
          {eg.receta_a_confirmar && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs shrink-0"
              style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.30)' }}>
              <AlertTriangle size={9} />A confirmar
            </span>
          )}
        </div>
        <button onClick={onRemove} style={{ color: 'rgba(239,68,68,0.5)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.5)')}>
          <Trash2 size={14} />
        </button>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex gap-3 items-start">
          <div className="flex-1">
            <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Armazón</p>
            <input type="text" value={eg.frame_description} onChange={e => onUpdate({ frame_description: e.target.value })}
              placeholder="Código o descripción"
              className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border"
              style={{ borderColor: 'rgba(197,160,89,0.22)' }} />
          </div>
          <div className="shrink-0 pt-5">
            {eg.photo_url ? (
              <div className="relative">
                <img src={eg.photo_url} alt="armazón" className="w-16 h-12 object-cover rounded-lg border" style={{ borderColor: 'rgba(197,160,89,0.25)' }} />
                <button onClick={() => onUpdate({ photo_url: '' })} className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#ef4444' }}>
                  <X size={8} color="#fff" />
                </button>
              </div>
            ) : (
              <PhotoInputCompact onChange={url => onUpdate({ photo_url: url })} />
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Foto de receta <span style={{ color: 'rgba(255,255,255,0.25)' }}>(opcional)</span>
          </p>
          {eg.receta_url ? (
            <div className="relative inline-block">
              <img src={eg.receta_url} alt="receta" className="h-20 w-28 object-cover rounded-lg border" style={{ borderColor: 'rgba(59,130,246,0.35)' }} />
              <button onClick={() => onUpdate({ receta_url: '' })} className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#ef4444' }}>
                <X size={8} color="#fff" />
              </button>
            </div>
          ) : (
            <PhotoBtn onFile={url => onUpdate({ receta_url: url })} label="Receta" />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Cristales</p>
            <input type="text" value={eg.crystals} onChange={e => onUpdate({ crystals: e.target.value })} placeholder="monofocal..."
              className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border"
              style={{ borderColor: 'rgba(197,160,89,0.22)' }} />
          </div>
          <div>
            <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Tratamiento</p>
            <input type="text" value={eg.treatments} onChange={e => onUpdate({ treatments: e.target.value })} placeholder="antirreflejo..."
              className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border"
              style={{ borderColor: 'rgba(197,160,89,0.22)' }} />
          </div>
        </div>

        <div>
          <p className="text-xs font-light mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Tipo de venta</p>
          <div className="flex gap-2 flex-wrap">
            {SALE_TYPES.map(t => (
              <button key={t.id} onClick={() => onUpdate({ saleType: t.id })}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                style={{ background: currentType===t.id ? `${t.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${currentType===t.id ? t.color+'55' : 'rgba(255,255,255,0.08)'}`, color: currentType===t.id ? t.color : 'rgba(255,255,255,0.38)' }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => onUpdate({ showReceta: !eg.showReceta, receta_a_confirmar: false })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-light"
            style={{ color: 'rgba(197,160,89,0.7)', border: '1px solid rgba(197,160,89,0.20)' }}>
            {eg.showReceta ? <ChevronUp size={11} /> : <Plus size={11} />}
            {eg.showReceta ? 'Ocultar receta' : '+ Cargar receta'}
          </button>
          {!eg.showReceta && (
            <button onClick={() => onUpdate({ receta_a_confirmar: !eg.receta_a_confirmar, showReceta: false })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-light"
              style={{ color: eg.receta_a_confirmar ? '#f97316' : 'rgba(249,115,22,0.55)', border: `1px solid ${eg.receta_a_confirmar ? 'rgba(249,115,22,0.50)' : 'rgba(249,115,22,0.22)'}`, background: eg.receta_a_confirmar ? 'rgba(249,115,22,0.10)' : 'transparent' }}>
              <AlertTriangle size={11} />
              {eg.receta_a_confirmar ? '⚠ Receta a confirmar' : 'Receta a confirmar'}
            </button>
          )}
        </div>

        {eg.showReceta && (
          <div className="rounded-xl p-3 space-y-3" style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.14)' }}>
            <div>
              <p className="text-xs font-light mb-2" style={{ color: '#C5A059' }}>OD — Ojo Derecho</p>
              <div className="grid grid-cols-2 gap-2">
                <RxInput label="Esfera"   value={eg.prescription.od_esfera}   onChange={v => updateRx('od_esfera', v)}   placeholder="-2.00" />
                <RxInput label="Cilindro" value={eg.prescription.od_cilindro} onChange={v => updateRx('od_cilindro', v)} placeholder="-0.50" />
                <RxInput label="Eje"      value={eg.prescription.od_eje}      onChange={v => updateRx('od_eje', v)}      placeholder="180" />
                <RxInput label="Altura"   value={eg.prescription.od_altura}   onChange={v => updateRx('od_altura', v)}   placeholder="20" />
              </div>
            </div>
            <div>
              <p className="text-xs font-light mb-2" style={{ color: '#C5A059' }}>OI — Ojo Izquierdo</p>
              <div className="grid grid-cols-2 gap-2">
                <RxInput label="Esfera"   value={eg.prescription.oi_esfera}   onChange={v => updateRx('oi_esfera', v)}   placeholder="-1.75" />
                <RxInput label="Cilindro" value={eg.prescription.oi_cilindro} onChange={v => updateRx('oi_cilindro', v)} placeholder="-0.25" />
                <RxInput label="Eje"      value={eg.prescription.oi_eje}      onChange={v => updateRx('oi_eje', v)}      placeholder="175" />
                <RxInput label="Altura"   value={eg.prescription.oi_altura}   onChange={v => updateRx('oi_altura', v)}   placeholder="20" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <RxInput label="ADD" value={eg.prescription.add} onChange={v => updateRx('add', v)} placeholder="+2.00" />
              <RxInput label="DP"  value={eg.prescription.dp}  onChange={v => updateRx('dp', v)}  placeholder="64" />
              <div>
                <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Obs</p>
                <input type="text" value={eg.prescription.obs} onChange={e => updateRx('obs', e.target.value)}
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

function DeliverModal({ sale, onClose, onDelivered }: { sale: any; onClose: () => void; onDelivered: () => void }) {
  const { profile } = useAuth();
  const balance    = Number(sale.saldo) || 0;
  const hasBalance = balance > 0;
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('retiro');
  const [payMethod,    setPayMethod]    = useState<PaymentMethod>('efectivo');
  const [payAmount,    setPayAmount]    = useState(hasBalance ? String(balance) : '');
  const [payBranch,    setPayBranch]    = useState(sale.sucursalCobro || sale.sucursalVenta || '');
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');

  async function handleDeliver() {
    setError('');
    const amt = parseFloat(payAmount) || 0;
    if (hasBalance && amt <= 0)      { setError(`Ingresá el monto a cobrar (Gs. ${fmt(balance)}).`); return; }
    if (hasBalance && amt < balance) { setError(`El monto (Gs. ${fmt(amt)}) es menor al saldo (Gs. ${fmt(balance)}).`); return; }
    if (!payBranch && hasBalance)    { setError('Seleccioná la sucursal de cobro.'); return; }
    setSaving(true);
    const branchName = FIXED_BRANCHES.find(b => b.id === payBranch)?.name ?? payBranch ?? '';
    const clientName = `${sale.cliente?.nombre ?? ''} ${sale.cliente?.apellido ?? ''}`.trim();
    await closeSaleLocal(sale.id, deliveryMode,
      hasBalance && amt > 0 ? { monto: amt, metodo: payMethod, sucursal: branchName, vendedora: profile?.full_name ?? '', cliente: clientName, receipt_url: undefined } : undefined
    );
    setSaving(false); onDelivered(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4"
      style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full lg:max-w-md rounded-t-3xl lg:rounded-2xl overflow-hidden"
        style={{ background: '#0e0e0e', border: '1px solid rgba(197,160,89,0.25)', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
          style={{ background: '#0e0e0e', borderBottom: '1px solid rgba(197,160,89,0.12)' }}>
          <div>
            <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.55)' }}>Marcar como entregado</p>
            <p className="text-sm font-light text-white mt-0.5">VTA-{sale.id} · {`${sale.cliente?.nombre ?? ''} ${sale.cliente?.apellido ?? ''}`.trim()}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
            <X size={14} />
          </button>
        </div>
        <div className="p-5 space-y-5">
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />{error}
            </div>
          )}
          <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.15)' }}>
            <div className="flex justify-between text-xs font-light"><span style={{ color: 'rgba(255,255,255,0.4)' }}>Total</span><span className="text-white">Gs. {fmt(Number(sale.total))}</span></div>
            <div className="flex justify-between text-xs font-light"><span style={{ color: 'rgba(255,255,255,0.4)' }}>Cobrado</span><span style={{ color: '#10b981' }}>Gs. {fmt(Number(sale.sena))}</span></div>
            <div className="flex justify-between text-xs font-medium border-t pt-2" style={{ borderColor: 'rgba(197,160,89,0.1)' }}>
              <span style={{ color: hasBalance ? '#f59e0b' : '#10b981' }}>{hasBalance ? 'Saldo pendiente' : '✓ Sin saldo'}</span>
              {hasBalance && <span style={{ color: '#f59e0b' }}>Gs. {fmt(balance)}</span>}
            </div>
          </div>
          {hasBalance && (
            <div className="space-y-3">
              <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(239,68,68,0.6)' }}>Cobrar saldo</p>
              <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border text-right"
                style={{ borderColor: 'rgba(245,158,11,0.4)' }} />
              <div className="flex gap-1.5 flex-wrap">
                {PAY_METHODS.map(m => (
                  <button key={m.id} onClick={() => setPayMethod(m.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-light"
                    style={{ background: payMethod===m.id ? `${m.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${payMethod===m.id ? m.color+'44' : 'rgba(255,255,255,0.08)'}`, color: payMethod===m.id ? m.color : 'rgba(255,255,255,0.42)' }}>
                    {m.icon}{m.label}
                  </button>
                ))}
              </div>
              <select value={payBranch} onChange={e => setPayBranch(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm font-light outline-none border"
                style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(197,160,89,0.22)', color: 'rgba(255,255,255,0.8)' }}>
                <option value="" style={{ background: '#111' }}>— Sucursal de cobro —</option>
                {FIXED_BRANCHES.map(b => <option key={b.id} value={b.id} style={{ background: '#111' }}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <p className="text-xs font-light mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Tipo de entrega</p>
            <div className="flex gap-2 flex-wrap">
              {DELIVERY_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => setDeliveryMode(opt.id)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-light"
                  style={{ background: deliveryMode===opt.id ? 'rgba(197,160,89,0.14)' : 'rgba(255,255,255,0.03)', border: `1px solid ${deliveryMode===opt.id ? 'rgba(197,160,89,0.44)' : 'rgba(255,255,255,0.08)'}`, color: deliveryMode===opt.id ? '#C5A059' : 'rgba(255,255,255,0.44)' }}>
                  {opt.icon}{opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button onClick={handleDeliver} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
              style={{ background: saving ? 'rgba(16,185,129,0.4)' : '#10b981', color: '#000' }}>
              <Package size={14} />{saving ? 'Guardando...' : hasBalance ? 'Cobrar y entregar' : 'Confirmar entrega'}
            </button>
            <button onClick={onClose} className="px-5 py-3 rounded-xl text-sm font-light"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditModal({ sale, onClose, onSaved }: { sale: any; onClose: () => void; onSaved: () => void }) {
  const [nombre,     setNombre]     = useState(sale.cliente?.nombre    ?? '');
  const [apellido,   setApellido]   = useState(sale.cliente?.apellido  ?? '');
  const [telefono,   setTelefono]   = useState(sale.cliente?.telefono  ?? '');
  const [ci,         setCi]         = useState(sale.cliente?.ci        ?? '');
  const [estado,     setEstado]     = useState<string>(sale.estadoTrabajo ?? 'pendiente');
  const [total,      setTotal]      = useState(String(sale.total ?? ''));
  const [sena,       setSena]       = useState(String(sale.sena  ?? ''));
  const [saldo,      setSaldo]      = useState(String(sale.saldo ?? ''));
  const [obs,        setObs]        = useState(sale.observaciones ?? '');
  const [vendedora,  setVendedora]  = useState(sale.vendedora     ?? '');
  const [sucursal,   setSucursal]   = useState(sale.sucursalVenta ?? '');
  const [receiptUrl, setReceiptUrl] = useState(sale.receipt_url   ?? '');

  const [fechaDate, setFechaDate] = useState(isoToDateInput(sale.fecha));
  const [fechaTime, setFechaTime] = useState(isoToTimeInput(sale.fecha));

  const [eyeglasses, setEyeglasses] = useState<EyeglassItem[]>(() =>
    ((sale.anteojos as any[]) || []).map((eg: any) => ({
      _id:                uid(),
      frame_description:  eg.frame_description  ?? '',
      photo_url:          eg.photo_url          ?? '',
      receta_url:         eg.receta_url         ?? '',
      crystals:           eg.crystals           ?? '',
      treatments:         eg.treatments         ?? '',
      showReceta:         false,
      prescription:       eg.prescription       ?? emptyRx(),
      price:              eg.price              ?? '',
      saleType:           eg.saleType           ?? 'completa',
      stock_frame_id:     eg.stock_frame_id,
      receta_a_confirmar: eg.receta_a_confirmar ?? false,
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  useEffect(() => {
    const t = Number(total) || 0;
    const s = Number(sena)  || 0;
    if (t > 0) setSaldo(String(Math.max(0, t - s)));
  }, [total, sena]);

  function updateEg(id: string, patch: Partial<EyeglassItem>) {
    setEyeglasses(prev => prev.map(eg => eg._id === id ? { ...eg, ...patch } : eg));
  }

  async function handleSave() {
    setError('');
    const t = Number(total), s = Number(sena), b = Number(saldo);
    if (isNaN(t) || isNaN(s) || isNaN(b)) { setError('Total, seña y saldo deben ser números válidos.'); return; }
    if (!fechaDate) { setError('La fecha es obligatoria.'); return; }

    setSaving(true);
    const nuevaFecha = buildIso(fechaDate, fechaTime);

    const payload = {
      fecha:            nuevaFecha,
      estado_trabajo:   estado,
      total: t, sena: s, saldo: b,
      observaciones:    obs.trim()      || null,
      vendedora:        vendedora.trim()|| null,
      sucursal_venta:   sucursal        || null,
      receipt_url:      receiptUrl      || null,
      cliente_nombre:   nombre.trim(),
      cliente_apellido: apellido.trim(),
      cliente_telefono: telefono.trim(),
      cliente_ci:       ci.trim(),
      anteojos: eyeglasses.map(eg => ({
        frame_description:  eg.frame_description,
        photo_url:          eg.photo_url,
        receta_url:         eg.receta_url ?? '',
        crystals:           eg.crystals,
        treatments:         eg.treatments,
        prescription:       eg.prescription,
        price:              eg.price,
        saleType:           eg.saleType,
        stock_frame_id:     eg.stock_frame_id,
        receta_a_confirmar: eg.receta_a_confirmar ?? false,
      })),
    };
    console.log('SALES DEBUG UPDATE PAYLOAD', payload);
    const { data: updateData, error: err } = await supabase.from('ventas').update(payload).eq('id', sale.id);
    console.log('SALES DEBUG UPDATE RESULT', { data: updateData, error: err });

    if (err) { setError('Error al guardar. Intentá de nuevo.'); setSaving(false); return; }
    setSaving(false); onSaved(); onClose();
  }

  const sc = STATUS_CFG[estado] ?? STATUS_CFG.pendiente;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4"
      style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full lg:max-w-2xl rounded-t-3xl lg:rounded-2xl overflow-hidden"
        style={{ background: '#0e0e0e', border: '1px solid rgba(197,160,89,0.2)', maxHeight: '95vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
          style={{ background: '#0e0e0e', borderBottom: '1px solid rgba(197,160,89,0.1)' }}>
          <div>
            <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.55)' }}>Editando venta</p>
            <p className="text-sm font-light text-white mt-0.5">VTA-{sale.id} · {`${sale.cliente?.nombre ?? ''} ${sale.cliente?.apellido ?? ''}`.trim()}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
            <X size={14} />
          </button>
        </div>
        <div className="p-5 space-y-6">
          {error && <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>{error}</div>}

          <div>
            <p className="text-xs font-light tracking-widest uppercase mb-3" style={{ color: 'rgba(197,160,89,0.6)' }}>Fecha de la venta</p>
            <div className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: 'rgba(197,160,89,0.05)', border: '1px solid rgba(197,160,89,0.22)' }}>
              <Calendar size={14} style={{ color: '#C5A059', flexShrink: 0 }} />
              <div className="flex gap-3 flex-1 flex-wrap">
                <div className="flex-1 min-w-[140px]">
                  <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Fecha</p>
                  <input type="date" value={fechaDate} onChange={e => setFechaDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-transparent text-white text-sm font-light outline-none border"
                    style={{ borderColor: 'rgba(197,160,89,0.30)', colorScheme: 'dark' }} />
                </div>
                <div style={{ minWidth: 110 }}>
                  <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Hora</p>
                  <input type="time" value={fechaTime} onChange={e => setFechaTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-transparent text-white text-sm font-light outline-none border"
                    style={{ borderColor: 'rgba(197,160,89,0.30)', colorScheme: 'dark' }} />
                </div>
              </div>
            </div>
            <p className="text-xs font-light mt-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Podés cambiar la fecha para registrar ventas del viernes, sábado u otro día anterior.
            </p>
          </div>

          <div>
            <p className="text-xs font-light tracking-widest uppercase mb-3" style={{ color: 'rgba(197,160,89,0.6)' }}>Cliente</p>
            <div className="grid grid-cols-2 gap-3">
              {[{label:'Nombre',value:nombre,onChange:setNombre},{label:'Apellido',value:apellido,onChange:setApellido},{label:'Teléfono',value:telefono,onChange:setTelefono},{label:'C.I.',value:ci,onChange:setCi}].map(f => (
                <div key={f.label}>
                  <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{f.label}</p>
                  <input type="text" value={f.value} onChange={e => f.onChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border"
                    style={{ borderColor: 'rgba(197,160,89,0.22)' }} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-light tracking-widest uppercase mb-3" style={{ color: 'rgba(197,160,89,0.6)' }}>Estado del trabajo</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(STATUS_CFG).map(([key, cfg]) => (
                <button key={key} onClick={() => setEstado(key)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-light text-left"
                  style={{ background: estado===key ? `${cfg.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${estado===key ? cfg.color+'55' : 'rgba(255,255,255,0.08)'}`, color: estado===key ? cfg.color : 'rgba(255,255,255,0.45)' }}>
                  {cfg.icon}{cfg.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>Seleccionado:</span>
              <span className="px-2 py-0.5 rounded text-xs inline-flex items-center gap-1" style={{ background: `${sc.color}18`, color: sc.color }}>{sc.icon}{sc.label}</span>
            </div>
          </div>

          <div>
            <p className="text-xs font-light tracking-widest uppercase mb-3" style={{ color: 'rgba(197,160,89,0.6)' }}>Montos (Gs.)</p>
            <div className="grid grid-cols-3 gap-3">
              {[{label:'Total',value:total,onChange:setTotal,color:'#C5A059'},{label:'Seña / Cobrado',value:sena,onChange:setSena,color:'#10b981'},{label:'Saldo pendiente',value:saldo,onChange:setSaldo,color:Number(saldo)>0?'#f59e0b':'#10b981'}].map(f => (
                <div key={f.label}>
                  <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{f.label}</p>
                  <input type="number" value={f.value} onChange={e => f.onChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-transparent text-sm font-light outline-none border"
                    style={{ borderColor: 'rgba(197,160,89,0.22)', color: f.color }} />
                </div>
              ))}
            </div>
            <p className="text-xs font-light mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>El saldo se recalcula automáticamente al cambiar total o seña.</p>
          </div>

          <div>
            <p className="text-xs font-light tracking-widest uppercase mb-3" style={{ color: 'rgba(197,160,89,0.6)' }}>Comprobante de pago</p>
            {receiptUrl ? (
              <div className="relative inline-block">
                <img src={receiptUrl} alt="comprobante" className="h-24 w-32 object-cover rounded-xl border" style={{ borderColor: 'rgba(197,160,89,0.3)' }} />
                <button onClick={() => setReceiptUrl('')} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#ef4444' }}>
                  <X size={10} color="#fff" />
                </button>
              </div>
            ) : (
              <PhotoBtn onFile={setReceiptUrl} label="Comprobante" />
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.6)' }}>Armazones</p>
              <button onClick={() => setEyeglasses(prev => [...prev, newEyeglass()])}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light"
                style={{ background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.22)', color: '#C5A059' }}>
                <Plus size={12} /><Glasses size={12} />Agregar
              </button>
            </div>
            {eyeglasses.length === 0
              ? <p className="text-xs font-light text-center py-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Sin armazones</p>
              : <div className="space-y-3">{eyeglasses.map((eg, idx) => (
                  <EyeglassEditCard key={eg._id} eg={eg} idx={idx}
                    onUpdate={patch => updateEg(eg._id, patch)}
                    onRemove={() => setEyeglasses(prev => prev.filter(e => e._id !== eg._id))} />
                ))}</div>
            }
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(197,160,89,0.6)' }}>Vendedora</p>
              <input type="text" value={vendedora} onChange={e => setVendedora(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-transparent text-sm font-light text-white outline-none border"
                style={{ borderColor: 'rgba(197,160,89,0.22)' }} />
            </div>
            <div>
              <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(197,160,89,0.6)' }}>Sucursal</p>
              <select value={sucursal} onChange={e => setSucursal(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm font-light outline-none border"
                style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(197,160,89,0.22)', color: 'rgba(255,255,255,0.8)' }}>
                <option value="" style={{ background: '#111' }}>Sin sucursal</option>
                {SUCURSALES.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(197,160,89,0.6)' }}>Observaciones</p>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-transparent text-sm font-light text-white outline-none border resize-none"
              style={{ borderColor: 'rgba(197,160,89,0.22)' }} />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
              style={{ background: saving ? 'rgba(197,160,89,0.4)' : '#C5A059', color: '#000' }}>
              <Save size={14} />{saving ? 'Guardando...' : 'Guardar todos los cambios'}
            </button>
            <button onClick={onClose} className="px-5 py-3 rounded-xl text-sm font-light"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SalesHistoryPage() {
  const { profile } = useAuth();
  const { sales: allSales, refresh } = useData();
  const isAdmin     = profile?.role === 'admin' || profile?.role === 'gerente';
  const isVendedora = profile?.role === 'vendedora';

  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [editSale,     setEditSale]     = useState<any | null>(null);
  const [deliverSale,  setDeliverSale]  = useState<any | null>(null);
  const [canEdit,      setCanEdit]      = useState(false);
  const [lightboxSrc,  setLightboxSrc]  = useState<string | null>(null);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);

  // ── FIX: relee el permiso cada 30 seg para reflejar cambios desde Settings ──
  useEffect(() => {
    if (!profile) return;
    console.log('SALES DEBUG PROFILE', profile);
    console.log('SALES DEBUG ROLE', profile?.role);
    if (isAdmin) { setCanEdit(true); return; }

    const checkPerm = () => {
      supabase
        .from('optica_users')
        .select('puede_editar_ventas')
        .eq('email', profile.email)
        .maybeSingle()
        .then(({ data, error }) => {
          console.log('SALES DEBUG PERMISSION QUERY', { data, error });
          const val = data?.puede_editar_ventas ?? false;
          console.log('SALES DEBUG CAN_EDIT', val);
          setCanEdit(val);
        });
    };

    checkPerm();
    const interval = setInterval(checkPerm, 30000);
    return () => clearInterval(interval);
  }, [profile, isAdmin]);

  async function handleDelete(saleId: number, clientName: string) {
    const confirmed = window.confirm(
      `¿Eliminar la venta de ${clientName}?\n\nEsto eliminará la venta, sus pagos y el pedido de laboratorio.\nEsta acción no se puede deshacer.`
    );
    if (!confirmed) return;
    setDeletingId(String(saleId));
    try {
      await supabase.from('pagos').delete().eq('venta_id', String(saleId));
      await supabase.from('lab_orders').delete().eq('sale_id', saleId);
      await supabase.from('ventas').delete().eq('id', saleId);
      await refresh();
    } catch (err) {
      console.error('Error eliminando venta:', err);
    } finally {
      setDeletingId(null);
    }
  }

  const sales = allSales
    .filter(v => {
      if (isVendedora) return v.vendedora === profile?.full_name;
      if (branchFilter) return branchMatch(v.sucursalVenta || '', branchFilter);
      return true;
    })
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  const filtered = sales.filter(v => {
    if (statusFilter !== 'todos' && v.estadoTrabajo !== statusFilter) return false;
    if (search) {
      const q    = normalize(search);
      const name = normalize(`${v.cliente.nombre} ${v.cliente.apellido}`);
      const ci   = normalize(v.cliente.ci || '');
      const tel  = (v.cliente.telefono || '').replace(/\D/g, '');
      const qTel = search.replace(/\D/g, '');
      return name.includes(q) || ci.includes(q) || (qTel.length >= 3 && tel.includes(qTel)) || String(v.id).includes(q) || (v.vendedora || '').toLowerCase().includes(q);
    }
    return true;
  });

  const countBy        = (s: string) => sales.filter(v => v.estadoTrabajo === s).length;
  const totalFacturado = sales.reduce((s, v) => s + (Number(v.total) || 0), 0);
  const totalCobrado   = sales.reduce((s, v) => s + ((Number(v.total) || 0) - (Number(v.saldo) || 0)), 0);

  function getSaldoDisplay(v: any) {
    if (v.estadoTrabajo === 'entregado' || v.estadoTrabajo === 'cancelado') return null;
    const s = Number(v.saldo) || 0;
    return s > 0 ? s : null;
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-5xl mx-auto">
      {editSale    && <EditModal    sale={editSale}    onClose={() => setEditSale(null)}    onSaved={() => refresh()} />}
      {deliverSale && <DeliverModal sale={deliverSale} onClose={() => setDeliverSale(null)} onDelivered={() => refresh()} />}

      {lightboxSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
          onClick={() => setLightboxSrc(null)}>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <img src={lightboxSrc} alt="Vista ampliada" className="rounded-xl shadow-2xl"
              style={{ maxWidth: '90vw', maxHeight: '88vh', objectFit: 'contain' }} />
            <button onClick={() => setLightboxSrc(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center font-bold text-black"
              style={{ background: '#C5A059', fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-light tracking-wider text-white">{isVendedora ? 'Mis Ventas' : 'Historial de Ventas'}</h1>
          <p className="text-xs mt-0.5 tracking-wide" style={{ color: 'rgba(197,160,89,0.6)' }}>
            {isVendedora ? `${profile?.full_name} · solo tus ventas` : branchFilter ? `Sucursal ${branchFilter} · ${sales.length} ventas` : 'Registro completo de ventas'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <select value={branchFilter} onChange={e => { setBranchFilter(e.target.value); setStatusFilter('todos'); }}
              className="px-3 py-2 rounded-lg text-xs outline-none border"
              style={{ background: 'rgba(197,160,89,0.07)', borderColor: 'rgba(197,160,89,0.22)', color: branchFilter ? '#C5A059' : 'rgba(255,255,255,0.5)' }}>
              <option value="" style={{ background: '#111' }}>Todas las sedes</option>
              {SUCURSALES.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
            </select>
          )}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ borderColor: 'rgba(197,160,89,0.2)', background: 'rgba(255,255,255,0.02)' }}>
            <Search size={13} style={{ color: 'rgba(197,160,89,0.5)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre, C.I., celular o venta..."
              className="bg-transparent text-xs text-white outline-none w-44" />
          </div>
          <button onClick={() => refresh()} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)' }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.2)' }}>
          <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{isVendedora ? 'Mis ventas' : branchFilter ? `Ventas ${branchFilter}` : 'Total ventas'}</p>
          <p className="text-2xl font-light" style={{ color: '#C5A059' }}>{sales.length}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Entregadas</p>
          <p className="text-2xl font-light" style={{ color: '#10b981' }}>{countBy('entregado')}</p>
        </div>
        {isAdmin && (
          <>
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.2)' }}>
              <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Total facturado</p>
              <p className="text-lg font-light" style={{ color: '#C5A059' }}>Gs. {fmt(totalFacturado)}</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Total cobrado</p>
              <p className="text-lg font-light" style={{ color: '#22c55e' }}>Gs. {fmt(totalCobrado)}</p>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setStatusFilter('todos')}
          className="px-3 py-1.5 rounded-lg text-xs font-light"
          style={{ background: statusFilter==='todos' ? 'rgba(197,160,89,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${statusFilter==='todos' ? 'rgba(197,160,89,0.4)' : 'rgba(255,255,255,0.08)'}`, color: statusFilter==='todos' ? '#C5A059' : 'rgba(255,255,255,0.4)' }}>
          Todas ({sales.length})
        </button>
        {Object.entries(STATUS_CFG).map(([key, cfg]) => {
          const count = countBy(key); if (count === 0) return null;
          return (
            <button key={key} onClick={() => setStatusFilter(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light"
              style={{ background: statusFilter===key ? `${cfg.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${statusFilter===key ? cfg.color+'44' : 'rgba(255,255,255,0.08)'}`, color: statusFilter===key ? cfg.color : 'rgba(255,255,255,0.4)' }}>
              {cfg.icon}{cfg.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag size={32} style={{ color: 'rgba(197,160,89,0.2)', margin: '0 auto 12px' }} />
            <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>{search ? 'Sin resultados' : 'No hay ventas registradas'}</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {filtered.map((v, saleIdx) => {
              const key          = String(v.id);
              const isExp        = expandedId === key;
              const sc           = STATUS_CFG[v.estadoTrabajo] ?? STATUS_CFG.pendiente;
              const name         = `${v.cliente.nombre} ${v.cliente.apellido}`.trim() || '—';
              const anteojos     = (v.anteojos as any[]) || [];
              const waUrl        = v.cliente.telefono ? `https://wa.me/595${v.cliente.telefono.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola ${v.cliente.nombre}! Te contactamos de Óptica Excelent.`)}` : null;
              const fechaStr     = new Date(v.fecha).toLocaleDateString('es-PY', { day:'2-digit', month:'2-digit', year:'2-digit' });
              const saldoVisible = getSaldoDisplay(v);
              const isEntregado  = v.estadoTrabajo === 'entregado';
              const hasConfirmar = anteojos.some((eg: any) => eg.receta_a_confirmar);
              const isDeleting   = deletingId === key;

              console.log('SALES DEBUG SHOW EDIT BUTTON', { canEdit, saleId: v.id });
              return (
                <div key={key}>
                  <div className="px-4 py-3.5 cursor-pointer" style={{ background: isExp ? 'rgba(197,160,89,0.03)' : 'transparent' }}
                    onClick={() => setExpandedId(isExp ? null : key)}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0" style={{ background: '#C5A059', fontSize: 10 }}>{saleIdx + 1}</span>
                      <p className="text-sm text-white font-light flex-1 truncate">{name}</p>
                      {canEdit && !isEntregado && v.estadoTrabajo !== 'cancelado' && (
                        <button onClick={e => { e.stopPropagation(); setDeliverSale(v); }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-light shrink-0"
                          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
                          <Package size={11} /><span className="hidden lg:inline">Entregar</span>
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={e => { e.stopPropagation(); setEditSale(v); }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-light shrink-0"
                          style={{ background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.2)', color: 'rgba(197,160,89,0.7)' }}>
                          <Pencil size={11} /><span className="hidden lg:inline">Editar</span>
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={e => { e.stopPropagation(); handleDelete(v.id, name); }} disabled={isDeleting}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-light shrink-0"
                          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: isDeleting ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.7)', cursor: isDeleting ? 'not-allowed' : 'pointer' }}>
                          <Trash2 size={11} /><span className="hidden lg:inline">{isDeleting ? '...' : 'Eliminar'}</span>
                        </button>
                      )}
                      <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)', transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap pl-8 mb-1.5">
                      <span className="text-xs font-mono" style={{ color: '#C5A059' }}>VTA-{v.id}</span>
                      {v.sucursalVenta && <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>· {v.sucursalVenta}</span>}
                      {isAdmin && v.vendedora && <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>· {v.vendedora}</span>}
                      <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>· {fechaStr}</span>
                      {hasConfirmar && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs"
                          style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.28)' }}>
                          <AlertTriangle size={9} />Receta pendiente
                        </span>
                      )}
                    </div>
                    {(v.cliente.ci || v.cliente.telefono) && (
                      <div className="flex items-center gap-3 pl-8 mb-1.5">
                        {v.cliente.ci && <span className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.6)' }}>CI: {v.cliente.ci}</span>}
                        {v.cliente.telefono && <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>📞 {v.cliente.telefono}</span>}
                      </div>
                    )}
                    <div className="flex items-center gap-3 pl-8 flex-wrap">
                      <div>
                        <span className="text-xs text-white font-light">Gs. {fmt(Number(v.total))}</span>
                        <span className="text-xs font-light ml-1.5" style={{ color: '#10b981' }}>Pagó {fmt(Number(v.sena))}</span>
                      </div>
                      {saldoVisible !== null
                        ? <span className="text-xs font-light" style={{ color: '#f59e0b' }}>Debe Gs. {fmt(saldoVisible)}</span>
                        : <span className="text-xs font-light" style={{ color: '#10b981' }}>✓ Pagado</span>}
                      <span className="px-2 py-0.5 rounded text-xs font-light inline-flex items-center gap-1" style={{ background: `${sc.color}18`, color: sc.color }}>{sc.icon}{sc.label}</span>
                    </div>
                  </div>

                  {isExp && (
                    <div className="px-4 pb-5 space-y-4" style={{ background: 'rgba(197,160,89,0.02)' }}>
                      <div className="flex items-center gap-3 pt-2 flex-wrap">
                        {v.cliente.telefono && <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.45)' }}>📞 {v.cliente.telefono}</span>}
                        {v.cliente.ci && <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>CI: {v.cliente.ci}</span>}
                        <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          📅 {new Date(v.fecha).toLocaleDateString('es-PY', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}
                        </span>
                        {waUrl && (
                          <a href={waUrl} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light"
                            style={{ background: 'rgba(37,211,102,0.1)', color: '#25D366', border: '1px solid rgba(37,211,102,0.25)' }}>
                            <MessageCircle size={12} />WhatsApp
                          </a>
                        )}
                        {canEdit && !isEntregado && v.estadoTrabajo !== 'cancelado' && (
                          Number(v.saldo) > 0 ? (
                            <div className="flex flex-col items-start gap-0.5">
                              <button
                                disabled
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light cursor-not-allowed opacity-40"
                                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
                                <Package size={12} />Marcar como entregado
                              </button>
                              <span className="text-xs font-light" style={{ color: 'rgba(245,158,11,0.8)', paddingLeft: 2 }}>
                                Saldo pendiente: no se puede entregar
                              </span>
                            </div>
                          ) : (
                            <button onClick={() => setDeliverSale(v)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light"
                              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
                              <Package size={12} />Marcar como entregado
                            </button>
                          )
                        )}
                        {canEdit && (
                          <button onClick={() => setEditSale(v)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light"
                            style={{ background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.25)', color: '#C5A059' }}>
                            <Pencil size={12} />Editar venta
                          </button>
                        )}
                      </div>

                      {anteojos.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.55)' }}>Lentes vendidos</p>
                          {anteojos.map((eg: any, i: number) => (
                            <div key={i} className="rounded-xl p-4 space-y-3"
                              style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${eg.receta_a_confirmar ? 'rgba(249,115,22,0.28)' : 'rgba(197,160,89,0.12)'}` }}>
                              <div className="flex items-start gap-3">
                                {eg.photo_url
                                  ? <img src={eg.photo_url} alt="armazón"
                                      className="w-20 h-16 object-cover rounded-lg border shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                      style={{ borderColor: 'rgba(197,160,89,0.3)' }}
                                      onClick={e => { e.stopPropagation(); setLightboxSrc(eg.photo_url); }} />
                                  : <div className="w-20 h-16 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(197,160,89,0.1)' }}>
                                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Sin foto</span>
                                    </div>
                                }
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.7)' }}>Armazón {i + 1}</p>
                                    {eg.receta_a_confirmar && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs"
                                        style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.28)' }}>
                                        <AlertTriangle size={9} />Receta pendiente
                                      </span>
                                    )}
                                  </div>
                                  {eg.frame_description && <p className="text-sm text-white font-light">{eg.frame_description}</p>}
                                  <div className="flex gap-2 flex-wrap">
                                    {eg.crystals   && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>{eg.crystals}</span>}
                                    {eg.treatments && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>{eg.treatments}</span>}
                                  </div>
                                  {eg.receta_url && (
                                    <div className="mt-2">
                                      <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>📋 Foto de receta</p>
                                      <img src={eg.receta_url} alt="receta"
                                        className="h-20 w-28 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                                        style={{ borderColor: 'rgba(59,130,246,0.35)' }}
                                        onClick={e => { e.stopPropagation(); setLightboxSrc(eg.receta_url); }} />
                                    </div>
                                  )}
                                </div>
                              </div>

                              {hasRxData(eg.prescription) && !eg.receta_a_confirmar && (
                                <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.18)' }}>
                                  <p className="text-xs font-light tracking-widest uppercase flex items-center gap-1.5" style={{ color: 'rgba(197,160,89,0.7)' }}>
                                    <FlaskConical size={11} style={{ color: '#3b82f6' }} />Receta óptica
                                  </p>
                                  <div className="grid grid-cols-1 gap-3">
                                    {[['OD', 'od'], ['OI', 'oi']].map(([label, key]) => (
                                      <div key={key}>
                                        <p className="text-xs font-light mb-1" style={{ color: '#C5A059' }}>{label}</p>
                                        <div className="grid grid-cols-2 gap-1">
                                          {[['Esf',`${key}_esfera`],['Cil',`${key}_cilindro`],['Eje',`${key}_eje`],['Alt',`${key}_altura`]].map(([fl,fk]) => (
                                            <div key={fk} className="flex items-center gap-1">
                                              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, minWidth: 24 }}>{fl}:</span>
                                              <span className="px-2 py-1 rounded text-xs font-mono flex-1 text-center"
                                                style={{ background: 'rgba(255,255,255,0.06)', color: eg.prescription[fk] ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.2)' }}>
                                                {eg.prescription[fk] || '—'}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  {(eg.prescription.add || eg.prescription.dp || eg.prescription.obs) && (
                                    <div className="flex gap-3 flex-wrap pt-1">
                                      {[['ADD','add'],['DP','dp'],['Obs','obs']].map(([fl,fk]) => (
                                        eg.prescription[fk] ? (
                                          <div key={fk} className="flex items-center gap-1">
                                            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{fl}:</span>
                                            <span className="px-2 py-1 rounded text-xs font-mono"
                                              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.75)' }}>
                                              {eg.prescription[fk]}
                                            </span>
                                          </div>
                                        ) : null
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {v.observaciones && (
                        <div className="px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>📝 {v.observaciones}</p>
                        </div>
                      )}
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
