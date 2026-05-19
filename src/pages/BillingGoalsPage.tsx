import { useState, useEffect, useMemo } from 'react';
import {
  Target, ChevronLeft, ChevronRight, Edit3, Check, X,
  Plus, Trophy, Building2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { BillingGoal } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

const SUCURSALES = ['Pettirossi', 'Azara', 'Lambaré', 'Acceso Sur', 'Capiatá'];
const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

function fmtGs(n: number) {
  return '₲ ' + Math.round(n).toLocaleString('es-PY');
}

function fmtPct(p: number) {
  return Math.round(p) + '%';
}

function formatMonth(m: string) {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1)
    .toLocaleDateString('es-PY', { month: 'long', year: 'numeric' });
}

function shiftMonth(m: string, delta: number) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return d.toISOString().slice(0, 7);
}

type GoalRow = {
  seller_name:   string;
  branch_name:   string;
  goal_id:       string | null;
  goal_amount:   number;
  actual_amount: number;
};

export default function BillingGoalsPage() {
  const { profile } = useAuth();
  const { sales }   = useData();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'gerente';

  const [month,        setMonth]        = useState(CURRENT_MONTH);
  const [goals,        setGoals]        = useState<BillingGoal[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(false);

  // Edit-inline state
  const [editKey,    setEditKey]    = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);

  // New goal form state
  const [showNew,    setShowNew]    = useState(false);
  const [newSeller,  setNewSeller]  = useState('');
  const [newBranch,  setNewBranch]  = useState('');
  const [newAmount,  setNewAmount]  = useState('');

  async function loadGoals() {
    setLoadingGoals(true);
    const { data, error } = await supabase
      .from('billing_goals')
      .select('*')
      .eq('month', month)
      .order('seller_name');
    if (!error && data) setGoals(data as BillingGoal[]);
    setLoadingGoals(false);
  }

  useEffect(() => { loadGoals(); }, [month]);

  // Ventas del mes seleccionado
  const monthlySales = useMemo(
    () => sales.filter(s => (s.fecha || '').startsWith(month)),
    [sales, month],
  );

  // Totales reales por (vendedora, sucursalVenta)
  const actualMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of monthlySales) {
      const k = `${s.vendedora}|${s.sucursalVenta}`;
      map[k] = (map[k] || 0) + (s.total || 0);
    }
    return map;
  }, [monthlySales]);

  // Filas unificadas: goals + ventas sin meta
  const rows = useMemo((): GoalRow[] => {
    const map: Record<string, GoalRow> = {};

    for (const g of goals) {
      const k = `${g.seller_name}|${g.branch_name}`;
      map[k] = {
        seller_name:   g.seller_name,
        branch_name:   g.branch_name,
        goal_id:       g.id,
        goal_amount:   Number(g.goal_amount_gs),
        actual_amount: actualMap[k] || 0,
      };
    }

    for (const [k, actual] of Object.entries(actualMap)) {
      if (!map[k]) {
        const [seller_name, branch_name] = k.split('|');
        map[k] = { seller_name, branch_name, goal_id: null, goal_amount: 0, actual_amount: actual };
      }
    }

    return Object.values(map).sort((a, b) => b.actual_amount - a.actual_amount);
  }, [goals, actualMap]);

  // Resumen por sucursal
  const branchSummaries = useMemo(() => {
    const map: Record<string, { actual: number; goal: number }> = {};
    for (const r of rows) {
      if (!map[r.branch_name]) map[r.branch_name] = { actual: 0, goal: 0 };
      map[r.branch_name].actual += r.actual_amount;
      map[r.branch_name].goal   += r.goal_amount;
    }
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.actual - a.actual);
  }, [rows]);

  const totalActual  = rows.reduce((s, r) => s + r.actual_amount, 0);
  const totalGoal    = rows.filter(r => r.goal_amount > 0).reduce((s, r) => s + r.goal_amount, 0);
  const goalsHit     = rows.filter(r => r.goal_amount > 0 && r.actual_amount >= r.goal_amount).length;
  const globalPct    = totalGoal > 0 ? (totalActual / totalGoal) * 100 : 0;

  const allSellers = useMemo(
    () => [...new Set(monthlySales.map(s => s.vendedora).filter(Boolean))].sort(),
    [monthlySales],
  );

  async function saveGoal(sellerName: string, branchName: string, amount: number) {
    setSaving(true);
    setSaveError(null);
    const { error } = await supabase
      .from('billing_goals')
      .upsert(
        {
          seller_name:    sellerName,
          branch_name:    branchName,
          month,
          goal_amount_gs: amount,
          created_by:     profile?.full_name ?? null,
          updated_at:     new Date().toISOString(),
        },
        { onConflict: 'seller_name,branch_name,month' },
      );
    if (error) {
      setSaveError(error.message);
    } else {
      await loadGoals();
      setEditKey(null);
    }
    setSaving(false);
  }

  async function handleSaveNew() {
    const amount = Number(newAmount.replace(/[^\d]/g, ''));
    if (!newSeller.trim() || !newBranch || isNaN(amount) || amount <= 0) return;
    await saveGoal(newSeller.trim(), newBranch, amount);
    setShowNew(false);
    setNewSeller(''); setNewBranch(''); setNewAmount('');
  }

  function rowPct(r: GoalRow): number | null {
    return r.goal_amount > 0 ? (r.actual_amount / r.goal_amount) * 100 : null;
  }

  function progressColor(p: number | null): string {
    if (p === null) return '#3b82f6';
    if (p >= 100)  return '#10b981';
    if (p >= 75)   return '#C5A059';
    return '#3b82f6';
  }

  const rankColors = ['#C5A059', '#cd7f32', '#888'];

  return (
    <div className="p-4 lg:p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl text-white font-light tracking-wider">
            Metas de Facturación
          </h1>
          <p className="text-sm font-light mt-1" style={{ color: 'rgba(197,160,89,0.7)' }}>
            Seguimiento mensual por vendedora · Guaraníes
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setShowNew(v => !v); setSaveError(null); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium"
            style={{ background: 'rgba(197,160,89,0.1)', color: '#C5A059', border: '1px solid rgba(197,160,89,0.35)' }}>
            <Plus size={13} />Configurar meta
          </button>
        )}
      </div>

      {/* Selector de mes */}
      <div className="flex items-center gap-3">
        <button onClick={() => setMonth(m => shiftMonth(m, -1))}
          className="p-2 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
          <ChevronLeft size={15} />
        </button>
        <span className="text-white font-light text-sm capitalize text-center" style={{ minWidth: 160 }}>
          {formatMonth(month)}
        </span>
        <button onClick={() => setMonth(m => shiftMonth(m, +1))}
          className="p-2 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
          <ChevronRight size={15} />
        </button>
        {month !== CURRENT_MONTH && (
          <button onClick={() => setMonth(CURRENT_MONTH)}
            className="text-xs font-light px-3 py-1.5 rounded-lg"
            style={{ color: '#C5A059', border: '1px solid rgba(197,160,89,0.3)', background: 'rgba(197,160,89,0.06)' }}>
            Mes actual
          </button>
        )}
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Total Facturado',
            value: fmtGs(totalActual),
            sub:   `${rows.filter(r => r.actual_amount > 0).length} vendedoras`,
            color: '#C5A059',
          },
          {
            label: 'Total Metas',
            value: totalGoal > 0 ? fmtGs(totalGoal) : '—',
            sub:   `${goals.length} meta${goals.length !== 1 ? 's' : ''} configurada${goals.length !== 1 ? 's' : ''}`,
            color: 'rgba(255,255,255,0.55)',
          },
          {
            label: 'Metas alcanzadas',
            value: String(goalsHit),
            sub:   `de ${goals.length} vendedoras con meta`,
            color: '#10b981',
          },
          {
            label: 'Avance global',
            value: totalGoal > 0 ? fmtPct(globalPct) : '—',
            sub:   'del total de metas',
            color: globalPct >= 100 ? '#10b981' : '#C5A059',
          },
        ].map(c => (
          <div key={c.label} className="rounded-xl p-4"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(197,160,89,0.1)' }}>
            <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{c.label}</p>
            <p className="text-lg font-light" style={{ color: c.color }}>{c.value}</p>
            <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Formulario nueva meta */}
      {isAdmin && showNew && (
        <div className="rounded-xl p-4 space-y-4"
          style={{ background: 'rgba(197,160,89,0.03)', border: '1px solid rgba(197,160,89,0.25)' }}>
          <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.7)' }}>
            Nueva meta · {formatMonth(month)}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-light mb-1 block" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Vendedora *
              </label>
              <input
                list="sellers-datalist"
                value={newSeller}
                onChange={e => setNewSeller(e.target.value)}
                placeholder="Nombre completo"
                className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border"
                style={{ borderColor: 'rgba(197,160,89,0.3)' }}
              />
              <datalist id="sellers-datalist">
                {allSellers.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs font-light mb-1 block" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Sucursal *
              </label>
              <select
                value={newBranch}
                onChange={e => setNewBranch(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-white text-xs outline-none border"
                style={{ borderColor: 'rgba(197,160,89,0.3)', background: '#111' }}>
                <option value="" style={{ background: '#111' }}>Seleccionar…</option>
                {SUCURSALES.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-light mb-1 block" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Meta en Gs *
              </label>
              <input
                type="number"
                min="0"
                value={newAmount}
                onChange={e => setNewAmount(e.target.value)}
                placeholder="Ej: 80000000"
                className="w-full px-3 py-2.5 rounded-lg bg-transparent text-white text-xs outline-none border font-mono"
                style={{ borderColor: 'rgba(197,160,89,0.3)' }}
              />
            </div>
          </div>
          {saveError && (
            <p className="text-xs font-light" style={{ color: '#f87171' }}>Error: {saveError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSaveNew}
              disabled={saving || !newSeller.trim() || !newBranch || !newAmount}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium"
              style={{ background: 'rgba(197,160,89,0.15)', color: '#C5A059', border: '1px solid rgba(197,160,89,0.4)' }}>
              <Check size={12} />{saving ? 'Guardando…' : 'Guardar meta'}
            </button>
            <button
              onClick={() => { setShowNew(false); setSaveError(null); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-light"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <X size={12} />Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Ranking vendedoras ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={14} style={{ color: '#C5A059' }} />
          <h2 className="text-sm font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.8)' }}>
            Ranking Vendedoras
          </h2>
          {loadingGoals && (
            <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>Cargando…</span>
          )}
        </div>

        {rows.length === 0 && !loadingGoals ? (
          <div className="rounded-xl p-12 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.1)' }}>
            <Target size={28} className="mx-auto mb-3 opacity-20" style={{ color: '#C5A059' }} />
            <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>
              No hay ventas ni metas para {formatMonth(month)}
            </p>
            {isAdmin && (
              <button
                onClick={() => setShowNew(true)}
                className="mt-3 text-xs font-light px-4 py-2 rounded-lg"
                style={{ color: '#C5A059', border: '1px solid rgba(197,160,89,0.3)', background: 'rgba(197,160,89,0.06)' }}>
                Configurar primera meta
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row, idx) => {
              const p         = rowPct(row);
              const achieved  = p !== null && p >= 100;
              const key       = `${row.seller_name}|${row.branch_name}`;
              const isEditing = editKey === key;
              const remaining = row.goal_amount > 0 ? Math.max(0, row.goal_amount - row.actual_amount) : null;
              const rankColor = rankColors[idx] ?? 'rgba(255,255,255,0.3)';
              const barColor  = progressColor(p);

              return (
                <div key={key} className="rounded-xl overflow-hidden"
                  style={{
                    background:   'rgba(255,255,255,0.025)',
                    border:       `1px solid ${achieved ? 'rgba(16,185,129,0.3)' : 'rgba(197,160,89,0.1)'}`,
                    boxShadow:    achieved ? '0 0 16px rgba(16,185,129,0.05)' : 'none',
                  }}>

                  <div className="flex items-start gap-4 p-4">
                    {/* Posición */}
                    <div className="w-6 text-center text-lg font-light shrink-0 mt-0.5" style={{ color: rankColor }}>
                      {idx + 1}
                    </div>

                    {/* Info + barra */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-white font-light">{row.seller_name}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-light"
                          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)' }}>
                          {row.branch_name}
                        </span>
                        {achieved && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-light"
                            style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                            ✓ Meta alcanzada
                          </span>
                        )}
                        {!row.goal_amount && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-light"
                            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            Sin meta
                          </span>
                        )}
                      </div>

                      {/* Barra de progreso */}
                      {row.goal_amount > 0 && (
                        <div className="h-1.5 rounded-full overflow-hidden mb-2.5"
                          style={{ background: 'rgba(255,255,255,0.07)' }}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(p ?? 0, 100)}%`, background: barColor }}
                          />
                        </div>
                      )}

                      {/* Cifras */}
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-light">
                        <span>
                          <span style={{ color: 'rgba(255,255,255,0.35)' }}>Facturado </span>
                          <strong style={{ color: '#C5A059' }}>{fmtGs(row.actual_amount)}</strong>
                        </span>
                        {row.goal_amount > 0 && (
                          <>
                            <span>
                              <span style={{ color: 'rgba(255,255,255,0.35)' }}>Meta </span>
                              <strong style={{ color: 'rgba(255,255,255,0.6)' }}>{fmtGs(row.goal_amount)}</strong>
                            </span>
                            <span style={{ color: achieved ? '#10b981' : '#C5A059', fontWeight: 600 }}>
                              {fmtPct(p ?? 0)}
                            </span>
                            {remaining !== null && remaining > 0 && (
                              <span>
                                <span style={{ color: 'rgba(255,255,255,0.3)' }}>Falta </span>
                                <strong style={{ color: 'rgba(255,255,255,0.45)' }}>{fmtGs(remaining)}</strong>
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Botón editar (admin) */}
                    {isAdmin && !isEditing && (
                      <button
                        onClick={() => {
                          setEditKey(key);
                          setEditAmount(row.goal_amount > 0 ? String(row.goal_amount) : '');
                          setSaveError(null);
                        }}
                        className="shrink-0 p-1.5 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
                        <Edit3 size={12} />
                      </button>
                    )}
                  </div>

                  {/* Formulario edición inline */}
                  {isAdmin && isEditing && (
                    <div className="flex items-center gap-3 px-4 pb-4 pt-1 border-t flex-wrap"
                      style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      <label className="text-xs font-light shrink-0" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        Meta Gs
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editAmount}
                        onChange={e => setEditAmount(e.target.value)}
                        autoFocus
                        className="w-44 px-3 py-1.5 rounded-lg bg-transparent text-white text-xs outline-none border font-mono"
                        style={{ borderColor: 'rgba(197,160,89,0.4)' }}
                      />
                      <button
                        onClick={async () => {
                          const amt = Number(editAmount);
                          if (!isNaN(amt) && amt >= 0) await saveGoal(row.seller_name, row.branch_name, amt);
                        }}
                        disabled={saving}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: 'rgba(197,160,89,0.15)', color: '#C5A059', border: '1px solid rgba(197,160,89,0.4)' }}>
                        <Check size={11} />{saving ? '…' : 'Guardar'}
                      </button>
                      <button
                        onClick={() => { setEditKey(null); setSaveError(null); }}
                        className="p-1.5 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}>
                        <X size={11} />
                      </button>
                      {saveError && (
                        <p className="text-xs font-light" style={{ color: '#f87171' }}>{saveError}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Resumen por sucursal ───────────────────────────────────────────── */}
      {branchSummaries.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={14} style={{ color: '#C5A059' }} />
            <h2 className="text-sm font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.8)' }}>
              Resumen por Sucursal
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {branchSummaries.map(b => {
              const bPct      = b.goal > 0 ? (b.actual / b.goal) * 100 : null;
              const bAchieved = bPct !== null && bPct >= 100;
              return (
                <div key={b.name} className="rounded-xl p-4"
                  style={{
                    background:   'rgba(255,255,255,0.02)',
                    border:       `1px solid ${bAchieved ? 'rgba(16,185,129,0.25)' : 'rgba(197,160,89,0.1)'}`,
                  }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-light text-white">{b.name}</span>
                    {bPct !== null && (
                      <span className="text-xs font-light" style={{ color: bAchieved ? '#10b981' : '#C5A059' }}>
                        {fmtPct(bPct)}
                      </span>
                    )}
                  </div>
                  {b.goal > 0 && (
                    <div className="h-1 rounded-full overflow-hidden mb-2"
                      style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(bPct ?? 0, 100)}%`, background: bAchieved ? '#10b981' : '#C5A059' }} />
                    </div>
                  )}
                  <p className="text-sm font-light" style={{ color: '#C5A059' }}>{fmtGs(b.actual)}</p>
                  {b.goal > 0 && (
                    <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Meta: {fmtGs(b.goal)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
