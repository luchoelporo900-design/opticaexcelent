import { useEffect, useState, useCallback } from 'react';
import {
  Search, UserPlus, MessageCircle, X, Clock, ZoomIn,
  AlertCircle, CheckCircle, ChevronDown, ChevronUp,
  Glasses, FlaskConical, Phone,
} from 'lucide-react';
import { supabase, Customer } from '../lib/supabase';
import { getSales, getPayments } from '../lib/salesStorage';

// ── Types ────────────────────────────────────────────────────────────────────

type SaleEyeglass = {
  id: string;
  frame_description: string;
  crystals: string;
  treatments: string;
  prescription_text: string;
  photo_url: string;
  price: number;
};

type SalePaymentEntry = {
  id: string;
  paid_at: string;
  amount: number;
  method: string;
  tipo: 'sena' | 'abono';
  reference?: string;
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

type ClientHistory = {
  customer: Customer;
  sales: SaleEntry[];
};

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  pendiente:      { label: 'Pendiente',      color: '#f59e0b' },
  en_laboratorio: { label: 'Laboratorio',    color: '#3b82f6' },
  listo:          { label: 'Listo',          color: '#10b981' },
  entregado:      { label: 'Entregado',      color: '#6b7280' },
  cancelado:      { label: 'Cancelado',      color: '#ef4444' },
};

function fmt(n: number) {
  return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Normalize accents and case for fuzzy matching
function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Returns true if query is contained in text (after normalization) OR
// if query is within 1 edit distance of any substring of similar length (typo tolerance)
function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  const t = normalize(text);
  const q = normalize(query);
  if (t.includes(q)) return true;
  // Typo tolerance: check if q appears as a subsequence or close substring
  // For short queries skip costly check
  if (q.length < 3) return false;
  // Sliding window of length q.length ± 1 through t, compare edit distance
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
    let prev = dp[0];
    dp[0] = j;
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

// ── Photo lightbox ─────────────────────────────────────────────────────────

function PhotoThumb({ url, alt }: { url: string; alt: string }) {
  const [open, setOpen] = useState(false);
  if (!url) return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
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
          style={{ background: 'rgba(0,0,0,0.92)' }}
          onClick={() => setOpen(false)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <img src={url} alt={alt} className="w-full rounded-2xl" style={{ border: '1px solid rgba(197,160,89,0.3)' }} />
            <button onClick={() => setOpen(false)}
              className="absolute top-3 right-3 p-2 rounded-full"
              style={{ background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.7)' }}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Sale card in timeline ──────────────────────────────────────────────────

function SaleCard({ sale }: { sale: SaleEntry }) {
  const [expanded, setExpanded] = useState(false);
  const sc = STATUS_CFG[sale.status] ?? STATUS_CFG.pendiente;
  const hasPending = Number(sale.balance) > 0;

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{
        border: hasPending ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(197,160,89,0.14)',
        background: hasPending ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.018)',
      }}>

      {/* Header row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        style={{ borderBottom: expanded ? '1px solid rgba(197,160,89,0.08)' : 'none' }}
        onClick={() => setExpanded(!expanded)}>

        {/* Date dot */}
        <div className="flex flex-col items-center shrink-0">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: hasPending ? '#ef4444' : sc.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono" style={{ color: '#C5A059' }}>#{sale.sale_number}</span>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: `${sc.color}18`, color: sc.color }}>
              {sc.label}
            </span>
            {hasPending && (
              <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.30)' }}>
                <AlertCircle size={10} />
                Saldo Gs. {fmt(Number(sale.balance))}
              </span>
            )}
          </div>
          <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
            {new Date(sale.created_at).toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' })}
            {sale.seller_name ? ` · ${sale.seller_name}` : ''}
            {sale.branches?.name ? ` · ${sale.branches.name}` : ''}
          </p>
        </div>

        {/* Amounts */}
        <div className="text-right shrink-0">
          <p className="text-sm font-light text-white">Gs. {fmt(Number(sale.total))}</p>
          {!hasPending && Number(sale.total) > 0 && (
            <p className="text-xs mt-0.5 flex items-center gap-1 justify-end" style={{ color: '#22c55e' }}>
              <CheckCircle size={9} /> Pagado
            </p>
          )}
        </div>

        {/* Frame photos preview */}
        {sale.eyeglasses.some(eg => eg.photo_url) && !expanded && (
          <div className="flex gap-1 shrink-0">
            {sale.eyeglasses.filter(eg => eg.photo_url).slice(0, 2).map(eg => (
              <img key={eg.id} src={eg.photo_url} alt="armazón"
                className="w-9 h-9 rounded-lg object-cover"
                style={{ border: '1px solid rgba(197,160,89,0.22)' }} />
            ))}
          </div>
        )}

        <span style={{ color: 'rgba(255,255,255,0.3)' }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-3 space-y-4">

          {/* Eyeglasses */}
          {sale.eyeglasses.length > 0 && (
            <div className="space-y-3">
              {sale.eyeglasses.map((eg, idx) => (
                <div key={eg.id} className="rounded-xl p-3 space-y-2"
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
                  {eg.prescription_text && (
                    <div className="rounded-lg px-3 py-2"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <FlaskConical size={10} style={{ color: '#3b82f6' }} />
                        <span className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(59,130,246,0.7)' }}>Receta</span>
                      </div>
                      <p className="text-xs font-mono font-light" style={{ color: 'rgba(255,255,255,0.62)', lineHeight: 1.8 }}>
                        {eg.prescription_text}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Payment summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total', value: `Gs. ${fmt(Number(sale.total))}`, color: '#C5A059' },
              { label: 'Pagado', value: `Gs. ${fmt(Number(sale.deposit))}`, color: '#22c55e' },
              { label: hasPending ? 'Saldo pendiente' : 'Saldo', value: `Gs. ${fmt(Number(sale.balance))}`, color: hasPending ? '#ef4444' : 'rgba(255,255,255,0.4)' },
            ].map(item => (
              <div key={item.label} className="rounded-xl px-3 py-2.5 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.36)' }}>{item.label}</p>
                <p className="text-sm font-light" style={{ color: item.color }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Payment detail timeline */}
          {sale.payments.length > 0 && (
            <div className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(197,160,89,0.10)', background: 'rgba(197,160,89,0.02)' }}>
              <div className="px-3 py-2 border-b flex items-center gap-2"
                style={{ borderColor: 'rgba(197,160,89,0.08)' }}>
                <span className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.55)' }}>
                  Detalle de pagos
                </span>
              </div>
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                {sale.payments.map((p, i) => {
                  const isSeña = p.tipo === 'sena';
                  const color = isSeña ? '#22c55e' : '#3b82f6';
                  const dt = new Date(p.paid_at);
                  const dateStr = dt.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: '2-digit' });
                  const timeStr = dt.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
                  const totalPaidUpToNow = sale.payments.slice(0, i + 1).reduce((s, px) => s + px.amount, 0);
                  const remaining = Math.max(0, sale.total - totalPaidUpToNow);
                  return (
                    <div key={p.id} className="flex items-center gap-2 px-3 py-2 text-xs font-light">
                      <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-black font-medium"
                        style={{ background: color, fontSize: 9 }}>{i + 1}</span>
                      <span className="shrink-0 px-1.5 py-0.5 rounded-full"
                        style={{ background: `${color}18`, color }}>{isSeña ? 'Seña' : 'Abono'}</span>
                      <span className="text-white font-medium">Gs. {fmt(p.amount)}</span>
                      <span style={{ color: 'rgba(255,255,255,0.38)' }}>{p.method}</span>
                      <span className="ml-auto shrink-0 text-right space-x-1" style={{ color: 'rgba(255,255,255,0.30)' }}>
                        {dateStr}
                        <span style={{ color: 'rgba(255,255,255,0.18)' }}> {timeStr}</span>
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

// ── Client history modal ───────────────────────────────────────────────────

function ClientFicha({ history, onClose }: { history: ClientHistory; onClose: () => void }) {
  const { customer, sales } = history;
  const totalSpent    = sales.reduce((s, v) => s + Number(v.total), 0);
  const totalPending  = sales.reduce((s, v) => s + Number(v.balance), 0);
  const phone         = customer.whatsapp || customer.phone;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-3xl overflow-hidden animate-slide-up"
        style={{ background: '#0a0900', border: '1px solid rgba(197,160,89,0.28)', boxShadow: '0 32px 80px rgba(0,0,0,0.8)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
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
              {customer.email && (
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.34)' }}>{customer.email}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {phone && (
              <a href={waLink(phone)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                style={{ background: 'rgba(37,211,102,0.12)', color: '#25d366', border: '1px solid rgba(37,211,102,0.28)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(37,211,102,0.20)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(37,211,102,0.12)'; }}>
                <MessageCircle size={13} />
                WhatsApp
              </a>
            )}
            <button onClick={onClose}
              className="p-2 rounded-xl transition-colors"
              style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)'; }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Summary stats */}
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
              {totalPending > 0 ? `Gs. ${fmt(totalPending)}` : 'Al día'}
            </p>
          </div>
        </div>

        {/* Sale timeline */}
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
            <div className="space-y-3 relative">
              {/* Vertical timeline line */}
              <div className="absolute left-[23px] top-4 bottom-4 w-px"
                style={{ background: 'linear-gradient(to bottom, rgba(197,160,89,0.3), rgba(197,160,89,0.05))' }} />
              {sales.map(sale => <SaleCard key={sale.id} sale={sale} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

type Props = {
  initialSearch?: string;
  onSearchConsumed?: () => void;
};

export default function CustomersPage({ initialSearch = '', onSearchConsumed }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [history,   setHistory]   = useState<ClientHistory | null>(null);
  const [loadingFicha, setLoadingFicha] = useState(false);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch);
      onSearchConsumed?.();
    }
  }, [initialSearch]);

  async function load(q?: string) {
    setLoading(true);

    // Build Supabase query — use server-side search when query provided
    let query = supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (q && q.trim().length >= 2) {
      query = query.or(
        `full_name.ilike.%${q.trim()}%,ci.ilike.%${q.trim()}%,phone.ilike.%${q.trim()}%`
      );
    }
    const { data: remoteData } = await query.limit(200);
    const remoteIds = new Set((remoteData ?? []).map((c: any) => c.id));

    // Merge local-only customers from localStorage sales (not yet in Supabase)
    const localCustomers: Customer[] = [];
    const seen = new Set<string>();
    for (const sale of getSales()) {
      const key = `${sale.cliente.nombre} ${sale.cliente.apellido}`.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const fullName = `${sale.cliente.nombre} ${sale.cliente.apellido}`.trim();
      // Only add if not already in Supabase results
      const alreadyInRemote = (remoteData ?? []).some(
        (c: any) =>
          (c.full_name ?? '').toLowerCase() === key ||
          (sale.cliente.ci && c.ci === sale.cliente.ci) ||
          (sale.cliente.telefono && c.phone === sale.cliente.telefono)
      );
      if (alreadyInRemote) continue;
      // Apply local fuzzy filter too
      if (q && q.trim().length >= 2) {
        if (
          !fuzzyMatch(fullName, q) &&
          !fuzzyMatch(sale.cliente.ci || '', q) &&
          !(sale.cliente.telefono || '').includes(q.replace(/\D/g, ''))
        ) continue;
      }
      localCustomers.push({
        id: `local-${key.replace(/\s+/g, '-')}`,
        full_name: fullName,
        ci: sale.cliente.ci || null,
        phone: sale.cliente.telefono || null,
        whatsapp: sale.cliente.telefono || null,
        email: null,
        address: null,
        branch_id: sale.sucursalVenta || null,
        notes: null,
        created_at: sale.fecha,
      } as any);
    }

    setCustomers([...localCustomers, ...(remoteData ?? []).filter((c: any) => !remoteIds.has(c.id) ? false : true)]);
    setLoading(false);
  }

  const openFicha = useCallback(async (customer: Customer) => {
    setLoadingFicha(true);
    setHistory({ customer, sales: [] });

    // Fetch sales from Supabase
    const { data: salesData } = await supabase
      .from('sales')
      .select('id, sale_number, created_at, total, deposit, balance, status, seller_name, payment_method, notes, branches(name)')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });

    const supabaseSales: SaleEntry[] = [];
    for (const s of (salesData ?? [])) {
      const [{ data: egs }, { data: pays }] = await Promise.all([
        supabase
          .from('sale_eyeglasses')
          .select('id, frame_description, crystals, treatments, prescription_text, photo_url, price')
          .eq('sale_id', s.id)
          .order('sort_order'),
        supabase
          .from('sale_payments')
          .select('id, amount, method, paid_at, reference')
          .eq('sale_id', s.id)
          .order('paid_at'),
      ]);
      // Build initial seña row from sale itself if no payments recorded
      const payRows: SalePaymentEntry[] = [];
      if ((pays ?? []).length === 0 && Number(s.deposit) > 0) {
        payRows.push({
          id: `init-${s.id}`,
          paid_at: s.created_at,
          amount: Number(s.deposit),
          method: s.payment_method ?? 'efectivo',
          tipo: 'sena',
          reference: 'Seña inicial',
        });
      } else {
        (pays ?? []).forEach((p: any, i: number) => {
          payRows.push({
            id: String(p.id),
            paid_at: p.paid_at,
            amount: Number(p.amount),
            method: p.method ?? '',
            tipo: i === 0 ? 'sena' : 'abono',
            reference: p.reference ?? undefined,
          });
        });
      }
      supabaseSales.push({
        id: s.id,
        sale_number: s.sale_number,
        created_at: s.created_at,
        total: Number(s.total),
        deposit: Number(s.deposit),
        balance: Number(s.balance),
        status: s.status,
        seller_name: s.seller_name ?? '',
        payment_method: s.payment_method ?? '',
        notes: s.notes ?? '',
        branches: (s as any).branches,
        eyeglasses: (egs ?? []).map((eg: any) => ({
          id: eg.id,
          frame_description: eg.frame_description ?? '',
          crystals: eg.crystals ?? '',
          treatments: eg.treatments ?? '',
          prescription_text: eg.prescription_text ?? '',
          photo_url: eg.photo_url ?? '',
          price: Number(eg.price),
        })),
        payments: payRows,
      });
    }

    // Also include localStorage sales matching by name
    const fullNameLower = customer.full_name.toLowerCase();
    const allLocalPayments = getPayments();
    const localSales: SaleEntry[] = getSales()
      .filter(v => {
        const vName = `${v.cliente.nombre} ${v.cliente.apellido}`.trim().toLowerCase();
        return vName === fullNameLower || (customer.ci && v.cliente.ci === customer.ci);
      })
      .map(v => {
        const salePayments: SalePaymentEntry[] = allLocalPayments
          .filter(p => p.saleId === v.id)
          .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
          .map(p => ({
            id: String(p.id),
            paid_at: p.fecha,
            amount: p.monto,
            method: p.metodo,
            tipo: p.tipo,
            reference: p.tipo === 'abono' ? 'Abono' : 'Seña inicial',
          }));
        // If no payments recorded, synthesize seña row
        if (salePayments.length === 0 && Number(v.sena) > 0) {
          salePayments.push({
            id: `init-${v.id}`,
            paid_at: v.fecha,
            amount: Number(v.sena),
            method: v.metodoPago,
            tipo: 'sena',
            reference: 'Seña inicial',
          });
        }
        return {
          id: String(v.id),
          sale_number: `VTA-${v.id}`,
          created_at: v.fecha,
          total: Number(v.total),
          deposit: Number(v.sena),
          balance: Number(v.saldo),
          status: v.estadoTrabajo,
          seller_name: v.vendedora,
          payment_method: v.metodoPago,
          notes: v.observaciones,
          branches: v.sucursalVenta ? { name: v.sucursalVenta } : null,
          eyeglasses: (v.anteojos as any[]).map((eg: any, i) => ({
            id: String(i),
            frame_description: eg.frame_description ?? '',
            crystals: eg.crystals ?? '',
            treatments: eg.treatments ?? '',
            prescription_text: eg.prescription_text ?? '',
            photo_url: eg.photo_url ?? '',
            price: Number(eg.price) || 0,
          })),
          payments: salePayments,
        };
      });

    // Merge, sort newest first
    const allSales = [...supabaseSales, ...localSales].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setHistory({ customer, sales: allSales });
    setLoadingFicha(false);
  }, []);

  // Debounce Supabase re-query on search change
  useEffect(() => {
    const t = setTimeout(() => load(search), 280);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Client-side fuzzy filter as immediate feedback while query is in-flight
  const filtered = customers.filter(c =>
    !search ||
    fuzzyMatch(c.full_name || '', search) ||
    fuzzyMatch(c.ci || '', search) ||
    (c.phone || '').includes(search.replace(/\D/g, ''))
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-light tracking-wider text-white">Clientes</h1>
          <p className="text-xs text-gold-muted mt-0.5 tracking-wide">{customers.length} clientes registrados</p>
        </div>
      </div>

      {/* Universal search bar */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'rgba(197,160,89,0.55)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, C.I. o teléfono para ver el historial completo..."
          className="w-full pl-11 pr-5 py-3.5 rounded-2xl text-sm bg-transparent text-white outline-none"
          style={{
            border: '1px solid rgba(197,160,89,0.28)',
            background: 'rgba(197,160,89,0.04)',
            boxShadow: search ? '0 0 0 2px rgba(197,160,89,0.12)' : 'none',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(197,160,89,0.5)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(197,160,89,0.28)'; }}
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(197,160,89,0.12)' }}>
        {loading ? (
          <div className="p-6 space-y-2">
            {[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded shimmer" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <UserPlus size={32} style={{ color: 'rgba(197,160,89,0.2)', margin: '0 auto 12px' }} />
            <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {search ? 'No se encontraron clientes' : 'Sin clientes registrados'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(197,160,89,0.10)' }}>
                {['Nombre', 'C.I.', 'Teléfono', 'Email', 'Sede', 'Registro', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-light tracking-wider uppercase"
                    style={{ color: 'rgba(197,160,89,0.55)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer, i) => {
                const phone = customer.whatsapp || customer.phone;
                return (
                  <tr key={customer.id}
                    className="transition-colors cursor-pointer"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.008)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(197,160,89,0.04)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.008)'; }}
                    onClick={() => openFicha(customer)}>
                    <td className="px-4 py-3 text-sm text-white font-light">{customer.full_name}</td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: '#C5A059' }}>{customer.ci || '—'}</td>
                    <td className="px-4 py-3 text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>{customer.phone || '—'}</td>
                    <td className="px-4 py-3 text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>{customer.email || '—'}</td>
                    <td className="px-4 py-3 text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>—</td>
                    <td className="px-4 py-3 text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {new Date(customer.created_at).toLocaleDateString('es-PY')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={e => { e.stopPropagation(); openFicha(customer); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-light transition-all"
                          style={{ background: 'rgba(197,160,89,0.08)', color: '#C5A059', border: '1px solid rgba(197,160,89,0.22)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(197,160,89,0.16)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(197,160,89,0.08)'; }}>
                          <Clock size={11} /> Ver ficha
                        </button>
                        {phone && (
                          <a href={waLink(phone)} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="p-1.5 rounded-lg transition-all"
                            style={{ color: 'rgba(37,211,102,0.5)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#25d366'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(37,211,102,0.5)'; }}>
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

      {/* Client ficha modal */}
      {history && (
        <ClientFicha
          history={loadingFicha ? { ...history, sales: [] } : history}
          onClose={() => setHistory(null)}
        />
      )}

      {/* Loading overlay for ficha */}
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
