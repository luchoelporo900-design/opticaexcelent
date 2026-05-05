import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Package, Plus, Search, RefreshCw, Edit2, Trash2, X, Check,
  ChevronDown, Eye, EyeOff, AlertTriangle, Glasses, DollarSign,
  BarChart2, Camera,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { compressImage } from '../lib/salesStorage';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Frame = {
  id: string;
  codigo: string;
  nombre: string;
  foto_url: string;
  precio: number;
  stock_azara: number;
  stock_fernando: number;
  stock_caacupe: number;
  stock_la_fina: number;
  created_at: string;
  updated_at: string;
};

type FormData = {
  codigo: string;
  nombre: string;
  foto_url: string;
  precio: number;
  stock_azara: number;
  stock_fernando: number;
  stock_caacupe: number;
  stock_la_fina: number;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const SEDES = [
  { key: 'stock_azara',    label: 'Azara',    color: '#22c55e' },
  { key: 'stock_fernando', label: 'Fernando', color: '#3b82f6' },
  { key: 'stock_caacupe',  label: 'Caacupé',  color: '#C5A059' },
  { key: 'stock_la_fina',  label: 'La Fina',  color: '#a78bfa' },
];

function fmt(n: number) {
  return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function emptyForm(): FormData {
  return {
    codigo: '', nombre: '', foto_url: '', precio: 0,
    stock_azara: 0, stock_fernando: 0, stock_caacupe: 0, stock_la_fina: 0,
  };
}

function totalStock(f: Frame | FormData) {
  return (f.stock_azara || 0) + (f.stock_fernando || 0) + (f.stock_caacupe || 0) + (f.stock_la_fina || 0);
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function StockPage() {
  const { profile } = useAuth();

  const isAdmin     = profile?.role === 'admin' || profile?.role === 'gerente';
  const isVendedora = profile?.role === 'vendedora';

  // Detectar sede de la vendedora
  const vendedoraSede = (() => {
    const b = (profile?.branch_id || '').toLowerCase()
      .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
      .replace(/ /g,'_');
    if (b.includes('azara'))    return 'stock_azara';
    if (b.includes('fernando')) return 'stock_fernando';
    if (b.includes('caacupe') || b.includes('caacupé')) return 'stock_caacupe';
    if (b.includes('fina'))     return 'stock_la_fina';
    return 'stock_azara';
  })();

  const [frames, setFrames]     = useState<Frame[]>([]);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState('');
  const [sortBy, setSortBy]     = useState<'nombre' | 'precio' | 'stock'>('nombre');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Frame | null>(null);
  const [form, setForm]           = useState<FormData>(emptyForm());
  const [saving, setSaving]       = useState(false);
  const [saveOk, setSaveOk]       = useState(false);
  const photoRef = useRef<HTMLInputElement | null>(null);

  // Modal rápido vendedora
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [quickFrame, setQuickFrame]         = useState<Frame | null>(null);
  const [quickCodigo, setQuickCodigo]       = useState('');
  const [quickFoto, setQuickFoto]           = useState('');
  const [quickSaving, setQuickSaving]       = useState(false);
  const [quickOk, setQuickOk]               = useState(false);
  const quickPhotoRef = useRef<HTMLInputElement | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId]     = useState<string | null>(null);

  // ─── Carga ────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('armazones')
      .select('*')
      .order('nombre', { ascending: true });
    if (!error && data) setFrames(data as Frame[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Filtros ──────────────────────────────────────────────────────────────

  const visible = frames.filter(f => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      f.nombre.toLowerCase().includes(q) ||
      f.codigo.toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    if (sortBy === 'precio') return b.precio - a.precio;
    if (sortBy === 'stock')  return totalStock(b) - totalStock(a);
    return a.nombre.localeCompare(b.nombre);
  });

  // ─── Stats ────────────────────────────────────────────────────────────────

  const totalModelos = frames.length;
  const totalUnidades = frames.reduce((s, f) => s + totalStock(f), 0);
  const totalValor    = frames.reduce((s, f) => s + totalStock(f) * f.precio, 0);

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  function openNew() {
    setEditing(null);
    setForm(emptyForm());
    setShowModal(true);
  }

  function openEdit(f: Frame) {
    setEditing(f);
    setForm({
      codigo: f.codigo, nombre: f.nombre, foto_url: f.foto_url || '', precio: f.precio,
      stock_azara: f.stock_azara, stock_fernando: f.stock_fernando,
      stock_caacupe: f.stock_caacupe, stock_la_fina: f.stock_la_fina,
    });
    setShowModal(true);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const compressed = await compressImage(ev.target?.result as string);
      setForm(p => ({ ...p, foto_url: compressed }));
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    if (!form.nombre.trim() || !form.codigo.trim()) return;
    setSaving(true);
    if (editing) {
      await supabase.from('armazones').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id);
    } else {
      await supabase.from('armazones').insert([{ ...form, id: crypto.randomUUID() }]);
    }
    await load();
    setSaving(false);
    setSaveOk(true);
    setTimeout(() => { setSaveOk(false); setShowModal(false); }, 1200);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await supabase.from('armazones').delete().eq('id', deleteId);
    setDeleteId(null);
    await load();
  }

  async function adjustStock(id: string, sede: string, delta: number) {
    const f = frames.find(x => x.id === id);
    if (!f) return;
    const current = (f as any)[sede] || 0;
    const newVal  = Math.max(0, current + delta);
    await supabase.from('armazones').update({ [sede]: newVal, updated_at: new Date().toISOString() }).eq('id', id);
    setFrames(prev => prev.map(x => x.id === id ? { ...x, [sede]: newVal } : x));
  }

  // ─── Quick edit vendedora ─────────────────────────────────────────────────

  function openQuick(f: Frame) {
    setQuickFrame(f);
    setQuickCodigo(f.codigo);
    setQuickFoto(f.foto_url || '');
    setShowQuickModal(true);
  }

  async function handleQuickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const compressed = await compressImage(ev.target?.result as string);
      setQuickFoto(compressed);
    };
    reader.readAsDataURL(file);
  }

  async function saveQuick() {
    if (!quickFrame) return;
    setQuickSaving(true);
    await supabase.from('armazones')
      .update({ codigo: quickCodigo, foto_url: quickFoto, updated_at: new Date().toISOString() })
      .eq('id', quickFrame.id);
    await load();
    setQuickSaving(false);
    setQuickOk(true);
    setTimeout(() => { setQuickOk(false); setShowQuickModal(false); }, 1200);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-light tracking-wider text-white flex items-center gap-2">
            <Glasses size={18} style={{ color: '#C5A059' }} />
            Stock de Armazones
          </h1>
          <p className="text-xs mt-0.5 tracking-wide" style={{ color: 'rgba(197,160,89,0.65)' }}>
            Inventario de monturas por sede
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Modelos',   value: totalModelos,  unit: 'modelos',  color: '#C5A059', icon: <Package size={14} /> },
          { label: 'Unidades',  value: totalUnidades, unit: 'unidades', color: '#22c55e', icon: <BarChart2 size={14} /> },
          { label: 'Valor',     value: totalValor,    unit: 'Gs.',      color: '#3b82f6', icon: <DollarSign size={14} />, money: true },
        ].map(item => (
          <div key={item.label} className="rounded-xl p-4"
            style={{ background: `${item.color}08`, border: `1px solid ${item.color}28` }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.44)' }}>{item.label}</span>
              <span style={{ color: item.color, opacity: 0.7 }}>{item.icon}</span>
            </div>
            <p className="text-xl font-light" style={{ color: item.color }}>
              {(item as any).money ? fmt(item.value) : item.value}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.22)' }}>{item.unit}</p>
          </div>
        ))}
      </div>

      {/* Stock por sede */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {SEDES.map(s => {
          const total = frames.reduce((sum, f) => sum + ((f as any)[s.key] || 0), 0);
          return (
            <div key={s.key} className="rounded-xl p-3"
              style={{ background: `${s.color}08`, border: `1px solid ${s.color}22` }}>
              <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</p>
              <p className="text-lg font-light" style={{ color: s.color }}>{total}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>unidades</p>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-40"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)' }}>
          <Search size={13} style={{ color: 'rgba(255,255,255,0.35)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar nombre o código..."
            className="bg-transparent text-xs text-white outline-none flex-1" />
          {search && <button onClick={() => setSearch('')}><X size={11} style={{ color: 'rgba(255,255,255,0.3)' }} /></button>}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
          className="px-3 py-2 rounded-lg text-xs outline-none border"
          style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.5)' }}>
          <option value="nombre" style={{ background: '#111' }}>A-Z</option>
          <option value="precio" style={{ background: '#111' }}>Precio ↓</option>
          <option value="stock"  style={{ background: '#111' }}>Stock ↓</option>
        </select>
      </div>

      <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>
        {visible.length} resultado{visible.length !== 1 ? 's' : ''}
      </p>

      {/* Lista de armazones */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>

        {/* Header tabla */}
        <div className="hidden lg:grid px-5 py-3 text-xs font-light"
          style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 40px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.32)' }}>
          <span>Nombre / Código</span>
          <span>Precio</span>
          <span>Stock total</span>
          <span>Por sede</span>
          <span></span>
        </div>

        {visible.length === 0 ? (
          <div className="text-center py-14">
            <Package size={28} style={{ color: 'rgba(255,255,255,0.08)', margin: '0 auto 10px' }} />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Sin armazones para mostrar</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {visible.map((f, i) => {
              const isExp   = expandedId === f.id;
              const total   = totalStock(f);

              return (
                <div key={f.id}>
                  {/* Fila */}
                  <div className="flex lg:grid items-center gap-3 px-4 py-3 cursor-pointer"
                    style={{
                      gridTemplateColumns: '2fr 1fr 1fr 1fr 40px',
                      background: isExp ? 'rgba(197,160,89,0.03)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    }}
                    onClick={() => setExpandedId(isExp ? null : f.id)}>

                    {/* Foto + nombre */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {f.foto_url ? (
                        <img src={f.foto_url} alt={f.nombre} className="w-9 h-9 rounded-lg object-cover shrink-0" style={{ border: '1px solid rgba(197,160,89,0.2)' }} />
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

                    {/* Precio — oculto en móvil */}
                    <p className="hidden lg:block text-xs font-light" style={{ color: '#C5A059' }}>
                      Gs. {fmt(f.precio)}
                    </p>

                    {/* Stock total */}
                    <div className="hidden lg:flex items-center gap-1.5">
                      <span className="text-sm font-light text-white">{total}</span>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>uds.</span>
                    </div>

                    {/* Badges por sede — oculto en móvil */}
                    <div className="hidden lg:flex items-center gap-1 flex-wrap">
                      {SEDES.map(s => {
                        const qty = (f as any)[s.key] || 0;
                        return (
                          <span key={s.key} className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: qty > 0 ? `${s.color}18` : 'rgba(255,255,255,0.04)', color: qty > 0 ? s.color : 'rgba(255,255,255,0.2)' }}>
                            {s.label.slice(0,3)}: {qty}
                          </span>
                        );
                      })}
                    </div>

                    {/* Chevron */}
                    <ChevronDown size={13} style={{ color: 'rgba(255,255,255,0.3)', transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                  </div>

                  {/* Expandido */}
                  {isExp && (
                    <div className="px-4 pb-4 pt-3 space-y-4" style={{ background: 'rgba(197,160,89,0.02)', borderTop: '1px solid rgba(197,160,89,0.08)' }}>

                      {/* Info básica */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Precio</p>
                          <p className="text-sm font-light" style={{ color: '#C5A059' }}>Gs. {fmt(f.precio)}</p>
                        </div>
                        <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Stock total</p>
                          <p className="text-sm font-light text-white">{totalStock(f)} unidades</p>
                        </div>
                      </div>

                      {/* Stock por sede con ajuste */}
                      <div>
                        <p className="text-xs font-light mb-2 tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.55)' }}>Stock por sede</p>
                        <div className="grid grid-cols-2 gap-2">
                          {SEDES.map(s => {
                            const qty = (f as any)[s.key] || 0;
                            // Vendedora solo ve su sede
                            if (isVendedora && s.key !== vendedoraSede) return null;
                            return (
                              <div key={s.key} className="flex items-center justify-between px-3 py-2 rounded-lg"
                                style={{ background: `${s.color}08`, border: `1px solid ${s.color}22` }}>
                                <span className="text-xs font-light" style={{ color: s.color }}>{s.label}</span>
                                <div className="flex items-center gap-1.5">
                                  <button onClick={() => adjustStock(f.id, s.key, -1)}
                                    className="w-6 h-6 rounded flex items-center justify-center text-sm"
                                    style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>−</button>
                                  <span className="text-sm font-light text-white w-5 text-center">{qty}</span>
                                  <button onClick={() => adjustStock(f.id, s.key, +1)}
                                    className="w-6 h-6 rounded flex items-center justify-center text-sm"
                                    style={{ background: 'rgba(34,197,94,0.10)', color: '#22c55e' }}>+</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        {isVendedora && (
                          <button onClick={() => openQuick(f)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-light"
                            style={{ background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.25)', color: '#C5A059' }}>
                            <Camera size={11} />Código / Foto
                          </button>
                        )}
                        {isAdmin && (
                          <>
                            <button onClick={() => openEdit(f)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-light"
                              style={{ background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.25)', color: '#C5A059' }}>
                              <Edit2 size={11} />Editar
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

      {/* ─── Modal agregar/editar (admin) ───────────────────────────────── */}
      {showModal && (
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
                    <img src={form.foto_url} alt="armazón" className="h-28 rounded-xl object-cover border" style={{ borderColor: 'rgba(197,160,89,0.25)' }} />
                    <button onClick={() => setForm(p => ({ ...p, foto_url: '' }))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#ef4444' }}><X size={10} color="#fff" /></button>
                  </div>
                ) : (
                  <button onClick={() => photoRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-light border" style={{ borderColor: 'rgba(197,160,89,0.22)', color: 'rgba(197,160,89,0.7)', background: 'rgba(197,160,89,0.04)' }}>
                    <Camera size={14} />Tomar foto o elegir de galería
                  </button>
                )}
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </div>

              {/* Nombre y Código */}
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
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>Cancelar</button>
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

      {/* ─── Modal rápido vendedora ──────────────────────────────────────── */}
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
                    <img src={quickFoto} alt="armazón" className="h-32 rounded-xl object-cover border w-full" style={{ borderColor: 'rgba(197,160,89,0.25)' }} />
                    <button onClick={() => setQuickFoto('')} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#ef4444' }}><X size={10} color="#fff" /></button>
                  </div>
                ) : (
                  <button onClick={() => quickPhotoRef.current?.click()} className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border" style={{ borderColor: 'rgba(197,160,89,0.22)', borderStyle: 'dashed', color: 'rgba(197,160,89,0.7)', background: 'rgba(197,160,89,0.04)' }}>
                    <Camera size={18} /><span className="text-sm font-light">Tomar foto o elegir de galería</span>
                  </button>
                )}
                <input ref={quickPhotoRef} type="file" accept="image/*" className="hidden" onChange={handleQuickPhoto} />
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={() => setShowQuickModal(false)} className="flex-1 px-4 py-2.5 rounded-lg text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>Cancelar</button>
              <button onClick={saveQuick} disabled={quickSaving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium"
                style={{ background: quickOk ? 'rgba(34,197,94,0.15)' : 'rgba(197,160,89,0.15)', border: quickOk ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(197,160,89,0.35)', color: quickOk ? '#22c55e' : '#C5A059' }}>
                {quickOk ? <><Check size={12} />Guardado</> : quickSaving ? 'Guardando...' : <><Check size={12} />Guardar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Confirm delete ──────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-[950] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.88)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: '#0d0d0d', border: '1px solid rgba(239,68,68,0.30)' }}>
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} style={{ color: '#ef4444' }} />
              <p className="text-sm font-light text-white">¿Eliminar este armazón?</p>
            </div>
            <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.45)' }}>Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 rounded-lg text-xs font-light" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.5)' }}>Cancelar</button>
              <button onClick={confirmDelete} className="flex-1 px-4 py-2 rounded-lg text-xs font-medium" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
