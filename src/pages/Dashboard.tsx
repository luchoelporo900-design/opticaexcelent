import { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp, ShoppingCart, Users, FlaskConical, Clock, CheckCircle,
  AlertCircle, Building2, Trophy, Medal, X, DollarSign, MessageCircle,
  Plus, Minus, Banknote, CreditCard, ChevronDown, Calendar,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);
const SUCURSALES    = ['Azara', 'Fernando', 'Caacupé', 'La Fina'];

type Stats = {
  totalSales: number; totalCustomers: number; pendingLab: number;
  readyLab: number; todaySales: number; monthlySales: number;
};
type BranchStat = { name: string; count: number; total: number };

// ── Helpers de período ────────────────────────────────────────────────────────
function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
function getWeekRange(dateStr: string): { start: string; end: string } {
  const d   = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d); monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return { start: monday.toISOString().slice(0,10), end: sunday.toISOString().slice(0,10) };
}
function matchesPeriod(fecha: string, scope: string, ref: string): boolean {
  const d = (fecha || '').slice(0, 10);
  if (scope === 'day')   return d === ref;
  if (scope === 'week')  { const { start, end } = getWeekRange(ref); return d >= start && d <= end; }
  if (scope === 'month') return d.startsWith(ref.slice(0, 7));
  if (scope === 'year')  return d.startsWith(ref.slice(0, 4));
  return true;
}
function periodLabel(scope: string, ref: string): string {
  if (scope === 'day') return new Date(ref + 'T12:00:00').toLocaleDateString('es-PY', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  if (scope === 'week') {
    const { start, end } = getWeekRange(ref);
    return `Semana ${new Date(start+'T12:00:00').toLocaleDateString('es-PY',{day:'2-digit',month:'2-digit'})} – ${new Date(end+'T12:00:00').toLocaleDateString('es-PY',{day:'2-digit',month:'2-digit',year:'2-digit'})}`;
  }
  if (scope === 'month') return new Date(ref.slice(0,7)+'-01T12:00:00').toLocaleDateString('es-PY',{month:'long',year:'numeric'});
  if (scope === 'year')  return `Año ${ref.slice(0,4)}`;
  return '';
}
function fmt(n: number) { return n.toLocaleString('es-PY', { minimumFractionDigits:0, maximumFractionDigits:0 }); }

export default function Dashboard() {
  const { profile } = useAuth();
  const { sales: allSalesData, payments: allPaymentsData } = useData();

  const [stats,          setStats]          = useState<Stats>({ totalSales:0, totalCustomers:0, pendingLab:0, readyLab:0, todaySales:0, monthlySales:0 });
  const [branchStats,    setBranchStats]    = useState<BranchStat[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [todayCash,      setTodayCash]      = useState(0);
  const [myPoints,       setMyPoints]       = useState(0);
  const [prizeLevel,     setPrizeLevel]     = useState<'sin_nivel'|'bronce'|'oro'>('sin_nivel');
  const [dismissedLevel, setDismissedLevel] = useState<string|null>(() => sessionStorage.getItem('dismissedPrize'));
  const [selectedBranch, setSelectedBranch] = useState('');
  const [branchDropdown, setBranchDropdown] = useState(false);
  const [cashModal,  setCashModal]  = useState<'ingreso'|'gasto'|null>(null);
  const [cashDesc,   setCashDesc]   = useState('');
  const [cashAmt,    setCashAmt]    = useState('');
  const [cashMethod, setCashMethod] = useState<'efectivo'|'transferencia'|'tarjeta'>('efectivo');
  const [savingCash, setSavingCash] = useState(false);
  const [cashMsg,    setCashMsg]    = useState('');

  // ── Selector de período ───────────────────────────────────────────────────
  const today = getToday();
  const [scope,     setScope]     = useState<'day'|'week'|'month'|'year'>('month');
  const [periodRef, setPeriodRef] = useState(today);

  // Cuando cambia el scope, actualizar ref al período actual
  useEffect(() => {
    if (scope === 'day')   setPeriodRef(today);
    if (scope === 'week')  setPeriodRef(today);
    if (scope === 'month') setPeriodRef(today);
    if (scope === 'year')  setPeriodRef(today);
  }, [scope]);

  function branchMatch(val: string) {
    if (!selectedBranch) return true;
    return (val||'').toLowerCase().includes(selectedBranch.toLowerCase());
  }

  useEffect(() => {
    const isVend = profile?.role === 'vendedora';

    let ventas = isVend ? allSalesData.filter(v => v.vendedora===profile?.full_name) : allSalesData;
    if (selectedBranch) ventas = ventas.filter(v => branchMatch(v.sucursalVenta||''));

    // Ventas del período seleccionado
    const periodSales  = ventas.filter(v => matchesPeriod(v.fecha, scope, periodRef));
    // Ventas de hoy siempre para cobrado hoy
    const todaySalesData = ventas.filter(v => (v.fecha||'').startsWith(today));

    // Cobrado hoy (siempre del día actual, no del período)
    const todayPays = allPaymentsData.filter(p => {
      if (!(p.fecha||'').startsWith(today)) return false;
      if (isVend && p.vendedora !== profile?.full_name) return false;
      if (selectedBranch && !branchMatch(p.sucursal||'')) return false;
      return true;
    });
    const fromPays    = todayPays.reduce((a,p) => a+(Number(p.monto)||0), 0);
    const recordedIds = new Set(todayPays.map(p => p.saleId));
    const fallback    = todaySalesData.filter(v => !recordedIds.has(v.id)).reduce((a,v) => a+Math.max(0,(Number(v.total)||0)-(Number(v.saldo)||0)), 0);
    setTodayCash(fromPays + fallback);

    // Stats por sucursal del período
    const bMap: Record<string,BranchStat> = {};
    periodSales.forEach(v => {
      const bn = v.sucursalVenta||'N/A';
      if (!bMap[bn]) bMap[bn] = { name:bn, count:0, total:0 };
      bMap[bn].count++;
      bMap[bn].total += Number(v.total)||0;
    });
    setBranchStats(Object.values(bMap).sort((a,b) => b.count-a.count));

    setStats({
      totalSales:    ventas.length,
      totalCustomers: isVend ? ventas.length : 0,
      pendingLab:    0,
      readyLab:      0,
      todaySales:    todaySalesData.length,
      monthlySales:  periodSales.reduce((a,v)=>a+(Number(v.total)||0),0),
    });

    if (!isVend) supabase.from('customers').select('id',{count:'exact',head:true}).then(({count})=>setStats(s=>({...s,totalCustomers:count||0})));
    setLoading(false);
  }, [allSalesData, allPaymentsData, selectedBranch, profile, scope, periodRef]);

  useEffect(() => {
    if (!profile) return;
    supabase.from('monthly_seller_summary').select('total_points,prize_level').eq('seller_id',profile.id).eq('sale_month',CURRENT_MONTH).maybeSingle()
      .then(({data}) => { if (data) { setMyPoints(Number(data.total_points)); setPrizeLevel(data.prize_level as any); } });
  }, [profile]);

  // Ventas filtradas por período para la tabla
  const ventasFilt = useMemo(() => {
    let v = selectedBranch ? allSalesData.filter(x => branchMatch(x.sucursalVenta||'')) : allSalesData;
    return v.filter(x => matchesPeriod(x.fecha, scope, periodRef));
  }, [allSalesData, selectedBranch, scope, periodRef]);

  const recentSales  = ventasFilt.slice(0, 8).map(v => ({
    id: String(v.id), sale_number: `VTA-${v.id}`, total: v.total,
    status: v.estadoTrabajo||'pendiente',
    customers: { full_name: `${v.cliente.nombre} ${v.cliente.apellido}`.trim() },
    branches:  { name: v.sucursalVenta },
  }));

  const pendingSales = (selectedBranch ? allSalesData.filter(v=>branchMatch(v.sucursalVenta||'')) : allSalesData)
    .filter(v=>v.estadoTrabajo==='pendiente'||v.estadoTrabajo==='en_laboratorio')
    .sort((a,b)=>new Date(a.fecha).getTime()-new Date(b.fecha).getTime())
    .slice(0,20);

  const isVendedora = profile?.role === 'vendedora';

  const statusConfig: Record<string,{label:string;color:string;icon:React.ReactNode}> = {
    pendiente:      {label:'Pendiente',   color:'#f59e0b',icon:<Clock       size={12}/>},
    en_proceso:     {label:'En Proceso',  color:'#3b82f6',icon:<AlertCircle size={12}/>},
    en_laboratorio: {label:'Laboratorio', color:'#3b82f6',icon:<AlertCircle size={12}/>},
    listo:          {label:'Listo',       color:'#10b981',icon:<CheckCircle size={12}/>},
    entregado:      {label:'Entregado',   color:'#6b7280',icon:<CheckCircle size={12}/>},
    cancelado:      {label:'Cancelado',   color:'#ef4444',icon:<AlertCircle size={12}/>},
  };

  async function saveCashEntry() {
    const amt = parseFloat(cashAmt);
    if (!amt||amt<=0||!cashDesc.trim()) return;
    setSavingCash(true);
    if (cashModal==='gasto') {
      await supabase.from('expenses').insert([{branch_id:profile?.branch_id?.toLowerCase()??'',amount:amt,method:cashMethod,description:cashDesc.trim(),registered_by:profile?.id??null,expense_date:new Date().toISOString().split('T')[0]}]);
    }
    setSavingCash(false); setCashModal(null); setCashDesc(''); setCashAmt('');
    setCashMsg(cashModal==='gasto'?'Gasto registrado.':'Ingreso registrado.');
    setTimeout(()=>setCashMsg(''),4000);
  }

  // ── Label de la tarjeta según scope ──────────────────────────────────────
  const scopeCardLabel = {
    day:   'Ventas del Día',
    week:  'Ventas de la Semana',
    month: 'Ventas del Mes',
    year:  'Ventas del Año',
  }[scope];

  // ── VENDEDORA ─────────────────────────────────────────────────────────────
  if (isVendedora) {
    const allMySales   = allSalesData.filter(v => v.vendedora===profile?.full_name);
    const myTodaySales = allMySales.filter(v => (v.fecha||'').startsWith(today));
    const myTodayTotal = myTodaySales.reduce((a,v)=>a+(Number(v.total)||0),0);
    const myPending    = allMySales.filter(v=>v.estadoTrabajo==='pendiente'||v.estadoTrabajo==='en_laboratorio').sort((a,b)=>new Date(b.fecha).getTime()-new Date(a.fecha).getTime());

    return (
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl text-white font-light tracking-wider">Mi Panel</h1>
            <p className="text-sm font-light mt-1" style={{color:'rgba(197,160,89,0.7)'}}>{profile?.full_name} · {new Date().toLocaleDateString('es-PY',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>{setCashModal('ingreso');setCashDesc('');setCashAmt('');}} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-light" style={{background:'rgba(34,197,94,0.12)',border:'1px solid rgba(34,197,94,0.28)',color:'#22c55e'}}><Plus size={13}/>Ingreso Caja</button>
            <button onClick={()=>{setCashModal('gasto');setCashDesc('');setCashAmt('');}} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-light" style={{background:'rgba(239,68,68,0.10)',border:'1px solid rgba(239,68,68,0.25)',color:'#ef4444'}}><Minus size={13}/>Registrar Gasto</button>
          </div>
        </div>

        {cashMsg && <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-light" style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.25)',color:'#10b981'}}><CheckCircle size={13}/>{cashMsg}</div>}

        {cashModal && (
          <div className="rounded-2xl border p-5 space-y-4" style={{background:cashModal==='gasto'?'rgba(239,68,68,0.05)':'rgba(34,197,94,0.05)',borderColor:cashModal==='gasto'?'rgba(239,68,68,0.28)':'rgba(34,197,94,0.28)'}}>
            <div className="flex items-center justify-between"><p className="text-sm font-light text-white">{cashModal==='gasto'?'Registrar Gasto':'Registrar Ingreso'}</p><button onClick={()=>setCashModal(null)} style={{color:'rgba(255,255,255,0.6)'}}><X size={14}/></button></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={cashDesc} onChange={e=>setCashDesc(e.target.value)} placeholder="Descripción" className="px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border" style={{borderColor:'rgba(197,160,89,0.22)'}}/>
              <input value={cashAmt} onChange={e=>setCashAmt(e.target.value)} type="number" placeholder="Monto Gs." className="px-3 py-2.5 rounded-xl bg-transparent text-white text-sm font-light outline-none border" style={{borderColor:'rgba(197,160,89,0.22)'}}/>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {([{id:'efectivo' as const,label:'Efectivo',icon:<Banknote size={12}/>,color:'#22c55e'},{id:'transferencia' as const,label:'Transfer.',icon:<DollarSign size={12}/>,color:'#3b82f6'},{id:'tarjeta' as const,label:'POS',icon:<CreditCard size={12}/>,color:'#f59e0b'}]).map(m=>(
                <button key={m.id} onClick={()=>setCashMethod(m.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-light" style={{background:cashMethod===m.id?`${m.color}18`:'rgba(255,255,255,0.03)',border:`1px solid ${cashMethod===m.id?m.color+'44':'rgba(255,255,255,0.10)'}`,color:cashMethod===m.id?m.color:'rgba(255,255,255,0.45)'}}>{m.icon}{m.label}</button>
              ))}
              <button onClick={saveCashEntry} disabled={savingCash||!cashAmt||!cashDesc.trim()} className="ml-auto px-5 py-1.5 rounded-lg text-xs font-medium text-black disabled:opacity-40" style={{background:cashModal==='gasto'?'#ef4444':'#22c55e'}}>{savingCash?'Guardando...':'Guardar'}</button>
            </div>
          </div>
        )}

        {prizeLevel!=='sin_nivel'&&dismissedLevel!==prizeLevel&&(
          <div className="relative rounded-2xl border p-5" style={{background:prizeLevel==='oro'?'linear-gradient(135deg,rgba(197,160,89,0.12),rgba(139,105,20,0.08))':'linear-gradient(135deg,rgba(205,127,50,0.12),rgba(205,127,50,0.05))',borderColor:prizeLevel==='oro'?'rgba(197,160,89,0.5)':'rgba(205,127,50,0.5)'}}>
            <button onClick={()=>{setDismissedLevel(prizeLevel);sessionStorage.setItem('dismissedPrize',prizeLevel);}} className="absolute top-3 right-3 opacity-40" style={{color:'rgba(255,255,255,0.6)'}}><X size={14}/></button>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{background:prizeLevel==='oro'?'rgba(197,160,89,0.2)':'rgba(205,127,50,0.2)',border:`2px solid ${prizeLevel==='oro'?'#C5A059':'#cd7f32'}`}}>
                {prizeLevel==='oro'?<Trophy size={22} style={{color:'#C5A059'}}/>:<Medal size={22} style={{color:'#cd7f32'}}/>}
              </div>
              <div>
                <p className="text-white font-medium text-sm">{prizeLevel==='oro'?`¡Felicitaciones, ${profile?.full_name?.split(' ')[0]}!`:`¡Excelente, ${profile?.full_name?.split(' ')[0]}!`}</p>
                <p className="text-xs font-light mt-0.5" style={{color:prizeLevel==='oro'?'rgba(197,160,89,0.9)':'rgba(205,127,50,0.9)'}}>{prizeLevel==='oro'?`Nivel Oro — ${myPoints.toFixed(1)} pts`:`Nivel Bronce — ${myPoints.toFixed(1)} pts`}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {label:'Mis Ventas Hoy',        value:myTodaySales.length.toString(), icon:<ShoppingCart size={18}/>,sub:'registradas hoy'},
            {label:'Total Facturado Hoy',    value:`Gs. ${fmt(myTodayTotal)}`,     icon:<TrendingUp   size={18}/>,sub:'mis ventas'},
            {label:'Pendientes de Entrega',  value:myPending.length.toString(),    icon:<Clock        size={18}/>,sub:'en taller o pendiente'},
          ].map((card,i)=>(
            <div key={i} className="stat-card p-5">
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full -translate-y-6 translate-x-6 pointer-events-none" style={{background:'radial-gradient(circle,rgba(197,160,89,0.13) 0%,transparent 70%)'}}/>
              <div className="flex items-start justify-between relative">
                <div><p className="section-label">{card.label}</p><p className="text-2xl text-white font-light mt-1.5">{card.value}</p><p className="text-xs mt-1 text-gold-muted capitalize">{card.sub}</p></div>
                <div className="p-2.5 rounded-xl" style={{background:'rgba(197,160,89,0.10)',color:'#C5A059'}}>{card.icon}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="premium-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 soft-border-bottom">
            <div><h2 className="text-white text-sm font-light tracking-wider">Pendientes de Entrega</h2><p className="text-xs font-light mt-0.5" style={{color:'rgba(255,255,255,0.35)'}}>Clic en WhatsApp para avisar al cliente</p></div>
            <Clock size={16} className="text-gold gold-glow-sm"/>
          </div>
          {myPending.length===0?(<div className="empty-state"><div className="empty-state-icon"><Clock size={22}/></div><p className="text-sm font-light">Sin pendientes de entrega</p></div>):(
            <div className="divide-y" style={{borderColor:'rgba(255,255,255,0.04)'}}>
              {myPending.map(v=>{
                const cn=`${v.cliente.nombre} ${v.cliente.apellido}`.trim()||'—';
                const ph=v.cliente.telefono||'';
                const msg=`Hola ${cn}, te saludamos de Óptica Yolanda. Tus lentes están listos en ${v.sucursalEntrega}. ¡Te esperamos!`;
                const wa=ph?`https://wa.me/595${ph.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`:null;
                const sc=v.estadoTrabajo==='en_laboratorio'?'#3b82f6':'#f59e0b';
                return(<div key={v.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><p className="text-sm text-white font-light truncate">{cn}</p><span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{background:`${sc}18`,color:sc}}>{v.estadoTrabajo==='en_laboratorio'?'En Taller':'Pendiente'}</span></div>
                    <p className="text-xs font-light mt-0.5" style={{color:'rgba(255,255,255,0.35)'}}>{new Date(v.fecha).toLocaleDateString('es-PY',{day:'2-digit',month:'2-digit'})} · {v.sucursalEntrega} · Gs. {fmt(Number(v.total))}</p>
                  </div>
                  {wa?<a href={wa} target="_blank" rel="noreferrer" className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light" style={{background:'rgba(37,211,102,0.12)',color:'#25D366',border:'1px solid rgba(37,211,102,0.25)'}}><MessageCircle size={12}/>WhatsApp</a>:<span className="text-xs font-light shrink-0" style={{color:'rgba(255,255,255,0.22)'}}>Sin teléfono</span>}
                </div>);
              })}
            </div>
          )}
        </div>

        <div className="premium-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 soft-border-bottom"><h2 className="text-white text-sm font-light tracking-wider">Mis Ventas de Hoy</h2><ShoppingCart size={16} className="text-gold gold-glow-sm"/></div>
          {myTodaySales.length===0?(<div className="empty-state"><div className="empty-state-icon"><ShoppingCart size={22}/></div><p className="text-sm font-light">Aún no registraste ventas hoy</p></div>):(
            <div className="overflow-x-auto"><table className="w-full text-xs">
              <thead><tr className="soft-border-bottom">{['N° Venta','Cliente','Total','Estado'].map(h=><th key={h} className="px-4 py-3 text-left section-label">{h}</th>)}</tr></thead>
              <tbody>{myTodaySales.map(v=>{const sc=statusConfig[v.estadoTrabajo]||statusConfig.pendiente;return(<tr key={v.id} className="table-row"><td className="px-4 py-3 font-mono text-gold">VTA-{v.id}</td><td className="px-4 py-3 text-white font-light">{`${v.cliente.nombre} ${v.cliente.apellido}`.trim()||'—'}</td><td className="px-4 py-3 text-white font-light">Gs. {fmt(Number(v.total))}</td><td className="px-4 py-3"><span className="status-badge" style={{background:`${sc.color}1e`,color:sc.color}}>{sc.icon}{sc.label}</span></td></tr>);})}</tbody>
            </table></div>
          )}
        </div>
      </div>
    );
  }

  // ── ADMIN ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">

      {/* Header + controles */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl text-white font-light tracking-wider">Dashboard</h1>
          <p className="text-sm font-light mt-1 capitalize" style={{color:'rgba(197,160,89,0.7)'}}>
            Bienvenido, {profile?.full_name||'Usuario'} · {new Date().toLocaleDateString('es-PY',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* ── Selector de período ── */}
          <div className="flex rounded-xl overflow-hidden" style={{border:'1px solid rgba(197,160,89,0.22)'}}>
            {([
              {id:'day'   as const, label:'Día'   },
              {id:'week'  as const, label:'Semana'},
              {id:'month' as const, label:'Mes'   },
              {id:'year'  as const, label:'Año'   },
            ]).map(s=>(
              <button key={s.id} onClick={()=>setScope(s.id)}
                className="px-3 py-2 text-xs font-light"
                style={{background:scope===s.id?'rgba(197,160,89,0.18)':'transparent',color:scope===s.id?'#C5A059':'rgba(255,255,255,0.45)'}}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Input de referencia de fecha */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{background:'rgba(197,160,89,0.07)',border:'1px solid rgba(197,160,89,0.20)'}}>
            <Calendar size={13} style={{color:'rgba(197,160,89,0.6)'}}/>
            <input
              type={scope==='month'?'month':scope==='year'?'number':'date'}
              value={scope==='month'?periodRef.slice(0,7):scope==='year'?periodRef.slice(0,4):periodRef}
              onChange={e => {
                if (scope==='month')      setPeriodRef(e.target.value+'-01');
                else if (scope==='year')  setPeriodRef(e.target.value+'-01-01');
                else                      setPeriodRef(e.target.value);
              }}
              min={scope==='year'?'2024':undefined}
              max={scope==='year'?'2030':undefined}
              className="bg-transparent text-xs text-white border-none outline-none"
              style={{width: scope==='month'?90:scope==='year'?60:110}}
            />
          </div>

          {/* Selector de sucursal */}
          <div className="relative">
            <button onClick={()=>setBranchDropdown(!branchDropdown)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-light"
              style={{background:selectedBranch?'rgba(197,160,89,0.12)':'rgba(255,255,255,0.05)',border:`1px solid ${selectedBranch?'rgba(197,160,89,0.35)':'rgba(255,255,255,0.12)'}`,color:selectedBranch?'#C5A059':'rgba(255,255,255,0.6)'}}>
              <Building2 size={14}/>{selectedBranch||'Todas las Sucursales'}<ChevronDown size={13} style={{transform:branchDropdown?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
            </button>
            {branchDropdown&&(
              <div className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden z-50 min-w-48"
                style={{background:'rgba(10,9,7,0.97)',border:'1px solid rgba(197,160,89,0.22)',boxShadow:'0 8px 32px rgba(0,0,0,0.6)'}}>
                <button onClick={()=>{setSelectedBranch('');setBranchDropdown(false);}}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm font-light text-left"
                  style={{background:!selectedBranch?'rgba(197,160,89,0.10)':'transparent',color:!selectedBranch?'#C5A059':'rgba(255,255,255,0.6)',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                  {!selectedBranch&&<span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:'#C5A059'}}/>}Todas las Sucursales
                </button>
                {SUCURSALES.map(s=>(
                  <button key={s} onClick={()=>{setSelectedBranch(s);setBranchDropdown(false);}}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm font-light text-left"
                    style={{background:selectedBranch===s?'rgba(197,160,89,0.10)':'transparent',color:selectedBranch===s?'#C5A059':'rgba(255,255,255,0.6)',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                    {selectedBranch===s&&<span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:'#C5A059'}}/>}{s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Label del período activo */}
      <p className="text-xs font-light -mt-3 capitalize" style={{color:'rgba(197,160,89,0.55)'}}>
        Mostrando: <span style={{color:'#C5A059'}}>{periodLabel(scope, periodRef)}</span>
        {selectedBranch && <span> · {selectedBranch}</span>}
      </p>

      {/* KPIs */}
      {loading?(<div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_,i)=><div key={i} className="h-28 rounded-xl shimmer"/>)}</div>):(
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {label: scopeCardLabel,  value:`Gs. ${fmt(stats.monthlySales)}`,  icon:<TrendingUp   size={20}/>, sub:`${ventasFilt.length} ventas`},
            {label:'Cobrado Hoy',    value:`Gs. ${fmt(todayCash)}`,           icon:<DollarSign   size={20}/>, sub:'Todos los métodos'},
            {label:'Total Clientes', value:fmt(stats.totalCustomers),          icon:<Users        size={20}/>, sub:'Registrados'},
            {label:'En Laboratorio', value:String(stats.pendingLab),           icon:<FlaskConical size={20}/>, sub:`${stats.readyLab} listos`},
          ].map((card,i)=>(
            <div key={i} className="stat-card p-5">
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full -translate-y-6 translate-x-6 pointer-events-none" style={{background:'radial-gradient(circle,rgba(197,160,89,0.13) 0%,transparent 70%)'}}/>
              <div className="flex items-start justify-between relative">
                <div>
                  <p className="section-label">{card.label}</p>
                  <p className="text-2xl text-white font-light mt-1.5">{card.value}</p>
                  <p className="text-xs mt-1 text-gold-muted">{card.sub}</p>
                </div>
                <div className="p-2.5 rounded-xl" style={{background:'rgba(197,160,89,0.10)',color:'#C5A059',boxShadow:'0 0 14px rgba(197,160,89,0.14)'}}>{card.icon}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ventas recientes + Sucursales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="premium-card lg:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 soft-border-bottom">
            <div>
              <h2 className="text-white text-sm font-light tracking-wider">
                Ventas{selectedBranch?` — ${selectedBranch}`:''}
              </h2>
              <p className="text-xs font-light mt-0.5 capitalize" style={{color:'rgba(255,255,255,0.35)'}}>
                {periodLabel(scope, periodRef)} · {ventasFilt.length} ventas
              </p>
            </div>
            <ShoppingCart size={16} className="text-gold gold-glow-sm"/>
          </div>
          {recentSales.length===0?(<div className="empty-state"><div className="empty-state-icon"><ShoppingCart size={22}/></div><p className="text-sm font-light">No hay ventas para este período</p></div>):(
            <div className="overflow-x-auto"><table className="w-full text-xs">
              <thead><tr className="soft-border-bottom">{['N° Venta','Cliente','Sucursal','Total','Estado'].map(h=><th key={h} className="px-4 py-3 text-left section-label">{h}</th>)}</tr></thead>
              <tbody>{recentSales.map(sale=>{const sc=statusConfig[sale.status]||statusConfig.pendiente;return(<tr key={sale.id} className="table-row"><td className="px-4 py-3 font-mono text-gold">{sale.sale_number}</td><td className="px-4 py-3 text-white font-light">{sale.customers?.full_name||'-'}</td><td className="px-4 py-3 font-light" style={{color:'rgba(255,255,255,0.48)'}}>{sale.branches?.name||'-'}</td><td className="px-4 py-3 text-white font-light">Gs. {fmt(Number(sale.total))}</td><td className="px-4 py-3"><span className="status-badge" style={{background:`${sc.color}1e`,color:sc.color}}>{sc.icon}{sc.label}</span></td></tr>);})}</tbody>
            </table></div>
          )}
        </div>

        <div className="premium-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 soft-border-bottom">
            <h2 className="text-white text-sm font-light tracking-wider">
              Sucursales <span className="capitalize" style={{color:'rgba(197,160,89,0.6)',fontSize:11}}>({scope==='day'?'día':scope==='week'?'semana':scope==='month'?'mes':'año'})</span>
            </h2>
            <Building2 size={16} className="text-gold gold-glow-sm"/>
          </div>
          <div className="p-4 space-y-3">
            {branchStats.length===0?(<p className="text-xs text-center py-2 font-light" style={{color:'rgba(255,255,255,0.3)'}}>Sin datos</p>):branchStats.map((b,i)=>(
              <div key={i}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-white font-light">{b.name}</span>
                  <span className="text-gold">{b.count} ventas</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,0.055)'}}>
                  <div className="h-full rounded-full" style={{width:`${Math.min(100,(b.count/Math.max(...branchStats.map(x=>x.count),1))*100)}%`,background:'linear-gradient(to right,#E2C070,#C5A059,#8B6914)',boxShadow:'0 0 8px rgba(197,160,89,0.40)'}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pendientes de entrega */}
      <div className="premium-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 soft-border-bottom">
          <div>
            <h2 className="text-white text-sm font-light tracking-wider">Pendientes de Entrega{selectedBranch?` — ${selectedBranch}`:''}</h2>
            <p className="text-xs font-light mt-0.5" style={{color:'rgba(255,255,255,0.35)'}}>En Taller o Pendiente — todos los períodos</p>
          </div>
          <Clock size={16} className="text-gold gold-glow-sm"/>
        </div>
        {pendingSales.length===0?(<div className="empty-state"><div className="empty-state-icon"><Clock size={22}/></div><p className="text-sm font-light">Sin pendientes de entrega</p></div>):(
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead><tr className="soft-border-bottom">{['Cliente','Vendedora','Sucursal','Fecha','Total','Estado','WhatsApp'].map(h=><th key={h} className="px-4 py-3 text-left section-label">{h}</th>)}</tr></thead>
            <tbody>{pendingSales.map(v=>{
              const cn=`${v.cliente.nombre} ${v.cliente.apellido}`.trim()||'—';
              const ph=v.cliente.telefono||'';
              const msg=`Hola ${cn}, te saludamos de Óptica Yolanda. Tus lentes están listos en ${v.sucursalEntrega}. ¡Te esperamos!`;
              const wa=ph?`https://wa.me/595${ph.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`:null;
              const sc=v.estadoTrabajo==='en_laboratorio'?'#3b82f6':'#f59e0b';
              return(<tr key={v.id} className="table-row">
                <td className="px-4 py-3 text-white font-light">{cn}</td>
                <td className="px-4 py-3 font-light" style={{color:'rgba(255,255,255,0.48)'}}>{v.vendedora}</td>
                <td className="px-4 py-3 font-light" style={{color:'rgba(255,255,255,0.48)'}}>{v.sucursalEntrega}</td>
                <td className="px-4 py-3 font-light" style={{color:'rgba(255,255,255,0.48)'}}>{new Date(v.fecha).toLocaleDateString('es-PY',{day:'2-digit',month:'2-digit'})}</td>
                <td className="px-4 py-3 text-white font-light">Gs. {fmt(Number(v.total))}</td>
                <td className="px-4 py-3"><span className="status-badge" style={{background:`${sc}18`,color:sc}}>{v.estadoTrabajo==='en_laboratorio'?'En Taller':'Pendiente'}</span></td>
                <td className="px-4 py-3">{wa?<a href={wa} target="_blank" rel="noreferrer" className="flex items-center gap-1" style={{color:'#25D366'}}><MessageCircle size={13}/>Avisar</a>:<span style={{color:'rgba(255,255,255,0.22)'}}>—</span>}</td>
              </tr>);
            })}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
