import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Search, UserPlus, MessageCircle, X, Clock, ZoomIn,
  AlertCircle, CheckCircle, ChevronDown, ChevronUp,
  Glasses, FlaskConical, Phone, Eye, Receipt, Camera,
} from 'lucide-react';
import { supabase, Customer } from '../lib/supabase';
import { useData } from '../context/DataContext';   // ← FIX
import { useAuth } from '../context/AuthContext';
import { StoredSale, StoredPayment } from '../lib/salesStorage';

// ── Types ────────────────────────────────────────────────────────────────────

type SaleEyeglass = {
  id: string;
  frame_description: string;
  crystals: string;
  treatments: string;
  prescription_text: string;
  photo_url: string;
  price: number;
  showReceta?: boolean;
  prescription?: {
    od_esfera?: string; od_cilindro?: string; od_eje?: string; od_altura?: string;
    oi_esfera?: string; oi_cilindro?: string; oi_eje?: string; oi_altura?: string;
    add?: string; dp?: string; obs?: string;
  };
};

type SalePaymentEntry = {
  id: string;
  paid_at: string;
  amount: number;
  method: string;
  tipo: 'sena' | 'abono';
  reference?: string;
  receipt_url?: string;
};

type SaleEntry = {
  id: string;
  sale_number: string;
  created_at: string;
  total: number;
  deposit: number;
  balance: number;
  status: string;
  seller_name: string;
  payment_method: string;
  notes: string;
  branches?: { name: string } | null;
  eyeglasses: SaleEyeglass[];
  payments: SalePaymentEntry[];
};

// ── FIX: tipo cliente derivado de ventas ────────────────────────────────────
type DerivedCustomer = {
  id: string;
  full_name: string;
  ci: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  branch_id: string | null;
  notes: string | null;
  created_at: string;
  source: 'local';          // siempre 'local' porque viene de ventas
};

type ClientHistory = {
  customer: DerivedCustomer;
  sales: SaleEntry[];
};

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  pendiente:      { label: 'Pendiente',      color: '#f59e0b' },
  en_laboratorio: { label: 'Laboratorio',    color: '#3b82f6' },
  listo:          { label: 'Listo',          color: '#10b981' },
  entregado:      { label: 'Entregado',      color: '#6b7280' },
  cancelado:      { label: 'Cancelado',      color: '#ef4444' },
  pagado_total:   { label: 'Pagado Total',   color: '#22c55e' },
  en_proceso:     { label: 'En Proceso',     color: '#f59e0b' },
};

function fmt(n: number) {
  return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  const t = normalize(text);
  const q = normalize(query);
  if (t.includes(q)) return true;
  if (q.length < 3) return false;
  for (let i = 0; i <= t.length - q.length + 1; i++) {
    const win = t.slice(i, i + q.length);
    if (editDistance(win, q) <= 1) return true;
  }
  return false;
}

function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 1) return 99;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0]; dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1]);
      prev = tmp;
    }
  }
  return dp[m];
}

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, '').replace(/^0/, '');
  return `https://wa.me/595${digits}`;
}

// ── Photo lightbox ──────────────────────────────────────────────────────────

function PhotoThumb({ url, alt }: { url: string; alt: string }) {
  const [open, setOpen] = useState(false);
  if (!url) return null;
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="relative group rounded-xl overflow-hidden shrink-0"
        style={{ width: 72, height: 72, border: '1px solid rgba(197,160,89,0.22)' }}>
        <img src={url} alt={alt} className="w-full h-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.55)' }}>
          <ZoomIn size={16} style={{ color: '#C5A059' }} />
        </div>
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.92)' }} onClick={() => setOpen(false)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <img src={url} alt={alt} className="w-full rounded-2xl" style={{ border: '1px solid rgba(197,160,89,0.3)' }} />
            <button onClick={() => setOpen(false)} className="absolute top-3 right-3 p-2 rounded-full"
              style={{ background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.7)' }}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

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

// ── Sale card ────────────────────────────────────────────────────────────────

function SaleCard({ sale, isAdmin }: { sale: SaleEntry; isAdmin?: boolean }) {
  const [expanded,    setExpanded]    = useState(false);
  const [viewReceipt, setViewReceipt] = useState<string | null>(null);
  const sc         = STATUS_CFG[sale.status] ?? STATUS_CFG.pendiente;
  const hasPending = Number(sale.balance) > 0;

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{
        border: hasPending ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(197,160,89,0.14)',
        background: hasPending ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.018)',
      }}>
      <button className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        style={{ borderBottom: expanded ? '1px solid rgba(197,160,89,0.08)' : 'none' }}
        onClick={() => setExpanded(!expanded)}>
        <div className="flex flex-col items-center shrink-0">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: hasPending ? '#ef4444' : sc.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono" style={{ color: '#C5A059' }}>#{sale.sale_number}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${sc.color}18`, color: sc.color }}>
              {sc.label}
            </span>
            {hasPending && (
              <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.30)' }}>
                <AlertCircle size={10} />Saldo Gs. {fmt(Number(sale.balance))}
              </span>
            )}
          </div>
          <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
            {new Date(sale.created_at).toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' })}
            {sale.seller_name ? ` · ${sale.seller_name}` : ''}
            {sale.branches?.name ? ` · ${sale.branches.name}` : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-light text-white">Gs. {fmt(Number(sale.total))}</p>
          {!hasPending && Number(sale.total) > 0 && (
            <p className="text-xs mt-0.5 flex items-center gap-1 justify-end" style={{ color: '#22c55e' }}>
              <CheckCircle size={9} /> Pagado
            </p>
          )}
        </div>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-3 space-y-4">
          {sale.eyeglasses.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Glasses size={11} style={{ color: '#C5A059' }} />
                <span className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.55)' }}>
                  Armazón / Receta
                </span>
              </div>
              {sale.eyeglasses.map((eg, idx) => (
                <div key={eg.id} className="rounded-xl p-3 space-y-3"
                  style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.10)' }}>
                  <div className="flex items-start gap-3">
                    {eg.photo_url && <PhotoThumb url={eg.photo_url} alt={`armazón ${idx + 1}`} />}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <Glasses size={12} style={{ color: '#C5A059' }} />
                        <span className="text-xs font-light text-white">Armazón {idx + 1}</span>
                        {eg.price > 0 && (
                          <span className="text-xs" style={{ color: 'rgba(197,160,89,0.7)' }}>· Gs. {fmt(eg.price)}</span>
                        )}
                      </div>
                      {eg.frame_description && (
                        <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.55)' }}>{eg.frame_description}</p>
                      )}
                      {eg.crystals && (
                        <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.45)' }}>
                          <span style={{ color: 'rgba(197,160,89,0.55)' }}>Cristales: </span>{eg.crystals}
                        </p>
                      )}
                      {eg.treatments && (
                        <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.45)' }}>
                          <span style={{ color: 'rgba(197,160,89,0.55)' }}>Tratamientos: </span>{eg.treatments}
                        </p>
                      )}
                    </div>
                  </div>
                  {eg.prescription && (
                    <div className="rounded-lg p-3 space-y-2"
                      style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.20)' }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <FlaskConical size={11} style={{ color: '#3b82f6' }} />
                        <span className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(59,130,246,0.8)' }}>Receta óptica</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-light mb-1" style={{ color: '#C5A059' }}>OD</p>
                          <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.75)' }}>
                            {eg.prescription.od_esfera || '—'} / {eg.prescription.od_cilindro || '—'} x {eg.prescription.od_eje || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-light mb-1" style={{ color: '#C5A059' }}>OI</p>
                          <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.75)' }}>
                            {eg.prescription.oi_esfera || '—'} / {eg.prescription.oi_cilindro || '—'} x {eg.prescription.oi_eje || '—'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {eg.prescription.add && <span>ADD: {eg.prescription.add}</span>}
                        {eg.prescription.dp  && <span>DP: {eg.prescription.dp}</span>}
                        {eg.prescription.obs && <span>{eg.prescription.obs}</span>}
                      </div>
                    </div>
                  )}
                  {!eg.prescription && eg.prescription_text && (
                    <div className="rounded-lg px-3 py-2"
                      style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)' }}>
                      <p className="text-xs font-mono font-light" style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8 }}>
                        {eg.prescription_text}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total',   value: `Gs. ${fmt(Number(sale.total))}`,   color: '#C5A059' },
              { label: 'Pagado',  value: `Gs. ${fmt(Number(sale.deposit))}`, color: '#22c55e' },
              { label: hasPending ? 'Saldo pendiente' : 'Saldo', value: `Gs. ${fmt(Number(sale.balance))}`, color: hasPending ? '#ef4444' : 'rgba(255,255,255,0.4)' },
            ].map(item => (
              <div key={item.label} className="rounded-xl px-3 py-2.5 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.36)' }}>{item.label}</p>
                <p className="text-sm font-light" style={{ color: item.color }}>{item.value}</p>
              </div>
            ))}
          </div>

          {sale.payments.length > 0 && (
            <>
              {viewReceipt && <ReceiptLightbox url={viewReceipt} onClose={() => setViewReceipt(null)} />}
              <div className="rounded-xl overflow-hidden"
                style={{ border: '1px solid rgba(197,160,89,0.10)', background: 'rgba(197,160,89,0.02)' }}>
                <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(197,160,89,0.08)' }}>
                  <span className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.55)' }}>
                    Detalle de pagos
                  </span>
                </div>
                <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  {sale.payments.map((p, i) => {
                    const isSeña = p.tipo === 'sena';
                    const color  = isSeña ? '#22c55e' : '#3b82f6';
                    const dt     = new Date(p.paid_at);
                    const dateStr = dt.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: '2-digit' });
                    const timeStr = dt.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
                    const totalPaidUpToNow = sale.payments.slice(0, i + 1).reduce((s, px) => s + px.amount, 0);
                    const remaining = Math.max(0, sale.total - totalPaidUpToNow);
                    return (
                      <div key={p.id} className="flex items-center gap-2 px-3 py-2 text-xs font-light flex-wrap">
                        <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-black font-medium"
                          style={{ background: color, fontSize: 9 }}>{i + 1}</span>
                        <span className="shrink-0 px-1.5 py-0.5 rounded-full"
                          style={{ background: `${color}18`, color }}>{isSeña ? 'Seña' : 'Abono'}</span>
                        <span className="text-white font-medium">Gs. {fmt(p.amount)}</span>
                        <span style={{ color: 'rgba(255,255,255,0.38)' }}>{p.method}</span>
                        <span className="ml-auto shrink-0 text-right" style={{ color: 'rgba(255,255,255,0.30)' }}>
                          {dateStr}<span style={{ color: 'rgba(255,255,255,0.18)' }}> {timeStr}</span>
                        </span>
                        {remaining > 0 && i === sale.payments.length - 1 && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded-full text-xs"
                            style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                            resta {fmt(remaining)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {sale.notes && (
            <p className="text-xs font-light px-3 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.44)', border: '1px solid rgba(255,255,255,0.05)' }}>
              {sale.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Client history modal ────────────────────────────────────────────────────

function ClientFicha({ history, onClose, isAdmin }: { history: ClientHistory; onClose: () => void; isAdmin?: boolean }) {
  const { customer, sales } = history;
  const totalSpent   = sales.reduce((s, v) => s + Number(v.total), 0);

  // ── FIX Problema 2: saldo real = suma de balance de cada venta ──────────
  // No recalculamos desde pagos — usamos el campo saldo que ya está correcto
  // después de closeSaleLocal (que fuerza saldo=0 al entregar)
  const totalPending = sales
    .filter(v => v.status !== 'entregado' && v.status !== 'cancelado')
    .reduce((s, v) => s + Math.max(0, Number(v.balance)), 0);

  const phone = customer.whatsapp || customer.phone;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
      style={{ background: 'rgba(0,0,0,0.85)' }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-3xl overflow-hidden animate-slide-up"
        style={{ background: '#0a0900', border: '1px solid rgba(197,160,89,0.28)', boxShadow: '0 32px 80px rgba(0,0,0,0.8)' }}
        onClick={e => e.stopPropagation()}>

        <div className="px-6 py-5 flex items-start justify-between"
          style={{ borderBottom: '1px solid rgba(197,160,89,0.12)', background: 'rgba(197,160,89,0.04)' }}>
          <div>
            <p className="text-xs font-light tracking-widest uppercase mb-1" style={{ color: 'rgba(197,160,89,0.5)' }}>Ficha del Cliente</p>
            <h2 className="text-xl font-light text-white">{customer.full_name}</h2>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {customer.ci && (
                <span className="text-xs font-mono" style={{ color: 'rgba(197,160,89,0.7)' }}>CI: {customer.ci}</span>
              )}
              {phone && (
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.44)' }}>
                  <Phone size={9} className="inline mr-1" />{phone}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {phone && (
              <a href={waLink(phone)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
                style={{ background: 'rgba(37,211,102,0.12)', color: '#25d366', border: '1px solid rgba(37,211,102,0.28)' }}>
                <MessageCircle size={13} />WhatsApp
              </a>
            )}
            <button onClick={onClose} className="p-2 rounded-xl"
              style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 px-6 py-4" style={{ borderBottom: '1px solid rgba(197,160,89,0.08)' }}>
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.15)' }}>
            <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.38)' }}>Compras totales</p>
            <p className="text-lg font-light" style={{ color: '#C5A059' }}>{sales.length}</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.18)' }}>
            <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.38)' }}>Total histórico</p>
            <p className="text-sm font-light" style={{ color: '#22c55e' }}>Gs. {fmt(totalSpent)}</p>
          </div>
          <div className="rounded-xl p-3 text-center"
            style={{ background: totalPending > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.04)', border: `1px solid ${totalPending > 0 ? 'rgba(239,68,68,0.28)' : 'rgba(34,197,94,0.15)'}` }}>
            <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.38)' }}>Saldo pendiente</p>
            <p className="text-sm font-light" style={{ color: totalPending > 0 ? '#ef4444' : '#22c55e' }}>
              {totalPending > 0 ? `Gs. ${fmt(totalPending)}` : '✓ Al día'}
            </p>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={13} style={{ color: '#C5A059' }} />
            <span className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.6)' }}>
              Historial de compras
            </span>
          </div>
          {sales.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Sin compras registradas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sales.map(sale => <SaleCard key={sale.id} sale={sale} isAdmin={isAdmin} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

type Props = {
  initialSearch?: string;
  onSearchConsumed?: () => void;
};

export default function CustomersPage({ initialSearch = '', onSearchConsumed }: Props) {
  const { profile } = useAuth();
  const { sales: allSales, payments: allPayments } = useData();  // ← FIX
  const [search,       setSearch]       = useState('');
  const [history,      setHistory]      = useState<ClientHistory | null>(null);
  const [loadingFicha, setLoadingFicha] = useState(false);

  useEffect(() => {
    if (initialSearch) { setSearch(initialSearch); onSearchConsumed?.(); }
  }, [initialSearch]);

  // ── FIX Problema 3: derivar clientes únicos desde ventas ─────────────────
  // No se usa tabla customers (vacía). Cada venta tiene datos del cliente.
  const customers = useMemo<DerivedCustomer[]>(() => {
    const seen = new Map<string, DerivedCustomer>();
    // Ordenamos por fecha desc para que el "primer registro" sea el más reciente
    const sorted = [...allSales].sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );
    for (const sale of sorted) {
      const fullName = `${sale.cliente.nombre} ${sale.cliente.apellido}`.trim();
      if (!fullName) continue;
      // Clave: nombre normalizado + CI si existe
      const key = sale.cliente.ci
        ? `ci:${sale.cliente.ci}`
        : `name:${fullName.toLowerCase().replace(/\s+/g, ' ')}`;
      if (!seen.has(key)) {
        seen.set(key, {
          id:         key,
          full_name:  fullName,
          ci:         sale.cliente.ci   || null,
          phone:      sale.cliente.telefono || null,
          whatsapp:   sale.cliente.telefono || null,
          email:      null,
          address:    null,
          branch_id:  sale.sucursalVenta || null,
          notes:      null,
          created_at: sale.fecha,
          source:     'local',
        });
      }
    }
    return Array.from(seen.values());
  }, [allSales]);

  // ── Abrir ficha: construir historial desde ventas del context ────────────
  const openFicha = useCallback((customer: DerivedCustomer) => {
    setLoadingFicha(true);
    setHistory({ customer, sales: [] });

    const fullNameLower = customer.full_name.toLowerCase();

    const customerSales: SaleEntry[] = allSales
      .filter(v => {
        const vName = `${v.cliente.nombre} ${v.cliente.apellido}`.trim().toLowerCase();
        return vName === fullNameLower || (customer.ci && v.cliente.ci === customer.ci);
      })
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .map(v => {
        // Pagos de esta venta
        const salePayments: SalePaymentEntry[] = allPayments
          .filter(p => p.saleId === v.id)
          .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
          .map((p, i) => ({
            id:          String(p.id),
            paid_at:     p.fecha,
            amount:      p.monto,
            method:      p.metodo,
            tipo:        p.tipo,
            reference:   p.tipo === 'abono' ? 'Abono' : 'Seña inicial',
            receipt_url: p.receipt_url ?? undefined,
          }));

        if (salePayments.length === 0 && Number(v.sena) > 0) {
          salePayments.push({
            id: `init-${v.id}`, paid_at: v.fecha, amount: Number(v.sena),
            method: v.metodoPago, tipo: 'sena', reference: 'Seña inicial',
          });
        }

        return {
          id:             String(v.id),
          sale_number:    `VTA-${v.id}`,
          created_at:     v.fecha,
          total:          Number(v.total),
          deposit:        Number(v.sena),
          // ── FIX Problema 2: usar saldo directo de la venta ──────────────
          balance:        Number(v.saldo),
          status:         v.estadoTrabajo,
          seller_name:    v.vendedora,
          payment_method: v.metodoPago,
          notes:          v.observaciones,
          branches:       v.sucursalVenta ? { name: v.sucursalVenta } : null,
          eyeglasses:     (v.anteojos as any[]).map((eg: any, i: number) => ({
            id:                String(i),
            frame_description: eg.frame_description ?? '',
            crystals:          eg.crystals          ?? '',
            treatments:        eg.treatments        ?? '',
            prescription_text: eg.prescription_text ?? '',
            photo_url:         eg.photo_url         ?? '',
            price:             Number(eg.price) || 0,
            prescription:      eg.prescription ?? null,
            showReceta:        eg.showReceta    ?? false,
          })),
          payments: salePayments,
        };
      });

    setHistory({ customer, sales: customerSales });
    setLoadingFicha(false);
  }, [allSales, allPayments]);

  // Filtro de búsqueda
  const filtered = useMemo(() => {
    if (!search) return customers;
    const qTel = search.replace(/\D/g, '');
    return customers.filter(c =>
      fuzzyMatch(c.full_name || '', search) ||
      fuzzyMatch(c.ci || '', search) ||
      (qTel.length >= 3 && (c.phone || '').replace(/\D/g, '').includes(qTel))
    );
  }, [customers, search]);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-light tracking-wider text-white">Clientes</h1>
          <p className="text-xs mt-0.5 tracking-wide" style={{ color: 'rgba(197,160,89,0.6)' }}>
            {customers.length} clientes derivados de {allSales.length} ventas
          </p>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'rgba(197,160,89,0.55)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, C.I. o celular..."
          className="w-full pl-11 pr-5 py-3.5 rounded-2xl text-sm bg-transparent text-white outline-none"
          style={{ border: '1px solid rgba(197,160,89,0.28)', background: 'rgba(197,160,89,0.04)', boxShadow: search ? '0 0 0 2px rgba(197,160,89,0.12)' : 'none' }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(197,160,89,0.5)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(197,160,89,0.28)'; }}
        />
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(197,160,89,0.12)' }}>
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <UserPlus size={32} style={{ color: 'rgba(197,160,89,0.2)', margin: '0 auto 12px' }} />
            <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {search ? 'No se encontraron clientes' : 'Sin ventas registradas aún'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(197,160,89,0.10)' }}>
                {['Nombre', 'C.I.', 'Teléfono', 'Sede', 'Primera compra', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-light tracking-wider uppercase"
                    style={{ color: 'rgba(197,160,89,0.55)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer, i) => {
                const phone = customer.whatsapp || customer.phone;
                // Contar ventas de este cliente
                const salesCount = allSales.filter(v => {
                  const vName = `${v.cliente.nombre} ${v.cliente.apellido}`.trim().toLowerCase();
                  return vName === customer.full_name.toLowerCase() ||
                    (customer.ci && v.cliente.ci === customer.ci);
                }).length;
                // Calcular saldo pendiente
                const pendingBalance = allSales
                  .filter(v => {
                    const vName = `${v.cliente.nombre} ${v.cliente.apellido}`.trim().toLowerCase();
                    return (vName === customer.full_name.toLowerCase() ||
                      (customer.ci && v.cliente.ci === customer.ci)) &&
                      v.estadoTrabajo !== 'entregado' && v.estadoTrabajo !== 'cancelado';
                  })
                  .reduce((s, v) => s + Math.max(0, Number(v.saldo)), 0);

                return (
                  <tr key={customer.id} className="transition-colors cursor-pointer"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.008)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(197,160,89,0.04)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.008)'; }}
                    onClick={() => openFicha(customer)}>
                    <td className="px-4 py-3">
                      <p className="text-sm text-white font-light">{customer.full_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.6)' }}>
                          {salesCount} compra{salesCount !== 1 ? 's' : ''}
                        </span>
                        {pendingBalance > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                            Debe Gs. {fmt(pendingBalance)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: '#C5A059' }}>{customer.ci || '—'}</td>
                    <td className="px-4 py-3 text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>{customer.phone || '—'}</td>
                    <td className="px-4 py-3 text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>{customer.branch_id || '—'}</td>
                    <td className="px-4 py-3 text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {new Date(customer.created_at).toLocaleDateString('es-PY')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={e => { e.stopPropagation(); openFicha(customer); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-light"
                          style={{ background: 'rgba(197,160,89,0.08)', color: '#C5A059', border: '1px solid rgba(197,160,89,0.22)' }}>
                          <Clock size={11} /> Ver ficha
                        </button>
                        {phone && (
                          <a href={waLink(phone)} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="p-1.5 rounded-lg" style={{ color: 'rgba(37,211,102,0.5)' }}>
                            <MessageCircle size={14} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {history && (
        <ClientFicha
          history={loadingFicha ? { ...history, sales: [] } : history}
          onClose={() => setHistory(null)}
          isAdmin={profile?.role === 'admin'}
        />
      )}

      {loadingFicha && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="px-4 py-3 rounded-xl text-xs font-light"
            style={{ background: 'rgba(10,9,7,0.92)', border: '1px solid rgba(197,160,89,0.25)', color: '#C5A059' }}>
            Cargando historial...
          </div>
        </div>
      )}
    </div>
  );
}
