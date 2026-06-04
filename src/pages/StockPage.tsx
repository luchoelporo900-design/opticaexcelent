import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Package, Plus, Search, RefreshCw, Edit2, Trash2, X, Check,
  ChevronDown, AlertTriangle, Glasses, DollarSign,
  BarChart2, Camera, Clock, Trophy, Calendar, ZoomIn, Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { compressImage } from '../lib/salesStorage';

type Frame = {
  id: string; codigo: string; nombre: string; foto_url: string; color: string;
  precio: number; stock_pettirossi: number; stock_azara: number;
  stock_lambere: number; stock_accesosur: number; stock_capiata: number;
  stock_deposito: number;
  created_at: string; updated_at: string;
};

type FormData = {
  codigo: string; nombre: string; foto_url: string; color: string; precio: number;
  stock_pettirossi: number; stock_azara: number; stock_lambere: number;
  stock_accesosur: number; stock_capiata: number; stock_deposito: number;
};

type Movimiento = {
  id: string; armazon_id: string; armazon_nombre: string; armazon_codigo: string;
  cantidad: number; tipo: string; sucursal: string; vendedora: string;
  venta_id: string; created_at: string;
};

type MasVendido = { armazon_nombre: string; armazon_codigo: string; total: number; };

type Insumo = {
  id: string; nombre: string; unidad: string; foto_url: string;
  stock_pettirossi: number; stock_azara: number; stock_lambere: number;
  stock_accesosur: number; stock_capiata: number; stock_deposito: number;
  precio_costo: number; updated_at: string;
};

type InsumoForm = {
  nombre: string; unidad: string; foto_url: string; precio_costo: number;
  stock_pettirossi: number; stock_azara: number; stock_lambere: number;
  stock_accesosur: number; stock_capiata: number; stock_deposito: number;
};

const SEDES = [
  { key: 'stock_pettirossi', label: 'Pettirossi', color: '#22c55e' },
  { key: 'stock_azara',      label: 'Azara',      color: '#3b82f6' },
  { key: 'stock_lambere',    label: 'Lambaré',    color: '#C5A059' },
  { key: 'stock_accesosur',  label: 'Acceso Sur', color: '#a78bfa' },
  { key: 'stock_capiata',    label: 'Capiatá',    color: '#f97316' },
  { key: 'stock_deposito',   label: 'Depósito',   color: '#f97316' },
];

function fmt(n: number) {
  return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function emptyForm(): FormData {
  return { codigo: '', nombre: '', foto_url: '', color: '', precio: 0,
    stock_pettirossi: 0, stock_azara: 0, stock_lambere: 0, stock_accesosur: 0,
    stock_capiata: 0, stock_deposito: 0 };
}

function emptyInsumoForm(): InsumoForm {
  return { nombre: '', unidad: '', foto_url: '', precio_costo: 0,
    stock_pettirossi: 0, stock_azara: 0, stock_lambere: 0, stock_accesosur: 0,
    stock_capiata: 0, stock_deposito: 0 };
}

function totalStock(f: Frame | FormData) {
  return (f.stock_pettirossi||0)+(f.stock_azara||0)+(f.stock_lambere||0)+
    (f.stock_accesosur||0)+(f.stock_capiata||0)+(f.stock_deposito||0);
}

function totalInsumoStock(ins: Insumo | InsumoForm) {
  return (ins.stock_pettirossi||0)+(ins.stock_azara||0)+(ins.stock_lambere||0)+
    (ins.stock_accesosur||0)+(ins.stock_capiata||0)+(ins.stock_deposito||0);
}

export default function StockPage() {
  const { profile } = useAuth();
  const isAdmin          = profile?.role === 'admin' || profile?.role === 'gerente';
  const isVendedora      = profile?.role === 'vendedora';
  const puedeCargarStock = isAdmin || (profile as any)?.puede_cargar_stock === true;
  const defaultBranch    = (profile as any)?.branch_id || '';

  const vendedoraSede = (() => {
    const b = defaultBranch.toLowerCase()
      .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u').replace(/ /g,'_');
    if (b.includes('pettirossi'))          return 'stock_pettirossi';
    if (b.includes('azara'))               return 'stock_azara';
    if (b.includes('lambere') || b.includes('lambare')) return 'stock_lambere';
    if (b.includes('acceso') || b.includes('sur'))      return 'stock_accesosur';
    if (b.includes('capiata'))             return 'stock_capiata';
    return 'stock_pettirossi';
  })();

  const searchTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  const [frames, setFrames]           = useState<Frame[]>([]);
  const [loading, setLoading]         = useState(false);
  const [search, setSearch]           = useState('');
  const [sortBy, setSortBy]           = useState<'nombre'|'precio'|'stock'>('nombre');
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [masVendidos, setMasVendidos] = useState<MasVendido[]>([]);
  const [loadingMov, setLoadingMov]   = useState(false);

  // Filtro por fecha en vendidos
  const hoy    = new Date().toISOString().slice(0,10);
  const mesIni = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);
  const [fechaDesde, setFechaDesde] = useState(mesIni);
  const [fechaHasta, setFechaHasta] = useState(hoy);
  const [vendidosFiltrados, setVendidosFiltrados] = useState<Movimiento[]>([]);
  const [loadingVendidos, setLoadingVendidos]     = useState(false);

  // Insumos
  const [insumos, setInsumos]               = useState<Insumo[]>([]);
  const [loadingInsumos, setLoadingInsumos] = useState(false);
  const [showInsumoModal, setShowInsumoModal] = useState(false);
  const [editingInsumo, setEditingInsumo]   = useState<Insumo|null>(null);
  const [insumoForm, setInsumoForm]         = useState<InsumoForm>(emptyInsumoForm());
  const [savingInsumo, setSavingInsumo]     = useState(false);
  const [saveInsumoOk, setSaveInsumoOk]     = useState(false);
  const [expandedInsumoId, setExpandedInsumoId] = useState<string|null>(null);
  const [deleteInsumoId, setDeleteInsumoId] = useState<string|null>(null);
  const insumoPhotoRef = useRef<HTMLInputElement|null>(null);

  // Lightbox foto
  const [lightboxUrl, setLightboxUrl] = useState<string|null>(null);

  // Vista activa
  const [vistaActiva, setVistaActiva] = useState<'stock'|'vendidos'|'insumos'>('stock');

  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState<Frame|null>(null);
  const [form, setForm]               = useState<FormData>(emptyForm());
  const [saving, setSaving]           = useState(false);
  const [saveOk, setSaveOk]           = useState(false);
  const photoRef = useRef<HTMLInputElement|null>(null);

  const [showQuickModal, setShowQuickModal] = useState(false);
  const [quickFrame, setQuickFrame]         = useState<Frame|null>(null);
  const [quickCodigo, setQuickCodigo]       = useState('');
  const [quickFoto, setQuickFoto]           = useState('');
  const [quickSaving, setQuickSaving]       = useState(false);
  const [quickOk, setQuickOk]               = useState(false);
  const quickPhotoRef = useRef<HTMLInputElement|null>(null);

  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [deleteId, setDeleteId]     = useState<string|null>(null);

  // ─── Carga ────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('armazones').select('*').order('nombre', { ascending: true });
    if (!error && data) setFrames(data as Frame[]);
    setLoading(false);
  }, []);

  const loadMovimientos = useCallback(async () => {
    setLoadingMov(true);
    const { data } = await supabase.from('stock_movimientos').select('*').order('created_at', { ascending: false }).limit(20);
    if (data) setMovimientos(data as Movimiento[]);

    const mesStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    mesStart.setHours(mesStart.getHours() + 4);
    const mesStartISO = mesStart.toISOString();
    const { data: mvData } = await supabase.from('stock_movimientos').select('armazon_nombre, armazon_codigo, cantidad').eq('tipo','venta').gte('created_at', mesStartISO);
    if (mvData) {
      const map: Record<string, MasVendido> = {};
      for (const m of mvData) {
        if (!map[m.armazon_codigo]) map[m.armazon_codigo] = { armazon_nombre: m.armazon_nombre, armazon_codigo: m.armazon_codigo, total: 0 };
        map[m.armazon_codigo].total += m.cantidad;
      }
      setMasVendidos(Object.values(map).sort((a,b) => b.total - a.total).slice(0,5));
    }
    setLoadingMov(false);
  }, []);

  const loadVendidos = useCallback(async () => {
    setLoadingVendidos(true);
    const { data } = await supabase.from('stock_movimientos')
      .select('*').eq('tipo','venta')
      .gte('created_at', fechaDesde + 'T04:00:00.000Z')
      .lte('created_at', (() => { const d = new Date(fechaHasta + 'T00:00:00'); d.setDate(d.getDate() + 1); d.setHours(3, 59, 59, 999); return d.toISOString(); })())
      .order('created_at', { ascending: false });
    if (data) setVendidosFiltrados(data as Movimiento[]);
    setLoadingVendidos(false);
  }, [fechaDesde, fechaHasta]);

  const loadInsumos = useCallback(async () => {
    setLoadingInsumos(true);
    const { data, error } = await supabase.from('insumos_stock').select('*').order('nombre', { ascending: true });
    if (!error && data) setInsumos(data as Insumo[]);
    setLoadingInsumos(false);
  }, []);

  useEffect(() => { load(); loadMovimientos(); loadInsumos(); }, [load, loadMovimientos, loadInsumos]);
  useEffect(() => { if (vistaActiva === 'vendidos') loadVendidos(); }, [vistaActiva, loadVendidos]);

  useEffect(() => {
    const term = search.trim();
    if (!term) { load(); return; }
    if (term.length < 2) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from('armazones')
        .select('id,codigo,nombre,foto_url,precio,color,stock_pettirossi,stock_azara,stock_lambere,stock_accesosur,stock_capiata,stock_deposito')
        .or(`nombre.ilike.%${term}%,codigo.ilike.%${term}%,color.ilike.%${term}%`)
        .order('nombre')
        .limit(50);
      if (data) setFrames(data as Frame[]);
      setLoading(false);
    }, 350);
  }, [search, load]);

  // ─── Filtros ──────────────────────────────────────────────────────────────

  const visible = [...frames].sort((a,b) => {
    if (sortBy === 'precio') return b.precio - a.precio;
    if (sortBy === 'stock')  return totalStock(b) - totalStock(a);
    return a.nombre.localeCompare(b.nombre);
  });

  const totalModelos  = frames.length;
  const totalUnidades = frames.reduce((s,f) => s + totalStock(f), 0);
  const totalValor    = frames.reduce((s,f) => s + totalStock(f) * f.precio, 0);

  // ─── CRUD armazones ───────────────────────────────────────────────────────

  function openNew()    { setEditing(null); setForm(emptyForm()); setShowModal(true); }
  function openEdit(f: Frame) {
    setEditing(f);
    setForm({
      codigo: f.codigo, nombre: f.nombre, foto_url: f.foto_url||'',
      color: (f as any).color||'', precio: f.precio,
      stock_pettirossi: f.stock_pettirossi, stock_azara: f.stock_azara,
      stock_lambere: f.stock_lambere, stock_accesosur: f.stock_accesosur,
      stock_capiata: f.stock_capiata, stock_deposito: f.stock_deposito||0,
    });
    setShowModal(true);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => { const c = await compressImage(ev.target?.result as string); setForm(p => ({ ...p, foto_url: c })); };
    reader.readAsDataURL(file);
  }

  async function save() {
    if (!form.nombre.trim() || !form.codigo.trim()) return;
    setSaving(true);
    if (editing) { await supabase.from('armazones').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id); }
    else { await supabase.from('armazones').insert([{ ...form, id: crypto.randomUUID() }]); }
    await load(); setSaving(false); setSaveOk(true);
    setTimeout(() => { setSaveOk(false); setShowModal(false); }, 1200);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await supabase.from('armazones').delete().eq('id', deleteId);
    setDeleteId(null); await load();
  }

  async function adjustStock(id: string, sede: string, delta: number) {
    const f = frames.find(x => x.id === id); if (!f) return;
    const newVal = Math.max(0, ((f as any)[sede]||0) + delta);
    await supabase.from('armazones').update({ [sede]: newVal, updated_at: new Date().toISOString() }).eq('id', id);
    setFrames(prev => prev.map(x => x.id === id ? { ...x, [sede]: newVal } : x));
  }

  function openQuick(f: Frame) { setQuickFrame(f); setQuickCodigo(f.codigo); setQuickFoto(f.foto_url||''); setShowQuickModal(true); }

  async function handleQuickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => { const c = await compressImage(ev.target?.result as string); setQuickFoto(c); };
    reader.readAsDataURL(file);
  }

  async function saveQuick() {
    if (!quickFrame) return;
    setQuickSaving(true);
    await supabase.from('armazones').update({ codigo: quickCodigo, foto_url: quickFoto, updated_at: new Date().toISOString() }).eq('id', quickFrame.id);
    await load(); setQuickSaving(false); setQuickOk(true);
    setTimeout(() => { setQuickOk(false); setShowQuickModal(false); }, 1200);
  }

  // ─── CRUD insumos ─────────────────────────────────────────────────────────

  function openNewInsumo() { setEditingInsumo(null); setInsumoForm(emptyInsumoForm()); setShowInsumoModal(true); }
  function openEditInsumo(ins: Insumo) {
    setEditingInsumo(ins);
    setInsumoForm({
      nombre: ins.nombre, unidad: ins.unidad, foto_url: ins.foto_url||'',
      precio_costo: ins.precio_costo,
      stock_pettirossi: ins.stock_pettirossi, stock_azara: ins.stock_azara,
      stock_lambere: ins.stock_lambere, stock_accesosur: ins.stock_accesosur,
      stock_capiata: ins.stock_capiata, stock_deposito: ins.stock_deposito||0,
    });
    setShowInsumoModal(true);
  }

  async function handleInsumoPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => { const c = await compressImage(ev.target?.result as string); setInsumoForm(p => ({ ...p, foto_url: c })); };
    reader.readAsDataURL(file);
  }

  async function saveInsumo() {
    if (!insumoForm.nombre.trim()) return;
    setSavingInsumo(true);
    if (editingInsumo) {
      await supabase.from('insumos_stock').update({ ...insumoForm, updated_at: new Date().toISOString() }).eq('id', editingInsumo.id);
    } else {
      await supabase.from('insumos_stock').insert([{ ...insumoForm, id: crypto.randomUUID() }]);
    }
    await loadInsumos(); setSavingInsumo(false); setSaveInsumoOk(true);
    setTimeout(() => { setSaveInsumoOk(false); setShowInsumoModal(false); }, 1200);
  }

  async function confirmDeleteInsumo() {
    if (!deleteInsumoId) return;
    await supabase.from('insumos_stock').delete().eq('id', deleteInsumoId);
    setDeleteInsumoId(null); await loadInsumos();
  }

  async function adjustInsumoStock(id: string, sede: string, delta: number) {
    const ins = insumos.find(x => x.id === id); if (!ins) return;
    const newVal = Math.max(0, ((ins as any)[sede]||0) + delta);
    await supabase.from('insumos_stock').update({ [sede]: newVal, updated_at: new Date().toISOString() }).eq('id', id);
    setInsumos(prev => prev.map(x => x.id === id ? { ...x, [sede]: newVal } : x));
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-light tracking-wider text-white flex items-center gap-2">
            <Glasses size={18} style={{ color: '#C5A059' }} />Stock de Armazones
          </h1>
          <p className="text-xs mt-0.5 tracking-wide" style={{ color: 'rgba(197,160,89,0.65)' }}>Inventario de monturas por sede</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { load(); loadMovimientos(); loadInsumos(); }} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          {puedeCargarStock && vistaActiva === 'stock' && (
            <button onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-light"
              style={{ background: 'rgba(197,160,89,0.12)', border: '1px solid rgba(197,160,89,0.30)', color: '#C5A059' }}>
              <Plus size={13} />Agregar armazón
            </button>
          )}
          {isAdmin && vistaActiva === 'insumos' && (
            <button onClick={openNewInsumo}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-light"
              style={{ background: 'rgba(197,160,89,0.12)', border: '1px solid rgba(197,160,89,0.30)', color: '#C5A059' }}>
              <Plus size={13} />Agregar insumo
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Modelos',  value: totalModelos,  unit: 'modelos',  color: '#C5A059', icon: <Package size={14} /> },
          { label: 'Unidades', value: totalUnidades, unit: 'unidades', color: '#22c55e', icon: <BarChart2 size={14} /> },
          { label: 'Valor',    value: totalValor,    unit: 'Gs.',      color: '#3b82f6', icon: <DollarSign size={14} />, money: true },
        ].map(item => (
          <div key={item.label} className="rounded-xl p-4" style={{ background: `${item.color}08`, border: `1px solid ${item.color}28` }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.44)' }}>{item.label}</span>
              <span style={{ color: item.color, opacity: 0.7 }}>{item.icon}</span>
            </div>
            <p className="text-xl font-light" style={{ color: item.color }}>{(item as any).money ? fmt(item.value) : item.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.22)' }}>{item.unit}</p>
          </div>
        ))}
      </div>

      {/* Stock por sede */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {SEDES.map(s => {
          const total = frames.reduce((sum,f) => sum + ((f as any)[s.key]||0), 0);
          return (
            <div key={s.key} className="rounded-xl p-3" style={{ background: `${s.color}08`, border: `1px solid ${s.color}22` }}>
              <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</p>
              <p className="text-lg font-light" style={{ color: s.color }}>{total}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>unidades</p>
            </div>
          );
        })}
      </div>

      {/* Tabs: Stock / Vendidos / Insumos */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setVistaActiva('stock')}
          className="px-4 py-2 rounded-lg text-xs font-light"
          style={{ background: vistaActiva === 'stock' ? 'rgba(197,160,89,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${vistaActiva === 'stock' ? 'rgba(197,160,89,0.35)' : 'rgba(255,255,255,0.09)'}`, color: vistaActiva === 'stock' ? '#C5A059' : 'rgba(255,255,255,0.45)' }}>
          📦 Armazones en Stock
        </button>
        <button onClick={() => setVistaActiva('vendidos')}
          className="px-4 py-2 rounded-lg text-xs font-light"
          style={{ background: vistaActiva === 'vendidos' ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${vistaActiva === 'vendidos' ? 'rgba(34,197,94,0.30)' : 'rgba(255,255,255,0.09)'}`, color: vistaActiva === 'vendidos' ? '#22c55e' : 'rgba(255,255,255,0.45)' }}>
          🏷️ Armazones Vendidos
        </button>
        <button onClick={() => setVistaActiva('insumos')}
          className="px-4 py-2 rounded-lg text-xs font-light"
          style={{ background: vistaActiva === 'insumos' ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${vistaActiva === 'insumos' ? 'rgba(167,139,250,0.30)' : 'rgba(255,255,255,0.09)'}`, color: vistaActiva === 'insumos' ? '#a78bfa' : 'rgba(255,255,255,0.45)' }}>
          🧴 Insumos
        </button>
      </div>

      {/* ── VISTA: STOCK ─────────────────────────────────────────────────── */}
      {vistaActiva === 'stock' && (
        <>
          {/* Más vendidos + últimos movimientos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(197,160,89,0.15)' }}>
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(197,160,89,0.04)' }}>
                <Trophy size={13} style={{ color: '#C5A059' }} />
                <span className="text-xs font-light tracking-wider text-white">Más vendidos del mes</span>
              </div>
              {loadingMov ? <div className="p-4 space-y-2">{[...Array(3)].map((_,i) => <div key={i} className="h-8 rounded shimmer" />)}</div>
              : masVendidos.length === 0 ? (
                <div className="text-center py-8"><Trophy size={22} style={{ color: 'rgba(255,255,255,0.08)', margin: '0 auto 8px' }} /><p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.28)' }}>Sin ventas este mes</p></div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  {masVendidos.map((m,i) => (
                    <div key={m.armazon_codigo} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium shrink-0" style={{ background: i===0 ? 'rgba(197,160,89,0.2)' : 'rgba(255,255,255,0.06)', color: i===0 ? '#C5A059' : 'rgba(255,255,255,0.4)' }}>{i+1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white font-light truncate">{m.armazon_nombre}</p>
                        <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>#{m.armazon_codigo}</p>
                      </div>
                      <span className="text-xs font-light shrink-0 px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.10)', color: '#22c55e' }}>{m.total} vend.</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                <Clock size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />
                <span className="text-xs font-light tracking-wider text-white">Últimas ventas registradas</span>
              </div>
              {loadingMov ? <div className="p-4 space-y-2">{[...Array(3)].map((_,i) => <div key={i} className="h-8 rounded shimmer" />)}</div>
              : movimientos.length === 0 ? (
                <div className="text-center py-8"><Clock size={22} style={{ color: 'rgba(255,255,255,0.08)', margin: '0 auto 8px' }} /><p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.28)' }}>Sin movimientos</p></div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  {movimientos.slice(0,8).map(m => (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white font-light truncate">{m.armazon_nombre}</p>
                        <p className="text-xs font-light truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{m.sucursal} · {m.vendedora}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-light" style={{ color: '#ef4444' }}>−{m.cantidad}</p>
                        <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.28)' }}>{new Date(m.created_at).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filtros tabla */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-40" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <Search size={13} style={{ color: 'rgba(255,255,255,0.35)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nombre, código o color..." className="bg-transparent text-xs text-white outline-none flex-1" />
              {search && <button onClick={() => setSearch('')}><X size={11} style={{ color: 'rgba(255,255,255,0.3)' }} /></button>}
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="px-3 py-2 rounded-lg text-xs outline-none border" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.5)' }}>
              <option value="nombre" style={{ background: '#111' }}>A-Z</option>
              <option value="precio" style={{ background: '#111' }}>Precio ↓</option>
              <option value="stock"  style={{ background: '#111' }}>Stock ↓</option>
            </select>
          </div>

          <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>{visible.length} resultado{visible.length !== 1 ? 's' : ''}</p>

          {/* Tabla armazones */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="hidden lg:grid px-5 py-3 text-xs font-light" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 40px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.32)' }}>
              <span>Nombre / Código</span><span>Color</span><span>Precio</span><span>Stock total</span><span></span>
            </div>

            {visible.length === 0 ? (
              <div className="text-center py-14"><Package size={28} style={{ color: 'rgba(255,255,255,0.08)', margin: '0 auto 10px' }} /><p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Sin armazones</p></div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                {visible.map((f, i) => {
                  const isExp = expandedId === f.id;
                  return (
                    <div key={f.id}>
                      <div className="flex lg:grid items-center gap-3 px-4 py-3 cursor-pointer"
                        style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 40px', background: isExp ? 'rgba(197,160,89,0.03)' : i%2===0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                        onClick={() => setExpandedId(isExp ? null : f.id)}>

                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {f.foto_url ? (
                            <button onClick={e => { e.stopPropagation(); setLightboxUrl(f.foto_url); }}
                              className="shrink-0 relative group">
                              <img src={f.foto_url} alt={f.nombre} className="w-9 h-9 rounded-lg object-cover" style={{ border: '1px solid rgba(197,160,89,0.2)' }} />
                              <div className="absolute inset-0 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.5)' }}>
                                <ZoomIn size={12} style={{ color: '#C5A059' }} />
                              </div>
                            </button>
                          ) : (
                            <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center" style={{ background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.12)' }}>
                              <Glasses size={14} style={{ color: 'rgba(197,160,89,0.4)' }} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs text-white font-light truncate">{f.nombre}</p>
                            <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.36)' }}>#{f.codigo}</p>
                          </div>
                        </div>

                        <p className="hidden lg:block text-xs font-light truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>{(f as any).color || '—'}</p>
                        <p className="hidden lg:block text-xs font-light" style={{ color: '#C5A059' }}>Gs. {fmt(f.precio)}</p>
                        <div className="hidden lg:flex items-center gap-1.5">
                          <span className="text-sm font-light text-white">{totalStock(f)}</span>
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>uds.</span>
                        </div>
                        {/* Móvil: precio y stock */}
                        <div className="lg:hidden flex flex-col items-end shrink-0">
                          <span className="text-xs font-light" style={{ color: '#C5A059' }}>Gs. {fmt(f.precio)}</span>
                          <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>{totalStock(f)} uds.</span>
                        </div>

                        <ChevronDown size={13} style={{ color: 'rgba(255,255,255,0.3)', transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                      </div>

                      {isExp && (
                        <div className="px-4 pb-4 pt-3 space-y-4" style={{ background: 'rgba(197,160,89,0.02)', borderTop: '1px solid rgba(197,160,89,0.08)' }}>

                          {/* Foto grande al expandir */}
                          {f.foto_url && (
                            <button onClick={() => setLightboxUrl(f.foto_url)} className="relative group block">
                              <img src={f.foto_url} alt={f.nombre} className="h-28 rounded-xl object-cover border" style={{ borderColor: 'rgba(197,160,89,0.25)' }} />
                              <div className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.4)' }}>
                                <ZoomIn size={20} style={{ color: '#C5A059' }} />
                              </div>
                            </button>
                          )}

                          {/* Badge depósito */}
                          {(f.stock_deposito||0) > 0 && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light"
                              style={{ background: 'rgba(197,160,89,0.12)', border: '1px solid rgba(197,160,89,0.35)', color: '#C5A059' }}>
                              📦 Hay stock en Depósito: {f.stock_deposito} unidades
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { label: 'Precio',      value: `Gs. ${fmt(f.precio)}`, color: '#C5A059' },
                              { label: 'Color',       value: (f as any).color || '—', color: 'white' },
                              { label: 'Stock total', value: `${totalStock(f)} unidades`, color: 'white' },
                              { label: 'Código',      value: f.codigo || '—', color: 'white' },
                            ].map(d => (
                              <div key={d.label} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{d.label}</p>
                                <p className="text-sm font-light" style={{ color: d.color }}>{d.value}</p>
                              </div>
                            ))}
                          </div>

                          <div>
                            <p className="text-xs font-light mb-2 tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.55)' }}>Stock por sede</p>
                            <div className="grid grid-cols-2 gap-2">
                              {SEDES.map(s => {
                                const qty = (f as any)[s.key] || 0;
                                if (isVendedora && s.key !== vendedoraSede) return null;
                                return (
                                  <div key={s.key} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: `${s.color}08`, border: `1px solid ${s.color}22` }}>
                                    <span className="text-xs font-light" style={{ color: s.color }}>{s.label}</span>
                                    <div className="flex items-center gap-1.5">
                                      <button onClick={() => adjustStock(f.id, s.key, -1)} className="w-6 h-6 rounded flex items-center justify-center text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>−</button>
                                      <span className="text-sm font-light text-white w-5 text-center">{qty}</span>
                                      <button onClick={() => adjustStock(f.id, s.key, +1)} className="w-6 h-6 rounded flex items-center justify-center text-sm" style={{ background: 'rgba(34,197,94,0.10)', color: '#22c55e' }}>+</button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap pt-1">
                            {isVendedora && (
                              <button onClick={() => openQuick(f)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-light" style={{ background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.25)', color: '#C5A059' }}>
                                <Camera size={11} />Código / Foto
                              </button>
                            )}
                            {isAdmin && (
                              <>
                                <button onClick={() => openEdit(f)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-light" style={{ background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.25)', color: '#C5A059' }}><Edit2 size={11} />Editar</button>
                                <button onClick={() => setDeleteId(f.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-light" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.20)', color: 'rgba(239,68,68,0.7)' }}><Trash2 size={11} />Eliminar</button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── VISTA: VENDIDOS ──────────────────────────────────────────────── */}
      {vistaActiva === 'vendidos' && (
        <div className="space-y-4">
          {/* Filtro por fecha */}
          <div className="flex items-center gap-3 flex-wrap px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Calendar size={14} style={{ color: 'rgba(197,160,89,0.6)' }} />
            <div className="flex items-center gap-2">
              <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.45)' }}>Desde:</span>
              <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="bg-transparent text-xs text-white outline-none border-none" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.45)' }}>Hasta:</span>
              <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="bg-transparent text-xs text-white outline-none border-none" />
            </div>
            <button onClick={loadVendidos} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light" style={{ background: 'rgba(197,160,89,0.12)', border: '1px solid rgba(197,160,89,0.30)', color: '#C5A059' }}>
              <Search size={11} />Buscar
            </button>
          </div>

          {/* Resumen del período */}
          {vendidosFiltrados.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="rounded-xl p-3" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)' }}>
                <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Total vendidos</p>
                <p className="text-xl font-light" style={{ color: '#22c55e' }}>{vendidosFiltrados.reduce((s,m) => s+m.cantidad, 0)}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>unidades</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.22)' }}>
                <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Modelos distintos</p>
                <p className="text-xl font-light" style={{ color: '#C5A059' }}>{new Set(vendidosFiltrados.map(m => m.armazon_codigo)).size}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>modelos</p>
              </div>
              <div className="rounded-xl p-3 col-span-2 lg:col-span-1" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.22)' }}>
                <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Registros</p>
                <p className="text-xl font-light" style={{ color: '#3b82f6' }}>{vendidosFiltrados.length}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>transacciones</p>
              </div>
            </div>
          )}

          {/* Tabla vendidos */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="grid px-4 py-3 text-xs font-light" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.32)' }}>
              <span>Armazón</span><span>Sede</span><span>Vendedora</span><span>Fecha</span>
            </div>
            {loadingVendidos ? (
              <div className="p-4 space-y-2">{[...Array(5)].map((_,i) => <div key={i} className="h-10 rounded shimmer" />)}</div>
            ) : vendidosFiltrados.length === 0 ? (
              <div className="text-center py-12">
                <Package size={28} style={{ color: 'rgba(255,255,255,0.08)', margin: '0 auto 10px' }} />
                <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.28)' }}>Sin ventas en este período</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                {vendidosFiltrados.map((m, i) => (
                  <div key={m.id} className="grid items-center px-4 py-3" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr', background: i%2===0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <div>
                      <p className="text-xs text-white font-light truncate">{m.armazon_nombre}</p>
                      <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>#{m.armazon_codigo} · <span style={{ color: '#ef4444' }}>−{m.cantidad}</span></p>
                    </div>
                    <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>{m.sucursal}</p>
                    <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>{m.vendedora}</p>
                    <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {new Date(m.created_at).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── VISTA: INSUMOS ───────────────────────────────────────────────── */}
      {vistaActiva === 'insumos' && (
        <div className="space-y-4">
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(197,160,89,0.12)' }}>
            <div className="hidden lg:grid px-5 py-3 text-xs font-light" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 40px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(197,160,89,0.03)', color: 'rgba(255,255,255,0.32)' }}>
              <span>Nombre</span><span>Unidad</span><span>Precio costo</span><span>Stock total</span><span></span>
            </div>

            {loadingInsumos ? (
              <div className="p-4 space-y-2">{[...Array(4)].map((_,i) => <div key={i} className="h-10 rounded shimmer" />)}</div>
            ) : insumos.length === 0 ? (
              <div className="text-center py-14">
                <Layers size={28} style={{ color: 'rgba(255,255,255,0.08)', margin: '0 auto 10px' }} />
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Sin insumos registrados</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                {insumos.map((ins, i) => {
                  const isExp = expandedInsumoId === ins.id;
                  return (
                    <div key={ins.id}>
                      <div className="flex lg:grid items-center gap-3 px-4 py-3 cursor-pointer"
                        style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 40px', background: isExp ? 'rgba(197,160,89,0.03)' : i%2===0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                        onClick={() => setExpandedInsumoId(isExp ? null : ins.id)}>

                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {ins.foto_url ? (
                            <button onClick={e => { e.stopPropagation(); setLightboxUrl(ins.foto_url); }}
                              className="shrink-0 relative group">
                              <img src={ins.foto_url} alt={ins.nombre} className="w-9 h-9 rounded-lg object-cover" style={{ border: '1px solid rgba(197,160,89,0.2)' }} />
                              <div className="absolute inset-0 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.5)' }}>
                                <ZoomIn size={12} style={{ color: '#C5A059' }} />
                              </div>
                            </button>
                          ) : (
                            <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center" style={{ background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.12)' }}>
                              <Package size={14} style={{ color: 'rgba(197,160,89,0.4)' }} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs text-white font-light truncate">{ins.nombre}</p>
                            <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.36)' }}>{ins.unidad || '—'}</p>
                          </div>
                        </div>

                        <p className="hidden lg:block text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>{ins.unidad || '—'}</p>
                        <p className="hidden lg:block text-xs font-light" style={{ color: '#C5A059' }}>
                          {ins.precio_costo > 0 ? `Gs. ${fmt(ins.precio_costo)}` : '—'}
                        </p>
                        <div className="hidden lg:flex items-center gap-1.5">
                          <span className="text-sm font-light text-white">{totalInsumoStock(ins)}</span>
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{ins.unidad || 'uds.'}</span>
                        </div>
                        {/* Móvil */}
                        <div className="lg:hidden flex flex-col items-end shrink-0">
                          <span className="text-xs font-light" style={{ color: '#C5A059' }}>
                            {ins.precio_costo > 0 ? `Gs. ${fmt(ins.precio_costo)}` : '—'}
                          </span>
                          <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>{totalInsumoStock(ins)} uds.</span>
                        </div>

                        <ChevronDown size={13} style={{ color: 'rgba(255,255,255,0.3)', transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                      </div>

                      {isExp && (
                        <div className="px-4 pb-4 pt-3 space-y-4" style={{ background: 'rgba(197,160,89,0.02)', borderTop: '1px solid rgba(197,160,89,0.08)' }}>

                          {/* Foto grande al expandir */}
                          {ins.foto_url && (
                            <button onClick={() => setLightboxUrl(ins.foto_url)} className="relative group block">
                              <img src={ins.foto_url} alt={ins.nombre} className="h-28 rounded-xl object-cover border" style={{ borderColor: 'rgba(197,160,89,0.25)' }} />
                              <div className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.4)' }}>
                                <ZoomIn size={20} style={{ color: '#C5A059' }} />
                              </div>
                            </button>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { label: 'Nombre',       value: ins.nombre,                                                color: 'white' },
                              { label: 'Unidad',       value: ins.unidad || '—',                                         color: 'rgba(255,255,255,0.7)' },
                              { label: 'Precio costo', value: ins.precio_costo > 0 ? `Gs. ${fmt(ins.precio_costo)}` : '—', color: '#C5A059' },
                              { label: 'Stock total',  value: `${totalInsumoStock(ins)} ${ins.unidad || 'uds.'}`,         color: 'white' },
                            ].map(d => (
                              <div key={d.label} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{d.label}</p>
                                <p className="text-sm font-light" style={{ color: d.color }}>{d.value}</p>
                              </div>
                            ))}
                          </div>

                          {puedeCargarStock && (
                            <div>
                              <p className="text-xs font-light mb-2 tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.55)' }}>Stock por sede</p>
                              <div className="grid grid-cols-2 gap-2">
                                {SEDES.map(s => {
                                  const qty = (ins as any)[s.key] || 0;
                                  return (
                                    <div key={s.key} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: `${s.color}08`, border: `1px solid ${s.color}22` }}>
                                      <span className="text-xs font-light" style={{ color: s.color }}>{s.label}</span>
                                      <div className="flex items-center gap-1.5">
                                        <button onClick={() => adjustInsumoStock(ins.id, s.key, -1)} className="w-6 h-6 rounded flex items-center justify-center text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>−</button>
                                        <span className="text-sm font-light text-white w-5 text-center">{qty}</span>
                                        <button onClick={() => adjustInsumoStock(ins.id, s.key, +1)} className="w-6 h-6 rounded flex items-center justify-center text-sm" style={{ background: 'rgba(34,197,94,0.10)', color: '#22c55e' }}>+</button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {isAdmin && (
                            <div className="flex items-center gap-2 flex-wrap pt-1">
                              <button onClick={() => openEditInsumo(ins)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-light" style={{ background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.25)', color: '#C5A059' }}>
                                <Edit2 size={11} />Editar
                              </button>
                              <button onClick={() => setDeleteInsumoId(ins.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-light" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.20)', color: 'rgba(239,68,68,0.7)' }}>
                                <Trash2 size={11} />Eliminar
                              </button>
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
      )}

      {/* ─── Lightbox foto ───────────────────────────────────────────────── */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.94)' }} onClick={() => setLightboxUrl(null)}>
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <img src={lightboxUrl} alt="armazón" className="w-full rounded-2xl"
              style={{ border: '1px solid rgba(197,160,89,0.3)', maxHeight: '80vh', objectFit: 'contain', background: '#111' }} />
            <button onClick={() => setLightboxUrl(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.8)' }}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ─── Modal completo admin (armazón) ──────────────────────────────── */}
      {showModal && puedeCargarStock && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.88)' }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: '#0d0d0d', border: '1px solid rgba(197,160,89,0.25)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(197,160,89,0.04)' }}>
              <div className="flex items-center gap-2">
                <Glasses size={15} style={{ color: '#C5A059' }} />
                <p className="text-sm font-light text-white">{editing ? 'Editar armazón' : 'Nuevo armazón'}</p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ color: 'rgba(255,255,255,0.4)' }}><X size={14} /></button>
            </div>

            <div className="px-5 py-5 space-y-4 max-h-[78vh] overflow-y-auto">
              {/* Foto */}
              <div>
                <label className="text-xs font-light mb-2 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Foto del armazón</label>
                {form.foto_url ? (
                  <div className="relative inline-block">
                    <img src={form.foto_url} alt="armazón" className="h-28 rounded-xl object-cover border cursor-pointer"
                      style={{ borderColor: 'rgba(197,160,89,0.25)' }}
                      onClick={() => setLightboxUrl(form.foto_url)} />
                    <button onClick={() => setForm(p => ({ ...p, foto_url: '' }))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: '#ef4444' }}><X size={10} color="#fff" /></button>
                  </div>
                ) : (
                  <button onClick={() => photoRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-light border"
                    style={{ borderColor: 'rgba(197,160,89,0.22)', color: 'rgba(197,160,89,0.7)', background: 'rgba(197,160,89,0.04)' }}>
                    <Camera size={14} />Tomar foto o elegir de galería
                  </button>
                )}
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </div>

              {/* Nombre, Código y Color */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Nombre *</label>
                  <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                    placeholder="Ej: Ray-Ban Clubmaster"
                    className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                    style={{ borderColor: 'rgba(197,160,89,0.25)' }} />
                </div>
                <div>
                  <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Código *</label>
                  <input value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))}
                    placeholder="Ej: RB-001"
                    className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                    style={{ borderColor: 'rgba(197,160,89,0.25)' }} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Color</label>
                  <input value={form.color || ''} onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                    placeholder="Ej: Negro brillante, Carey, Azul"
                    className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                    style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
                </div>
              </div>

              {/* Precio */}
              <div>
                <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Precio de venta (Gs.)</label>
                <input type="number" value={form.precio || ''} onChange={e => setForm(p => ({ ...p, precio: Number(e.target.value) }))}
                  placeholder="0"
                  className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                  style={{ borderColor: 'rgba(197,160,89,0.25)' }} />
              </div>

              {/* Stock por sede */}
              <div>
                <label className="text-xs font-light mb-2 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Stock por sede</label>
                <div className="grid grid-cols-2 gap-2">
                  {SEDES.map(s => (
                    <div key={s.key} className="rounded-lg p-3" style={{ background: `${s.color}08`, border: `1px solid ${s.color}22` }}>
                      <label className="text-xs font-light mb-1.5 block" style={{ color: s.color }}>{s.label}</label>
                      <input type="number" value={(form as any)[s.key] || ''} onChange={e => setForm(p => ({ ...p, [s.key]: Number(e.target.value) }))}
                        placeholder="0" min="0"
                        className="w-full px-2.5 py-2 rounded-lg bg-transparent text-white text-xs outline-none border"
                        style={{ borderColor: `${s.color}30` }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-xs font-light"
                style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                Cancelar
              </button>
              <button onClick={save} disabled={saving || !form.nombre.trim() || !form.codigo.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-medium"
                style={{
                  background: saveOk ? 'rgba(34,197,94,0.15)' : (!form.nombre.trim() || !form.codigo.trim()) ? 'rgba(197,160,89,0.06)' : 'rgba(197,160,89,0.15)',
                  border: saveOk ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(197,160,89,0.35)',
                  color: saveOk ? '#22c55e' : (!form.nombre.trim() || !form.codigo.trim()) ? 'rgba(197,160,89,0.35)' : '#C5A059',
                  cursor: (!form.nombre.trim() || !form.codigo.trim()) ? 'not-allowed' : 'pointer',
                }}>
                {saveOk ? <><Check size={12} />Guardado</> : saving ? 'Guardando...' : <><Package size={12} />{editing ? 'Guardar cambios' : 'Agregar armazón'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal insumo ─────────────────────────────────────────────────── */}
      {showInsumoModal && isAdmin && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.88)' }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: '#0d0d0d', border: '1px solid rgba(197,160,89,0.25)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(197,160,89,0.04)' }}>
              <div className="flex items-center gap-2">
                <Layers size={15} style={{ color: '#C5A059' }} />
                <p className="text-sm font-light text-white">{editingInsumo ? 'Editar insumo' : 'Nuevo insumo'}</p>
              </div>
              <button onClick={() => setShowInsumoModal(false)} style={{ color: 'rgba(255,255,255,0.4)' }}><X size={14} /></button>
            </div>

            <div className="px-5 py-5 space-y-4 max-h-[78vh] overflow-y-auto">
              {/* Foto */}
              <div>
                <label className="text-xs font-light mb-2 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Foto del insumo</label>
                {insumoForm.foto_url ? (
                  <div className="relative inline-block">
                    <img src={insumoForm.foto_url} alt="insumo" className="h-28 rounded-xl object-cover border cursor-pointer"
                      style={{ borderColor: 'rgba(197,160,89,0.25)' }}
                      onClick={() => setLightboxUrl(insumoForm.foto_url)} />
                    <button onClick={() => setInsumoForm(p => ({ ...p, foto_url: '' }))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: '#ef4444' }}><X size={10} color="#fff" /></button>
                  </div>
                ) : (
                  <button onClick={() => insumoPhotoRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-light border"
                    style={{ borderColor: 'rgba(197,160,89,0.22)', color: 'rgba(197,160,89,0.7)', background: 'rgba(197,160,89,0.04)' }}>
                    <Camera size={14} />Tomar foto o elegir de galería
                  </button>
                )}
                <input ref={insumoPhotoRef} type="file" accept="image/*" className="hidden" onChange={handleInsumoPhotoUpload} />
              </div>

              {/* Nombre, Unidad, Precio */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Nombre *</label>
                  <input value={insumoForm.nombre} onChange={e => setInsumoForm(p => ({ ...p, nombre: e.target.value }))}
                    placeholder="Ej: Paño de limpieza"
                    className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                    style={{ borderColor: 'rgba(197,160,89,0.25)' }} />
                </div>
                <div>
                  <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Unidad</label>
                  <input value={insumoForm.unidad} onChange={e => setInsumoForm(p => ({ ...p, unidad: e.target.value }))}
                    placeholder="Ej: unidad, caja, ml"
                    className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                    style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
                </div>
                <div>
                  <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Precio costo (Gs.)</label>
                  <input type="number" value={insumoForm.precio_costo || ''} onChange={e => setInsumoForm(p => ({ ...p, precio_costo: Number(e.target.value) }))}
                    placeholder="0" min="0"
                    className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                    style={{ borderColor: 'rgba(197,160,89,0.25)' }} />
                </div>
              </div>

              {/* Stock por sede */}
              <div>
                <label className="text-xs font-light mb-2 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Stock por sede</label>
                <div className="grid grid-cols-2 gap-2">
                  {SEDES.map(s => (
                    <div key={s.key} className="rounded-lg p-3" style={{ background: `${s.color}08`, border: `1px solid ${s.color}22` }}>
                      <label className="text-xs font-light mb-1.5 block" style={{ color: s.color }}>{s.label}</label>
                      <input type="number" value={(insumoForm as any)[s.key] || ''} onChange={e => setInsumoForm(p => ({ ...p, [s.key]: Number(e.target.value) }))}
                        placeholder="0" min="0"
                        className="w-full px-2.5 py-2 rounded-lg bg-transparent text-white text-xs outline-none border"
                        style={{ borderColor: `${s.color}30` }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={() => setShowInsumoModal(false)} className="px-4 py-2 rounded-lg text-xs font-light"
                style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                Cancelar
              </button>
              <button onClick={saveInsumo} disabled={savingInsumo || !insumoForm.nombre.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-medium"
                style={{
                  background: saveInsumoOk ? 'rgba(34,197,94,0.15)' : !insumoForm.nombre.trim() ? 'rgba(197,160,89,0.06)' : 'rgba(197,160,89,0.15)',
                  border: saveInsumoOk ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(197,160,89,0.35)',
                  color: saveInsumoOk ? '#22c55e' : !insumoForm.nombre.trim() ? 'rgba(197,160,89,0.35)' : '#C5A059',
                  cursor: !insumoForm.nombre.trim() ? 'not-allowed' : 'pointer',
                }}>
                {saveInsumoOk ? <><Check size={12} />Guardado</> : savingInsumo ? 'Guardando...' : <><Layers size={12} />{editingInsumo ? 'Guardar cambios' : 'Agregar insumo'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal rápido vendedora ───────────────────────────────────────── */}
      {showQuickModal && quickFrame && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.88)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#0d0d0d', border: '1px solid rgba(197,160,89,0.25)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(197,160,89,0.04)' }}>
              <p className="text-sm font-light text-white">Código / Foto</p>
              <button onClick={() => setShowQuickModal(false)} style={{ color: 'rgba(255,255,255,0.4)' }}><X size={14} /></button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <p className="text-xs font-light truncate" style={{ color: 'rgba(197,160,89,0.7)' }}>{quickFrame.nombre}</p>
              <div>
                <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Código / SKU</label>
                <input value={quickCodigo} onChange={e => setQuickCodigo(e.target.value)} placeholder="Ej: RB-001"
                  className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                  style={{ borderColor: 'rgba(197,160,89,0.25)' }} />
              </div>
              <div>
                <label className="text-xs font-light mb-2 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Foto</label>
                {quickFoto ? (
                  <div className="relative">
                    <img src={quickFoto} alt="armazón" className="h-32 rounded-xl object-cover border w-full cursor-pointer"
                      style={{ borderColor: 'rgba(197,160,89,0.25)' }}
                      onClick={() => setLightboxUrl(quickFoto)} />
                    <button onClick={() => setQuickFoto('')}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: '#ef4444' }}><X size={10} color="#fff" /></button>
                  </div>
                ) : (
                  <button onClick={() => quickPhotoRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border"
                    style={{ borderColor: 'rgba(197,160,89,0.22)', borderStyle: 'dashed', color: 'rgba(197,160,89,0.7)', background: 'rgba(197,160,89,0.04)' }}>
                    <Camera size={18} /><span className="text-sm font-light">Tomar foto o elegir de galería</span>
                  </button>
                )}
                <input ref={quickPhotoRef} type="file" accept="image/*" className="hidden" onChange={handleQuickPhoto} />
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={() => setShowQuickModal(false)} className="flex-1 px-4 py-2.5 rounded-lg text-xs font-light"
                style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                Cancelar
              </button>
              <button onClick={saveQuick} disabled={quickSaving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium"
                style={{
                  background: quickOk ? 'rgba(34,197,94,0.15)' : 'rgba(197,160,89,0.15)',
                  border: quickOk ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(197,160,89,0.35)',
                  color: quickOk ? '#22c55e' : '#C5A059',
                }}>
                {quickOk ? <><Check size={12} />Guardado</> : quickSaving ? 'Guardando...' : <><Check size={12} />Guardar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Confirm delete armazón ───────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-[950] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.88)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: '#0d0d0d', border: '1px solid rgba(239,68,68,0.30)' }}>
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} style={{ color: '#ef4444' }} />
              <p className="text-sm font-light text-white">¿Eliminar este armazón?</p>
            </div>
            <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.45)' }}>Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 rounded-lg text-xs font-light"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.5)' }}>
                Cancelar
              </button>
              <button onClick={confirmDelete} className="flex-1 px-4 py-2 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444' }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Confirm delete insumo ────────────────────────────────────────── */}
      {deleteInsumoId && (
        <div className="fixed inset-0 z-[950] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.88)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: '#0d0d0d', border: '1px solid rgba(239,68,68,0.30)' }}>
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} style={{ color: '#ef4444' }} />
              <p className="text-sm font-light text-white">¿Eliminar este insumo?</p>
            </div>
            <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.45)' }}>Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteInsumoId(null)} className="flex-1 px-4 py-2 rounded-lg text-xs font-light"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.5)' }}>
                Cancelar
              </button>
              <button onClick={confirmDeleteInsumo} className="flex-1 px-4 py-2 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444' }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
