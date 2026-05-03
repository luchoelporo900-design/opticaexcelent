import { useEffect, useState } from 'react';
import { Trophy, Medal, Star, Users, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSales, StoredSale } from '../lib/salesStorage';

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);
const TODAY = new Date().toISOString().slice(0, 10);

function calcPointsForSale(sale: StoredSale): number {
  const anteojos = (sale.anteojos as any[]) || [];
  if (anteojos.length === 0) return 1;
  let pts = 0;
  for (const eg of anteojos) {
    if (eg.saleType === 'completa') { pts += 1; continue; }
    if (eg.saleType === 'media')    { pts += 0.5; continue; }
    const hasFrame   = !!(eg.frame_description || eg.photo_url);
    const hasCrystal = !!(eg.crystals);
    if (hasFrame && hasCrystal) pts += 1;
    else if (hasFrame || hasCrystal) pts += 0.5;
    else pts += 1;
  }
  return pts;
}

function calcLevel(points: number): 'oro' | 'bronce' | 'sin_nivel' {
  if (points >= 10) return 'oro';
  if (points >= 8)  return 'bronce';
  return 'sin_nivel';
}

function prizeConfig(level: string) {
  switch (level) {
    case 'oro':    return { label: 'Nivel Oro',    color: '#C5A059', bg: 'rgba(197,160,89,0.12)', border: 'rgba(197,160,89,0.4)',  icon: <Trophy size={14} /> };
    case 'bronce': return { label: 'Nivel Bronce', color: '#cd7f32', bg: 'rgba(205,127,50,0.12)', border: 'rgba(205,127,50,0.4)',  icon: <Medal  size={14} /> };
    default:       return { label: 'Sin premio',   color: 'rgba(255,255,255,0.25)', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)', icon: <Star size={14} /> };
  }
}

function fmtDay(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-PY', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatMonth(m: string) {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1).toLocaleDateString('es-PY', { month: 'long', year: 'numeric' });
}

type DaySummary = {
  date: string;
  sales: StoredSale[];
  totalSales: number;
  totalPoints: number;
  level: 'oro' | 'bronce' | 'sin_nivel';
};

type SellerMonthSummary = {
  seller_name: string;
  branch_name: string;
  days_worked: number;
  days_bronce: number;
  days_oro: number;
  total_sales: number;
  best_day_points: number;
};

function buildDaySummaries(sellerName: string, month: string): DaySummary[] {
  const sales = getSales().filter(v =>
    v.vendedora === sellerName && (v.fecha || '').startsWith(month)
  );
  const byDay: Record<string, StoredSale[]> = {};
  for (const v of sales) {
    const day = (v.fecha || '').slice(0, 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(v);
  }
  return Object.entries(byDay).map(([date, daySales]) => {
    const totalPoints = daySales.reduce((s, v) => s + calcPointsForSale(v), 0);
    return { date, sales: daySales, totalSales: daySales.length, totalPoints, level: calcLevel(totalPoints) };
  }).sort((a, b) => b.date.localeCompare(a.date));
}

function buildAdminSummaries(month: string): SellerMonthSummary[] {
  const all = getSales().filter(v => (v.fecha || '').startsWith(month));
  const bySeller: Record<string, Record<string, StoredSale[]>> = {};
  for (const v of all) {
    const seller = v.vendedora || 'Sin vendedora';
    const day    = (v.fecha || '').slice(0, 10);
    if (!bySeller[seller]) bySeller[seller] = {};
    if (!bySeller[seller][day]) bySeller[seller][day] = [];
    bySeller[seller][day].push(v);
  }
  return Object.entries(bySeller).map(([seller, days]) => {
    let totalSales = 0, daysOro = 0, daysBronce = 0, bestDay = 0;
    const branch = Object.values(days).flat()[0]?.sucursalVenta ?? '';
    for (const daySales of Object.values(days)) {
      const dayPts = daySales.reduce((s, v) => s + calcPointsForSale(v), 0);
      const lvl    = calcLevel(dayPts);
      totalSales  += daySales.length;
      if (dayPts > bestDay) bestDay = dayPts;
      if (lvl === 'oro')    daysOro++;
      if (lvl === 'bronce') daysBronce++;
    }
    return { seller_name: seller, branch_name: branch, days_worked: Object.keys(days).length, days_bronce: daysBronce, days_oro: daysOro, total_sales: totalSales, best_day_points: bestDay };
  }).sort((a, b) => b.days_oro - a.days_oro || b.best_day_points - a.best_day_points);
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
  const [months,        setMonths]        = useState<string[]>([CURRENT_MONTH]);
  const [myDays,        setMyDays]        = useState<DaySummary[]>([]);
  const [adminData,     setAdminData]     = useState<SellerMonthSummary[]>([]);
  const [expandedDay,   setExpandedDay]   = useState<string | null>(TODAY);

  useEffect(() => {
    setMonths(getAvailableMonths());
    if (isAdmin) setAdminData(buildAdminSummaries(selectedMonth));
    else if (profile?.full_name) setMyDays(buildDaySummaries(profile.full_name, selectedMonth));
  }, [selectedMonth, profile, isAdmin]);

  const todayData  = myDays.find(d => d.date === TODAY);
  const todayPts   = todayData?.totalPoints ?? 0;
  const todayLvl   = todayData?.level ?? 'sin_nivel';
  const todayPrize = prizeConfig(todayLvl);
  const daysOroMonth    = myDays.filter(d => d.level === 'oro').length;
  const daysBronceMonth = myDays.filter(d => d.level === 'bronce').length;

  return (
    <div className="p-6 space-y-6">

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl text-white font-light tracking-wider">Comisiones y Premios</h1>
          <p className="text-sm font-light mt-1" style={{ color: 'rgba(197,160,89,0.7)' }}>
            Premios <strong style={{ color: '#C5A059' }}>por día</strong> — cada día es independiente
          </p>
        </div>
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
          className="px-4 py-2 rounded-lg text-xs font-light bg-transparent text-white outline-none border capitalize"
          style={{ borderColor: 'rgba(197,160,89,0.3)', background: '#111' }}>
          {months.map(m => <option key={m} value={m} style={{ background: '#111' }}>{formatMonth(m)}</option>)}
        </select>
      </div>

      {/* Reglas */}
      <div className="rounded-xl border p-4 grid grid-cols-2 lg:grid-cols-4 gap-3"
        style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(197,160,89,0.15)' }}>
        {[
          { icon: <Star size={13} />,   label: 'Venta completa', sub: 'Armazón + Cristales',           pts: '+1 pt',       color: '#10b981' },
          { icon: <Star size={13} />,   label: 'Venta parcial',  sub: 'Solo armazón o solo cristales',  pts: '+0.5 pt',     color: '#f59e0b' },
          { icon: <Medal size={13} />,  label: 'Nivel Bronce',   sub: '8 o más puntos en el día',       pts: 'Premio día',  color: '#cd7f32' },
          { icon: <Trophy size={13} />, label: 'Nivel Oro',      sub: '10 o más puntos en el día',      pts: 'Premio día',  color: '#C5A059' },
        ].map(r => (
          <div key={r.label} className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${r.color}18`, color: r.color }}>{r.icon}</div>
            <div className="min-w-0">
              <p className="text-xs text-white font-light leading-tight">{r.label}</p>
              <p className="text-xs font-light leading-tight" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{r.sub}</p>
            </div>
            <span className="ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: `${r.color}18`, color: r.color }}>{r.pts}</span>
          </div>
        ))}
      </div>

      {/* VENDEDORA */}
      {!isAdmin && (
        <div className="space-y-4">
          {/* Tarjetas resumen */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl p-4 col-span-2 lg:col-span-1"
              style={{ background: todayPrize.bg, border: `1px solid ${todayPrize.border}` }}>
              <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Puntos hoy</p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-light text-white">{todayPts.toFixed(1)}</span>
                <span className="text-sm font-light mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>pts</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5" style={{ color: todayPrize.color }}>
                {todayPrize.icon}
                <span className="text-xs font-light">{todayPrize.label}</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${Math.min(100, (todayPts / 10) * 100)}%`, background: todayLvl === 'oro' ? 'linear-gradient(to right,#C5A059,#f0d080)' : todayLvl === 'bronce' ? '#cd7f32' : 'rgba(197,160,89,0.4)' }} />
              </div>
              <p className="text-xs font-light mt-1" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
                {todayPts >= 10 ? '🏆 Oro alcanzado!' : todayPts >= 8 ? `🥉 Bronce — faltan ${(10 - todayPts).toFixed(1)} para Oro` : `Faltan ${Math.max(0, 8 - todayPts).toFixed(1)} pts para Bronce`}
              </p>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.15)' }}>
              <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Días trabajados</p>
              <p className="text-3xl font-light text-white">{myDays.length}</p>
              <p className="text-xs font-light mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>este mes</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.2)' }}>
              <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Días Oro 🏆</p>
              <p className="text-3xl font-light" style={{ color: '#C5A059' }}>{daysOroMonth}</p>
              <p className="text-xs font-light mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>10+ pts en el día</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'rgba(205,127,50,0.06)', border: '1px solid rgba(205,127,50,0.2)' }}>
              <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Días Bronce 🥉</p>
              <p className="text-3xl font-light" style={{ color: '#cd7f32' }}>{daysBronceMonth}</p>
              <p className="text-xs font-light mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>8-9 pts en el día</p>
            </div>
          </div>

          {/* Historial por día */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(197,160,89,0.15)' }}>
            <div className="px-5 py-3.5" style={{ borderBottom: '1px solid rgba(197,160,89,0.1)', background: 'rgba(197,160,89,0.04)' }}>
              <p className="text-sm font-light text-white">Mis días · {formatMonth(selectedMonth)}</p>
            </div>
            {myDays.length === 0 ? (
              <div className="text-center py-12">
                <Trophy size={28} className="mx-auto mb-3 opacity-20" style={{ color: '#C5A059' }} />
                <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>No hay ventas registradas este mes</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                {myDays.map(day => {
                  const cfg     = prizeConfig(day.level);
                  const isExp   = expandedDay === day.date;
                  const isToday = day.date === TODAY;
                  const pct     = Math.min(100, (day.totalPoints / 10) * 100);
                  return (
                    <div key={day.date}>
                      <div className="flex items-center gap-3 px-5 py-3.5 cursor-pointer"
                        style={{ background: isToday ? 'rgba(197,160,89,0.04)' : 'transparent' }}
                        onMouseEnter={e => { if (!isExp) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.015)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isToday ? 'rgba(197,160,89,0.04)' : 'transparent'; }}
                        onClick={() => setExpandedDay(isExp ? null : day.date)}>
                        <div className="w-32 shrink-0">
                          <p className="text-xs text-white font-light">{fmtDay(day.date)}</p>
                          {isToday && <span className="text-xs font-light" style={{ color: '#C5A059', fontSize: 10 }}>Hoy</span>}
                        </div>
                        <div className="flex-1">
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: day.level === 'oro' ? 'linear-gradient(to right,#C5A059,#f0d080)' : day.level === 'bronce' ? '#cd7f32' : 'rgba(197,160,89,0.3)' }} />
                          </div>
                          <p className="text-xs font-light mt-0.5" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
                            {day.totalSales} venta{day.totalSales !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <p className="text-sm font-medium w-16 text-right shrink-0" style={{ color: cfg.color }}>{day.totalPoints.toFixed(1)} pts</p>
                        {day.level !== 'sin_nivel' ? (
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full shrink-0"
                            style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                            {cfg.icon}
                            <span className="text-xs font-light">{day.level === 'oro' ? 'Oro' : 'Bronce'}</span>
                          </div>
                        ) : <div className="w-20 shrink-0" />}
                        <ChevronDown size={13} style={{ color: 'rgba(255,255,255,0.3)', transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                      </div>

                      {isExp && (
                        <div className="px-5 pb-4 space-y-1.5" style={{ background: 'rgba(197,160,89,0.02)', borderTop: '1px solid rgba(197,160,89,0.08)' }}>
                          <p className="text-xs font-light tracking-widest uppercase pt-3 mb-2" style={{ color: 'rgba(197,160,89,0.5)' }}>
                            Ventas del {fmtDay(day.date)}
                          </p>
                          {day.sales.map(v => {
                            const pts = calcPointsForSale(v);
                            const anteojos = (v.anteojos as any[]) || [];
                            const desc = anteojos.length > 0
                              ? anteojos.map((eg: any) => {
                                  const p = [];
                                  if (eg.frame_description) p.push(eg.frame_description);
                                  if (eg.crystals) p.push(eg.crystals);
                                  return p.join(' + ') || (eg.saleType === 'media' ? '½ venta' : '1 venta');
                                }).join(' | ')
                              : 'Sin detalle';
                            const ptColor = pts >= 1 ? '#10b981' : '#f59e0b';
                            return (
                              <div key={v.id} className="flex items-center justify-between py-2 px-3 rounded-lg"
                                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono" style={{ color: '#C5A059' }}>VTA-{v.id}</span>
                                    <span className="text-xs text-white font-light truncate">{v.cliente.nombre} {v.cliente.apellido}</span>
                                  </div>
                                  <p className="text-xs font-light mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{desc}</p>
                                </div>
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ml-2"
                                  style={{ background: `${ptColor}18`, color: ptColor }}>
                                  {pts >= 1 ? '+1 pt' : '+0.5 pt'}
                                </span>
                              </div>
                            );
                          })}
                          <div className="flex justify-between pt-2 text-xs font-light border-t" style={{ borderColor: 'rgba(197,160,89,0.1)' }}>
                            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Total del día</span>
                            <span style={{ color: cfg.color }}>
                              {day.totalPoints.toFixed(1)} pts → {day.level === 'sin_nivel' ? 'Sin premio' : day.level === 'bronce' ? '🥉 Nivel Bronce' : '🏆 Nivel Oro'}
                            </span>
                          </div>
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

      {/* ADMIN */}
      {isAdmin && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(197,160,89,0.15)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: 'rgba(197,160,89,0.1)', background: 'rgba(197,160,89,0.03)' }}>
            <h2 className="text-white text-sm font-light tracking-wider flex items-center gap-2">
              <Users size={14} style={{ color: '#C5A059' }} />
              Reporte · {formatMonth(selectedMonth)}
            </h2>
            <span className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.5)' }}>{adminData.length} vendedoras</span>
          </div>
          {adminData.length === 0 ? (
            <div className="p-12 text-center">
              <Trophy size={32} className="mx-auto mb-3 opacity-20" style={{ color: '#C5A059' }} />
              <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>No hay ventas en {formatMonth(selectedMonth)}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(197,160,89,0.1)' }}>
                      {['#','Vendedora','Sucursal','Días','Ventas','Días Oro 🏆','Días Bronce 🥉','Mejor día'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-light" style={{ color: 'rgba(197,160,89,0.6)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {adminData.map((s, i) => (
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
                        <td className="px-4 py-3 text-white">{s.days_worked}</td>
                        <td className="px-4 py-3 font-medium" style={{ color: '#10b981' }}>{s.total_sales}</td>
                        <td className="px-4 py-3">
                          {s.days_oro > 0
                            ? <span className="font-medium" style={{ color: '#C5A059' }}>{s.days_oro} {s.days_oro === 1 ? 'día' : 'días'}</span>
                            : <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {s.days_bronce > 0
                            ? <span className="font-medium" style={{ color: '#cd7f32' }}>{s.days_bronce} {s.days_bronce === 1 ? 'día' : 'días'}</span>
                            : <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium"
                            style={{ color: s.best_day_points >= 10 ? '#C5A059' : s.best_day_points >= 8 ? '#cd7f32' : 'rgba(255,255,255,0.5)' }}>
                            {s.best_day_points.toFixed(1)} pts
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t flex flex-wrap gap-4 text-xs font-light" style={{ borderColor: 'rgba(197,160,89,0.1)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Total vendedoras: <span className="text-white">{adminData.length}</span></span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Con días Oro: <span style={{ color: '#C5A059' }}>{adminData.filter(s => s.days_oro > 0).length}</span></span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Con días Bronce: <span style={{ color: '#cd7f32' }}>{adminData.filter(s => s.days_bronce > 0).length}</span></span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
