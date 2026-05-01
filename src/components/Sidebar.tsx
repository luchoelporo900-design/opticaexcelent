import { useState, useEffect } from 'react';
import {
  LayoutDashboard, ShoppingCart, Users, FlaskConical,
  Glasses, Building2, ChevronLeft, ChevronRight,
  Bell, LogOut, Settings, Eye, Trophy, ChevronDown,
  DollarSign, BarChart3, AlertCircle, Search
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import { supabase } from '../lib/supabase';

type Page = 'dashboard' | 'pos' | 'customers' | 'lab' | 'simulator' | 'branches' | 'crm' | 'settings' | 'commissions' | 'cash' | 'reports' | 'balances';

type Props = {
  current: Page;
  onChange: (p: Page, searchQuery?: string) => void;
};

const navItems: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard',   label: 'Dashboard',          icon: <LayoutDashboard size={18} /> },
  { id: 'pos',         label: 'Ventas POS',          icon: <ShoppingCart    size={18} /> },
  { id: 'customers',   label: 'Clientes',            icon: <Users           size={18} /> },
  { id: 'crm',         label: 'CRM / Recordatorios', icon: <Bell            size={18} /> },
  { id: 'lab',         label: 'Laboratorio',         icon: <FlaskConical    size={18} /> },
  { id: 'commissions', label: 'Comisiones',          icon: <Trophy          size={18} /> },
  { id: 'cash',        label: 'Caja',                icon: <DollarSign      size={18} /> },
  { id: 'balances',    label: 'Saldos Pendientes',   icon: <AlertCircle     size={18} /> },
  { id: 'reports',     label: 'Reportes',            icon: <BarChart3       size={18} /> },
  { id: 'simulator',   label: 'Simuladores',         icon: <Eye             size={18} /> },
  { id: 'branches',    label: 'Sucursales',          icon: <Building2       size={18} /> },
  { id: 'settings',    label: 'Configuración',       icon: <Settings        size={18} /> },
];

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

export default function Sidebar({ current, onChange }: Props) {
  const [collapsed,    setCollapsed]    = useState(false);
  const [branchOpen,   setBranchOpen]   = useState(false);
  const [myPoints,     setMyPoints]     = useState<number | null>(null);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const { profile, signOut } = useAuth();
  const { branches, activeBranch, setActiveBranchId } = useBranch();

  useEffect(() => {
    if (!profile || profile.id === 'dev-mode-id') return;
    supabase
      .from('monthly_seller_summary')
      .select('total_points')
      .eq('seller_id', profile.id)
      .eq('sale_month', CURRENT_MONTH)
      .maybeSingle()
      .then(({ data }) => { if (data) setMyPoints(Number(data.total_points)); });
  }, [profile]);

  const pointColor =
    myPoints !== null && myPoints >= 10 ? '#C5A059' :
    myPoints !== null && myPoints >=  8 ? '#cd7f32' :
    'rgba(255,255,255,0.36)';

  return (
    <aside
      className="sidebar-root flex flex-col h-screen sticky top-0 shrink-0"
      style={{
        width: collapsed ? 72 : 240,
        transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
      }}>

      {/* ── Logo ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-5 soft-border-bottom">
        <div className="sidebar-logo-ring flex items-center justify-center w-9 h-9 rounded-full shrink-0">
          <Glasses size={18} className="text-gold gold-glow-sm" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden animate-fade-in">
            <p className="text-white text-xs font-medium tracking-widest uppercase leading-tight">
              Óptica Yolanda
            </p>
            <p className="text-xs font-light tracking-wider text-gold-muted">Elite V10</p>
          </div>
        )}
      </div>

      {/* ── Branch selector ──────────────────────────────────── */}
      {!collapsed && branches.length > 0 && (
        <div className="px-3 pt-3 pb-2 soft-border-bottom animate-fade-in">
          <p className="section-label px-1 mb-1.5">Sede activa</p>
          <div className="relative">
            <button
              onClick={() => setBranchOpen(!branchOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-light"
              style={{
                background: 'rgba(197,160,89,0.08)',
                border: '1px solid rgba(197,160,89,0.24)',
                color: '#C5A059',
              }}
              onMouseEnter={e => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.background = 'rgba(197,160,89,0.13)';
                b.style.borderColor = 'rgba(197,160,89,0.40)';
              }}
              onMouseLeave={e => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.background = 'rgba(197,160,89,0.08)';
                b.style.borderColor = 'rgba(197,160,89,0.24)';
              }}>
              <span className="flex items-center gap-2 truncate">
                <Building2 size={12} />
                {activeBranch?.name ?? 'Seleccionar'}
              </span>
              <ChevronDown
                size={12}
                className="shrink-0"
                style={{
                  transform: branchOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
                }} />
            </button>

            {branchOpen && (
              <div
                className="absolute left-0 right-0 top-full mt-1 rounded-lg overflow-hidden animate-fade-in"
                style={{
                  background: 'rgba(10,9,7,0.96)',
                  border: '1px solid rgba(197,160,89,0.20)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.60)',
                  zIndex: 50,
                }}>
                {branches.map(b => {
                  const isActive = activeBranch?.id === b.id;
                  return (
                    <button
                      key={b.id}
                      onClick={() => { setActiveBranchId(b.id); setBranchOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-light text-left"
                      style={{
                        color: isActive ? '#C5A059' : 'rgba(255,255,255,0.58)',
                        background: isActive ? 'rgba(197,160,89,0.10)' : 'transparent',
                        transition: 'background 0.18s, color 0.18s',
                      }}
                      onMouseEnter={e => {
                        if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                      }}
                      onMouseLeave={e => {
                        if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      }}>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 gold-glow-sm"
                          style={{ background: '#C5A059' }} />
                      )}
                      {b.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Universal Client Search ──────────────────────────── */}
      {!collapsed && (
        <div className="px-3 pt-2.5 pb-2 animate-fade-in">
          <form
            onSubmit={e => {
              e.preventDefault();
              if (searchQuery.trim()) {
                onChange('customers', searchQuery.trim());
                setSearchQuery('');
              }
            }}>
            <div
              className="relative flex items-center"
              style={{
                borderRadius: 8,
                border: searchFocused
                  ? '1px solid rgba(197,160,89,0.55)'
                  : '1px solid rgba(197,160,89,0.20)',
                background: searchFocused
                  ? 'rgba(197,160,89,0.07)'
                  : 'rgba(197,160,89,0.04)',
                boxShadow: searchFocused
                  ? '0 0 0 2px rgba(197,160,89,0.12), 0 2px 12px rgba(197,160,89,0.10)'
                  : 'none',
                transition: 'border-color 0.22s, background 0.22s, box-shadow 0.22s',
              }}>
              <Search
                size={13}
                className="absolute left-2.5 shrink-0 pointer-events-none"
                style={{ color: searchFocused ? '#C5A059' : 'rgba(197,160,89,0.45)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Buscar cliente..."
                className="w-full bg-transparent outline-none text-xs font-light pl-7 pr-3 py-2"
                style={{
                  color: 'rgba(255,255,255,0.82)',
                  caretColor: '#C5A059',
                  letterSpacing: '0.04em',
                }}
              />
            </div>
          </form>
        </div>
      )}
      {collapsed && (
        <button
          onClick={() => { setCollapsed(false); }}
          title="Buscar cliente"
          className="mx-auto flex items-center justify-center w-9 h-9 rounded-lg mt-2"
          style={{
            border: '1px solid rgba(197,160,89,0.20)',
            background: 'rgba(197,160,89,0.04)',
            color: 'rgba(197,160,89,0.55)',
          }}>
          <Search size={15} />
        </button>
      )}

      {/* ── Navigation ───────────────────────────────────────── */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              title={collapsed ? item.label : undefined}
              className={`nav-item w-full flex items-center gap-3 px-3 py-2.5 text-left ${active ? 'active' : ''}`}
              style={{ color: active ? '#C5A059' : 'rgba(255,255,255,0.48)' }}>
              <span className="shrink-0" style={{ opacity: active ? 1 : 0.72 }}>
                {item.icon}
              </span>
              {!collapsed && (
                <span className="text-xs tracking-wider font-light truncate">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Footer ───────────────────────────────────────────── */}
      <div className="soft-border-top p-3 space-y-1.5">
        {!collapsed && profile && (
          <div className="sidebar-user-card px-2.5 py-2 animate-fade-in">
            <p className="text-white text-xs font-medium truncate">{profile.full_name}</p>
            <p className="text-xs capitalize text-gold-muted mt-0.5">{profile.role}</p>
            {myPoints !== null && (
              <div className="flex items-center gap-1.5 mt-2">
                <Trophy size={10} style={{ color: pointColor }} />
                <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.44)' }}>
                  Puntos del mes:
                </span>
                <span className="text-xs font-medium" style={{ color: pointColor }}>
                  {myPoints.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left"
          style={{ color: 'rgba(255,255,255,0.36)', transition: 'color 0.22s, background 0.22s' }}
          onMouseEnter={e => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.color = '#ef4444';
            b.style.background = 'rgba(239,68,68,0.07)';
          }}
          onMouseLeave={e => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.color = 'rgba(255,255,255,0.36)';
            b.style.background = 'transparent';
          }}>
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span className="text-xs tracking-wider font-light">Cerrar Sesión</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 rounded-lg"
          style={{ color: 'rgba(197,160,89,0.38)', transition: 'color 0.22s, background 0.22s' }}
          onMouseEnter={e => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.color = '#C5A059';
            b.style.background = 'rgba(197,160,89,0.06)';
          }}
          onMouseLeave={e => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.color = 'rgba(197,160,89,0.38)';
            b.style.background = 'transparent';
          }}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
