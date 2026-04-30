import { useEffect, useState } from 'react';
import { Trophy, Medal, Star, TrendingUp, Users, ChevronDown, Award } from 'lucide-react';
import { supabase, MonthlySummary } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

function prizeConfig(level: string) {
  switch (level) {
    case 'oro':
      return {
        label: 'Nivel Oro',
        color: '#C5A059',
        bg: 'rgba(197,160,89,0.12)',
        border: 'rgba(197,160,89,0.4)',
        icon: <Trophy size={16} />,
        glow: '0 0 20px rgba(197,160,89,0.3)',
      };
    case 'bronce':
      return {
        label: 'Nivel Bronce',
        color: '#cd7f32',
        bg: 'rgba(205,127,50,0.12)',
        border: 'rgba(205,127,50,0.4)',
        icon: <Medal size={16} />,
        glow: '0 0 16px rgba(205,127,50,0.25)',
      };
    default:
      return {
        label: 'Sin nivel',
        color: 'rgba(255,255,255,0.3)',
        bg: 'rgba(255,255,255,0.04)',
        border: 'rgba(255,255,255,0.1)',
        icon: <Star size={16} />,
        glow: 'none',
      };
  }
}

export default function CommissionsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'gerente';

  const [summaries, setSummaries] = useState<MonthlySummary[]>([]);
  const [mySummary, setMySummary] = useState<MonthlySummary | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [selectedMonth, profile]);

  async function loadData() {
    setLoading(true);

    // Load available months
    const { data: monthData } = await supabase
      .from('seller_points')
      .select('sale_month')
      .order('sale_month', { ascending: false });

    const uniqueMonths = [...new Set((monthData || []).map((r: any) => r.sale_month))];
    if (!uniqueMonths.includes(CURRENT_MONTH)) uniqueMonths.unshift(CURRENT_MONTH);
    setMonths(uniqueMonths);

    if (isAdmin) {
      // Admin sees all sellers for selected month
      const { data } = await supabase
        .from('monthly_seller_summary')
        .select('*')
        .eq('sale_month', selectedMonth)
        .order('total_points', { ascending: false });
      setSummaries((data || []) as MonthlySummary[]);
    }

    // Always load own summary
    if (profile) {
      const { data } = await supabase
        .from('monthly_seller_summary')
        .select('*')
        .eq('seller_id', profile.id)
        .eq('sale_month', selectedMonth)
        .maybeSingle();
      setMySummary(data as MonthlySummary | null);
    }

    setLoading(false);
  }

  const myPoints = mySummary?.total_points ?? 0;
  const myLevel = mySummary?.prize_level ?? 'sin_nivel';
  const myPrize = prizeConfig(myLevel);

  // Progress bar towards next target
  const nextTarget = myPoints >= 10 ? 10 : myPoints >= 8 ? 10 : 8;
  const prevTarget = myPoints >= 10 ? 8 : 0;
  const progressPct = Math.min(100, ((myPoints - prevTarget) / (nextTarget - prevTarget)) * 100);

  function formatMonth(m: string) {
    const [y, mo] = m.split('-');
    return new Date(Number(y), Number(mo) - 1).toLocaleDateString('es-PY', { month: 'long', year: 'numeric' });
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl text-white font-light tracking-wider">Comisiones y Premios</h1>
          <p className="text-sm font-light mt-1" style={{ color: 'rgba(197,160,89,0.7)' }}>
            Sistema de puntos y niveles mensuales
          </p>
        </div>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="px-4 py-2 rounded-lg text-xs font-light bg-transparent text-white outline-none border capitalize"
          style={{ borderColor: 'rgba(197,160,89,0.3)', background: '#111' }}>
          {months.map(m => (
            <option key={m} value={m} style={{ background: '#111' }}>{formatMonth(m)}</option>
          ))}
        </select>
      </div>

      {/* Rules banner */}
      <div className="rounded-xl border p-4 grid grid-cols-1 sm:grid-cols-3 gap-4"
        style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(197,160,89,0.15)' }}>
        {[
          { icon: <Star size={14} />, label: 'Venta completa', sub: 'Armazón + Cristales', pts: '+1 punto', color: '#C5A059' },
          { icon: <Medal size={14} />, label: 'Nivel Bronce', sub: 'Desde 8 puntos', pts: 'Premio menor', color: '#cd7f32' },
          { icon: <Trophy size={14} />, label: 'Nivel Oro', sub: 'Desde 10 puntos', pts: 'Premio mayor', color: '#C5A059' },
        ].map(r => (
          <div key={r.label} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${r.color}18`, color: r.color }}>
              {r.icon}
            </div>
            <div>
              <p className="text-xs text-white font-light">{r.label}</p>
              <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>{r.sub}</p>
            </div>
            <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: `${r.color}18`, color: r.color }}>{r.pts}</span>
          </div>
        ))}
      </div>

      {/* My progress card (visible to everyone) */}
      {!loading && (
        <div className="rounded-2xl border p-6 relative overflow-hidden transition-all"
          style={{
            background: myLevel !== 'sin_nivel' ? `linear-gradient(135deg, rgba(0,0,0,0.9), rgba(0,0,0,0.95))` : 'rgba(255,255,255,0.02)',
            borderColor: myPrize.border,
            boxShadow: myPrize.glow,
          }}>
          {/* background shimmer for prize levels */}
          {myLevel !== 'sin_nivel' && (
            <div className="absolute inset-0 opacity-5"
              style={{ background: `radial-gradient(ellipse at top right, ${myPrize.color}, transparent 60%)` }} />
          )}

          <div className="relative z-10">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs font-light tracking-widest uppercase mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {isAdmin ? 'Vista general · ' : 'Mis puntos · '}{formatMonth(selectedMonth)}
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-5xl font-light text-white">{myPoints.toFixed(1)}</span>
                  <span className="text-lg font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>pts</span>
                </div>
                {mySummary && (
                  <p className="text-xs font-light mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {mySummary.full_sales} ventas completas · {mySummary.partial_sales} parciales · {mySummary.total_sales} total
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 px-4 py-2 rounded-xl border"
                style={{ background: myPrize.bg, borderColor: myPrize.border, color: myPrize.color }}>
                {myPrize.icon}
                <span className="text-sm font-light tracking-wider">{myPrize.label}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-5 space-y-1.5">
              <div className="flex justify-between text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <span>{myPoints >= 10 ? 'Nivel Oro alcanzado' : `Faltan ${(nextTarget - myPoints).toFixed(1)} pts para ${nextTarget === 8 ? 'Bronce' : 'Oro'}`}</span>
                <span style={{ color: myPrize.color }}>{myPoints.toFixed(1)} / {nextTarget}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${progressPct}%`,
                    background: myLevel === 'oro'
                      ? 'linear-gradient(to right, #C5A059, #f0d080)'
                      : myLevel === 'bronce'
                        ? 'linear-gradient(to right, #cd7f32, #e8a855)'
                        : 'linear-gradient(to right, #C5A059, #8B6914)'
                  }} />
              </div>
              <div className="flex justify-between text-xs font-light" style={{ color: 'rgba(255,255,255,0.2)' }}>
                <span>0</span>
                <span style={{ color: myPoints >= 8 ? '#cd7f32' : undefined }}>8 Bronce</span>
                <span style={{ color: myPoints >= 10 ? '#C5A059' : undefined }}>10 Oro</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin: full ranking table */}
      {isAdmin && (
        <div className="rounded-xl border overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(197,160,89,0.15)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: 'rgba(197,160,89,0.1)' }}>
            <h2 className="text-white text-sm font-light tracking-wider flex items-center gap-2">
              <Users size={14} style={{ color: '#C5A059' }} />
              Reporte Mensual · {formatMonth(selectedMonth)}
            </h2>
            <span className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.5)' }}>
              {summaries.length} vendedora{summaries.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div className="p-8 space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
            </div>
          ) : summaries.length === 0 ? (
            <div className="p-12 text-center">
              <Trophy size={32} className="mx-auto mb-3 opacity-20" style={{ color: '#C5A059' }} />
              <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>
                No hay ventas registradas para {formatMonth(selectedMonth)}
              </p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(197,160,89,0.1)' }}>
                  {['#', 'Vendedora', 'Sucursal', 'Completas', 'Parciales', 'Puntos', 'Premio'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-light tracking-wider uppercase"
                      style={{ color: 'rgba(197,160,89,0.6)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaries.map((s, i) => {
                  const cfg = prizeConfig(s.prize_level);
                  return (
                    <tr key={s.seller_id + s.sale_month} className="border-b transition-colors"
                      style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(197,160,89,0.03)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td className="px-4 py-3">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                          style={{
                            background: i === 0 ? 'rgba(197,160,89,0.2)' : i === 1 ? 'rgba(205,127,50,0.15)' : 'rgba(255,255,255,0.06)',
                            color: i === 0 ? '#C5A059' : i === 1 ? '#cd7f32' : 'rgba(255,255,255,0.4)'
                          }}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white font-light">{s.seller_name}</td>
                      <td className="px-4 py-3 font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.branch_name || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium" style={{ color: '#10b981' }}>{s.full_sales}</span>
                        <span className="font-light ml-1" style={{ color: 'rgba(255,255,255,0.3)' }}>× 1pt</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium" style={{ color: '#f59e0b' }}>{s.partial_sales}</span>
                        <span className="font-light ml-1" style={{ color: 'rgba(255,255,255,0.3)' }}>× 0.5pt</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium" style={{ color: cfg.color }}>
                          {Number(s.total_points).toFixed(1)}
                        </span>
                        <span className="font-light ml-1" style={{ color: 'rgba(255,255,255,0.3)' }}>pts</span>
                      </td>
                      <td className="px-4 py-3">
                        {s.prize_level !== 'sin_nivel' ? (
                          <span className="flex items-center gap-1 w-fit px-2 py-1 rounded-full text-xs font-light"
                            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                            {cfg.icon}{cfg.label}
                          </span>
                        ) : (
                          <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Summary totals */}
          {summaries.length > 0 && (
            <div className="px-5 py-3 border-t flex flex-wrap gap-4 text-xs font-light"
              style={{ borderColor: 'rgba(197,160,89,0.1)' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                Total vendedoras: <span className="text-white">{summaries.length}</span>
              </span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                Nivel Oro: <span style={{ color: '#C5A059' }}>{summaries.filter(s => s.prize_level === 'oro').length}</span>
              </span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                Nivel Bronce: <span style={{ color: '#cd7f32' }}>{summaries.filter(s => s.prize_level === 'bronce').length}</span>
              </span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                Puntos totales del mes: <span className="text-white">
                  {summaries.reduce((a, s) => a + Number(s.total_points), 0).toFixed(1)}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Non-admin: own point history */}
      {!isAdmin && <SellerPointHistory />}
    </div>
  );
}

function SellerPointHistory() {
  const { profile } = useAuth();
  const [points, setPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('seller_points')
      .select('*, sales(sale_number, customers(full_name))')
      .eq('seller_id', profile.id)
      .eq('sale_month', CURRENT_MONTH)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setPoints(data || []); setLoading(false); });
  }, [profile]);

  if (loading) return null;

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(197,160,89,0.15)' }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(197,160,89,0.1)' }}>
        <h2 className="text-white text-sm font-light tracking-wider">Mis ventas del mes</h2>
      </div>
      {points.length === 0 ? (
        <div className="p-8 text-center text-sm font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>
          No hay puntos registrados este mes
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(197,160,89,0.1)' }}>
              {['Venta', 'Cliente', 'Tipo', 'Puntos', 'Fecha'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-light tracking-wider uppercase"
                  style={{ color: 'rgba(197,160,89,0.6)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((p: any) => (
              <tr key={p.id} className="border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                <td className="px-4 py-3 font-mono" style={{ color: '#C5A059' }}>{p.sales?.sale_number}</td>
                <td className="px-4 py-3 text-white font-light">{p.sales?.customers?.full_name}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full font-light"
                    style={{
                      background: p.point_type === 'completa' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                      color: p.point_type === 'completa' ? '#10b981' : '#f59e0b'
                    }}>
                    {p.point_type === 'completa' ? 'Completa' : p.point_type === 'solo_armazon' ? 'Solo armazón' : 'Solo cristales'}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium" style={{ color: '#C5A059' }}>+{p.points}</td>
                <td className="px-4 py-3 font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {new Date(p.created_at).toLocaleDateString('es-PY')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
