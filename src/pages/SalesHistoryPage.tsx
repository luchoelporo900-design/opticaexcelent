import { useState, useEffect } from 'react';
import {
  Search, RefreshCw, ChevronDown, Package, Clock, CheckCircle,
  XCircle, FlaskConical, ShoppingBag, MessageCircle, Pencil, X, Save,
  Banknote, CreditCard, Smartphone, QrCode, Send, Store, Truck,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import { closeSaleLocal } from '../lib/salesStorage';

type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'qr' | 'giro';
type DeliveryMode = 'retiro' | 'delivery' | 'encomienda';

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendiente:      { label: 'Pendiente',      color: '#f59e0b', icon: <Clock        size={11} /> },
  en_proceso:     { label: 'En Proceso',     color: '#f59e0b', icon: <Clock        size={11} /> },
  en_laboratorio: { label: 'Laboratorio',    color: '#3b82f6', icon: <FlaskConical size={11} /> },
  listo:          { label: 'Listo',          color: '#10b981', icon: <CheckCircle  size={11} /> },
  pagado_total:   { label: 'Pagado Total',   color: '#22c55e', icon: <CheckCircle  size={11} /> },
  entregado:      { label: 'Entregado',      color: '#6b7280', icon: <Package      size={11} /> },
  cancelado:      { label: 'Cancelado',      color: '#ef4444', icon: <XCircle      size={11} /> },
};

const PAY_METHODS: { id: PaymentMethod; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'efectivo',      label: 'Efectivo',    icon: <Banknote   size={13} />, color: '#22c55e' },
  { id: 'transferencia', label: 'Transfer.',   icon: <Smartphone size={13} />, color: '#3b82f6' },
  { id: 'tarjeta',       label: 'POS',         icon: <CreditCard size={13} />, color: '#f59e0b' },
  { id: 'qr',            label: 'QR',          icon: <QrCode     size={13} />, color: '#C5A059' },
  { id: 'giro',          label: 'Giro',        icon: <Send       size={13} />, color: '#a78bfa' },
];

const DELIVERY_OPTIONS: { id: DeliveryMode; label: string; icon: React.ReactNode }[] = [
  { id: 'retiro',     label: 'Retiro en local', icon: <Store size={13} /> },
  { id: 'delivery',   label: 'Delivery',        icon: <Truck size={13} /> },
  { id: 'encomienda', label: 'Encomienda',      icon: <Package size={13} /> },
];

const SUCURSALES = ['Azara', 'Fernando', 'Caacupé', 'La Fina'];
const FIXED_BRANCHES = [
  { id: 'azara',    name: 'Azara' },
  { id: 'la_fina',  name: 'La Fina' },
  { id: 'caacupe',  name: 'Caacupé' },
  { id: 'fernando', name: 'Fernando' },
];

function fmt(n: number) {
  return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
function branchMatch(stored: string, selected: string): boolean {
  if (!selected) return true;
  const n = (s: string) => s.toLowerCase()
    .replace(/[áàä]/g,'a').replace(/[éèë]/g,'e').replace(/[íìï]/g,'i')
    .replace(/[óòö]/g,'o').replace(/[úùü]/g,'u');
  return n(stored).includes(n(selected)) || n(selected).includes(n(stored));
}

// ─── Modal de entrega ─────────────────────────────────────────────────────────
interface DeliverModalProps {
  sale: any;
  onClose: () => void;
  onDelivered: () => void;
}

function DeliverModal({ sale, onClose, onDelivered }: DeliverModalProps) {
  const { profile } = useAuth();
  const balance    = Number(sale.saldo) || 0;
  const hasBalance = balance > 0;

  const [deliveryMode,  setDeliveryMode]  = useState<DeliveryMode>('retiro');
  const [payMethod,     setPayMethod]     = useState<PaymentMethod>('efectivo');
  const [payAmount,     setPayAmount]     = useState(hasBalance ? String(balance) : '');
  const [payBranch,     setPayBranch]     = useState(sale.sucursalCobro || sale.sucursalVenta || '');
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');

  async function handleDeliver() {
    setError('');
    const amt = parseFloat(payAmount) || 0;

    // Si tiene saldo, el monto ingresado debe cubrir el saldo
    if (hasBalance && amt <= 0) {
      setError(`Esta venta tiene un saldo de Gs. ${fmt(balance)}. Ingresá el monto a cobrar.`);
      return;
    }
    if (hasBalance && amt < balance) {
      setError(`El monto ingresado (Gs. ${fmt(amt)}) es menor al saldo pendiente (Gs. ${fmt(balance)}). ¿Querés registrar un pago parcial? Ajustá el monto.`);
      return;
    }
    if (!payBranch && hasBalance) {
      setError('Seleccioná la sucursal de cobro.');
      return;
    }

    setSaving(true);
    const branchName = FIXED_BRANCHES.find(b => b.id === payBranch)?.name ?? payBranch ?? sale.sucursalCobro ?? '';
    const clientName = `${sale.cliente?.nombre ?? ''} ${sale.cliente?.apellido ?? ''}`.trim();

    await closeSaleLocal(
      sale.id,
      deliveryMode,
      hasBalance && amt > 0
        ? {
            monto: amt,
            metodo: payMethod,
            sucursal: branchName,
            vendedora: profile?.full_name ?? '',
            cliente: clientName,
            receipt_url: undefined,
          }
        : undefined
    );

    setSaving(false);
    onDelivered();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4"
      style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="w-full lg:max-w-md rounded-t-3xl lg:rounded-2xl overflow-hidden"
        style={{ background: '#0e0e0e', border: '1px solid rgba(197,160,89,0.25)', maxHeight: '92vh', overflowY: 'auto' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
          style={{ background: '#0e0e0e', borderBottom: '1px solid rgba(197,160,89,0.12)' }}>
          <div>
            <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.55)' }}>Marcar como entregado</p>
            <p className="text-sm font-light text-white mt-0.5">
              VTA-{sale.id} · {`${sale.cliente?.nombre ?? ''} ${sale.cliente?.apellido ?? ''}`.trim()}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Resumen de la venta */}
          <div className="rounded-xl p-4 space-y-2"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.15)' }}>
            <div className="flex justify-between text-xs font-light">
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Total venta</span>
              <span className="text-white">Gs. {fmt(Number(sale.total))}</span>
            </div>
            <div className="flex justify-between text-xs font-light">
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Ya cobrado</span>
              <span style={{ color: '#10b981' }}>Gs. {fmt(Number(sale.sena))}</span>
            </div>
            <div className="flex justify-between text-xs font-medium border-t pt-2" style={{ borderColor: 'rgba(197,160,89,0.1)' }}>
              <span style={{ color: hasBalance ? '#f59e0b' : '#10b981' }}>
                {hasBalance ? 'Saldo pendiente' : '✓ Sin saldo pendiente'}
              </span>
              {hasBalance && (
                <span style={{ color: '#f59e0b' }}>Gs. {fmt(balance)}</span>
              )}
            </div>
          </div>

          {/* Pago del saldo si tiene */}
          {hasBalance && (
            <div className="space-y-3">
              <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(239,68,68,0.6)' }}>
                Cobrar saldo pendiente
              </p>

              {/* Monto */}
              <div>
                <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Monto a cobrar (Gs.)</p>
                <input
                  type="number"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border text-right"
                  style={{ borderColor: 'rgba(245,158,11,0.4)' }}
                />
              </div>

              {/* Método de pago */}
              <div>
                <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Método de pago</p>
                <div className="flex gap-1.5 flex-wrap">
                  {PAY_METHODS.map(m => (
                    <button key={m.id} onClick={() => setPayMethod(m.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-light"
                      style={{
                        background: payMethod === m.id ? `${m.color}18` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${payMethod === m.id ? m.color + '44' : 'rgba(255,255,255,0.08)'}`,
                        color: payMethod === m.id ? m.color : 'rgba(255,255,255,0.42)',
                      }}>
                      {m.icon}{m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sucursal de cobro */}
              <div>
                <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Sucursal de cobro</p>
                <select
                  value={payBranch}
                  onChange={e => setPayBranch(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm font-light outline-none border"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(197,160,89,0.22)', color: 'rgba(255,255,255,0.8)' }}>
                  <option value="" style={{ background: '#111' }}>— Seleccionar —</option>
                  {FIXED_BRANCHES.map(b => <option key={b.id} value={b.id} style={{ background: '#111' }}>{b.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Tipo de entrega */}
          <div>
            <p className="text-xs font-light mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Tipo de entrega</p>
            <div className="flex gap-2 flex-wrap">
              {DELIVERY_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => setDeliveryMode(opt.id)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-light"
                  style={{
                    background: deliveryMode === opt.id ? 'rgba(197,160,89,0.14)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${deliveryMode === opt.id ? 'rgba(197,160,89,0.44)' : 'rgba(255,255,255,0.08)'}`,
                    color: deliveryMode === opt.id ? '#C5A059' : 'rgba(255,255,255,0.44)',
                  }}>
                  {opt.icon}{opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Botones */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleDeliver}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
              style={{ background: saving ? 'rgba(16,185,129,0.4)' : '#10b981', color: '#000' }}>
              <Package size={14} />
              {saving ? 'Guardando...' : hasBalance ? 'Cobrar y entregar' : 'Confirmar entrega'}
            </button>
            <button onClick={onClose}
              className="px-5 py-3 rounded-xl text-sm font-light"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Cancelar
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Modal de edición ─────────────────────────────────────────────────────────
interface EditModalProps {
  sale: any;
  onClose: () => void;
  onSaved: () => void;
}

function EditModal({ sale, onClose, onSaved }: EditModalProps) {
  const [estado,    setEstado]    = useState<string>(sale.estadoTrabajo ?? 'pendiente');
  const [total,     setTotal]     = useState<string>(String(sale.total ?? ''));
  const [sena,      setSena]      = useState<string>(String(sale.sena  ?? ''));
  const [saldo,     setSaldo]     = useState<string>(String(sale.saldo ?? ''));
  const [obs,       setObs]       = useState<string>(sale.observaciones ?? '');
  const [vendedora, setVendedora] = useState<string>(sale.vendedora     ?? '');
  const [sucursal,  setSucursal]  = useState<string>(sale.sucursalVenta ?? '');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    const t = Number(total) || 0;
    const s = Number(sena)  || 0;
    if (t > 0) setSaldo(String(Math.max(0, t - s)));
  }, [total, sena]);

  async function handleSave() {
    setError('');
    const t = Number(total);
    const s = Number(sena);
    const b = Number(saldo);
    if (isNaN(t) || isNaN(s) || isNaN(b)) {
      setError('Total, seña y saldo deben ser números válidos.'); return;
    }
    setSaving(true);
    const { error: err } = await supabase
      .from('ventas')
      .update({
        estado_trabajo: estado,
        total: t, sena: s, saldo: b,
        observaciones: obs.trim() || null,
        vendedora: vendedora.trim() || null,
        sucursal_venta: sucursal || null,
      })
      .eq('id', sale.id);

    if (err) { setError('Error al guardar. Intentá de nuevo.'); setSaving(false); return; }
    setSaving(false);
    onSaved();
    onClose();
  }

  const sc = STATUS_CFG[estado] ?? STATUS_CFG.pendiente;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="w-full lg:max-w-lg rounded-t-3xl lg:rounded-2xl overflow-hidden"
        style={{ background: '#0e0e0e', border: '1px solid rgba(197,160,89,0.2)', maxHeight: '92vh', overflowY: 'auto' }}>

        <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
          style={{ background: '#0e0e0e', borderBottom: '1px solid rgba(197,160,89,0.1)' }}>
          <div>
            <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.55)' }}>Editando venta</p>
            <p className="text-sm font-light text-white mt-0.5">
              VTA-{sale.id} · {`${sale.cliente?.nombre ?? ''} ${sale.cliente?.apellido ?? ''}`.trim()}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <div className="px-3 py-2.5 rounded-xl text-xs"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-light mb-2 tracking-wide" style={{ color: 'rgba(197,160,89,0.65)' }}>Estado del trabajo</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(STATUS_CFG).map(([key, cfg]) => (
                <button key={key} onClick={() => setEstado(key)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-light text-left"
                  style={{
                    background: estado === key ? `${cfg.color}18` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${estado === key ? cfg.color + '55' : 'rgba(255,255,255,0.08)'}`,
                    color: estado === key ? cfg.color : 'rgba(255,255,255,0.45)',
                  }}>
                  {cfg.icon}{cfg.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>Seleccionado:</span>
              <span className="px-2 py-0.5 rounded text-xs inline-flex items-center gap-1"
                style={{ background: `${sc.color}18`, color: sc.color }}>
                {sc.icon}{sc.label}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-light mb-2 tracking-wide" style={{ color: 'rgba(197,160,89,0.65)' }}>Montos (Gs.)</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total', value: total, onChange: setTotal, color: '#C5A059' },
                { label: 'Seña',  value: sena,  onChange: setSena,  color: '#10b981' },
                { label: 'Saldo', value: saldo, onChange: setSaldo, color: Number(saldo) > 0 ? '#f59e0b' : '#10b981' },
              ].map(f => (
                <div key={f.label}>
                  <p className="text-xs font-light mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{f.label}</p>
                  <input type="number" value={f.value} onChange={e => f.onChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-transparent text-sm font-light outline-none border"
                    style={{ borderColor: 'rgba(197,160,89,0.22)', color: f.color }} />
                </div>
              ))}
            </div>
            <p className="text-xs font-light mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
              El saldo se recalcula automáticamente al cambiar total o seña.
            </p>
          </div>

          <div>
            <label className="block text-xs font-light mb-2 tracking-wide" style={{ color: 'rgba(197,160,89,0.65)' }}>Vendedora</label>
            <input type="text" value={vendedora} onChange={e => setVendedora(e.target.value)}
              placeholder="Nombre de la vendedora"
              className="w-full px-3 py-2.5 rounded-xl bg-transparent text-sm font-light text-white outline-none border"
              style={{ borderColor: 'rgba(197,160,89,0.22)' }} />
          </div>

          <div>
            <label className="block text-xs font-light mb-2 tracking-wide" style={{ color: 'rgba(197,160,89,0.65)' }}>Sucursal de venta</label>
            <select value={sucursal} onChange={e => setSucursal(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm font-light outline-none border"
              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(197,160,89,0.22)', color: 'rgba(255,255,255,0.8)' }}>
              <option value="" style={{ background: '#111' }}>Sin sucursal</option>
              {SUCURSALES.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-light mb-2 tracking-wide" style={{ color: 'rgba(197,160,89,0.65)' }}>Observaciones</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Notas internas, detalles del pedido..." rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-transparent text-sm font-light text-white outline-none border resize-none"
              style={{ borderColor: 'rgba(197,160,89,0.22)' }} />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
              style={{ background: saving ? 'rgba(197,160,89,0.4)' : '#C5A059', color: '#000' }}>
              <Save size={14} />{saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button onClick={onClose}
              className="px-5 py-3 rounded-xl text-sm font-light"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
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

  useEffect(() => {
    if (!profile) return;
    if (isAdmin) { setCanEdit(true); return; }
    supabase
      .from('optica_users')
      .select('puede_editar_ventas')
      .eq('id', profile.id)
      .maybeSingle()
      .then(({ data }) => setCanEdit(data?.puede_editar_ventas ?? false));
  }, [profile]);

  // CORREGIDO: vendedoras ven SOLO sus ventas
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
      const q     = normalize(search);
      const name  = normalize(`${v.cliente.nombre} ${v.cliente.apellido}`);
      const ci    = normalize(v.cliente.ci || '');
      const tel   = (v.cliente.telefono || '').replace(/\D/g, '');
      const qTel  = search.replace(/\D/g, '');
      const vtaId = String(v.id);
      return name.includes(q) || ci.includes(q) || (qTel.length >= 3 && tel.includes(qTel)) || vtaId.includes(q) || (v.vendedora || '').toLowerCase().includes(q);
    }
    return true;
  });

  const countBy        = (status: string) => sales.filter(v => v.estadoTrabajo === status).length;
  const totalFacturado = sales.reduce((s, v) => s + (Number(v.total) || 0), 0);
  const totalCobrado   = sales.reduce((s, v) => s + ((Number(v.total) || 0) - (Number(v.saldo) || 0)), 0);

  // CORREGIDO: una venta entregada o cancelada nunca muestra saldo pendiente
  function getSaldoDisplay(v: any) {
    if (v.estadoTrabajo === 'entregado' || v.estadoTrabajo === 'cancelado') return null;
    const saldo = Number(v.saldo) || 0;
    if (saldo <= 0) return null;
    return saldo;
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-5xl mx-auto">

      {editSale && (
        <EditModal sale={editSale} onClose={() => setEditSale(null)} onSaved={() => refresh()} />
      )}
      {deliverSale && (
        <DeliverModal sale={deliverSale} onClose={() => setDeliverSale(null)} onDelivered={() => refresh()} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-light tracking-wider text-white">
            {isVendedora ? 'Mis Ventas' : 'Historial de Ventas'}
          </h1>
          <p className="text-xs text-gold-muted mt-0.5 tracking-wide">
            {isVendedora
              ? `${profile?.full_name} · solo tus ventas`
              : branchFilter ? `Sucursal ${branchFilter} · ${sales.length} ventas` : 'Registro completo de ventas'}
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
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border"
            style={{ borderColor: 'rgba(197,160,89,0.2)', background: 'rgba(255,255,255,0.02)' }}>
            <Search size={13} style={{ color: 'rgba(197,160,89,0.5)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Nombre, C.I., celular o venta..."
              className="bg-transparent text-xs text-white outline-none w-44" />
          </div>
          <button onClick={() => refresh()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)' }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.2)' }}>
          <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {isVendedora ? 'Mis ventas' : branchFilter ? `Ventas ${branchFilter}` : 'Total ventas'}
          </p>
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

      {/* Filtros por estado */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setStatusFilter('todos')}
          className="px-3 py-1.5 rounded-lg text-xs font-light"
          style={{ background: statusFilter === 'todos' ? 'rgba(197,160,89,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${statusFilter === 'todos' ? 'rgba(197,160,89,0.4)' : 'rgba(255,255,255,0.08)'}`, color: statusFilter === 'todos' ? '#C5A059' : 'rgba(255,255,255,0.4)' }}>
          Todas ({sales.length})
        </button>
        {Object.entries(STATUS_CFG).map(([key, cfg]) => {
          const count = countBy(key);
          if (count === 0) return null;
          return (
            <button key={key} onClick={() => setStatusFilter(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light"
              style={{ background: statusFilter === key ? `${cfg.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${statusFilter === key ? cfg.color + '44' : 'rgba(255,255,255,0.08)'}`, color: statusFilter === key ? cfg.color : 'rgba(255,255,255,0.4)' }}>
              {cfg.icon}{cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Lista */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag size={32} style={{ color: 'rgba(197,160,89,0.2)', margin: '0 auto 12px' }} />
            <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {search ? 'Sin resultados para esa búsqueda' : 'No hay ventas registradas'}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {filtered.map((v, saleIdx) => {
              const key      = String(v.id);
              const isExp    = expandedId === key;
              const sc       = STATUS_CFG[v.estadoTrabajo] ?? STATUS_CFG.pendiente;
              const name     = `${v.cliente.nombre} ${v.cliente.apellido}`.trim() || '—';
              const anteojos = (v.anteojos as any[]) || [];
              const waUrl    = v.cliente.telefono
                ? `https://wa.me/595${v.cliente.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${v.cliente.nombre}! Te contactamos de Óptica Yolanda.`)}`
                : null;
              const fechaStr  = new Date(v.fecha).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: '2-digit' });
              // CORREGIDO: saldo visible solo si NO está entregado/cancelado
              const saldoVisible = getSaldoDisplay(v);
              const isEntregado  = v.estadoTrabajo === 'entregado';

              return (
                <div key={key}>
                  <div className="px-4 py-3.5 cursor-pointer"
                    style={{ background: isExp ? 'rgba(197,160,89,0.03)' : 'transparent' }}
                    onClick={() => setExpandedId(isExp ? null : key)}>

                    {/* Línea 1 */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0"
                        style={{ background: '#C5A059', fontSize: 10 }}>{saleIdx + 1}</span>
                      <p className="text-sm text-white font-light flex-1 truncate">{name}</p>

                      {/* Botón entregar — solo si NO está entregado/cancelado */}
                      {canEdit && !isEntregado && v.estadoTrabajo !== 'cancelado' && (
                        <button
                          onClick={e => { e.stopPropagation(); setDeliverSale(v); }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-light shrink-0"
                          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}
                          title="Marcar como entregado">
                          <Package size={11} />
                          <span className="hidden lg:inline">Entregar</span>
                        </button>
                      )}

                      {canEdit && (
                        <button
                          onClick={e => { e.stopPropagation(); setEditSale(v); }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-light shrink-0"
                          style={{ background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.2)', color: 'rgba(197,160,89,0.7)' }}
                          title="Editar venta">
                          <Pencil size={11} />
                          <span className="hidden lg:inline">Editar</span>
                        </button>
                      )}

                      <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)', transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                    </div>

                    {/* Línea 2 */}
                    <div className="flex items-center gap-1.5 flex-wrap pl-8 mb-1.5">
                      <span className="text-xs font-mono" style={{ color: '#C5A059' }}>VTA-{v.id}</span>
                      {v.sucursalVenta && <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>· {v.sucursalVenta}</span>}
                      {isAdmin && v.vendedora && <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>· {v.vendedora}</span>}
                      <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>· {fechaStr}</span>
                    </div>

                    {/* Línea 3 */}
                    {(v.cliente.ci || v.cliente.telefono) && (
                      <div className="flex items-center gap-3 pl-8 mb-1.5">
                        {v.cliente.ci && <span className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.6)' }}>CI: {v.cliente.ci}</span>}
                        {v.cliente.telefono && <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>📞 {v.cliente.telefono}</span>}
                      </div>
                    )}

                    {/* Línea 4: montos y estado */}
                    <div className="flex items-center gap-3 pl-8 flex-wrap">
                      <div>
                        <span className="text-xs text-white font-light">Gs. {fmt(Number(v.total))}</span>
                        <span className="text-xs font-light ml-1.5" style={{ color: '#10b981' }}>Pagó {fmt(Number(v.sena))}</span>
                      </div>
                      {/* CORREGIDO: si está entregado, NO mostrar saldo */}
                      {saldoVisible !== null ? (
                        <span className="text-xs font-light" style={{ color: '#f59e0b' }}>
                          Debe Gs. {fmt(saldoVisible)}
                        </span>
                      ) : (
                        <span className="text-xs font-light" style={{ color: '#10b981' }}>✓ Pagado</span>
                      )}
                      <span className="px-2 py-0.5 rounded text-xs font-light inline-flex items-center gap-1"
                        style={{ background: `${sc.color}18`, color: sc.color }}>
                        {sc.icon}{sc.label}
                      </span>
                    </div>
                  </div>

                  {/* Panel expandido */}
                  {isExp && (
                    <div className="px-4 pb-5 space-y-4" style={{ background: 'rgba(197,160,89,0.02)' }}>

                      <div className="flex items-center gap-3 pt-2 flex-wrap">
                        {v.cliente.telefono && (
                          <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.45)' }}>📞 {v.cliente.telefono}</span>
                        )}
                        {v.cliente.ci && (
                          <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>CI: {v.cliente.ci}</span>
                        )}
                        <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          📅 {new Date(v.fecha).toLocaleDateString('es-PY', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                        </span>
                        {waUrl && (
                          <a href={waUrl} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light"
                            style={{ background: 'rgba(37,211,102,0.1)', color: '#25D366', border: '1px solid rgba(37,211,102,0.25)' }}>
                            <MessageCircle size={12} />WhatsApp
                          </a>
                        )}
                        {canEdit && !isEntregado && v.estadoTrabajo !== 'cancelado' && (
                          <button onClick={() => setDeliverSale(v)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light"
                            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
                            <Package size={12} />Marcar como entregado
                          </button>
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
                              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(197,160,89,0.12)' }}>
                              <div className="flex items-start gap-3">
                                {eg.photo_url ? (
                                  <img src={eg.photo_url} alt="armazón"
                                    className="w-20 h-16 object-cover rounded-lg border shrink-0 cursor-pointer"
                                    style={{ borderColor: 'rgba(197,160,89,0.3)' }}
                                    onClick={() => window.open(eg.photo_url, '_blank')} />
                                ) : (
                                  <div className="w-20 h-16 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(197,160,89,0.1)' }}>
                                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Sin foto</span>
                                  </div>
                                )}
                                <div className="flex-1 space-y-1">
                                  <p className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.7)' }}>Armazón {i + 1}</p>
                                  {eg.frame_description && <p className="text-sm text-white font-light">{eg.frame_description}</p>}
                                  <div className="flex gap-2 flex-wrap">
                                    {eg.crystals   && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>{eg.crystals}</span>}
                                    {eg.treatments && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>{eg.treatments}</span>}
                                  </div>
                                </div>
                              </div>

                              {eg.prescription && (
                                <div className="rounded-lg p-3 space-y-2"
                                  style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.18)' }}>
                                  <p className="text-xs font-light tracking-widest uppercase flex items-center gap-1.5" style={{ color: 'rgba(197,160,89,0.7)' }}>
                                    <FlaskConical size={11} style={{ color: '#3b82f6' }} />Receta óptica
                                  </p>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <p className="text-xs font-light mb-1" style={{ color: '#C5A059' }}>OD (ojo derecho)</p>
                                      <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.75)' }}>
                                        {eg.prescription.od_esfera || '—'} / {eg.prescription.od_cilindro || '—'} x {eg.prescription.od_eje || '—'}
                                        {eg.prescription.od_altura ? ` · Alt: ${eg.prescription.od_altura}` : ''}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-light mb-1" style={{ color: '#C5A059' }}>OI (ojo izquierdo)</p>
                                      <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.75)' }}>
                                        {eg.prescription.oi_esfera || '—'} / {eg.prescription.oi_cilindro || '—'} x {eg.prescription.oi_eje || '—'}
                                        {eg.prescription.oi_altura ? ` · Alt: ${eg.prescription.oi_altura}` : ''}
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
