import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { StoredSale, StoredPayment, StoredExpense } from '../lib/salesStorage';

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

// ── FIX: columnas explícitas para evitar error 500 con select=* y jsonb ───────
const VENTAS_COLUMNS = [
  'id', 'fecha',
  'cliente_nombre', 'cliente_apellido', 'cliente_telefono', 'cliente_ci',
  'sucursal_venta', 'sucursal_entrega', 'sucursal_cobro',
  'vendedora', 'total', 'sena', 'saldo', 'metodo_pago',
  'estado_trabajo', 'anteojos', 'observaciones',
  'delivery_type', 'delivered_at', 'receipt_url',
].join(',');

// ── Provider ──────────────────────────────────────────────────────────────────
export function DataProvider({ children }: { children: ReactNode }) {
  const [sales,    setSales]    = useState<StoredSale[]>([]);
  const [payments, setPayments] = useState<StoredPayment[]>([]);
  const [expenses, setExpenses] = useState<StoredExpense[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  const refresh = useCallback(async () => {
    if (isFetching) return;
    setIsFetching(true);
    setLoading(true);
    try {
      const [{ data: ventasData }, { data: pagosData }, { data: gastosData }] = await Promise.all([
        // FIX: select explícito en lugar de * para evitar error 500 con anteojos (jsonb)
        supabase.from('ventas').select(VENTAS_COLUMNS).order('id', { ascending: false }),
        supabase.from('pagos').select('*').order('id', { ascending: false }),
        supabase.from('gastos').select('*').order('id', { ascending: false }),
      ]);

      const newSales    = (ventasData || []).map(rowToSale);
      const newPayments = (pagosData  || []).map(rowToPayment);
      const newExpenses = (gastosData || []).map(rowToExpense);

      setSales(newSales);
      setPayments(newPayments);
      setExpenses(newExpenses);

      try {
        localStorage.setItem('optica_yolanda_ventas', JSON.stringify(newSales));
        localStorage.setItem('optica_yolanda_abonos', JSON.stringify(newPayments));
        localStorage.setItem('optica_yolanda_gastos', JSON.stringify(newExpenses));
      } catch { /* ignore quota errors */ }

    } catch {
      try {
        const s = localStorage.getItem('optica_yolanda_ventas');
        const p = localStorage.getItem('optica_yolanda_abonos');
        const e = localStorage.getItem('optica_yolanda_gastos');
        if (s) setSales(JSON.parse(s));
        if (p) setPayments(JSON.parse(p));
        if (e) setExpenses(JSON.parse(e));
      } catch { /* ignore */ }
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cargar al inicio
  useEffect(() => { refresh(); }, [refresh]);

  // FIX: evento local — solo lee localStorage, NO llama a Supabase
  useEffect(() => {
    const handler = () => {
      try {
        const s = localStorage.getItem('optica_yolanda_ventas');
        const p = localStorage.getItem('optica_yolanda_abonos');
        const e = localStorage.getItem('optica_yolanda_gastos');
        if (s) setSales(JSON.parse(s));
        if (p) setPayments(JSON.parse(p));
        if (e) setExpenses(JSON.parse(e));
      } catch { /* ignore */ }
    };
    window.addEventListener('optica_ventas_updated', handler);
    return () => window.removeEventListener('optica_ventas_updated', handler);
  }, []);

  // ── REALTIME ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const ventasChannel = supabase
      .channel('ventas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newSale = rowToSale(payload.new);
            setSales(prev => {
              if (prev.some(s => s.id === newSale.id)) return prev;
              const updated = [newSale, ...prev];
              try { localStorage.setItem('optica_yolanda_ventas', JSON.stringify(updated)); } catch {}
              return updated;
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedSale = rowToSale(payload.new);
            setSales(prev => {
              const updated = prev.map(s => s.id === updatedSale.id ? updatedSale : s);
              try { localStorage.setItem('optica_yolanda_ventas', JSON.stringify(updated)); } catch {}
              return updated;
            });
          } else if (payload.eventType === 'DELETE') {
            setSales(prev => {
              const updated = prev.filter(s => s.id !== Number(payload.old.id));
              try { localStorage.setItem('optica_yolanda_ventas', JSON.stringify(updated)); } catch {}
              return updated;
            });
          }
        }
      )
      .subscribe();

    const pagosChannel = supabase
      .channel('pagos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newPay = rowToPayment(payload.new);
            setPayments(prev => {
              if (prev.some(p => p.id === newPay.id)) return prev;
              const updated = [newPay, ...prev];
              try { localStorage.setItem('optica_yolanda_abonos', JSON.stringify(updated)); } catch {}
              return updated;
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedPay = rowToPayment(payload.new);
            setPayments(prev => {
              const updated = prev.map(p => p.id === updatedPay.id ? updatedPay : p);
              try { localStorage.setItem('optica_yolanda_abonos', JSON.stringify(updated)); } catch {}
              return updated;
            });
          } else if (payload.eventType === 'DELETE') {
            setPayments(prev => {
              const updated = prev.filter(p => p.id !== Number(payload.old.id));
              try { localStorage.setItem('optica_yolanda_abonos', JSON.stringify(updated)); } catch {}
              return updated;
            });
          }
        }
      )
      .subscribe();

    const gastosChannel = supabase
      .channel('gastos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gastos' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newExp = rowToExpense(payload.new);
            setExpenses(prev => {
              if (prev.some(e => e.id === newExp.id)) return prev;
              const updated = [newExp, ...prev];
              try { localStorage.setItem('optica_yolanda_gastos', JSON.stringify(updated)); } catch {}
              return updated;
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedExp = rowToExpense(payload.new);
            setExpenses(prev => {
              const updated = prev.map(e => e.id === updatedExp.id ? updatedExp : e);
              try { localStorage.setItem('optica_yolanda_gastos', JSON.stringify(updated)); } catch {}
              return updated;
            });
          } else if (payload.eventType === 'DELETE') {
            setExpenses(prev => {
              const updated = prev.filter(e => e.id !== Number(payload.old.id));
              try { localStorage.setItem('optica_yolanda_gastos', JSON.stringify(updated)); } catch {}
              return updated;
            });
          }
        }
      )
      .subscribe();

    // POLLING ELIMINADO

    return () => {
      supabase.removeChannel(ventasChannel);
      supabase.removeChannel(pagosChannel);
      supabase.removeChannel(gastosChannel);
    };
  }, []);

  return (
    <DataContext.Provider value={{ sales, payments, expenses, loading, refresh }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
