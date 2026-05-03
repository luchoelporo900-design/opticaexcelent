import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Plus, Check, X, Search, ChevronDown, DollarSign, Phone, Camera, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSales, updateSaleBalance, recordPayment, getPayments, closeSaleLocal } from '../lib/salesStorage';

type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'qr' | 'giro';

const PAYMENT_METHODS: { id: PaymentMethod; label: string; color: string }[] = [
  { id: 'efectivo',      label: 'Efectivo',     color: '#22c55e' },
  { id: 'transferencia', label: 'Transferencia', color: '#3b82f6' },
  { id: 'tarjeta',       label: 'POS',          color: '#f59e0b' },
  { id: 'qr',            label: 'QR',           color: '#C5A059' },
  { id: 'giro',          label: 'Giro',         color: '#a78bfa' },
];

const SUCURSALES = ['Azara', 'Fernando', 'Caacupé', 'La Fina'];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pendiente:      { label: 'Pendiente',   color: '#f59e0b' },
  en_laboratorio: { label: 'Laboratorio', color: '#3b82f6' },
  listo:          { label: 'Listo',       color: '#10b981' },
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

export default function BalancesPage() {
  const { profile } = useAuth();
  const isAdmin     = profile?.role === 'admin' || profile?.role === 'gerente';
  const isVendedora = profile?.role === 'vendedora';

  const [rows,       setRows]       = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [searchText, setSearchText] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [addPayFor,  setAddPayFor]  = useState<string | null>(null);
  const [payAmt,     setPayAmt]     = useState('');
  const [payMethod,  setPayMethod]  = useState<PaymentMethod>('efectivo');
  const [payBranch,  setPayBranch]  = useState('');
  const [payReceipt, setPayReceipt] = useState('');
  const [savingPay,  setSavingPay]  = useState(false);
  const [paySuccess, setPaySuccess] = useState('');
  const receiptRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const all = getSales().filter(v => {
      if (v.estadoTrabajo === 'entregado' || v.estadoTrabajo === 'cancelado') return false;
      if (isVendedora && v.vendedora !== profile?.full_name) return false;
      return true;
    });
    setRows(all.map(v => ({
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
      branch_name:         v.sucursalVenta,
      cobro_branch:        v.sucursalCobro,
      anteojos:            v.anteojos || [],
      observaciones:       v.observaciones || '',
    })));
    setLoading(false);
  }, [profile, isVendedora]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('optica_ventas_updated', h);
    return () => window.removeEventListener('optica_ventas_updated', h);
  }, [load]);

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

  function registerPayment(row: any) {
    const amt = parseFloat(payAmt);
    if (!amt || amt <= 0) return;
    setSavingPay(true);
    const saleIdNum  = Number(row.id);
    const newDeposit = row.deposit + amt;
    const newBalance = Math.max(0, row.total - newDeposit);
    updateSaleBalance(saleIdNum, newBalance, newDeposit);
    recordPayment({
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
    load();
  }

  // ── Marcar como entregado ─────────────────────────────────────────────────
  function markDelivered(rowId: string) {
    const saleIdNum = Number(rowId);
    const sale = getSales().find(v => v.id === saleIdNum);
    closeSaleLocal(saleIdNum, 'retiro');

    // Guardar alerta para el admin
    if (sale) {
      try {
        const alerts = JSON.parse(localStorage.getItem('optica_delivery_alerts') || '[]');
        alerts.unshift({
          id: Date.now(),
          saleId: saleIdNum,
          saleNumber: `VTA-${saleIdNum}`,
          customer: `${sale.cliente.nombre} ${sale.cliente.apellido}`.trim(),
          vendedora: sale.vendedora,
          total: sale.total,
          timestamp: new Date().toISOString(),
          reviewed: false,
        });
        localStorage.setItem('optica_delivery_alerts', JSON.stringify(alerts.slice(0, 50)));
      } catch {}
    }

    setPaySuccess('✓ Lentes entregados — venta cerrada. El administrador verá una alerta para verificar el pago.');
    setExpandedId(null);
    setTimeout(() => setPaySuccess(''), 5000);
    load();
    window.dispatchEvent(new Event('optica_ventas_updated'));
  }

  function getPayHistory(saleId: string) {
    return getPayments().filter(p => String(p.saleId) === saleId);
  }

  const filtered = rows.filter(r => {
    if (!searchText) return true;
    const q    = searchText.toLowerCase();
    const name = `${r.customer_first_name} ${r.customer_last_name}`;
    return name.toLowerCase().includes(q) || r.sale_number.toLowerCase().includes(q) || (r.seller_name ?? '').toLowerCase().includes(q);
  });

  const totalPending = rows.filter(r => Number(r.balance) > 0).reduce((s, r) => s + Number(r.balance), 0);
  const today        = new Date().toISOString().slice(0, 10);
  const todayPayments = isVendedora
    ? getPayments().filter(p => p.vendedora === profile?.full_name && (p.fecha || '').startsWith(today))
    : [];
  const todayTotal = todayPayments.reduce((s, p) => s + Number(p.monto), 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-light tracking-wider text-white">
            {isVendedora ? 'Mis Ventas Activas' : 'Saldos Pendientes'}
          </h1>
          <p className="text-xs text-gold-muted mt-0.5 tracking-wide">
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
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
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

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        {loading ? (
          <div className="p-6 space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded shimmer" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Check size={32} style={{ color: 'rgba(16,185,129,0.3)', margin: '0 auto 12px' }} />
            <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {searchText ? 'Sin resultados' : 'No hay ventas activas'}
            </p>
          </div>
        ) : (
          <div>
            <div className="grid px-5 py-2.5 text-xs font-light"
              style={{ gridTemplateColumns: '1fr 140px 100px 120px 36px', borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.30)' }}>
              <span>Cliente / Venta</span>
              <span>Total / Pagado</span>
              <span>Saldo</span>
              <span>Estado</span>
              <span />
            </div>

            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              {filtered.map(row => {
                const sc         = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.pendiente;
                const isExp      = expandedId === row.id;
                const isPayOpen  = addPayFor === row.id;
                const clientName = `${row.customer_first_name} ${row.customer_last_name}`.trim() || '—';
                const payHistory = isExp ? getPayHistory(row.id) : [];
                const lensPhotos = isExp ? (row.anteojos as any[]).filter((eg: any) => eg.photo_url) : [];
                const isPaid     = Number(row.balance) <= 0;

                return (
                  <div key={row.id}>
                    <div className="grid items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors"
                      style={{ gridTemplateColumns: '1fr 140px 100px 120px 36px', background: isExp ? 'rgba(197,160,89,0.03)' : 'transparent' }}
                      onMouseEnter={e => { if (!isExp) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.015)'; }}
                      onMouseLeave={e => { if (!isExp) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      onClick={() => setExpandedId(isExp ? null : row.id)}>

                      <div className="min-w-0">
                        <p className="text-sm text-white font-light truncate">{clientName}</p>
                        <p className="text-xs font-light mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.36)' }}>
                          <span style={{ color: '#C5A059' }}>#{row.sale_number}</span>
                          {row.branch_name ? ` · ${row.branch_name}` : ''}
                          {isAdmin && row.seller_name ? ` · ${row.seller_name}` : ''}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-white font-light">Gs. {fmt(Number(row.total))}</p>
                        <p className="text-xs font-light mt-0.5" style={{ color: '#10b981' }}>Pagó {fmt(Number(row.deposit))}</p>
                      </div>

                      <p className="text-sm font-light" style={{ color: isPaid ? '#10b981' : '#f59e0b' }}>
                        {isPaid ? '✓ Pagado' : `Gs. ${fmt(Number(row.balance))}`}
                      </p>

                      <span className="px-2 py-1 rounded text-xs font-light inline-block"
                        style={{ background: `${sc.color}18`, color: sc.color }}>
                        {sc.label}
                      </span>

                      <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)', transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </div>

                    {isExp && (
                      <div className="px-5 pb-5 space-y-4" style={{ background: 'rgba(197,160,89,0.02)' }}>

                        {row.customer_phone && (
                          <p className="text-xs font-light flex items-center gap-1.5 pt-2" style={{ color: 'rgba(255,255,255,0.44)' }}>
                            <Phone size={10} />{row.customer_phone}
                          </p>
                        )}

                        {lensPhotos.length > 0 && (
                          <div>
                            <p className="text-xs font-light tracking-widest uppercase mb-2" style={{ color: 'rgba(197,160,89,0.55)' }}>Fotos del lente</p>
                            <div className="flex gap-2 flex-wrap">
                              {lensPhotos.map((eg: any, i: number) => (
                                <img key={i} src={eg.photo_url} alt={`lente ${i+1}`}
                                  className="h-20 w-24 object-cover rounded-lg border cursor-pointer"
                                  style={{ borderColor: 'rgba(197,160,89,0.25)' }}
                                  onClick={() => window.open(eg.photo_url, '_blank')} />
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
                                        className="h-10 w-14 object-cover rounded border cursor-pointer"
                                        style={{ borderColor: 'rgba(197,160,89,0.25)' }}
                                        onClick={() => window.open((p as any).receipt_url, '_blank')} />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Formulario de abono — solo si hay saldo */}
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
                                      <img src={payReceipt} alt="comprobante" className="h-24 w-32 object-cover rounded-lg border" style={{ borderColor: 'rgba(197,160,89,0.25)' }} />
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
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all"
                                style={{ background: 'rgba(197,160,89,0.10)', color: '#C5A059', border: '1px solid rgba(197,160,89,0.28)' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(197,160,89,0.18)'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(197,160,89,0.10)'}>
                                <Plus size={12} />Registrar Pago de Saldo
                              </button>
                            )}
                          </div>
                        )}

                        {/* Botón entregado — solo para pendiente y pagado_total */}
                        {(row.status === 'pendiente' || row.status === 'en_proceso' || row.status === 'pagado_total') && (
                          <div className="pt-3 space-y-2" style={{ borderTop: '1px solid rgba(197,160,89,0.10)' }}>
                            {isPaid && (
                              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
                                <Check size={14} style={{ color: '#10b981' }} />
                                <p className="text-xs font-light" style={{ color: '#10b981' }}>
                                  Pago completo — marcar cuando retiren los lentes
                                </p>
                              </div>
                            )}
                            <button
                              onClick={e => { e.stopPropagation(); markDelivered(row.id); }}
                              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                              style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.35)' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.22)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.12)'; }}>
                              <Package size={15} />
                              ✓ Marcar como Entregado
                            </button>
                          </div>
                        )}
                        {/* Laboratorio/Listo — no se puede entregar aún */}
                        {(row.status === 'en_laboratorio' || row.status === 'listo') && (
                          <div className="pt-3" style={{ borderTop: '1px solid rgba(197,160,89,0.10)' }}>
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                              style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
                              <span className="text-sm">🔬</span>
                              <p className="text-xs font-light" style={{ color: 'rgba(59,130,246,0.8)' }}>
                                {row.status === 'listo' ? 'Listo en laboratorio — esperando retiro' : 'En laboratorio — no se puede entregar aún'}
                              </p>
                            </div>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
