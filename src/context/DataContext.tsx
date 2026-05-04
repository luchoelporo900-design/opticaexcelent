import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { StoredSale, StoredPayment, StoredExpense } from './salesStorage';

// ── Tipos ─────────────────────────────────────────────────────────────────────
type DataContextType = {
  sales:    StoredSale[];
  payments: StoredPayment[];
  expenses: StoredExpense[];
  loading:  boolean;
  refresh:  () => Promise<void>;
};

const DataContext = createContext<DataContextType>({
  sales: [], payments: [], expenses: [], loading: true,
  refresh: async () => {},
});

// ── Helpers de conversión ─────────────────────────────────────────────────────
function rowToSale(row: any): StoredSale {
  return {
    id:              Number(row.id),
    fecha:           row.fecha,
    cliente: {
      nombre:   row.cliente_nombre   || '',
      apellido: row.cliente_apellido || '',
      telefono: row.cliente_telefono || '',
      ci:       row.cliente_ci       || '',
    },
    sucursalVenta:   row.sucursal_venta   || '',
    sucursalEntrega: row.sucursal_entrega || '',
    sucursalCobro:   row.sucursal_cobro   || '',
    vendedora:       row.vendedora        || '',
    total:           Number(row.total)    || 0,
    sena:            Number(row.sena)     || 0,
    saldo:           Number(row.saldo)    || 0,
    metodoPago:      row.metodo_pago      || '',
    estadoTrabajo:   row.estado_trabajo   || '',
    anteojos:        row.anteojos         || [],
    observaciones:   row.observaciones    || '',
    delivery_type:   row.delivery_type,
    delivered_at:    row.delivered_at,
    receipt_url:     row.receipt_url,
  };
}

function rowToPayment(row: any): StoredPayment {
  return {
    id:          Number(row.id),
    saleId:      Number(row.sale_id),
    fecha:       row.fecha,
    monto:       Number(row.monto),
    metodo:      row.metodo,
    sucursal:    row.sucursal,
    vendedora:   row.vendedora,
    cliente:     row.cliente,
    tipo:        row.tipo,
    receipt_url: row.receipt_url,
  };
}

function rowToExpense(row: any): StoredExpense {
  return {
    id:          Number(row.id),
    fecha:       row.fecha,
    descripcion: row.descripcion,
    categoria:   row.categoria,
    monto:       Number(row.monto),
    metodo:      row.metodo,
    sucursal:    row.sucursal,
    vendedora:   row.vendedora,
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function DataProvider({ children }: { children: ReactNode }) {
  const [sales,    setSales]    = useState<StoredSale[]>([]);
  const [payments, setPayments] = useState<StoredPayment[]>([]);
  const [expenses, setExpenses] = useState<StoredExpense[]>([]);
  const [loading,  setLoading]  = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: ventasData }, { data: pagosData }, { data: gastosData }] = await Promise.all([
        supabase.from('ventas').select('*').order('id', { ascending: false }),
        supabase.from('pagos').select('*').order('id', { ascending: false }),
        supabase.from('gastos').select('*').order('id', { ascending: false }),
      ]);

      const newSales    = (ventasData || []).map(rowToSale);
      const newPayments = (pagosData  || []).map(rowToPayment);
      const newExpenses = (gastosData || []).map(rowToExpense);

      setSales(newSales);
      setPayments(newPayments);
      setExpenses(newExpenses);

      // Cache en localStorage como respaldo offline
      try {
        localStorage.setItem('optica_yolanda_ventas',  JSON.stringify(newSales));
        localStorage.setItem('optica_yolanda_abonos',  JSON.stringify(newPayments));
        localStorage.setItem('optica_yolanda_gastos',  JSON.stringify(newExpenses));
      } catch { /* ignore quota errors */ }

    } catch (err) {
      // Fallback a localStorage si no hay conexión
      try {
        const s = localStorage.getItem('optica_yolanda_ventas');
        const p = localStorage.getItem('optica_yolanda_abonos');
        const e = localStorage.getItem('optica_yolanda_gastos');
        if (s) setSales(JSON.parse(s));
        if (p) setPayments(JSON.parse(p));
        if (e) setExpenses(JSON.parse(e));
      } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  // Cargar al inicio
  useEffect(() => { refresh(); }, [refresh]);

  // Escuchar actualizaciones locales
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('optica_ventas_updated', handler);
    return () => window.removeEventListener('optica_ventas_updated', handler);
  }, [refresh]);

  // Polling cada 30 segundos para sincronizar entre dispositivos
  useEffect(() => {
    const interval = setInterval(() => refresh(), 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <DataContext.Provider value={{ sales, payments, expenses, loading, refresh }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
