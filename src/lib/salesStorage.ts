import { supabase } from './supabase';

export const LS_KEY          = 'optica_yolanda_ventas';
export const LS_PAYMENTS_KEY = 'optica_yolanda_abonos';
export const LS_EXPENSES_KEY = 'optica_yolanda_gastos';

export type StoredSale = {
  id: number;
  fecha: string;
  cliente: { nombre: string; apellido: string; telefono: string; ci: string };
  sucursalVenta: string;
  sucursalEntrega: string;
  sucursalCobro: string;
  vendedora: string;
  total: number;
  sena: number;
  saldo: number;
  metodoPago: string;
  estadoTrabajo: string;
  anteojos: unknown[];
  observaciones: string;
  delivery_type?: 'retiro' | 'delivery' | 'encomienda';
  delivered_at?: string;
  receipt_url?: string;
};

export type StoredPayment = {
  id: number;
  saleId: number;
  fecha: string;
  monto: number;
  metodo: string;
  sucursal: string;
  vendedora: string;
  cliente: string;
  tipo: 'sena' | 'abono';
  receipt_url?: string;
};

export type StoredExpense = {
  id: number;
  fecha: string;
  descripcion: string;
  categoria: string;
  monto: number;
  metodo: string;
  sucursal: string;
  vendedora: string;
};

export type SalesSummary = {
  totalVentas: number;
  totalFacturado: number;
  totalCobrado: number;
};

// ── Image compression ─────────────────────────────────────────────────────────
export function compressImage(dataUrl: string, maxKB = 200): Promise<string> {
  return new Promise(resolve => {
    if (!dataUrl.startsWith('data:image')) { resolve(dataUrl); return; }
    const img = new Image();
    img.onload = () => {
      const MAX_BYTES = maxKB * 1024;
      if (dataUrl.length * 0.75 <= MAX_BYTES) { resolve(dataUrl); return; }
      const canvas = document.createElement('canvas');
      const scaleFactor = Math.sqrt(MAX_BYTES / (dataUrl.length * 0.75));
      canvas.width  = Math.max(1, Math.floor(img.width  * scaleFactor));
      canvas.height = Math.max(1, Math.floor(img.height * scaleFactor));
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      let out = canvas.toDataURL('image/jpeg', 0.75);
      if (out.length * 0.75 > MAX_BYTES) out = canvas.toDataURL('image/jpeg', 0.50);
      resolve(out);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function saleToRow(sale: StoredSale) {
  return {
    id:               sale.id,
    fecha:            sale.fecha,
    cliente_nombre:   sale.cliente.nombre,
    cliente_apellido: sale.cliente.apellido,
    cliente_telefono: sale.cliente.telefono,
    cliente_ci:       sale.cliente.ci,
    sucursal_venta:   sale.sucursalVenta,
    sucursal_entrega: sale.sucursalEntrega,
    sucursal_cobro:   sale.sucursalCobro,
    vendedora:        sale.vendedora,
    total:            sale.total,
    sena:             sale.sena,
    saldo:            sale.saldo,
    metodo_pago:      sale.metodoPago,
    estado_trabajo:   sale.estadoTrabajo,
    anteojos:         sale.anteojos,
    observaciones:    sale.observaciones,
    delivery_type:    sale.delivery_type || null,
    delivered_at:     sale.delivered_at  || null,
    receipt_url:      sale.receipt_url   || null,
  };
}

function trySet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

// ── Crear orden de lab automáticamente al registrar venta ─────────────────────
async function createLabOrder(sale: StoredSale) {
  try {
    await supabase.from('lab_orders').upsert({
      id:             `lab-${sale.id}`,
      sale_id:        sale.id,
      sale_number:    `VTA-${sale.id}`,
      customer_name:  `${sale.cliente.nombre} ${sale.cliente.apellido}`.trim(),
      customer_phone: sale.cliente.telefono || '',
      customer_ci:    sale.cliente.ci || '',
      seller_name:    sale.vendedora,
      seller_phone:   '',
      branch_name:    sale.sucursalVenta,
      status:         'enviado',
      notes:          String(sale.observaciones || ''),
      created_at:     sale.fecha,
      updated_at:     sale.fecha,
      anteojos:       sale.anteojos,
      history:        [{ status: 'enviado', timestamp: sale.fecha, by: sale.vendedora }],
    }, { onConflict: 'id', ignoreDuplicates: true });
  } catch { /* ignore */ }
}

// ── Sales ─────────────────────────────────────────────────────────────────────
export function getSales(): StoredSale[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveSale(sale: StoredSale): Promise<void> {
  await supabase.from('ventas').upsert(saleToRow(sale));
  await createLabOrder(sale);
  const current = getSales().filter(s => s.id !== sale.id);
  trySet(LS_KEY, JSON.stringify([sale, ...current]));
  if (sale.sena > 0 || sale.total > 0) {
    await recordPayment({
      id: Date.now(), saleId: sale.id, fecha: sale.fecha,
      monto: sale.sena > 0 ? sale.sena : sale.total,
      metodo: sale.metodoPago, sucursal: sale.sucursalCobro,
      vendedora: sale.vendedora,
      cliente: `${sale.cliente.nombre} ${sale.cliente.apellido}`.trim(),
      tipo: 'sena', receipt_url: sale.receipt_url || undefined,
    });
  }
  window.dispatchEvent(new CustomEvent('optica_ventas_updated'));
}

export async function updateSaleBalance(saleId: number, newBalance: number, newDeposit: number): Promise<void> {
  const patch: any = { saldo: newBalance, sena: newDeposit };
  if (newBalance <= 0) patch.estado_trabajo = 'pagado_total';
  await supabase.from('ventas').update(patch).eq('id', saleId);
  const sales = getSales().map(s => {
    if (s.id !== saleId) return s;
    const u = { ...s, saldo: newBalance, sena: newDeposit };
    if (newBalance <= 0 && s.estadoTrabajo !== 'entregado' && s.estadoTrabajo !== 'cancelado') u.estadoTrabajo = 'pagado_total';
    return u;
  });
  trySet(LS_KEY, JSON.stringify(sales));
  window.dispatchEvent(new CustomEvent('optica_ventas_updated'));
}

// CORREGIDO: closeSaleLocal ahora siempre pone saldo=0, sena=total y registra
// el pago final si había saldo pendiente antes de entregar
export async function closeSaleLocal(
  saleId: number,
  deliveryType: 'retiro' | 'delivery' | 'encomienda',
  finalPayment?: { monto: number; metodo: string; sucursal: string; vendedora: string; cliente: string; receipt_url?: string }
): Promise<void> {
  const now = new Date().toISOString();

  // Si viene un pago final, registrarlo antes de cerrar
  if (finalPayment && finalPayment.monto > 0) {
    await recordPayment({
      id: Date.now(),
      saleId,
      fecha: now,
      monto: finalPayment.monto,
      metodo: finalPayment.metodo,
      sucursal: finalPayment.sucursal,
      vendedora: finalPayment.vendedora,
      cliente: finalPayment.cliente,
      tipo: 'abono',
      receipt_url: finalPayment.receipt_url,
    });
  }

  // Obtener la venta para saber el total
  const sale = getSales().find(s => s.id === saleId);
  const total = sale?.total ?? 0;

  // Siempre cerrar con saldo=0 y estado=entregado
  await supabase.from('ventas').update({
    saldo: 0,
    sena: total,
    estado_trabajo: 'entregado',
    delivery_type: deliveryType,
    delivered_at: now,
  }).eq('id', saleId);

  await supabase.from('lab_orders').update({
    status: 'entregado',
    updated_at: now,
  }).eq('sale_id', saleId);

  // Actualizar localStorage
  const sales = getSales().map(s =>
    s.id === saleId
      ? { ...s, saldo: 0, sena: total, estadoTrabajo: 'entregado', delivery_type: deliveryType, delivered_at: now }
      : s
  );
  trySet(LS_KEY, JSON.stringify(sales));
  window.dispatchEvent(new CustomEvent('optica_ventas_updated'));
}

export function clearSales(): void {
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem(LS_PAYMENTS_KEY);
  window.dispatchEvent(new CustomEvent('optica_ventas_updated'));
}

export function getSalesSummary(ventas?: StoredSale[]): SalesSummary {
  const all = ventas ?? getSales();
  return {
    totalVentas:    all.length,
    totalFacturado: all.reduce((a, v) => a + (Number(v.total) || 0), 0),
    totalCobrado:   all.reduce((a, v) => a + ((Number(v.total) || 0) - (Number(v.saldo) || 0)), 0),
  };
}

// ── Payments ──────────────────────────────────────────────────────────────────
export function getPayments(): StoredPayment[] {
  try {
    const raw = localStorage.getItem(LS_PAYMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function recordPayment(payment: StoredPayment): Promise<void> {
  await supabase.from('pagos').upsert({
    id: payment.id, sale_id: payment.saleId, fecha: payment.fecha,
    monto: payment.monto, metodo: payment.metodo, sucursal: payment.sucursal,
    vendedora: payment.vendedora, cliente: payment.cliente, tipo: payment.tipo,
    receipt_url: payment.receipt_url || null,
  });
  const current = getPayments().filter(p => p.id !== payment.id);
  trySet(LS_PAYMENTS_KEY, JSON.stringify([payment, ...current]));
  window.dispatchEvent(new CustomEvent('optica_ventas_updated'));
}

export function getPaymentsForDate(date: string): StoredPayment[] {
  return getPayments().filter(p => (p.fecha || '').startsWith(date));
}

// ── Expenses ──────────────────────────────────────────────────────────────────
export function getExpenses(): StoredExpense[] {
  try {
    const raw = localStorage.getItem(LS_EXPENSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveExpense(expense: StoredExpense): Promise<void> {
  await supabase.from('gastos').upsert({
    id: expense.id, fecha: expense.fecha, descripcion: expense.descripcion,
    categoria: expense.categoria, monto: expense.monto, metodo: expense.metodo,
    sucursal: expense.sucursal, vendedora: expense.vendedora,
  });
  const current = getExpenses().filter(e => e.id !== expense.id);
  trySet(LS_EXPENSES_KEY, JSON.stringify([expense, ...current]));
  window.dispatchEvent(new CustomEvent('optica_ventas_updated'));
}

export function getExpensesForDate(date: string): StoredExpense[] {
  return getExpenses().filter(e => (e.fecha || '') === date);
}
