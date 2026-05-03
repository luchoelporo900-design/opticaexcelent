export const LS_KEY = 'optica_yolanda_ventas';
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
  receipt_url?: string;   // ← comprobante del pago inicial
};

// Represents any single cash movement (initial seña or subsequent abono)
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

// ── localStorage helpers ──────────────────────────────────────────────────────
function purgeOldSales(): void {
  try {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 3);
    const kept = getSales().filter(s => new Date(s.fecha) >= cutoff);
    localStorage.setItem(LS_KEY, JSON.stringify(kept));
  } catch { /* ignore */ }
}

function trySetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) return false;
    return false;
  }
}

// ── Sales ─────────────────────────────────────────────────────────────────────
export function getSales(): StoredSale[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as StoredSale[]) : [];
  } catch { return []; }
}

export function saveSale(sale: StoredSale): void {
  const updated = [...getSales(), sale];
  const json = JSON.stringify(updated);

  if (!trySetItem(LS_KEY, json)) {
    // Strip photo data to save space
    const stripped = updated.map(s => ({
      ...s,
      anteojos: Array.isArray(s.anteojos)
        ? (s.anteojos as any[]).map((eg: any) => ({ ...eg, photo_url: '' }))
        : s.anteojos,
      receipt_url: '',
    }));
    if (!trySetItem(LS_KEY, JSON.stringify(stripped))) {
      purgeOldSales();
      const afterPurge = [...getSales(), sale];
      trySetItem(LS_KEY, JSON.stringify(
        afterPurge.map(s => ({
          ...s,
          anteojos: Array.isArray(s.anteojos)
            ? (s.anteojos as any[]).map((eg: any) => ({ ...eg, photo_url: '' }))
            : s.anteojos,
          receipt_url: '',
        }))
      ));
    }
  }

  // ── Registrar el pago inicial (seña) CON comprobante ──────────────────────
  if (sale.sena > 0 || sale.total > 0) {
    recordPayment({
      id: Date.now(),
      saleId: sale.id,
      fecha: sale.fecha,
      monto: sale.sena > 0 ? sale.sena : sale.total,
      metodo: sale.metodoPago,
      sucursal: sale.sucursalCobro,
      vendedora: sale.vendedora,
      cliente: `${sale.cliente.nombre} ${sale.cliente.apellido}`.trim(),
      tipo: 'sena',
      receipt_url: sale.receipt_url || undefined,   // ← ahora se guarda
    });
  }

  window.dispatchEvent(new CustomEvent('optica_ventas_updated'));
}

export function updateSaleBalance(saleId: number, newBalance: number, newDeposit: number): void {
  const sales = getSales();
  const updated = sales.map(s => {
    if (s.id !== saleId) return s;
    const patch: Partial<StoredSale> = { saldo: newBalance, sena: newDeposit };
    if (newBalance <= 0 && s.estadoTrabajo !== 'entregado' && s.estadoTrabajo !== 'cancelado') {
      patch.estadoTrabajo = 'pagado_total';
    }
    return { ...s, ...patch };
  });
  localStorage.setItem(LS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('optica_ventas_updated'));
}

export function closeSaleLocal(
  saleId: number,
  deliveryType: 'retiro' | 'delivery' | 'encomienda',
): void {
  const sales = getSales();
  const updated = sales.map(s =>
    s.id === saleId
      ? { ...s, saldo: 0, sena: s.total, estadoTrabajo: 'entregado',
          delivery_type: deliveryType, delivered_at: new Date().toISOString() }
      : s
  );
  localStorage.setItem(LS_KEY, JSON.stringify(updated));
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
    totalVentas: all.length,
    totalFacturado: all.reduce((a, v) => a + (Number(v.total) || 0), 0),
    totalCobrado: all.reduce((a, v) => a + ((Number(v.total) || 0) - (Number(v.saldo) || 0)), 0),
  };
}

// ── Payments ──────────────────────────────────────────────────────────────────
export function getPayments(): StoredPayment[] {
  try {
    const raw = localStorage.getItem(LS_PAYMENTS_KEY);
    return raw ? (JSON.parse(raw) as StoredPayment[]) : [];
  } catch { return []; }
}

export function recordPayment(payment: StoredPayment): void {
  const updated = [...getPayments(), payment];
  trySetItem(LS_PAYMENTS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('optica_ventas_updated'));
}

export function getPaymentsForDate(date: string): StoredPayment[] {
  return getPayments().filter(p => (p.fecha || '').startsWith(date));
}

// ── Expenses ──────────────────────────────────────────────────────────────────
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

export function getExpenses(): StoredExpense[] {
  try {
    const raw = localStorage.getItem(LS_EXPENSES_KEY);
    return raw ? (JSON.parse(raw) as StoredExpense[]) : [];
  } catch { return []; }
}

export function saveExpense(expense: StoredExpense): void {
  const updated = [...getExpenses(), expense];
  trySetItem(LS_EXPENSES_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('optica_ventas_updated'));
}

export function getExpensesForDate(date: string): StoredExpense[] {
  return getExpenses().filter(e => (e.fecha || '') === date);
}
