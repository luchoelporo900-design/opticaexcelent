import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, X, Save, ChevronUp, Glasses, Banknote, CreditCard,
  Smartphone, QrCode, Send, MapPin, Truck, Store, Package, User, FileText,
  Check, AlertCircle, Trash2, ShoppingBag, Hash, Clock,
  Building2, Camera, Image, Wrench, AlertTriangle, Calendar,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { saveSale as saveToStorage, uploadToCloudinary } from '../lib/salesStorage';
import { supabase } from '../lib/supabase';

type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'qr' | 'giro';
type SaleStatus    = 'pendiente' | 'en_proceso' | 'en_laboratorio' | 'listo' | 'pagado_total' | 'entregado' | 'cancelado';
type DeliveryType  = 'retiro' | 'delivery' | 'encomienda';
type Channel       = 'local' | 'online';
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

type InsumoItem = {
  _id: string;
  descripcion: string;
  precio: string;
  photo_url: string;
};

type PaymentEntry = {
  _id: string;
  method: PaymentMethod;
  amount: string;
  reference: string;
  receipts: string[];
};

const FIXED_BRANCHES = [
  { id: 'pettirossi', name: 'Pettirossi' },
  { id: 'azara',      name: 'Azara' },
  { id: 'lambere',    name: 'Lambaré' },
  { id: 'acceso_sur', name: 'Acceso Sur' },
  { id: 'capiata',    name: 'Capiatá' },
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

const SALE_TYPES: { id: SaleType; label: string; sublabel: string; color: string; icon: React.ReactNode }[] = [
  { id: 'completa',   label: '1 venta completa',   sublabel: 'Suma en comisiones',    color: '#10b981', icon: <Check size={11} /> },
  { id: 'media',      label: '½ media venta',       sublabel: 'Suma la mitad',         color: '#f59e0b', icon: <span style={{ fontSize: 11, fontWeight: 600 }}>½</span> },
  { id: 'reparacion', label: 'Reparación / Insumo', sublabel: 'No suma en comisiones', color: '#a78bfa', icon: <Wrench size={11} /> },
];

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function fmt(n: number) { return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function emptyRx(): Prescription {
  return { od_esfera:'', od_cilindro:'', od_eje:'', od_altura:'', oi_esfera:'', oi_cilindro:'', oi_eje:'', oi_altura:'', add:'', dp:'', obs:'' };
}
function newEyeglass(): EyeglassItem {
  return {
    _id: uid(), frame_description:'', photo_url:'', receta_url:'', crystals:'', treatments:'',
    showReceta: false, prescription: emptyRx(), price:'', saleType:'completa', receta_a_confirmar: false,
  };
}
function newInsumo(): InsumoItem { return { _id: uid(), descripcion: '', precio: '', photo_url: '' }; }
function newPayment(): PaymentEntry { return { _id: uid(), method: 'efectivo', amount: '', reference: '', receipts: [] }; }

// ── Helpers de fecha ──────────────────────────────────────────────────────────
function getTodayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
function getTodayTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}
function buildIso(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}
function isToday(dateStr: string): boolean {
  return dateStr === getTodayDate();
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

function PhotoBtn({ onFile, label }: { onFile: (url: string) => void; label?: string }) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    try { const url = await uploadToCloudinary(file); onFile(url); }
    catch { alert('Error al subir la foto. Intentá de nuevo.'); }
  }
  return (
    <div className="flex gap-1.5">
      <button onClick={() => camRef.current?.click()}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border"
        style={{ borderColor: 'rgba(197,160,89,0.25)', color: 'rgba(197,160,89,0.8)', background: 'rgba(197,160,89,0.05)' }}>
        <Camera size={12} />{label ? `${label} Cám.` : 'Cám.'}
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

function ReceiptMulti({ receipts, onChange }: { receipts: string[]; onChange: (r: string[]) => void }) {
  function addReceipt(url: string) { if (receipts.length >= 3) return; onChange([...receipts, url]); }
  function removeReceipt(i: number) { onChange(receipts.filter((_, idx) => idx !== i)); }
  return (
    <div>
      <p className="text-xs font-light mb-2" style={{ color: 'rgba(255,255,255,0.42)' }}>
        Comprobantes <span style={{ color: 'rgba(255,255,255,0.25)' }}>(hasta 3 fotos)</span>
      </p>
      <div className="flex items-start gap-2 flex-wrap">
        {receipts.map((url, i) => (
          <div key={i} className="relative">
            <img src={url} alt={`comprobante ${i+1}`} className="h-20 w-24 object-cover rounded-xl border" style={{ borderColor: 'rgba(197,160,89,0.25)' }} />
            <button onClick={() => removeReceipt(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#ef4444' }}>
              <X size={9} color="#fff" />
            </button>
          </div>
        ))}
        {receipts.length < 3 && <PhotoBtn onFile={addReceipt} />}
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

function SimpleEyeglassCard({ eg, idx, onUpdate, onRemove }: {
  eg: EyeglassItem; idx: number;
  onUpdate: (p: Partial<EyeglassItem>) => void;
  onRemove: () => void;
}) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searching,   setSearching]   = useState(false);
  const [stockFrame,  setStockFrame]  = useState<any | null>(null);
  const currentType = eg.saleType ?? 'completa';

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    try { const url = await uploadToCloudinary(file); onUpdate({ photo_url: url }); }
    catch { alert('Error al subir la foto. Intentá de nuevo.'); }
  }

  async function handleFrameInput(val: string) {
    onUpdate({ frame_description: val, stock_frame_id: undefined });
    setStockFrame(null);
    if (val.trim().length < 2) { setSuggestions([]); return; }
    setSearching(true);
    const { data } = await supabase.from('armazones')
      .select('id, codigo, nombre, foto_url, precio, stock_pettirossi, stock_azara, stock_lambere, stock_accesosur, stock_capiata')
      .or(`codigo.ilike.%${val.trim()}%,nombre.ilike.%${val.trim()}%`).limit(5);
    setSuggestions(data || []);
    setSearching(false);
  }

  function selectFrame(frame: any) {
    onUpdate({ frame_description: frame.codigo, photo_url: frame.foto_url || '', stock_frame_id: frame.id, price: frame.precio ? String(frame.precio) : eg.price });
    setStockFrame(frame); setSuggestions([]);
  }

  const totalStockFrame = stockFrame ? (stockFrame.stock_pettirossi||0)+(stockFrame.stock_azara||0)+(stockFrame.stock_lambere||0)+(stockFrame.stock_accesosur||0)+(stockFrame.stock_capiata||0) : 0;
  const activeCfg = SALE_TYPES.find(t => t.id === currentType) ?? SALE_TYPES[0];

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(197,160,89,0.16)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(197,160,89,0.09)' }}>
        <div className="flex items-center gap-2.5">
          <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium text-black shrink-0" style={{ background: '#C5A059' }}>{idx + 1}</span>
          <span className="text-sm font-light text-white truncate max-w-[130px]">{eg.frame_description || `Anteojo ${idx + 1}`}</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-light inline-flex items-center gap-1 shrink-0"
            style={{ background: `${activeCfg.color}15`, color: activeCfg.color, border: `1px solid ${activeCfg.color}30` }}>
            {activeCfg.icon}<span className="hidden sm:inline">{activeCfg.label}</span>
          </span>
          {eg.price && <span className="text-xs font-light shrink-0" style={{ color: '#C5A059' }}>Gs. {fmt(Number(eg.price))}</span>}
          {eg.receta_a_confirmar && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs shrink-0"
              style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.30)' }}>
              <AlertTriangle size={9} />A confirmar
            </span>
          )}
        </div>
        <button onClick={onRemove} style={{ color: 'rgba(239,68,68,0.45)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.45)')}>
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Armazón</p>
          <div className="flex gap-3 items-start">
            <div className="flex-1 relative">
              <input type="text" value={eg.frame_description} onChange={e => handleFrameInput(e.target.value)}
                placeholder="Código del stock o descripción libre"
                className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border"
                style={{ borderColor: eg.stock_frame_id ? 'rgba(34,197,94,0.4)' : 'rgba(197,160,89,0.22)' }} />
              {searching && <p className="text-xs mt-1 px-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Buscando...</p>}
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-50"
                  style={{ background: '#0d0d0d', border: '1px solid rgba(197,160,89,0.25)', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                  {suggestions.map(s => {
                    const tot = (s.stock_pettirossi||0)+(s.stock_azara||0)+(s.stock_lambere||0)+(s.stock_accesosur||0)+(s.stock_capiata||0);
                    return (
                      <button key={s.id} onClick={() => selectFrame(s)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(197,160,89,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {s.foto_url
                          ? <img src={s.foto_url} alt={s.nombre} className="w-10 h-8 rounded object-cover shrink-0" style={{ border: '1px solid rgba(197,160,89,0.2)' }} />
                          : <div className="w-10 h-8 rounded shrink-0 flex items-center justify-center" style={{ background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.12)' }}>
                              <Glasses size={12} style={{ color: 'rgba(197,160,89,0.4)' }} />
                            </div>}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white font-light truncate">{s.nombre}</p>
                          <p className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.6)' }}>#{s.codigo} · Stock: {tot} uds.{s.precio ? ` · Gs. ${fmt(s.precio)}` : ''}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
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
                <div className="flex flex-col gap-1">
                  <button onClick={() => camRef.current?.click()} className="w-16 h-6 rounded flex items-center justify-center gap-1 border text-xs" style={{ borderColor: 'rgba(197,160,89,0.22)', background: 'rgba(197,160,89,0.06)', color: 'rgba(197,160,89,0.7)' }}>
                    <Camera size={10} /><span style={{ fontSize: 9 }}>Cám.</span>
                  </button>
                  <button onClick={() => galRef.current?.click()} className="w-16 h-6 rounded flex items-center justify-center gap-1 border text-xs" style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.4)' }}>
                    <Image size={10} /><span style={{ fontSize: 9 }}>Gal.</span>
                  </button>
                  <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
                  <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                </div>
              )}
            </div>
          </div>
          {eg.stock_frame_id && stockFrame && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.22)' }}>
              <Check size={12} style={{ color: '#22c55e', flexShrink: 0 }} />
              <span className="text-xs font-light" style={{ color: '#22c55e' }}>{stockFrame.nombre} · Stock: {totalStockFrame} uds. · Se descontará 1 al guardar</span>
            </div>
          )}
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

        <div>
          <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Precio de este anteojo (Gs.) <span style={{ color: 'rgba(255,255,255,0.25)' }}>— armazón + cristales + receta</span>
          </p>
          <input type="number" value={eg.price} onChange={e => onUpdate({ price: e.target.value })} placeholder="Ej: 350000"
            className="w-full px-3 py-2.5 rounded-xl bg-transparent text-sm font-light outline-none border text-right"
            style={{ borderColor: 'rgba(197,160,89,0.30)', color: '#C5A059' }} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Cristales</p>
            <input type="text" value={eg.crystals} onChange={e => onUpdate({ crystals: e.target.value })} placeholder="monofocal, multifocal..."
              className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border" style={{ borderColor: 'rgba(197,160,89,0.22)' }} />
          </div>
          <div>
            <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Tratamiento</p>
            <input type="text" value={eg.treatments} onChange={e => onUpdate({ treatments: e.target.value })} placeholder="antirreflejo, filtro azul..."
              className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border" style={{ borderColor: 'rgba(197,160,89,0.22)' }} />
          </div>
        </div>

        <div>
          <p className="text-xs font-light mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Tipo de venta:</p>
          <div className="flex gap-2 flex-wrap">
            {SALE_TYPES.map(t => (
              <button key={t.id} onClick={() => onUpdate({ saleType: t.id })}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                style={{ background: currentType===t.id ? `${t.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${currentType===t.id ? t.color+'55' : 'rgba(255,255,255,0.08)'}`, color: currentType===t.id ? t.color : 'rgba(255,255,255,0.38)' }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
          {currentType === 'reparacion' && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.20)' }}>
              <Wrench size={11} style={{ color: '#a78bfa', flexShrink: 0 }} />
              <span className="text-xs font-light" style={{ color: 'rgba(167,139,250,0.8)' }}>Reparación / Insumo — no suma en comisiones</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => onUpdate({ showReceta: !eg.showReceta, receta_a_confirmar: false })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-light"
            style={{ color: 'rgba(197,160,89,0.7)', border: '1px solid rgba(197,160,89,0.20)' }}>
            {eg.showReceta ? <ChevronUp size={11} /> : <Plus size={11} />}
            {eg.showReceta ? 'Ocultar receta' : '+ Completar receta'}
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
                <RxInput label="Esfera"   value={eg.prescription.od_esfera}   onChange={v => onUpdate({ prescription: { ...eg.prescription, od_esfera: v } })}   placeholder="-2.00" />
                <RxInput label="Cilindro" value={eg.prescription.od_cilindro} onChange={v => onUpdate({ prescription: { ...eg.prescription, od_cilindro: v } })} placeholder="-0.50" />
                <RxInput label="Eje"      value={eg.prescription.od_eje}      onChange={v => onUpdate({ prescription: { ...eg.prescription, od_eje: v } })}      placeholder="180" />
                <RxInput label="Altura"   value={eg.prescription.od_altura}   onChange={v => onUpdate({ prescription: { ...eg.prescription, od_altura: v } })}   placeholder="20" />
              </div>
            </div>
            <div>
              <p className="text-xs font-light mb-2" style={{ color: '#C5A059' }}>OI — Ojo Izquierdo</p>
              <div className="grid grid-cols-2 gap-2">
                <RxInput label="Esfera"   value={eg.prescription.oi_esfera}   onChange={v => onUpdate({ prescription: { ...eg.prescription, oi_esfera: v } })}   placeholder="-1.75" />
                <RxInput label="Cilindro" value={eg.prescription.oi_cilindro} onChange={v => onUpdate({ prescription: { ...eg.prescription, oi_cilindro: v } })} placeholder="-0.25" />
                <RxInput label="Eje"      value={eg.prescription.oi_eje}      onChange={v => onUpdate({ prescription: { ...eg.prescription, oi_eje: v } })}      placeholder="175" />
                <RxInput label="Altura"   value={eg.prescription.oi_altura}   onChange={v => onUpdate({ prescription: { ...eg.prescription, oi_altura: v } })}   placeholder="20" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <RxInput label="ADD" value={eg.prescription.add} onChange={v => onUpdate({ prescription: { ...eg.prescription, add: v } })} placeholder="+2.00" />
              <RxInput label="DP"  value={eg.prescription.dp}  onChange={v => onUpdate({ prescription: { ...eg.prescription, dp: v } })}  placeholder="64" />
              <div>
                <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Obs</p>
                <input type="text" value={eg.prescription.obs} onChange={e => onUpdate({ prescription: { ...eg.prescription, obs: e.target.value } })}
                  className="w-full px-2.5 py-2 rounded-lg bg-transparent text-white text-xs font-light outline-none border" style={{ borderColor: 'rgba(197,160,89,0.20)' }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentCard({ pay, idx, total, onUpdate, onRemove, canRemove }: {
  pay: PaymentEntry; idx: number; total: number;
  onUpdate: (p: Partial<PaymentEntry>) => void;
  onRemove: () => void; canRemove: boolean;
}) {
  const mc = PAY_METHODS.find(m => m.id === pay.method)?.color ?? '#C5A059';
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${mc}28` }}>
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${mc}18` }}>
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0" style={{ background: mc }}>{idx + 1}</span>
          <span className="text-xs font-light text-white">Pago {idx + 1}</span>
          {pay.amount && <span className="text-xs font-light" style={{ color: mc }}>Gs. {fmt(Number(pay.amount))}</span>}
        </div>
        {canRemove && (
          <button onClick={onRemove} style={{ color: 'rgba(239,68,68,0.5)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.5)')}>
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <div className="p-3 space-y-3">
        <div className="flex gap-1.5 flex-wrap">
          {PAY_METHODS.map(m => (
            <button key={m.id} onClick={() => onUpdate({ method: m.id })}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-light"
              style={{ background: pay.method===m.id ? `${m.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${pay.method===m.id ? m.color+'44' : 'rgba(255,255,255,0.08)'}`, color: pay.method===m.id ? m.color : 'rgba(255,255,255,0.42)' }}>
              {m.icon}{m.label}
            </button>
          ))}
        </div>
        <div>
          <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Monto <span style={{ color: 'rgba(255,255,255,0.25)' }}>(dejar vacío = todo el total)</span>
          </p>
          <input type="number" value={pay.amount} onChange={e => onUpdate({ amount: e.target.value })} placeholder={fmt(total)}
            className="w-full px-3 py-2 rounded-xl bg-transparent text-sm font-light outline-none border text-right"
            style={{ borderColor: `${mc}44`, color: mc }} />
        </div>
        {(pay.method === 'transferencia' || pay.method === 'giro') && (
          <input type="text" value={pay.reference} onChange={e => onUpdate({ reference: e.target.value })}
            placeholder="Banco / referencia / número de transferencia"
            className="w-full px-3 py-2 rounded-xl bg-transparent text-white text-xs font-light outline-none border"
            style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
        )}
        <ReceiptMulti receipts={pay.receipts} onChange={r => onUpdate({ receipts: r })} />
      </div>
    </div>
  );
}

export default function POSPage() {
  const { profile } = useAuth();
  const [saleNumber] = useState(`VTA-${Date.now().toString().slice(-8)}`);
  const today = new Date().toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // ✅ Fecha editable — por defecto hoy
  const [saleDate, setSaleDate] = useState(getTodayDate());
  const [saleTime, setSaleTime] = useState(getTodayTime());

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
  const [insumos,    setInsumos]    = useState<InsumoItem[]>([]);
  const [payments,   setPayments]   = useState<PaymentEntry[]>([newPayment()]);
  const [status, setStatus] = useState<SaleStatus>('pendiente');
  const [notes,  setNotes]  = useState('');
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState('');
  const [saveErr, setSaveErr] = useState('');
  const [saleTotal,   setSaleTotal]   = useState('');
  const [saleDeposit, setSaleDeposit] = useState('');

  const totalNum   = parseFloat(saleTotal)   || 0;
  const depositNum = parseFloat(saleDeposit) || 0;
  const sumPrices  = eyeglasses.reduce((s, eg) => s + (parseFloat(eg.price) || 0), 0);

  useEffect(() => {
    if (profile?.branch_id) {
      const bid = profile.branch_id.toLowerCase().replace(/ /g,'_').replace(/é/g,'e').replace(/á/g,'a');
      setSaleBranch(bid); setDelBranch(bid); setPayBranch(bid);
    }
  }, [profile?.branch_id]);

  function addEyeglass()              { setEyeglasses(prev => [...prev, newEyeglass()]); }
  function removeEyeglass(id: string) { setEyeglasses(prev => prev.filter(eg => eg._id !== id)); }
  function updateEg(id: string, patch: Partial<EyeglassItem>) { setEyeglasses(prev => prev.map(eg => eg._id === id ? { ...eg, ...patch } : eg)); }
  function addInsumo()               { setInsumos(prev => [...prev, newInsumo()]); }
  function removeInsumo(id: string)  { setInsumos(prev => prev.filter(i => i._id !== id)); }
  function updateInsumo(id: string, patch: Partial<InsumoItem>) { setInsumos(prev => prev.map(i => i._id === id ? { ...i, ...patch } : i)); }
  function updatePay(id: string, patch: Partial<PaymentEntry>) { setPayments(prev => prev.map(p => p._id === id ? { ...p, ...patch } : p)); }
  function addPayment()              { setPayments(prev => [...prev, newPayment()]); }
  function removePayment(id: string) { setPayments(prev => prev.filter(p => p._id !== id)); }

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
      const allReceipts    = payments.flatMap(p => p.receipts);

      const finalDeposit = depositNum > 0 ? depositNum : 0;
      const finalBalance = Math.max(0, totalNum - finalDeposit);

      // ✅ Usar la fecha seleccionada por la vendedora
      const fechaISO = buildIso(saleDate, saleTime);

      await saveToStorage({
        id: saleId, fecha: fechaISO,
        cliente: { nombre: nFirst.trim(), apellido: nLast.trim(), telefono: nPhone.trim(), ci: nCi.trim() },
        sucursalVenta: saleBranchName, sucursalEntrega: delBranchName, sucursalCobro: payBranchName,
        vendedora: sellerName, total: totalNum, sena: finalDeposit, saldo: finalBalance,
        metodoPago: primaryMethod, estadoTrabajo: status,
        anteojos: [
          ...eyeglasses,
          ...insumos.map(ins => ({
            _id: ins._id, frame_description: ins.descripcion, photo_url: ins.photo_url, receta_url: '',
            crystals: '', treatments: '', showReceta: false, prescription: emptyRx(),
            price: ins.precio, saleType: 'reparacion' as SaleType, tipo: 'insumo',
          })),
        ],
        observaciones: notes, receipt_url: allReceipts[0] || undefined,
        channel, deliveryType: delType, deliveryAddress: delAddress || undefined,
        pagos: payments.map(p => ({ metodo: p.method, monto: parseFloat(p.amount) || totalNum, referencia: p.reference || undefined, receipts: p.receipts })),
      } as any);

      for (const eg of eyeglasses) {
        if (eg.stock_frame_id) {
          const { data: frame } = await supabase.from('armazones').select('*').eq('id', eg.stock_frame_id).single();
          if (frame) {
            const sedeKey = (() => {
              const n = saleBranchName.toLowerCase().replace(/á/g,'a').replace(/é/g,'e').replace(/ú/g,'u');
              if (n.includes('pettirossi'))               return 'stock_pettirossi';
              if (n.includes('azara'))                    return 'stock_azara';
              if (n.includes('lambere') || n.includes('lambare')) return 'stock_lambere';
              if (n.includes('acceso') || n.includes('sur'))      return 'stock_accesosur';
              if (n.includes('capiata'))                  return 'stock_capiata';
              return 'stock_pettirossi';
            })();
            await supabase.from('armazones').update({ [sedeKey]: Math.max(0, (frame[sedeKey]||0) - 1), updated_at: new Date().toISOString() }).eq('id', eg.stock_frame_id);
            await supabase.from('stock_movimientos').insert([{ armazon_id: eg.stock_frame_id, armazon_nombre: frame.nombre, armazon_codigo: frame.codigo, cantidad: 1, tipo: 'venta', sucursal: saleBranchName, vendedora: sellerName, venta_id: String(saleId) }]);
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
    setEyeglasses([]); setInsumos([]);
    setSaleTotal(''); setSaleDeposit('');
    setPayments([newPayment()]); setNotes(''); setStatus('pendiente');
    setChannel('local'); setDelType('retiro');
    setDelAddress(''); setDelRef(''); setDelPhone('');
    setShipCo(''); setShipCity(''); setShipRec(''); setShipPhone(''); setShipTrack('');
    setSaveErr('');
    setSaleDate(getTodayDate()); setSaleTime(getTodayTime()); // ✅ reset fecha
    if (profile?.branch_id) {
      const bid = profile.branch_id.toLowerCase().replace(/ /g,'_').replace(/é/g,'e').replace(/á/g,'a');
      setSaleBranch(bid); setDelBranch(bid); setPayBranch(bid);
    }
  }

  const branchOpts = [
    <option key="" value="" style={{ background: '#0a0908' }}>— Seleccionar —</option>,
    ...FIXED_BRANCHES.map(b => <option key={b.id} value={b.id} style={{ background: '#0a0908' }}>{b.name}</option>),
  ];

  const depositInfoColor = saleDeposit === '' || depositNum === 0 ? '#f59e0b' : depositNum >= totalNum ? '#10b981' : 'rgba(255,255,255,0.3)';
  const depositInfoText  = saleDeposit === '' || depositNum === 0
    ? '⚠ Sin seña — quedará saldo pendiente por el total'
    : depositNum >= totalNum
      ? '✓ Cobrado completo'
      : `Saldo pendiente: Gs. ${fmt(Math.max(0, totalNum - depositNum))}`;

  const fechaPasada = !isToday(saleDate);

  return (
    <div className="min-h-screen">
      <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-4" style={{ maxWidth: 680 }}>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-light tracking-wider text-white">Nueva Venta</h1>
            <p className="text-xs font-light mt-1 capitalize tracking-wide" style={{ color: 'rgba(197,160,89,0.65)' }}>{today}</p>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-light" style={{ background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.2)', color: '#C5A059' }}>
              <Hash size={11} />{saleNumber}
            </div>
            <button onClick={resetForm} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-light" style={{ color: 'rgba(239,68,68,0.65)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <X size={13} />Cancelar
            </button>
          </div>
        </div>

        {saveErr && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl border text-sm font-light" style={{ background: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.28)', color: '#ef4444' }}>
            <AlertCircle size={15} />{saveErr}
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl border text-sm font-light" style={{ background: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.28)', color: '#10b981' }}>
            <Check size={15} />{saved}
          </div>
        )}

        {/* ✅ FECHA DE LA VENTA */}
        <Section title="Fecha de la venta" icon={<Calendar size={15} />}>
          <div className="space-y-3">
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <FieldLabel>Fecha</FieldLabel>
                <input
                  type="date"
                  value={saleDate}
                  onChange={e => setSaleDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border"
                  style={{ borderColor: fechaPasada ? 'rgba(245,158,11,0.5)' : 'rgba(197,160,89,0.22)', colorScheme: 'dark' }}
                />
              </div>
              <div style={{ minWidth: 120 }}>
                <FieldLabel>Hora</FieldLabel>
                <input
                  type="time"
                  value={saleTime}
                  onChange={e => setSaleTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border"
                  style={{ borderColor: 'rgba(197,160,89,0.22)', colorScheme: 'dark' }}
                />
              </div>
            </div>
            {fechaPasada && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.30)' }}>
                <AlertTriangle size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />
                <span className="text-xs font-light" style={{ color: '#f59e0b' }}>
                  Estás cargando una venta con fecha pasada — aparecerá en los reportes y caja de ese día.
                </span>
              </div>
            )}
          </div>
        </Section>

        <Section title="Cliente" icon={<User size={15} />}>
          <div className="grid grid-cols-2 gap-3">
            <div><FieldLabel>Nombre <span style={{ color: '#C5A059' }}>*</span></FieldLabel><GoldInput value={nFirst} onChange={setNFirst} placeholder="Nombre" /></div>
            <div><FieldLabel>Apellido <span style={{ color: '#C5A059' }}>*</span></FieldLabel><GoldInput value={nLast} onChange={setNLast} placeholder="Apellido" /></div>
            <div><FieldLabel>Teléfono / WhatsApp</FieldLabel><GoldInput value={nPhone} onChange={setNPhone} placeholder="0981-000000" /></div>
            <div><FieldLabel>C.I.</FieldLabel><GoldInput value={nCi} onChange={setNCi} placeholder="Número de cédula" /></div>
          </div>
        </Section>

        <Section title="Sucursales" icon={<Building2 size={15} />}>
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.20)' }}>
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

        <Section title="Canal de Venta y Entrega" icon={<Truck size={15} />}>
          <div className="space-y-4">
            <div className="flex gap-2">
              {([{ v:'local' as const, l:'Local', ic:<Store size={13}/> }, { v:'online' as const, l:'Online', ic:<ShoppingBag size={13}/> }]).map(opt => (
                <button key={opt.v} onClick={() => setChannel(opt.v)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-light flex-1 justify-center"
                  style={{ background: channel===opt.v ? 'rgba(197,160,89,0.14)' : 'rgba(255,255,255,0.03)', border: `1px solid ${channel===opt.v ? 'rgba(197,160,89,0.44)' : 'rgba(255,255,255,0.08)'}`, color: channel===opt.v ? '#C5A059' : 'rgba(255,255,255,0.44)' }}>
                  {opt.ic}{opt.l}
                </button>
              ))}
            </div>
            <div>
              <FieldLabel>Tipo de entrega</FieldLabel>
              <div className="flex gap-2 flex-wrap">
                {([
                  { v:'retiro' as const,     l:'Retiro en sucursal', ic:<Store   size={12}/> },
                  { v:'delivery' as const,   l:'Delivery',           ic:<MapPin  size={12}/> },
                  { v:'encomienda' as const, l:'Encomienda',         ic:<Package size={12}/> },
                ]).map(opt => (
                  <button key={opt.v} onClick={() => setDelType(opt.v)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-light"
                    style={{ background: delType===opt.v ? 'rgba(197,160,89,0.14)' : 'rgba(255,255,255,0.03)', border: `1px solid ${delType===opt.v ? 'rgba(197,160,89,0.44)' : 'rgba(255,255,255,0.08)'}`, color: delType===opt.v ? '#C5A059' : 'rgba(255,255,255,0.44)' }}>
                    {opt.ic}{opt.l}
                  </button>
                ))}
              </div>
            </div>
            {delType === 'retiro' && <div><FieldLabel>Sucursal de retiro</FieldLabel><GoldSelect value={delBranch} onChange={setDelBranch}>{branchOpts}</GoldSelect></div>}
            {delType === 'delivery' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><FieldLabel>Dirección</FieldLabel><GoldInput value={delAddress} onChange={setDelAddress} placeholder="Calle y número" /></div>
                <div><FieldLabel>Referencia</FieldLabel><GoldInput value={delRef} onChange={setDelRef} placeholder="Entre calles..." /></div>
                <div><FieldLabel>Teléfono</FieldLabel><GoldInput value={delPhone} onChange={setDelPhone} placeholder="0981-000000" /></div>
              </div>
            )}
            {delType === 'encomienda' && (
              <div className="grid grid-cols-2 gap-3">
                <div><FieldLabel>Empresa</FieldLabel><GoldInput value={shipCo} onChange={setShipCo} placeholder="Rysa, Cometa..." /></div>
                <div><FieldLabel>Ciudad destino</FieldLabel><GoldInput value={shipCity} onChange={setShipCity} placeholder="Ciudad" /></div>
                <div><FieldLabel>Nombre receptor</FieldLabel><GoldInput value={shipRec} onChange={setShipRec} placeholder="Nombre completo" /></div>
                <div><FieldLabel>Teléfono</FieldLabel><GoldInput value={shipPhone} onChange={setShipPhone} placeholder="0981-000000" /></div>
                <div className="col-span-2"><FieldLabel>Número de guía (opcional)</FieldLabel><GoldInput value={shipTrack} onChange={setShipTrack} placeholder="Número de seguimiento" /></div>
              </div>
            )}
          </div>
        </Section>

        <Section title="Anteojos" icon={<Glasses size={15} />}>
          <div className="space-y-3">
            {eyeglasses.map((eg, idx) => (
              <SimpleEyeglassCard key={eg._id} eg={eg} idx={idx} onUpdate={patch => updateEg(eg._id, patch)} onRemove={() => removeEyeglass(eg._id)} />
            ))}
            {eyeglasses.length > 1 && eyeglasses.some(eg => eg.price) && (
              <div className="rounded-xl px-4 py-3 space-y-1.5" style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.15)' }}>
                <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.6)' }}>Resumen de precios</p>
                {eyeglasses.map((eg, i) => eg.price ? (
                  <div key={eg._id} className="flex justify-between text-xs font-light">
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Anteojo {i + 1}: {eg.frame_description || '—'}</span>
                    <span style={{ color: '#C5A059' }}>Gs. {fmt(Number(eg.price))}</span>
                  </div>
                ) : null)}
                <div className="flex justify-between text-xs font-medium border-t pt-1.5" style={{ borderColor: 'rgba(197,160,89,0.15)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>Suma parcial</span>
                  <span style={{ color: '#C5A059' }}>Gs. {fmt(sumPrices)}</span>
                </div>
              </div>
            )}
            <button onClick={addEyeglass}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-light border-dashed border"
              style={{ borderColor: 'rgba(197,160,89,0.30)', color: '#C5A059', background: 'rgba(197,160,89,0.03)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(197,160,89,0.09)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(197,160,89,0.03)')}>
              <Plus size={15} />Agregar anteojo
            </button>
          </div>
        </Section>

        <Section title="Insumos / Reparaciones" icon={<Wrench size={15} />}>
          <div className="space-y-3">
            <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>Limpia cristales, estuches, reparaciones — no cuentan como anteojos vendidos ni en comisiones.</p>
            {insumos.map((ins, idx) => (
              <div key={ins._id} className="rounded-xl overflow-hidden" style={{ background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.20)' }}>
                <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(167,139,250,0.10)' }}>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0" style={{ background: '#a78bfa' }}>{idx + 1}</span>
                    <span className="text-sm font-light text-white truncate max-w-[180px]">{ins.descripcion || `Insumo ${idx + 1}`}</span>
                    {ins.precio && <span className="text-xs font-light" style={{ color: '#a78bfa' }}>Gs. {fmt(Number(ins.precio))}</span>}
                  </div>
                  <button onClick={() => removeInsumo(ins._id)} style={{ color: 'rgba(239,68,68,0.45)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.45)')}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Descripción</p>
                    <input type="text" value={ins.descripcion} onChange={e => updateInsumo(ins._id, { descripcion: e.target.value })} placeholder="Limpia cristal, estuche, reparación bisagra..."
                      className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border" style={{ borderColor: 'rgba(167,139,250,0.25)' }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Precio (Gs.)</p>
                      <input type="number" value={ins.precio} onChange={e => updateInsumo(ins._id, { precio: e.target.value })} placeholder="15000"
                        className="w-full px-3 py-2.5 rounded-xl bg-transparent text-sm font-light outline-none border text-right" style={{ borderColor: 'rgba(167,139,250,0.25)', color: '#a78bfa' }} />
                    </div>
                    <div>
                      <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Foto <span style={{ color: 'rgba(255,255,255,0.25)' }}>(opcional)</span></p>
                      {ins.photo_url ? (
                        <div className="relative inline-block">
                          <img src={ins.photo_url} alt="insumo" className="h-16 w-20 object-cover rounded-lg border" style={{ borderColor: 'rgba(167,139,250,0.30)' }} />
                          <button onClick={() => updateInsumo(ins._id, { photo_url: '' })} className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#ef4444' }}>
                            <X size={8} color="#fff" />
                          </button>
                        </div>
                      ) : (
                        <PhotoBtn onFile={url => updateInsumo(ins._id, { photo_url: url })} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addInsumo}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-light border-dashed border"
              style={{ borderColor: 'rgba(167,139,250,0.30)', color: '#a78bfa', background: 'rgba(167,139,250,0.03)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(167,139,250,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(167,139,250,0.03)')}>
              <Plus size={14} />Agregar insumo / reparación
            </button>
          </div>
        </Section>

        <Section title="Totales" icon={<Banknote size={15} />} accent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Total venta *</FieldLabel>
                <input type="number" value={saleTotal} onChange={e => setSaleTotal(e.target.value)} placeholder="500000"
                  className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border text-right" style={{ borderColor: 'rgba(197,160,89,0.30)' }} />
              </div>
              <div>
                <FieldLabel>Seña / Monto entregado</FieldLabel>
                <input type="number" value={saleDeposit} onChange={e => setSaleDeposit(e.target.value)}
                  placeholder="Dejar vacío = sin seña"
                  className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border text-right" style={{ borderColor: 'rgba(197,160,89,0.22)' }} />
                <p className="text-xs font-light mt-1" style={{ color: depositInfoColor }}>{depositInfoText}</p>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.20)' }}>
              <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'rgba(197,160,89,0.14)' }}>
                {[
                  { label: 'TOTAL',       value: fmt(totalNum),                              color: '#C5A059' },
                  { label: 'ENTREGADO',   value: fmt(depositNum),                            color: depositNum > 0 ? '#10b981' : '#6b7280' },
                  { label: 'SALDO PEND.', value: fmt(Math.max(0, totalNum - depositNum)),    color: totalNum > depositNum ? '#f59e0b' : '#6b7280' },
                ].map(item => (
                  <div key={item.label} className="flex flex-col items-center py-4 px-3">
                    <p className="text-xs font-light tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.label}</p>
                    <p className="text-xl font-light" style={{ color: item.color }}>{item.value}</p>
                    <p className="text-xs mt-0.5 font-light" style={{ color: 'rgba(255,255,255,0.22)' }}>Gs.</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Métodos de Pago" icon={<Banknote size={15} />}>
          <div className="space-y-3">
            <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>Podés agregar múltiples métodos. Ej: 100k efectivo + 300k transferencia.</p>
            {payments.map((pay, idx) => (
              <PaymentCard key={pay._id} pay={pay} idx={idx} total={totalNum}
                onUpdate={patch => updatePay(pay._id, patch)} onRemove={() => removePayment(pay._id)} canRemove={payments.length > 1} />
            ))}
            <button onClick={addPayment}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-light border-dashed border"
              style={{ borderColor: 'rgba(197,160,89,0.25)', color: 'rgba(197,160,89,0.7)', background: 'rgba(197,160,89,0.02)' }}>
              <Plus size={13} />Agregar otro método de pago
            </button>
          </div>
        </Section>

        <Section title="Estado del Trabajo" icon={<Clock size={15} />}>
          <div className="flex gap-2 flex-wrap">
            {(Object.entries(STATUS_CFG) as [SaleStatus, { label: string; color: string }][])
              .filter(([k]) => k !== 'cancelado')
              .map(([k, v]) => (
                <button key={k} onClick={() => setStatus(k)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-light"
                  style={{ background: status===k ? `${v.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${status===k ? v.color+'55' : 'rgba(255,255,255,0.08)'}`, color: status===k ? v.color : 'rgba(255,255,255,0.44)' }}>
                  {status === k && <Check size={12} />}{v.label}
                </button>
              ))}
          </div>
        </Section>

        <Section title="Observaciones" icon={<FileText size={15} />}>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Notas internas, instrucciones especiales..."
            className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm outline-none border resize-none font-light"
            style={{ borderColor: 'rgba(197,160,89,0.22)' }} />
        </Section>

        <button onClick={handleSaveSale} disabled={saving}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-base font-medium disabled:opacity-40"
          style={{ background: '#C5A059', color: '#000' }}>
          {saving
            ? <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />Guardando...</>
            : <><Save size={18} />Guardar Venta</>}
        </button>
        <div className="h-6" />
      </div>
    </div>
  );
}
