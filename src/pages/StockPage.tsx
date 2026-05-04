import { useState, useEffect, useCallback } from 'react';
import {
  Package, Plus, Search, RefreshCw, Edit2, Trash2, X, Check,
  ChevronDown, Filter, Eye, EyeOff, AlertTriangle, TrendingDown,
  Glasses, Tag, MapPin, Hash, DollarSign, BarChart2, Upload,
} from 'lucide-react';
import { useBranch } from '../context/BranchContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Frame = {
  id: number;
  codigo: string;
  descripcion: string;
  marca: string;
  modelo: string;
  color: string;
  material: string;
  tipo: string; // 'armazón' | 'sol' | 'deportivo' | 'infantil'
  precio_costo: number;
  precio_venta: number;
  stock: number;
  stock_minimo: number;
  sucursal: string;
  proveedor: string;
  foto_url: string | null;
  activo: boolean;
  created_at: string;
};

type FormData = Omit<Frame, 'id' | 'created_at'>;

// ─── Constantes ───────────────────────────────────────────────────────────────

const SUCURSALES = ['Azara', 'Fernando', 'Caacupé', 'La Fina'];
const TIPOS = ['armazón', 'sol', 'deportivo', 'infantil'];
const MATERIALES = ['acetato', 'metal', 'titanio', 'tr-90', 'mixto', 'madera', 'otro'];

const TIPO_COLORS: Record<string, string> = {
  'armazón':  '#C5A059',
  'sol':      '#f59e0b',
  'deportivo':'#3b82f6',
  'infantil': '#a78bfa',
};

const SUCURSAL_COLORS: Record<string, string> = {
  'Azara':    '#22c55e',
  'Fernando': '#3b82f6',
  'Caacupé':  '#C5A059',
  'La Fina':  '#a78bfa',
};

function fmt(n: number) {
  return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function emptyForm(branch = ''): FormData {
  return {
    codigo: '', descripcion: '', marca: '', modelo: '', color: '',
    material: 'acetato', tipo: 'armazón', precio_costo: 0, precio_venta: 0,
    stock: 0, stock_minimo: 3, sucursal: branch, proveedor: '', foto_url: null, activo: true,
  };
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function StockPage() {
  const { activeBranch } = useBranch();
  const { profile } = useAuth();

  const isAdmin = profile?.role === 'admin' || profile?.role === 'gerente';
  const defaultBranch = activeBranch?.name || '';

  // Estado principal
  const [frames, setFrames]           = useState<Frame[]>([]);
  const [loading, setLoading]         = useState(false);
  const [search, setSearch]           = useState('');
  const [filterBranch, setFilterBranch] = useState(isAdmin ? '' : defaultBranch);
  const [filterTipo, setFilterTipo]   = useState('');
  const [filterLow, setFilterLow]     = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [sortBy, setSortBy]           = useState<'descripcion' | 'stock' | 'precio_venta'>('descripcion');

  // Modal
  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState<Frame | null>(null);
  const [form, setForm]               = useState<FormData>(emptyForm(defaultBranch));
  const [saving, setSaving]           = useState(false);
  const [saveOk, setSaveOk]           = useState(false);

  // Detalle
  const [expandedId, setExpandedId]   = useState<number | null>(null);

  // Confirm delete
  const [deleteId, setDeleteId]       = useState<number | null>(null);

  // ─── Carga desde Supabase ──────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('stock_armazones')
      .select('*')
      .order('descripcion', { ascending: true });
    if (!error && data) setFrames(data as Frame[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Filtros ───────────────────────────────────────────────────────────────

  const visible = frames.filter(f => {
    if (!showInactive && !f.activo) return false;
    if (filterBranch && f.sucursal !== filterBranch) return false;
    if (filterTipo && f.tipo !== filterTipo) return false;
    if (filterLow && f.stock > f.stock_minimo) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        f.descripcion.toLowerCase().includes(q) ||
        f.marca.toLowerCase().includes(q) ||
        f.codigo.toLowerCase().includes(q) ||
        f.modelo.toLowerCase().includes(q) ||
        f.color.toLowerCase().includes(q)
      );
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'stock') return a.stock - b.stock;
    if (sortBy === 'precio_venta') return b.precio_venta - a.precio_venta;
    return a.descripcion.localeCompare(b.descripcion);
  });

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const statsBase = isAdmin ? frames : frames.filter(f => f.sucursal === defaultBranch);
  const totalItems    = statsBase.filter(f => f.activo).length;
  const totalUnits    = statsBase.filter(f => f.activo).reduce((s, f) => s + f.stock, 0);
  const totalValue    = statsBase.filter(f => f.activo).reduce((s, f) => s + f.stock * f.precio_venta, 0);
  const lowStockCount = statsBase.filter(f => f.activo && f.stock <= f.stock_minimo).length;

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  function openNew() {
    setEditing(null);
    setForm(emptyForm(isAdmin ? '' : defaultBranch));
    setShowModal(true);
  }

  function openEdit(f: Frame) {
    setEditing(f);
    setForm({ ...f });
    setShowModal(true);
  }

  async function save() {
    if (!form.descripcion.trim() || !form.sucursal) return;
    setSaving(true);
    if (editing) {
      await supabase.from('stock_armazones').update({ ...form }).eq('id', editing.id);
    } else {
      await supabase.from('stock_armazones').insert([{ ...form }]);
    }
    await load();
    setSaving(false);
    setSaveOk(true);
    setTimeout(() => { setSaveOk(false); setShowModal(false); }, 1200);
  }

  async function toggleActivo(f: Frame) {
    await supabase.from('stock_armazones').update({ activo: !f.activo }).eq('id', f.id);
    setFrames(prev => prev.map(x => x.id === f.id ? { ...x, activo: !x.activo } : x));
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await supabase.from('stock_armazones').delete().eq('id', deleteId);
    setDeleteId(null);
    await load();
  }

  async function adjustStock(id: number, delta: number) {
    const f = frames.find(x => x.id === id);
    if (!f) return;
    const newStock = Math.max(0, f.stock + delta);
    await supabase.from('stock_armazones').update({ stock: newStock }).eq('id', id);
    setFrames(prev => prev.map(x => x.id === id ? { ...x, stock: newStock } : x));
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-light tracking-wider text-white flex items-center gap-2">
            <Glasses size={18} style={{ color: '#C5A059' }} />
            Stock de Armazones
          </h1>
          <p className="text-xs text-gold-muted mt-0.5 tracking-wide">
            Inventario de monturas por sede
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          {isAdmin && (
            <button onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-light"
              style={{ background: 'rgba(197,160,89,0.12)', border: '1px solid rgba(197,160,89,0.30)', color: '#C5A059' }}>
              <Plus size={13} />Agregar armazón
            </button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Modelos activos', value: totalItems, unit: 'modelos', color: '#C5A059', icon: <Package size={14} /> },
          { label: 'Unidades totales', value: totalUnits, unit: 'unidades', color: '#22c55e', icon: <BarChart2 size={14} /> },
          { label: 'Valor de stock', value: totalValue, unit: 'Gs.', color: '#3b82f6', icon: <DollarSign size={14} />, money: true },
          { label: 'Stock bajo mínimo', value: lowStockCount, unit: 'modelos', color: '#ef4444', icon: <AlertTriangle size={14} /> },
        ].map(item => (
          <div key={item.label} className="rounded-xl p-4"
            style={{ background: `${item.color}08`, border: `1px solid ${item.color}28` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.44)' }}>{item.label}</span>
              <span style={{ color: item.color, opacity: 0.7 }}>{item.icon}</span>
            </div>
            <p className="text-xl font-light" style={{ color: item.color }}>
              {item.money ? fmt(item.value) : item.value}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.22)' }}>{item.unit}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-48"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)' }}>
          <Search size={13} style={{ color: 'rgba(255,255,255,0.35)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar código, descripción, marca..."
            className="bg-transparent text-xs text-white outline-none flex-1"
            style={{ '::placeholder': { color: 'rgba(255,255,255,0.28)' } } as any} />
          {search && <button onClick={() => setSearch('')}><X size={11} style={{ color: 'rgba(255,255,255,0.3)' }} /></button>}
        </div>

        {isAdmin && (
          <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)}
            className="px-3 py-2 rounded-lg text-xs outline-none border"
            style={{ background: 'rgba(197,160,89,0.07)', borderColor: 'rgba(197,160,89,0.22)', color: '#C5A059' }}>
            <option value="" style={{ background: '#111' }}>Todas las sedes</option>
            {SUCURSALES.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
          </select>
        )}

        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs outline-none border"
          style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)', color: filterTipo ? '#C5A059' : 'rgba(255,255,255,0.5)' }}>
          <option value="" style={{ background: '#111' }}>Todos los tipos</option>
          {TIPOS.map(t => <option key={t} value={t} style={{ background: '#111' }}>{t}</option>)}
        </select>

        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
          className="px-3 py-2 rounded-lg text-xs outline-none border"
          style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.5)' }}>
          <option value="descripcion" style={{ background: '#111' }}>Ordenar: A-Z</option>
          <option value="stock"       style={{ background: '#111' }}>Ordenar: stock ↑</option>
          <option value="precio_venta" style={{ background: '#111' }}>Ordenar: precio ↓</option>
        </select>

        <button onClick={() => setFilterLow(!filterLow)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-light"
          style={{
            background: filterLow ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
            border: filterLow ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(255,255,255,0.09)',
            color: filterLow ? '#ef4444' : 'rgba(255,255,255,0.45)',
          }}>
          <TrendingDown size={12} />Stock bajo
        </button>

        {isAdmin && (
          <button onClick={() => setShowInactive(!showInactive)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-light"
            style={{
              background: showInactive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)',
              color: showInactive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)',
            }}>
            {showInactive ? <Eye size={12} /> : <EyeOff size={12} />}
            {showInactive ? 'Ocultar inactivos' : 'Ver inactivos'}
          </button>
        )}
      </div>

      {/* Conteo */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {visible.length} resultado{visible.length !== 1 ? 's' : ''}
        </span>
        {filterLow && lowStockCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>
            {lowStockCount} bajo mínimo
          </span>
        )}
      </div>

      {/* Tabla */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Header tabla */}
        <div className="grid px-5 py-3"
          style={{
            gridTemplateColumns: '2fr 1fr 1fr 80px 80px 80px 90px 48px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
          }}>
          {['Descripción','Marca / Color','Tipo','Costo','Venta','Stock','Sede',''].map(h => (
            <span key={h} className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.32)' }}>{h}</span>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="text-center py-14">
            <Package size={28} style={{ color: 'rgba(255,255,255,0.08)', margin: '0 auto 10px' }} />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Sin armazones para mostrar</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {visible.map((f, i) => {
              const isExp = expandedId === f.id;
              const isLow = f.stock <= f.stock_minimo;
              const tipoColor = TIPO_COLORS[f.tipo] ?? '#C5A059';
              const sucColor  = SUCURSAL_COLORS[f.sucursal] ?? '#C5A059';

              return (
                <div key={f.id} style={{ opacity: f.activo ? 1 : 0.45 }}>
                  {/* Fila principal */}
                  <div
                    className="grid items-center px-5 py-3 cursor-pointer"
                    style={{
                      gridTemplateColumns: '2fr 1fr 1fr 80px 80px 80px 90px 48px',
                      background: isExp ? 'rgba(197,160,89,0.03)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    }}
                    onClick={() => setExpandedId(isExp ? null : f.id)}
                  >
                    {/* Descripción */}
                    <div className="flex items-center gap-2 min-w-0">
                      {f.foto_url ? (
                        <img src={f.foto_url} alt={f.descripcion}
                          className="w-8 h-8 rounded object-cover shrink-0"
                          style={{ border: '1px solid rgba(197,160,89,0.2)' }} />
                      ) : (
                        <div className="w-8 h-8 rounded shrink-0 flex items-center justify-center"
                          style={{ background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.12)' }}>
                          <Glasses size={13} style={{ color: 'rgba(197,160,89,0.4)' }} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs text-white font-light truncate">{f.descripcion}</p>
                        <p className="text-xs font-light truncate" style={{ color: 'rgba(255,255,255,0.36)' }}>
                          #{f.codigo || '—'}
                        </p>
                      </div>
                    </div>

                    {/* Marca / Color */}
                    <div>
                      <p className="text-xs font-light text-white truncate">{f.marca || '—'}</p>
                      <p className="text-xs font-light truncate" style={{ color: 'rgba(255,255,255,0.36)' }}>{f.color || '—'}</p>
                    </div>

                    {/* Tipo */}
                    <span className="text-xs px-2 py-0.5 rounded-full w-fit"
                      style={{ background: `${tipoColor}18`, color: tipoColor }}>
                      {f.tipo}
                    </span>

                    {/* Costo */}
                    <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      {fmt(f.precio_costo)}
                    </p>

                    {/* Venta */}
                    <p className="text-xs font-light" style={{ color: '#C5A059' }}>
                      {fmt(f.precio_venta)}
                    </p>

                    {/* Stock */}
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-light ${isLow ? 'text-red-400' : 'text-white'}`}>
                        {f.stock}
                      </span>
                      {isLow && <AlertTriangle size={11} style={{ color: '#ef4444' }} />}
                    </div>

                    {/* Sede */}
                    <span className="text-xs px-2 py-0.5 rounded-full w-fit"
                      style={{ background: `${sucColor}18`, color: sucColor }}>
                      {f.sucursal}
                    </span>

                    {/* Chevron */}
                    <ChevronDown size={13}
                      style={{ color: 'rgba(255,255,255,0.3)', transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </div>

                  {/* Fila expandida */}
                  {isExp && (
                    <div className="px-5 pb-5 pt-3 space-y-4"
                      style={{ background: 'rgba(197,160,89,0.02)', borderTop: '1px solid rgba(197,160,89,0.08)' }}>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                          { label: 'Modelo',     value: f.modelo   || '—' },
                          { label: 'Material',   value: f.material || '—' },
                          { label: 'Proveedor',  value: f.proveedor || '—' },
                          { label: 'Stock mínimo', value: `${f.stock_minimo} unidades` },
                        ].map(d => (
                          <div key={d.label} className="rounded-lg p-3"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{d.label}</p>
                            <p className="text-xs text-white font-light">{d.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Ajuste rápido de stock + acciones */}
                      <div className="flex items-center gap-3 flex-wrap pt-1">
                        {/* Ajuste stock */}
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.45)' }}>Stock:</span>
                          <button onClick={() => adjustStock(f.id, -1)}
                            className="w-6 h-6 rounded flex items-center justify-center"
                            style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>
                            <span className="text-sm leading-none">−</span>
                          </button>
                          <span className="text-sm font-light text-white w-6 text-center">{f.stock}</span>
                          <button onClick={() => adjustStock(f.id, +1)}
                            className="w-6 h-6 rounded flex items-center justify-center"
                            style={{ background: 'rgba(34,197,94,0.10)', color: '#22c55e' }}>
                            <span className="text-sm leading-none">+</span>
                          </button>
                        </div>

                        {isAdmin && (
                          <>
                            <button onClick={() => openEdit(f)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-light"
                              style={{ background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.25)', color: '#C5A059' }}>
                              <Edit2 size={11} />Editar
                            </button>
                            <button onClick={() => toggleActivo(f)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-light"
                              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: f.activo ? 'rgba(255,255,255,0.5)' : '#22c55e' }}>
                              {f.activo ? <><EyeOff size={11} />Desactivar</> : <><Eye size={11} />Activar</>}
                            </button>
                            <button onClick={() => setDeleteId(f.id)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-light"
                              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.20)', color: 'rgba(239,68,68,0.7)' }}>
                              <Trash2 size={11} />Eliminar
                            </button>
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

      {/* ─── Modal agregar / editar ─────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden"
            style={{ background: '#0d0d0d', border: '1px solid rgba(197,160,89,0.25)' }}>

            {/* Header modal */}
            <div className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(197,160,89,0.04)' }}>
              <div className="flex items-center gap-2">
                <Glasses size={15} style={{ color: '#C5A059' }} />
                <p className="text-sm font-light text-white">
                  {editing ? 'Editar armazón' : 'Nuevo armazón'}
                </p>
              </div>
              <button onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg"
                style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)' }}>
                <X size={14} />
              </button>
            </div>

            {/* Cuerpo modal */}
            <div className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">

              {/* Descripción + código */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Descripción *</label>
                  <input value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                    placeholder="Ej: Ray-Ban Clubmaster Negro"
                    className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                    style={{ borderColor: 'rgba(197,160,89,0.25)' }} />
                </div>
                <div>
                  <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Código / SKU</label>
                  <input value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))}
                    placeholder="Ej: RB-001"
                    className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                    style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
                </div>
              </div>

              {/* Marca / Modelo / Color */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Marca', key: 'marca', placeholder: 'Ej: Ray-Ban' },
                  { label: 'Modelo', key: 'modelo', placeholder: 'Ej: Clubmaster' },
                  { label: 'Color', key: 'color', placeholder: 'Ej: Negro brillante' },
                ].map(f2 => (
                  <div key={f2.key}>
                    <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>{f2.label}</label>
                    <input value={(form as any)[f2.key]} onChange={e => setForm(p => ({ ...p, [f2.key]: e.target.value }))}
                      placeholder={f2.placeholder}
                      className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                      style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
                  </div>
                ))}
              </div>

              {/* Tipo / Material / Proveedor */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Tipo</label>
                  <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-transparent text-xs outline-none border"
                    style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#C5A059', background: '#0d0d0d' }}>
                    {TIPOS.map(t => <option key={t} value={t} style={{ background: '#111' }}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Material</label>
                  <select value={form.material} onChange={e => setForm(p => ({ ...p, material: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-transparent text-xs outline-none border"
                    style={{ borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', background: '#0d0d0d' }}>
                    {MATERIALES.map(m => <option key={m} value={m} style={{ background: '#111' }}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Proveedor</label>
                  <input value={form.proveedor} onChange={e => setForm(p => ({ ...p, proveedor: e.target.value }))}
                    placeholder="Ej: Distribuidora XYZ"
                    className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                    style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
                </div>
              </div>

              {/* Precios */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Precio costo (Gs.)</label>
                  <input type="number" value={form.precio_costo || ''} onChange={e => setForm(p => ({ ...p, precio_costo: Number(e.target.value) }))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                    style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
                </div>
                <div>
                  <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Precio venta (Gs.)</label>
                  <input type="number" value={form.precio_venta || ''} onChange={e => setForm(p => ({ ...p, precio_venta: Number(e.target.value) }))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                    style={{ borderColor: 'rgba(197,160,89,0.25)' }} />
                </div>
              </div>

              {/* Stock */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Stock actual</label>
                  <input type="number" value={form.stock || ''} onChange={e => setForm(p => ({ ...p, stock: Number(e.target.value) }))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                    style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
                </div>
                <div>
                  <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Stock mínimo</label>
                  <input type="number" value={form.stock_minimo || ''} onChange={e => setForm(p => ({ ...p, stock_minimo: Number(e.target.value) }))}
                    placeholder="3"
                    className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                    style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
                </div>
              </div>

              {/* Sede */}
              <div>
                <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>Sede *</label>
                <select value={form.sucursal} onChange={e => setForm(p => ({ ...p, sucursal: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-xs outline-none border"
                  style={{ borderColor: 'rgba(197,160,89,0.25)', color: form.sucursal ? '#C5A059' : 'rgba(255,255,255,0.38)', background: '#0d0d0d' }}>
                  <option value="" style={{ background: '#111' }}>Seleccionar sede...</option>
                  {SUCURSALES.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
                </select>
              </div>

              {/* URL foto */}
              <div>
                <label className="text-xs font-light mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>URL de foto (opcional)</label>
                <input value={form.foto_url || ''} onChange={e => setForm(p => ({ ...p, foto_url: e.target.value || null }))}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                  style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
              </div>

              {/* Margen */}
              {form.precio_costo > 0 && form.precio_venta > 0 && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.18)' }}>
                  <TrendingDown size={12} style={{ color: '#22c55e' }} />
                  <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>Margen:</span>
                  <span className="text-xs font-light" style={{ color: '#22c55e' }}>
                    Gs. {fmt(form.precio_venta - form.precio_costo)} · {Math.round(((form.precio_venta - form.precio_costo) / form.precio_costo) * 100)}%
                  </span>
                </div>
              )}
            </div>

            {/* Footer modal */}
            <div className="flex items-center justify-end gap-2 px-6 py-4"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-light"
                style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                Cancelar
              </button>
              <button onClick={save} disabled={saving || !form.descripcion.trim() || !form.sucursal}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-medium"
                style={{
                  background: saveOk ? 'rgba(34,197,94,0.15)' : (!form.descripcion.trim() || !form.sucursal) ? 'rgba(197,160,89,0.06)' : 'rgba(197,160,89,0.15)',
                  border: saveOk ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(197,160,89,0.35)',
                  color: saveOk ? '#22c55e' : (!form.descripcion.trim() || !form.sucursal) ? 'rgba(197,160,89,0.35)' : '#C5A059',
                  cursor: (!form.descripcion.trim() || !form.sucursal) ? 'not-allowed' : 'pointer',
                }}>
                {saveOk ? <><Check size={12} />Guardado</> : saving ? 'Guardando...' : <><Package size={12} />{editing ? 'Guardar cambios' : 'Agregar armazón'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Confirm delete ─────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-[950] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.88)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: '#0d0d0d', border: '1px solid rgba(239,68,68,0.30)' }}>
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} style={{ color: '#ef4444' }} />
              <p className="text-sm font-light text-white">¿Eliminar este armazón?</p>
            </div>
            <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2 rounded-lg text-xs font-light"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.5)' }}>
                Cancelar
              </button>
              <button onClick={confirmDelete}
                className="flex-1 px-4 py-2 rounded-lg text-xs font-medium"
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
