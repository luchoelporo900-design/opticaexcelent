import { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw, Search, CheckCircle, Package, MessageCircle,
  ChevronDown, Printer, X, FlaskConical, Save,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const SUCURSALES = ['Pettirossi', 'Azara', 'Lambaré', 'Acceso Sur', 'Capiatá'];

type LabStatus = 'enviado' | 'proceso' | 'listo' | 'entregado';

type LabHistoryEntry = {
  // Entrada clásica de cambio de estado (formato existente)
  status?: LabStatus;
  // Entrada de asignación de laboratorio (nuevo)
  event?: 'lab_assigned' | 'observation';
  lab_name?: string;
  sent_date?: string;
  text?: string;
  // Común a todos los tipos
  timestamp: string;
  by: string;
};

type LabOrder = {
  id: string;
  sale_id: number;
  sale_number: string;
  customer_name: string;
  customer_phone: string;
  customer_ci: string;
  seller_name: string;
  seller_phone?: string;
  branch_name: string;
  status: LabStatus;
  notes: string;
  created_at: string;
  updated_at: string;
  anteojos: any[];
  history: LabHistoryEntry[];
  // Trazabilidad — Phase 1
  assigned_lab_name?: string | null;
  sent_date?: string | null;
  internal_observation?: string | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
};

type LabFormState = { lab_name: string; sent_date: string; observation: string };

const STATUS_FLOW: LabStatus[] = ['enviado', 'proceso', 'listo', 'entregado'];

const statusConfig: Record<LabStatus, { label: string; color: string; bg: string }> = {
  enviado:   { label: 'Enviado al Lab',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  proceso:   { label: 'En Proceso',      color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
  listo:     { label: 'Listo / Retirar', color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  entregado: { label: 'Entregado',       color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

function todayStr() { return new Date().toISOString().slice(0, 10); }

function getFormDefaults(order: LabOrder): LabFormState {
  return {
    lab_name:    order.assigned_lab_name    ?? '',
    sent_date:   order.sent_date            ? order.sent_date.slice(0, 10) : todayStr(),
    observation: order.internal_observation ?? '',
  };
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function hasRxData(rx: any): boolean {
  if (!rx) return false;
  return !!(rx.od_esfera || rx.od_cilindro || rx.od_eje || rx.od_altura ||
            rx.oi_esfera || rx.oi_cilindro || rx.oi_eje || rx.oi_altura ||
            rx.add || rx.dp);
}

function buildWhatsAppUrlForSeller(sellerPhone: string, sellerName: string, customerName: string, saleNumber: string) {
  if (!sellerPhone) return null;
  const clean = sellerPhone.replace(/\D/g, '');
  const full  = clean.startsWith('595') ? clean : `595${clean.replace(/^0/, '')}`;
  const msg   = encodeURIComponent(
    `Hola ${sellerName.split(' ')[0]}! 🔬\n\n` +
    `El trabajo de *${customerName}* (${saleNumber}) ya está *listo para retirar*.\n\n` +
    `Podés coordinar la entrega con el cliente. ✅`
  );
  return `https://wa.me/${full}?text=${msg}`;
}

function printOrders(orders: LabOrder[]) {
  const now = new Date().toLocaleString('es-PY');
  const rows = orders.map((o) => {
    const statusLabel = statusConfig[o.status]?.label ?? o.status;
    const fecha = new Date(o.created_at).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const lentes = o.anteojos.map((eg: any, i: number) => {
      const receta = (hasRxData(eg.prescription)) ? `
        <div style="margin-top:6px;padding:6px 8px;border:1px solid #ccc;border-radius:4px;font-size:11px;">
          <strong>Receta óptica</strong><br/>
          <table style="width:100%;margin-top:4px;border-collapse:collapse;">
            <tr>
              <td style="padding:2px 6px;font-weight:600;color:#555;">OD</td>
              <td style="padding:2px 4px;">Esf: <strong>${eg.prescription.od_esfera || '—'}</strong></td>
              <td style="padding:2px 4px;">Cil: <strong>${eg.prescription.od_cilindro || '—'}</strong></td>
              <td style="padding:2px 4px;">Eje: <strong>${eg.prescription.od_eje || '—'}</strong></td>
              <td style="padding:2px 4px;">Alt: <strong>${eg.prescription.od_altura || '—'}</strong></td>
            </tr>
            <tr>
              <td style="padding:2px 6px;font-weight:600;color:#555;">OI</td>
              <td style="padding:2px 4px;">Esf: <strong>${eg.prescription.oi_esfera || '—'}</strong></td>
              <td style="padding:2px 4px;">Cil: <strong>${eg.prescription.oi_cilindro || '—'}</strong></td>
              <td style="padding:2px 4px;">Eje: <strong>${eg.prescription.oi_eje || '—'}</strong></td>
              <td style="padding:2px 4px;">Alt: <strong>${eg.prescription.oi_altura || '—'}</strong></td>
            </tr>
          </table>
          <div style="margin-top:6px;display:flex;gap:16px;">
            ${eg.prescription.add ? `<span>ADD: <strong>${eg.prescription.add}</strong></span>` : ''}
            ${eg.prescription.dp  ? `<span>DP: <strong>${eg.prescription.dp}</strong></span>`  : ''}
            ${eg.prescription.obs ? `<span>Obs: <strong>${eg.prescription.obs}</strong></span>` : ''}
          </div>
        </div>` : '';
      return `
        <div style="margin-top:8px;padding:8px;border:1px solid #e0d8c8;border-radius:4px;background:#fffdf7;">
          <strong style="font-size:12px;">Armazón ${i + 1}</strong>
          ${eg.frame_description ? `<div style="font-size:12px;margin-top:2px;">${eg.frame_description}</div>` : ''}
          ${eg.crystals   ? `<div style="font-size:11px;color:#3b82f6;margin-top:2px;">Cristales: ${eg.crystals}</div>` : ''}
          ${eg.treatments ? `<div style="font-size:11px;color:#10b981;margin-top:2px;">Tratamientos: ${eg.treatments}</div>` : ''}
          ${receta}
        </div>`;
    }).join('');
    const labInfo = o.assigned_lab_name
      ? `<div style="margin-top:6px;font-size:11px;color:#1d4ed8;padding:4px 8px;background:#eff6ff;border-radius:4px;display:inline-block;">🔬 Lab: ${o.assigned_lab_name}${o.sent_date ? ` · Enviado: ${new Date(o.sent_date).toLocaleDateString('es-PY')}` : ''}</div>`
      : '';
    return `
      <div style="page-break-inside:avoid;margin-bottom:16px;padding:12px 14px;border:1px solid #c8b87a;border-radius:8px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
          <div>
            <span style="font-family:monospace;font-size:13px;color:#8a6a00;font-weight:600;">${o.sale_number}</span>
            <span style="margin-left:8px;font-size:11px;padding:2px 8px;border-radius:20px;background:#f3ead8;color:#8a6a00;">${statusLabel}</span>
            <span style="margin-left:6px;font-size:11px;color:#666;">${o.branch_name}</span>
          </div>
          <div style="font-size:11px;color:#888;">${fecha}</div>
        </div>
        <div style="margin-top:6px;">
          <strong style="font-size:14px;">${o.customer_name}</strong>
          ${o.customer_ci    ? `<span style="margin-left:10px;font-size:11px;color:#8a6a00;">CI: ${o.customer_ci}</span>` : ''}
          ${o.customer_phone ? `<span style="margin-left:10px;font-size:11px;color:#666;">📞 ${o.customer_phone}</span>` : ''}
        </div>
        <div style="font-size:11px;color:#888;margin-top:2px;">Vendedora: ${o.seller_name}</div>
        ${labInfo}
        ${lentes}
        ${o.notes ? `<div style="margin-top:8px;font-size:11px;color:#666;padding:6px 8px;background:#f9f9f9;border-radius:4px;">📝 ${o.notes}</div>` : ''}
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Laboratorio — Óptica Excelent</title>
  <style>*{box-sizing:border-box;}body{font-family:Arial,sans-serif;color:#111;margin:0;padding:20px;background:#fff;}@media print{body{padding:10px;}.no-print{display:none!important;}}</style>
  </head><body>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #c8b87a;">
    <div><h1 style="margin:0;font-size:20px;color:#8a6a00;">🔬 Óptica Excelent</h1>
    <p style="margin:4px 0 0;font-size:13px;color:#555;">Panel de Laboratorio · ${orders.length} pedido${orders.length !== 1 ? 's' : ''}</p></div>
    <div style="text-align:right;font-size:11px;color:#888;">Impreso el ${now}</div>
  </div>${rows}
  <div class="no-print" style="margin-top:20px;text-align:center;">
    <button onclick="window.print()" style="padding:10px 24px;background:#8a6a00;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">🖨️ Imprimir ahora</button>
  </div></body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

// ── Componente de receta ──────────────────────────────────────────────────────
function RxDisplay({ prescription }: { prescription: any }) {
  return (
    <div className="rounded-lg p-3 space-y-3" style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.14)' }}>
      <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.65)' }}>Receta óptica</p>
      {[['OD — Ojo Derecho', 'od'], ['OI — Ojo Izquierdo', 'oi']].map(([label, key]) => (
        <div key={key}>
          <p className="text-xs font-light mb-2" style={{ color: '#C5A059' }}>{label}</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Esfera',   `${key}_esfera`],
              ['Cilindro', `${key}_cilindro`],
              ['Eje',      `${key}_eje`],
              ['Altura',   `${key}_altura`],
            ].map(([fl, fk]) => (
              <div key={fk} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, minWidth: 44 }}>{fl}</span>
                <span className="text-xs font-mono font-medium" style={{ color: prescription[fk] ? '#fff' : 'rgba(255,255,255,0.2)' }}>
                  {prescription[fk] || '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {(prescription.add || prescription.dp || prescription.obs) && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[['ADD', 'add'], ['DP', 'dp'], ['Obs', 'obs']].map(([fl, fk]) => (
            prescription[fk] ? (
              <div key={fk} className="flex flex-col items-center px-2 py-1.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9 }}>{fl}</span>
                <span className="text-xs font-mono font-medium text-white mt-0.5">{prescription[fk]}</span>
              </div>
            ) : null
          ))}
        </div>
      )}
    </div>
  );
}

export default function LabPage() {
  const { profile } = useAuth();
  const isLab       = profile?.role === 'laboratorio';
  const isAdmin     = profile?.role === 'admin' || profile?.role === 'gerente';
  const isVendedora = profile?.role === 'vendedora';
  const canAssignLab = isLab || isAdmin;

  const [orders,       setOrders]       = useState<LabOrder[]>([]);
  const [branchFilter, setBranchFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [sellerFilter, setSellerFilter] = useState('todos');
  const [dateFilter,   setDateFilter]   = useState<'hoy' | 'semana' | 'mes' | 'todos'>('todos');
  const [search,       setSearch]       = useState('');
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [notes,        setNotes]        = useState<Record<string, string>>({});
  const [lightbox,     setLightbox]     = useState<string | null>(null);
  const [loading,      setLoading]      = useState(false);

  // Estado del formulario de asignación de laboratorio (por orden)
  const [labForms,  setLabForms]  = useState<Record<string, LabFormState>>({});
  const [labSaving, setLabSaving] = useState<Record<string, boolean>>({});
  const [labSaved,  setLabSaved]  = useState<Record<string, boolean>>({});
  const [labError,  setLabError]  = useState<Record<string, string | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('lab_orders')
        .select('*')
        .order('created_at', { ascending: false });
      setOrders((data || []).map((row: any) => ({
        ...row,
        anteojos: row.anteojos || [],
        history:  row.history  || [],
      })));
    } catch (err) {
      console.error('Error cargando lab orders:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const interval = setInterval(() => load(), 30000);
    return () => clearInterval(interval);
  }, [load]);

  // ── Cambio de estado (lógica existente sin cambios) ───────────────────────
  async function updateStatus(id: string, status: LabStatus) {
    const now    = new Date().toISOString();
    const byName = profile?.full_name ?? 'Laboratorio';
    const order  = orders.find(o => o.id === id);
    if (!order) return;
    const newHistory = [...(order.history || []), { status, timestamp: now, by: byName }];
    const newNotes   = notes[id] ?? order.notes;
    await supabase.from('lab_orders').update({
      status, updated_at: now, notes: newNotes, history: newHistory,
    }).eq('id', id);
    setOrders(prev => prev.map(o =>
      o.id === id ? { ...o, status, updated_at: now, notes: newNotes, history: newHistory } : o
    ));
    window.dispatchEvent(new Event('optica_ventas_updated'));
  }

  // ── Guardar asignación de laboratorio ────────────────────────────────────
  async function saveLab(id: string) {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const form = labForms[id] ?? getFormDefaults(order);
    if (!form.lab_name.trim()) return;

    setLabSaving(prev => ({ ...prev, [id]: true }));
    setLabError(prev => ({ ...prev, [id]: null }));

    const now    = new Date().toISOString();
    const byName = profile?.full_name ?? 'Admin';

    const sentDateISO = form.sent_date
      ? new Date(form.sent_date + 'T12:00:00').toISOString()
      : null;

    const newHistoryEntry: LabHistoryEntry = {
      event:     'lab_assigned',
      lab_name:  form.lab_name.trim(),
      sent_date: form.sent_date || undefined,
      timestamp: now,
      by:        byName,
    };
    const newHistory = [...(order.history || []), newHistoryEntry];

    const payload = {
      assigned_lab_name:    form.lab_name.trim(),
      sent_date:            sentDateISO,
      internal_observation: form.observation.trim() || null,
      assigned_by:          byName,
      assigned_at:          now,
      history:              newHistory,
      updated_at:           now,
    };

    console.log('[saveLab] id:', id);
    console.log('[saveLab] payload:', payload);

    const { data, error } = await supabase
      .from('lab_orders')
      .update(payload)
      .eq('id', id)
      .select();

    console.log('[saveLab] data:', data);
    console.log('[saveLab] error:', error);

    if (error) {
      console.error('[saveLab] Error de Supabase:', error.message, error.details, error.hint);
      setLabError(prev => ({ ...prev, [id]: error.message }));
      setLabSaving(prev => ({ ...prev, [id]: false }));
      return;
    }

    // Refetch real desde Supabase para confirmar persistencia
    await load();

    setLabSaving(prev => ({ ...prev, [id]: false }));
    setLabSaved(prev => ({ ...prev, [id]: true }));
    setTimeout(() => setLabSaved(prev => ({ ...prev, [id]: false })), 2500);
  }

  // Actualizar campo del formulario de laboratorio
  function updateLabForm(id: string, order: LabOrder, patch: Partial<LabFormState>) {
    setLabForms(prev => ({
      ...prev,
      [id]: { ...getFormDefaults(order), ...(prev[id] ?? {}), ...patch },
    }));
  }

  // ── Filtros (sin cambios) ─────────────────────────────────────────────────
  function inPeriod(fechaStr: string) {
    const fecha = new Date(fechaStr);
    const now   = new Date();
    if (dateFilter === 'hoy') return fecha.toDateString() === now.toDateString();
    if (dateFilter === 'semana') {
      const lunes = new Date(now);
      lunes.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
      lunes.setHours(0, 0, 0, 0);
      return fecha >= lunes;
    }
    if (dateFilter === 'mes') return fecha.getMonth() === now.getMonth() && fecha.getFullYear() === now.getFullYear();
    return true;
  }

  const allSellers = [...new Set(orders.map(o => o.seller_name).filter(Boolean))].sort();
  const roleFiltered = orders.filter(o => {
    if (isVendedora) return o.seller_name === profile?.full_name;
    return true;
  });
  const visibleStatuses = isVendedora ? ['enviado', 'proceso', 'listo'] : STATUS_FLOW;

  const filtered = roleFiltered.filter(o => {
    if (!visibleStatuses.includes(o.status)) return false;
    if (statusFilter !== 'todos' && o.status !== statusFilter) return false;
    if (branchFilter !== 'todos' && o.branch_name !== branchFilter) return false;
    if (sellerFilter !== 'todos' && o.seller_name !== sellerFilter) return false;
    if (!inPeriod(o.created_at)) return false;
    if (search) {
      const q    = normalize(search);
      const qNum = search.replace(/\D/g, '');
      const name = normalize(o.customer_name);
      const ci   = normalize(o.customer_ci || '');
      const sel  = normalize(o.seller_name || '');
      const ph   = (o.customer_phone || '').replace(/\D/g, '');
      const vta  = o.sale_number.toLowerCase();
      const lab  = normalize(o.assigned_lab_name || '');
      return name.includes(q) || ci.includes(q) || sel.includes(q) ||
             vta.includes(search.toLowerCase()) || lab.includes(q) ||
             (qNum.length >= 3 && ph.includes(qNum));
    }
    return true;
  });

  const countForPeriod = (period: 'hoy' | 'semana' | 'mes' | 'todos') => {
    return roleFiltered.filter(o => {
      if (!visibleStatuses.includes(o.status)) return false;
      const fecha = new Date(o.created_at); const now = new Date();
      if (period === 'hoy')    return fecha.toDateString() === now.toDateString();
      if (period === 'semana') { const l = new Date(now); l.setDate(now.getDate()-(now.getDay()===0?6:now.getDay()-1)); l.setHours(0,0,0,0); return fecha >= l; }
      if (period === 'mes')    return fecha.getMonth()===now.getMonth()&&fecha.getFullYear()===now.getFullYear();
      return true;
    }).length;
  };

  const countByStatus = (s: string) => roleFiltered.filter(o => o.status === s && inPeriod(o.created_at)).length;
  const hasFilters = search || branchFilter !== 'todos' || sellerFilter !== 'todos' || statusFilter !== 'todos' || dateFilter !== 'todos';

  function clearFilters() {
    setSearch(''); setBranchFilter('todos'); setSellerFilter('todos'); setStatusFilter('todos'); setDateFilter('todos');
  }

  // ── Render del historial (maneja formato clásico + nuevo) ─────────────────
  function renderHistoryEntry(h: LabHistoryEntry, i: number) {
    // Evento de asignación de laboratorio
    if (h.event === 'lab_assigned') {
      return (
        <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-lg"
          style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.18)' }}>
          <FlaskConical size={12} style={{ color: '#3b82f6', marginTop: 1, flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-light" style={{ color: '#3b82f6' }}>
              Laboratorio asignado: <strong>{h.lab_name}</strong>
            </span>
            {h.sent_date && (
              <span className="text-xs font-light ml-2" style={{ color: 'rgba(59,130,246,0.65)' }}>
                · Envío: {new Date(h.sent_date + 'T12:00:00').toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: '2-digit' })}
              </span>
            )}
          </div>
          <span className="text-xs font-light shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>{h.by}</span>
          <span className="text-xs font-light shrink-0" style={{ color: 'rgba(255,255,255,0.22)' }}>
            {new Date(h.timestamp).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })}
            {' '}{new Date(h.timestamp).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      );
    }

    // Entrada clásica de cambio de estado
    if (h.status && statusConfig[h.status]) {
      const hcfg = statusConfig[h.status];
      return (
        <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: hcfg.color }} />
          <span className="text-xs font-light flex-1" style={{ color: hcfg.color }}>{hcfg.label}</span>
          <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>{h.by}</span>
          <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {new Date(h.timestamp).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })}
            {' '}{new Date(h.timestamp).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      );
    }

    return null;
  }

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 lg:p-6 space-y-5" onClick={() => lightbox && setLightbox(null)}>

      {lightbox && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.93)' }} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="foto" className="max-w-full w-full rounded-2xl object-contain"
            style={{ maxHeight: '80vh', border: '1px solid rgba(197,160,89,0.3)' }}
            onClick={e => e.stopPropagation()} />
          <p className="absolute bottom-8 text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>Clic fuera para cerrar</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl text-white font-light tracking-wider">Panel de Laboratorio</h1>
          <p className="text-sm font-light mt-1" style={{ color: 'rgba(197,160,89,0.7)' }}>
            {isVendedora ? `Mis pedidos · ${profile?.full_name}` : 'Seguimiento de pedidos · Todas las sucursales'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => printOrders(filtered)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light border"
            style={{ borderColor: 'rgba(197,160,89,0.3)', color: '#C5A059', background: 'rgba(197,160,89,0.08)' }}>
            <Printer size={14} /> Imprimir ({filtered.length})
          </button>
          <button onClick={load}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light border"
            style={{ borderColor: 'rgba(197,160,89,0.3)', color: '#C5A059', background: 'rgba(197,160,89,0.08)' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>
      </div>

      {/* Contadores por estado */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(isVendedora ? ['enviado', 'proceso', 'listo'] : STATUS_FLOW).map(s => {
          const cfg   = statusConfig[s as LabStatus];
          const count = countByStatus(s);
          return (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? 'todos' : s)}
              className="p-4 rounded-xl border text-left transition-all"
              style={{ background: statusFilter === s ? cfg.bg : 'rgba(255,255,255,0.02)', borderColor: statusFilter === s ? cfg.color + '60' : 'rgba(197,160,89,0.1)' }}>
              <p className="text-2xl font-light text-white">{count}</p>
              <p className="text-xs font-light mt-0.5" style={{ color: cfg.color }}>{cfg.label}</p>
            </button>
          );
        })}
      </div>

      {/* Filtros de período */}
      <div className="flex gap-2 flex-wrap">
        {([
          { id: 'hoy'    as const, label: `Hoy (${countForPeriod('hoy')})` },
          { id: 'semana' as const, label: `Semana (${countForPeriod('semana')})` },
          { id: 'mes'    as const, label: `Mes (${countForPeriod('mes')})` },
          { id: 'todos'  as const, label: `Todos (${countForPeriod('todos')})` },
        ]).map(opt => (
          <button key={opt.id} onClick={() => setDateFilter(opt.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-light"
            style={{
              background: dateFilter === opt.id ? 'rgba(197,160,89,0.15)' : 'rgba(255,255,255,0.03)',
              border:     `1px solid ${dateFilter === opt.id ? 'rgba(197,160,89,0.4)' : 'rgba(255,255,255,0.08)'}`,
              color:      dateFilter === opt.id ? '#C5A059' : 'rgba(255,255,255,0.4)',
            }}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Filtros de búsqueda */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(197,160,89,0.5)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre, C.I., venta o laboratorio..."
            className="pl-9 pr-4 py-2 rounded-lg text-xs bg-transparent text-white outline-none border w-56"
            style={{ borderColor: 'rgba(197,160,89,0.25)', background: 'rgba(255,255,255,0.03)' }} />
        </div>
        {(isLab || isAdmin) && (
          <select value={sellerFilter} onChange={e => setSellerFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-xs font-light bg-transparent outline-none border"
            style={{ borderColor: 'rgba(197,160,89,0.25)', background: '#111', color: sellerFilter !== 'todos' ? '#C5A059' : 'rgba(255,255,255,0.6)' }}>
            <option value="todos" style={{ background: '#111' }}>Todas las vendedoras</option>
            {allSellers.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
          </select>
        )}
        {(isLab || isAdmin) && (
          <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-xs font-light bg-transparent text-white outline-none border"
            style={{ borderColor: 'rgba(197,160,89,0.25)', background: '#111', color: branchFilter !== 'todos' ? '#C5A059' : 'rgba(255,255,255,0.6)' }}>
            <option value="todos" style={{ background: '#111' }}>Todas las sucursales</option>
            {SUCURSALES.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
          </select>
        )}
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-light"
            style={{ background: 'rgba(239,68,68,0.08)', color: 'rgba(239,68,68,0.7)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <X size={12} />Limpiar
          </button>
        )}
        {hasFilters && <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>}
      </div>

      {/* Lista de órdenes */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(197,160,89,0.15)' }}>
          <Package size={32} className="mx-auto mb-3 opacity-20" style={{ color: '#C5A059' }} />
          <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {hasFilters ? 'No se encontraron pedidos' : 'No hay pedidos para mostrar'}
          </p>
          {hasFilters && (
            <button onClick={clearFilters} className="mt-3 text-xs font-light px-3 py-1.5 rounded-lg"
              style={{ color: '#C5A059', border: '1px solid rgba(197,160,89,0.3)', background: 'rgba(197,160,89,0.06)' }}>
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const cfg        = statusConfig[order.status];
            const isExp      = expandedId === order.id;
            const waUrl      = order.status === 'listo' ? buildWhatsAppUrlForSeller(order.seller_phone || '', order.seller_name, order.customer_name, order.sale_number) : null;
            const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(order.status) + 1];
            const canAdvance = canAssignLab && nextStatus && order.status !== 'entregado';
            const form       = labForms[order.id] ?? getFormDefaults(order);
            const isSaving   = labSaving[order.id] ?? false;
            const isSaved    = labSaved[order.id]  ?? false;
            const orderError = labError[order.id]  ?? null;

            return (
              <div key={order.id} className="rounded-xl border overflow-hidden"
                style={{
                  background:   'rgba(255,255,255,0.02)',
                  borderColor:  order.status === 'listo' ? 'rgba(16,185,129,0.4)' : 'rgba(197,160,89,0.12)',
                  boxShadow:    order.status === 'listo' ? '0 0 20px rgba(16,185,129,0.06)' : 'none',
                }}>

                {/* ── Cabecera de la tarjeta ──────────────────────────────── */}
                <div className="flex items-start justify-between gap-3 p-4 cursor-pointer" onClick={() => setExpandedId(isExp ? null : order.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-sm font-light" style={{ color: '#C5A059' }}>{order.sale_number}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-light" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-light" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>{order.branch_name}</span>
                      {(isLab || isAdmin) && <span className="px-2 py-0.5 rounded-full text-xs font-light" style={{ background: 'rgba(197,160,89,0.08)', color: 'rgba(197,160,89,0.7)' }}>{order.seller_name}</span>}
                      {/* Badge laboratorio asignado — visible para todos */}
                      {order.assigned_lab_name && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-light"
                          style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.25)' }}>
                          <FlaskConical size={9} />{order.assigned_lab_name}
                        </span>
                      )}
                    </div>
                    <p className="text-white font-light">{order.customer_name}</p>
                    {order.customer_ci    && <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(197,160,89,0.6)' }}>CI: {order.customer_ci}</p>}
                    {order.customer_phone && <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>📞 {order.customer_phone}</p>}
                    {order.sent_date && (
                      <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(59,130,246,0.7)' }}>
                        Enviado al lab: {new Date(order.sent_date).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </p>
                    )}
                    <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{new Date(order.created_at).toLocaleDateString('es-PY')}</p>
                    {/* Barra de progreso de estados */}
                    <div className="flex items-center gap-1 mt-2">
                      {STATUS_FLOW.map((s, i) => {
                        const done = STATUS_FLOW.indexOf(order.status) >= i;
                        return (
                          <div key={s} className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ background: done ? statusConfig[s as LabStatus].color : 'rgba(255,255,255,0.15)' }} />
                            {i < STATUS_FLOW.length - 1 && <div className="w-6 h-px" style={{ background: done && i < STATUS_FLOW.indexOf(order.status) ? '#C5A059' : 'rgba(255,255,255,0.1)' }} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => printOrders([order])}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light"
                      style={{ background: 'rgba(197,160,89,0.08)', color: 'rgba(197,160,89,0.7)', border: '1px solid rgba(197,160,89,0.2)' }}>
                      <Printer size={12} />Imprimir
                    </button>
                    {waUrl && (
                      <a href={waUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                        style={{ background: 'rgba(37,211,102,0.15)', color: '#25d366', border: '1px solid rgba(37,211,102,0.35)' }}>
                        <MessageCircle size={13} />Avisar
                      </a>
                    )}
                    {canAdvance && (
                      <button onClick={() => updateStatus(order.id, nextStatus)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{ background: statusConfig[nextStatus].bg, color: statusConfig[nextStatus].color, border: `1px solid ${statusConfig[nextStatus].color}40` }}>
                        {nextStatus === 'proceso'   && '▶ Proceso'}
                        {nextStatus === 'listo'     && '✓ Listo'}
                        {nextStatus === 'entregado' && '📦 Entregado'}
                      </button>
                    )}
                    {canAssignLab && (
                      <input placeholder="Nota..." value={notes[order.id] ?? order.notes}
                        onChange={e => setNotes(prev => ({ ...prev, [order.id]: e.target.value }))}
                        className="px-2 py-1 rounded text-xs bg-transparent text-white outline-none border w-28"
                        style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                    )}
                  </div>
                  <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)', transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0, marginTop: 4 }} />
                </div>

                {/* ── Detalle expandido ────────────────────────────────────── */}
                {isExp && (
                  <div className="border-t px-4 py-4 space-y-4" style={{ borderColor: 'rgba(197,160,89,0.1)', background: 'rgba(197,160,89,0.02)' }}>

                    {/* Anteojos */}
                    {order.anteojos.length === 0 ? (
                      <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>Sin detalle de lentes registrado</p>
                    ) : (
                      order.anteojos.map((eg: any, i: number) => (
                        <div key={i} className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(197,160,89,0.14)' }}>
                          <div className="flex items-start gap-3">
                            {eg.photo_url ? (
                              <img src={eg.photo_url} alt="armazón" className="w-20 h-16 object-cover rounded-lg border cursor-pointer shrink-0"
                                style={{ borderColor: 'rgba(197,160,89,0.3)' }} onClick={e => { e.stopPropagation(); setLightbox(eg.photo_url); }} />
                            ) : (
                              <div className="w-20 h-16 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(197,160,89,0.1)' }}>
                                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Sin foto</span>
                              </div>
                            )}
                            <div className="flex-1 space-y-1.5">
                              <p className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.7)' }}>Anteojo {i + 1}</p>
                              {eg.frame_description && <p className="text-sm text-white font-light">📦 {eg.frame_description}</p>}
                              <div className="flex gap-2 flex-wrap">
                                {eg.crystals   && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>🔬 {eg.crystals}</span>}
                                {eg.treatments && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>✨ {eg.treatments}</span>}
                              </div>
                              {eg.receta_url && (
                                <div className="mt-1">
                                  <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>📋 Foto receta</p>
                                  <img src={eg.receta_url} alt="receta"
                                    className="h-20 w-28 object-cover rounded-lg border cursor-pointer"
                                    style={{ borderColor: 'rgba(59,130,246,0.35)' }}
                                    onClick={e => { e.stopPropagation(); setLightbox(eg.receta_url); }} />
                                </div>
                              )}
                            </div>
                          </div>
                          {hasRxData(eg.prescription) && <RxDisplay prescription={eg.prescription} />}
                        </div>
                      ))
                    )}

                    {/* Nota general */}
                    {order.notes && (
                      <div className="px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>📝 {order.notes}</p>
                      </div>
                    )}

                    {/* ── SECCIÓN LABORATORIO (solo admin/lab) ──────────────── */}
                    {canAssignLab && (
                      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(59,130,246,0.25)', background: 'rgba(59,130,246,0.03)' }}>
                        {/* Header de la sección */}
                        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(59,130,246,0.15)', background: 'rgba(59,130,246,0.06)' }}>
                          <FlaskConical size={13} style={{ color: '#3b82f6' }} />
                          <span className="text-xs font-light tracking-wider text-white">
                            {order.assigned_lab_name ? 'Laboratorio asignado' : 'Asignar laboratorio'}
                          </span>
                          {order.assigned_lab_name && (
                            <span className="ml-auto text-xs font-light px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}>
                              {order.assigned_lab_name}
                            </span>
                          )}
                        </div>

                        <div className="px-4 py-4 space-y-3">
                          {/* Si ya hay lab asignado, mostrar resumen antes del formulario */}
                          {order.assigned_lab_name && (
                            <div className="grid grid-cols-2 gap-3 pb-2">
                              <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)' }}>
                                <p className="text-xs font-light mb-0.5" style={{ color: 'rgba(59,130,246,0.6)' }}>Laboratorio</p>
                                <p className="text-sm font-light text-white">{order.assigned_lab_name}</p>
                              </div>
                              {order.sent_date && (
                                <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)' }}>
                                  <p className="text-xs font-light mb-0.5" style={{ color: 'rgba(59,130,246,0.6)' }}>Enviado</p>
                                  <p className="text-sm font-light text-white">
                                    {new Date(order.sent_date).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                  </p>
                                </div>
                              )}
                              {order.internal_observation && (
                                <div className="col-span-2 rounded-lg px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                  <p className="text-xs font-light mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Observación interna</p>
                                  <p className="text-xs font-light text-white">{order.internal_observation}</p>
                                </div>
                              )}
                              {order.assigned_by && (
                                <div className="col-span-2">
                                  <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.25)' }}>
                                    Asignado por {order.assigned_by}
                                    {order.assigned_at && ` · ${new Date(order.assigned_at).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: '2-digit' })}`}
                                  </p>
                                </div>
                              )}
                              <div className="col-span-2">
                                <div className="h-px" style={{ background: 'rgba(59,130,246,0.15)' }} />
                                <p className="text-xs font-light mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                  Modificar asignación:
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Formulario de asignación */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2 sm:col-span-1">
                              <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>
                                Laboratorio *
                              </label>
                              <input
                                value={form.lab_name}
                                onChange={e => updateLabForm(order.id, order, { lab_name: e.target.value })}
                                placeholder="Ej: Lab Visión, Cristal..."
                                className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                                style={{ borderColor: form.lab_name ? 'rgba(59,130,246,0.45)' : 'rgba(255,255,255,0.15)' }}
                              />
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>
                                Fecha de envío
                              </label>
                              <input
                                type="date"
                                value={form.sent_date}
                                onChange={e => updateLabForm(order.id, order, { sent_date: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                                style={{ borderColor: 'rgba(255,255,255,0.15)', colorScheme: 'dark' }}
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>
                                Observación interna <span style={{ color: 'rgba(255,255,255,0.22)' }}>(solo visible para admin/lab)</span>
                              </label>
                              <textarea
                                value={form.observation}
                                onChange={e => updateLabForm(order.id, order, { observation: e.target.value })}
                                placeholder="Indicaciones especiales, estado del pedido, notas..."
                                rows={2}
                                className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border resize-none font-light"
                                style={{ borderColor: 'rgba(255,255,255,0.12)' }}
                              />
                            </div>
                          </div>

                          {/* Botón guardar */}
                          <div className="space-y-2">
                            <button
                              onClick={() => saveLab(order.id)}
                              disabled={isSaving || !form.lab_name.trim()}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium"
                              style={{
                                background:  isSaved    ? 'rgba(16,185,129,0.15)' : !form.lab_name.trim() ? 'rgba(59,130,246,0.05)' : 'rgba(59,130,246,0.15)',
                                border:      `1px solid ${isSaved ? 'rgba(16,185,129,0.4)' : !form.lab_name.trim() ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.4)'}`,
                                color:       isSaved    ? '#10b981' : !form.lab_name.trim() ? 'rgba(59,130,246,0.35)' : '#3b82f6',
                                cursor:      !form.lab_name.trim() ? 'not-allowed' : 'pointer',
                              }}>
                              {isSaved
                                ? <><CheckCircle size={12} />Guardado</>
                                : isSaving
                                  ? 'Guardando...'
                                  : <><Save size={12} />{order.assigned_lab_name ? 'Actualizar asignación' : 'Guardar asignación'}</>
                              }
                            </button>
                            {orderError && (
                              <p className="text-xs font-light px-1" style={{ color: '#f87171' }}>
                                Error: {orderError}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Historial ────────────────────────────────────────── */}
                    {order.history && order.history.length > 0 && (
                      <div>
                        <p className="text-xs font-light tracking-widest uppercase mb-2" style={{ color: 'rgba(197,160,89,0.55)' }}>Historial</p>
                        <div className="space-y-1.5">
                          {order.history.map((h, i) => renderHistoryEntry(h, i))}
                        </div>
                      </div>
                    )}

                    {/* Marcar como listo */}
                    {canAssignLab && order.status === 'proceso' && (
                      <button onClick={e => { e.stopPropagation(); updateStatus(order.id, 'listo'); }}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
                        style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)' }}>
                        <CheckCircle size={16} />✓ Marcar como Listo para Retirar
                      </button>
                    )}

                    {/* Banner listo + WhatsApp */}
                    {order.status === 'listo' && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
                          <CheckCircle size={14} style={{ color: '#10b981' }} />
                          <p className="text-xs font-light" style={{ color: '#10b981' }}>Trabajo listo — esperando entrega al cliente</p>
                        </div>
                        {waUrl ? (
                          <a href={waUrl} target="_blank" rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-light"
                            style={{ background: 'rgba(37,211,102,0.10)', color: '#25d366', border: '1px solid rgba(37,211,102,0.3)' }}>
                            <MessageCircle size={14} />Avisar a {order.seller_name}
                          </a>
                        ) : (
                          <p className="text-xs font-light text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>La vendedora no tiene teléfono registrado</p>
                        )}
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
  );
}
