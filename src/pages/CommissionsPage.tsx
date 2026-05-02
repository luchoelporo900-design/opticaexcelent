import { useEffect, useState } from 'react';
import { Trophy, Medal, Star, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSales } from '../lib/salesStorage';

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

type SellerSummary = {
  seller_name: string;
  branch_name: string;
  total_sales: number;
  full_sales: number;
  total_points: number;
  prize_level: 'oro' | 'bronce' | 'sin_nivel';
};

function calcLevel(points: number): 'oro' | 'bronce' | 'sin_nivel' {
  if (points >= 10) return 'oro';
  if (points >= 8) return 'bronce';
  return 'sin_nivel';
}

function prizeConfig(level: string) {
  switch (level) {
    case 'oro':
      return { label: 'Nivel Oro', color: '#C5A059', bg: 'rgba(197,160,89,0.12)', border: 'rgba(197,160,89,0.4)', icon: <Trophy size={16} /> };
    case 'bronce':
      return { label: 'Nivel Bronce', color: '#cd7f32', bg: 'rgba(205,127,50,0.12)', border: 'rgba(205,127,50,0.4)', icon: <Medal size={16} /> };
    default:
      return { label: 'Sin nivel', color: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)', icon: <Star size={16} /> };
  }
}

function formatMonth(m: string) {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1).toLocaleDateString('es-PY', { month: 'long', year: 'numeric' });
}

function buildSummaries(month: string): SellerSummary[] {
  const all = getSales().filter(v => (v.fecha || '').startsWith(month));
  const map: Record<string, SellerSummary> = {};
  for (const v of all) {
    const seller = v.vendedora || 'Sin vendedora';
    const branch = v.sucursalVenta || '';
    if (!map[seller]) map[seller] = { seller_name: seller, branch_name: branch, total_sales: 0, full_sales: 0, total_points: 0, prize_level: 'sin_nivel' };
    map[seller].total_sales++;
    map[seller].full_sales++;
    map[seller].total_points += 1;
  }
  for (const s of Object.values(map)) {
    s.prize_level = calcLevel(s.total_points);
  }
  return Object.values(map).sort((a, b) => b.total_points - a.total_points);
}

function getAvailableMonths(): string[] {
  const all = getSales();
  const months = new Set(all.map(v => (v.fecha || '').slice(0, 7)).filter(Boolean));
  if (!months.has(CURRENT_MONTH)) months.add(CURRENT_MONTH);
  return [...months].sort((a, b) => b.localeCompare(a));
}

export default function CommissionsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'gerente';

  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [months, setMonths] = useState<string[]>([CURRENT_MONTH]);
  const [summaries, setSummaries] = useState<SellerSummary[]>([]);
  const [mySummary, setMySummary] = useState<SellerSummary | null>(null);

  useEffect(() => {
    setMonths(getAvailableMonths());
    const all = buildSummaries(selectedMonth);
    setSummaries(all);
    if (profile) {
      const mine = all.find(s => s.seller_name === profile.full_name) ?? null;
      setMySummary(mine);
    }
  }, [selectedMonth, profile]);

  const myPoints = mySummary?.total_points ?? 0;
  const myLevel = mySummary?.prize_level ?? 'sin_nivel';
  const myPrize = prizeConfig(myLevel);
  const nextTarget = myPoints >= 10 ? 10 : 8;
  const prevTarget = myPoints >= 8 ? 8 : 0;
  const progressPct = Math.min(100, nextTarget > prevTarget ? ((myPoints - prevTarget) / (nextTarget - prevTarget)) * 100 : 100);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl text-white font-light tracking-wider">Comisiones y Premios</h1>
          <p className="text-sm font-light mt-1" style={{ color: 'rgba(197,160,89,0.7)' }}>Sistema de puntos y niveles mensuales</p>
        </div>
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
          className="px-4 py-2 rounded-lg text-xs font-light bg-transparent text-white outline-none border capitalize"
          style={{ borderColor: 'rgba(197,160,89,0.3)', background: '#111' }}>
          {months.map(m => <option key={m} value={m} style={{ background: '#111' }}>{formatMonth(m)}</option>)}
        </select>
      </div>

      {/* Reglas */}
      <div className="rounded-xl border p-4 grid grid-cols-1 sm:grid-cols-3 gap-4"
        style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(197,160,89,0.15)' }}>
        {[
          { icon: <Star size={14} />, label: 'Venta completa', sub: 'Armazón + Cristales', pts: '+1 punto', color: '#C5A059' },
          { icon: <Medal size={14} />, label: 'Nivel Bronce', sub: 'Desde 8 puntos', pts: 'Premio menor', color: '#cd7f32' },
          { icon: <Trophy size={14} />, label: 'Nivel Oro', sub: 'Desde 10 puntos', pts: 'Premio mayor', color: '#C5A059' },
        ].map(r => (
          <div key={r.label} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${r.color}18`, color: r.color }}>{r.icon}</div>
            <div>
              <p className="text-xs text-white font-light">{r.label}</p>
              <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>{r.sub}</p>
            </div>
            <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: `${r.color}18`, color: r.color }}>{r.pts}</span>
          </div>
        ))}
      </div>

      {/* Mi progreso — solo visible para vendedora */}
      {!isAdmin && (
        <div className="rounded-2xl border p-6"
          style={{ background: 'rgba(255,255,255,0.02)', borderColor: myPrize.border }}>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs font-light tracking-widest uppercase mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Mis puntos · {formatMonth(selectedMonth)}
              </p>
              <div className="flex items-center gap-3">
                <span className="text-5xl font-light text-white">{myPoints.toFixed(1)}</span>
                <span className="text-lg font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>pts</span>
              </div>
              {mySummary && (
                <p className="text-xs font-light mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {mySummary.full_sales} ventas completas · {mySummary.total_sales} total
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border"
              style={{ background: myPrize.bg, borderColor: myPrize.border, color: myPrize.color }}>
              {myPrize.icon}
              <span className="text-sm font-light tracking-wider">{myPrize.label}</span>
            </div>
          </div>
          <div className="mt-5 space-y-1.5">
            <div className="flex justify-between text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <span>{myPoints >= 10 ? 'Nivel Oro alcanzado' : `Faltan ${(nextTarget - myPoints).toFixed(1)} pts para ${nextTarget === 8 ? 'Bronce' : 'Oro'}`}</span>
              <span style={{ color: myPrize.color }}>{myPoints.toFixed(1)} / {nextTarget}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%`, background: myLevel === 'oro' ? 'linear-gradient(to right,#C5A059,#f0d080)' : 'linear-gradient(to right,#cd7f32,#e8a855)' }} />
            </div>
            <div className="flex justify-between text-xs font-light" style={{ color: 'rgba(255,255,255,0.2)' }}>
              <span>0</span>
              <span style={{ color: myPoints >= 8 ? '#cd7f32' : undefined }}>8 Bronce</span>
              <span style={{ color: myPoints >= 10 ? '#C5A059' : undefined }}>10 Oro</span>
            </div>
          </div>

          {/* Mis ventas del mes */}
          <div className="mt-6">
            <p className="text-xs font-light tracking-widest uppercase mb-3" style={{ color: 'rgba(197,160,89,0.55)' }}>Mis ventas del mes</p>
            {getSales().filter(v => (v.fecha || '').startsWith(selectedMonth) && v.vendedora === profile?.full_name).length === 0 ? (
              <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>No hay ventas registradas este mes</p>
            ) : (
              <div className="space-y-2">
                {getSales()
                  .filter(v => (v.fecha || '').startsWith(selectedMonth) && v.vendedora === profile?.full_name)
                  .map(v => (
                    <div key={v.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(197,160,89,0.1)' }}>
                      <div>
                        <span className="text-xs font-mono" style={{ color: '#C5A059' }}>VTA-{v.id}</span>
                        <span className="text-xs font-light ml-2 text-white">{v.cliente.nombre} {v.cliente.apellido}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {new Date(v.fecha).toLocaleDateString('es-PY')}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>+1 pt</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin: ranking completo */}
      {isAdmin && (
        <div className="rounded-xl border overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(197,160,89,0.15)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(197,160,89,0.1)' }}>
            <h2 className="text-white text-sm font-light tracking-wider flex items-center gap-2">
              <Users size={14} style={{ color: '#C5A059' }} />
              Reporte Mensual · {formatMonth(selectedMonth)}
            </h2>
            <span className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.5)' }}>
              {summaries.length} vendedora{summaries.length !== 1 ? 's' : ''}
            </span>
          </div>

          {summaries.length === 0 ? (
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
                  {['#', 'Vendedora', 'Sucursal', 'Ventas', 'Puntos', 'Premio'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-light tracking-wider uppercase"
                      style={{ color: 'rgba(197,160,89,0.6)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaries.map((s, i) => {
                  const cfg = prizeConfig(s.prize_level);
                  return (
                    <tr key={s.seller_name} className="border-b"
                      style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(197,160,89,0.03)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td className="px-4 py-3">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                          style={{ background: i === 0 ? 'rgba(197,160,89,0.2)' : 'rgba(255,255,255,0.06)', color: i === 0 ? '#C5A059' : 'rgba(255,255,255,0.4)' }}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white font-light">{s.seller_name}</td>
                      <td className="px-4 py-3 font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.branch_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium" style={{ color: '#10b981' }}>{s.total_sales}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium" style={{ color: cfg.color }}>{s.total_points.toFixed(1)}</span>
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

          {summaries.length > 0 && (
            <div className="px-5 py-3 border-t flex flex-wrap gap-4 text-xs font-light" style={{ borderColor: 'rgba(197,160,89,0.1)' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Total vendedoras: <span className="text-white">{summaries.length}</span></span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Nivel Oro: <span style={{ color: '#C5A059' }}>{summaries.filter(s => s.prize_level === 'oro').length}</span></span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Nivel Bronce: <span style={{ color: '#cd7f32' }}>{summaries.filter(s => s.prize_level === 'bronce').length}</span></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
