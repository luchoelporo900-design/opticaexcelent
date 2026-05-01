export const LS_KEY = 'optica_yolanda_ventas';

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

export type SalesSummary = {
  totalVentas: number;
  totalFacturado: number;
  totalCobrado: number;
};

export function getSales(): StoredSale[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredSale[];
  } catch {
    return [];
  }
}

export function saveSale(sale: StoredSale): void {
  const existing = getSales();
  const updated = [...existing, sale];
  localStorage.setItem(LS_KEY, JSON.stringify(updated));
  // Notify same-tab listeners (cross-tab already fires 'storage' natively)
  window.dispatchEvent(new CustomEvent('optica_ventas_updated'));
}

export function clearSales(): void {
  localStorage.removeItem(LS_KEY);
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
