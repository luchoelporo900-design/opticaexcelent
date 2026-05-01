export const LS_KEY = 'optica_yolanda_ventas';
export const LS_PAYMENTS_KEY = 'optica_yolanda_abonos';

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
};

// Represents any single cash movement (initial seña or subsequent abono)
export type StoredPayment = {
  id: number;
  saleId: number;       // links to StoredSale.id
  fecha: string;
  monto: number;
  metodo: string;
  sucursal: string;
  vendedora: string;
  cliente: string;
  tipo: 'sena' | 'abono'; // seña = initial, abono = subsequent
};

export type SalesSummary = {
  totalVentas: number;
  totalFacturado: number;
  totalCobrado: number;
};

// ── Sales ────────────────────────────────────────────────────────────────────

export function getSales(): StoredSale[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as StoredSale[]) : [];
  } catch {
    return [];
  }
}

export function saveSale(sale: StoredSale): void {
  const updated = [...getSales(), sale];
  localStorage.setItem(LS_KEY, JSON.stringify(updated));

  // Also record the initial seña as a cash movement
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
    });
  }

  window.dispatchEvent(new CustomEvent('optica_ventas_updated'));
}

export function updateSaleBalance(saleId: number, newBalance: number, newDeposit: number): void {
  const sales = getSales();
  const updated = sales.map(s =>
    s.id === saleId ? { ...s, saldo: newBalance, sena: newDeposit } : s
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

// ── Payments (ingresos diarios) ───────────────────────────────────────────────

export function getPayments(): StoredPayment[] {
  try {
    const raw = localStorage.getItem(LS_PAYMENTS_KEY);
    return raw ? (JSON.parse(raw) as StoredPayment[]) : [];
  } catch {
    return [];
  }
}

export function recordPayment(payment: StoredPayment): void {
  const updated = [...getPayments(), payment];
  localStorage.setItem(LS_PAYMENTS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('optica_ventas_updated'));
}

export function getPaymentsForDate(date: string): StoredPayment[] {
  return getPayments().filter(p => (p.fecha || '').startsWith(date));
}
