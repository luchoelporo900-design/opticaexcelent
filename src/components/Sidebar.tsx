import { useState, useEffect } from 'react';
import {
  LayoutDashboard, ShoppingCart, Users, FlaskConical,
  Glasses, Building2, ChevronLeft, ChevronRight,
  Bell, LogOut, Settings, Eye, Trophy, ChevronDown,
  DollarSign, BarChart3, AlertCircle, Search, X, ClipboardList, Package
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';

type Page = 'dashboard' | 'pos' | 'customers' | 'lab' | 'simulator' | 'branches' | 'crm' | 'settings' | 'commissions' | 'cash' | 'reports' | 'balances' | 'sales_history' | 'stock';

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
  { id: 'sales_history', label: 'Mis Ventas',        icon: <ClipboardList   size={18} /> },
  { id: 'stock',       label: 'Stock Armazones',     icon: <Package         size={18} /> },
  { id: 'reports',     label: 'Reportes',            icon: <BarChart3       size={18} /> },
  { id: 'simulator',   label: 'Simuladores',         icon: <Eye             size={18} /> },
  { id: 'branches',    label: 'Sucursales',          icon: <Building2       size={18} /> },
  { id: 'settings',    label: 'Configuración',       icon: <Settings        size={18} /> },
];

function getVisiblePages(role: string): Page[] {
  switch (role) {
    case 'admin':
    case 'gerente':
      return ['dashboard', 'pos', 'sales_history', 'customers', 'crm', 'lab', 'commissions', 'cash', 'balances', 'stock', 'reports', 'simulator', 'branches', 'settings'];
    case 'vendedora':
      return ['dashboard', 'pos', 'sales_history', 'customers', 'crm', 'lab', 'cash', 'balances', 'stock'];
    case 'laboratorio':
      return ['lab'];
    default:
      return ['dashboard'];
  }
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

export default function Sidebar({ current, onChange }: Props) {
  const [collapsed,     setCollapsed]     = useState(false);
  const [branchOpen,    setBranchOpen]    = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const { profile, signOut } = useAuth();
  const { branches, activeBranch, setActiveBranchId } = useBranch();

  const isMobile     = useIsMobile();
  const role         = profile?.role ?? '';
  const visiblePages = getVisiblePages(role);
  const isAdmin      = role === 'admin' || role === 'gerente';
  const isLab        = role === 'laboratorio';

  if (isMobile) {
    return (
      <MobileNav
        current={current}
        onChange={onChange}
        role={role}
        visiblePages={visiblePages}
        profile={profile}
        signOut={signOut}
      />
    );
  }

  return (
    <aside
      className="sidebar-root flex flex-col h-screen sticky top-0 shrink-0"
      style={{ width: collapsed ? 72 : 240, transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)' }}>

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 soft-border-bottom">
        <div className="sidebar-logo-ring flex items-center justify-center w-9 h-9 rounded-full shrink-0">
          <Glasses size={18} className="text-gold gold-glow-sm" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden animate-fade-in">
            <p className="text-white text-xs font-medium tracking-widest uppercase leading-tight">Óptica Excelent</p>
            <p className="text-xs font-light tracking-wider text-gold-muted">V10</p>
          </div>
        )}
      </div>

      {/* Branch selector — solo para admin/gerente */}
      {!collapsed && branches.length > 0 && isAdmin && (
        <div className="px-3 pt-3 pb-2 soft-border-bottom animate-fade-in">
          <p className="section-label px-1 mb-1.5">Sede activa</p>
          <div className="relative">
            <button
              onClick={() => setBranchOpen(!branchOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-light"
              style={{ background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.24)', color: '#C5A059' }}
              onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(197,160,89,0.13)'; b.style.borderColor = 'rgba(197,160,89,0.40)'; }}
              onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(197,160,89,0.08)'; b.style.borderColor = 'rgba(197,160,89,0.24)'; }}>
              <span className="flex items-center gap-2 truncate">
                <Building2 size={12} />
                {activeBranch?.name ?? 'Seleccionar'}
              </span>
              <ChevronDown size={12} className="shrink-0"
                style={{ transform: branchOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)' }} />
            </button>

            {branchOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 rounded-lg overflow-hidden animate-fade-in"
                style={{ background: 'rgba(10,9,7,0.96)', border: '1px solid rgba(197,160,89,0.20)', backdropFilter: 'blur(16px)', boxShadow: '0 8px 32px rgba(0,0,0,0.60)', zIndex: 50 }}>
                {branches.map(b => {
                  const isActive = activeBranch?.id === b.id;
                  return (
                    <button key={b.id} onClick={() => { setActiveBranchId(b.id); setBranchOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-light text-left"
                      style={{ color: isActive ? '#C5A059' : 'rgba(255,255,255,0.58)', background: isActive ? 'rgba(197,160,89,0.10)' : 'transparent', transition: 'background 0.18s, color 0.18s' }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full shrink-0 gold-glow-sm" style={{ background: '#C5A059' }} />}
                      {b.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sucursal vendedora (solo lectura) */}
      {!collapsed && profile?.branch_id && !isAdmin && !isLab && (
        <div className="px-3 pt-3 pb-2 soft-border-bottom animate-fade-in">
          <p className="section-label px-1 mb-1.5">Mi sucursal</p>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-light"
            style={{ background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.18)', color: 'rgba(197,160,89,0.8)' }}>
            <Building2 size={12} />
            {profile.branch_id}
          </div>
        </div>
      )}

      {/* Búsqueda cliente */}
      {!collapsed && !isLab && (
        <div className="px-3 pt-2.5 pb-2 animate-fade-in">
          <form onSubmit={e => { e.preventDefault(); if (searchQuery.trim()) { onChange('customers', searchQuery.trim()); setSearchQuery(''); } }}>
            <div className="relative flex items-center"
              style={{ borderRadius: 8, border: searchFocused ? '1px solid rgba(197,160,89,0.55)' : '1px solid rgba(197,160,89,0.20)', background: searchFocused ? 'rgba(197,160,89,0.07)' : 'rgba(197,160,89,0.04)', boxShadow: searchFocused ? '0 0 0 2px rgba(197,160,89,0.12)' : 'none', transition: 'border-color 0.22s, background 0.22s, box-shadow 0.22s' }}>
              <Search size={13} className="absolute left-2.5 shrink-0 pointer-events-none"
                style={{ color: searchFocused ? '#C5A059' : 'rgba(197,160,89,0.45)' }} />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
                placeholder="Buscar cliente..."
                className="w-full bg-transparent outline-none text-xs font-light pl-7 pr-3 py-2"
                style={{ color: 'rgba(255,255,255,0.82)', caretColor: '#C5A059', letterSpacing: '0.04em' }} />
            </div>
          </form>
        </div>
      )}
      {collapsed && !isLab && (
        <button onClick={() => setCollapsed(false)} title="Buscar cliente"
          className="mx-auto flex items-center justify-center w-9 h-9 rounded-lg mt-2"
          style={{ border: '1px solid rgba(197,160,89,0.20)', background: 'rgba(197,160,89,0.04)', color: 'rgba(197,160,89,0.55)' }}>
          <Search size={15} />
        </button>
      )}

      {/* Navegación */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {navItems
          .filter(item => visiblePages.includes(item.id))
          .map(item => {
            const active = current === item.id;
            return (
              <button key={item.id} onClick={() => onChange(item.id)} title={collapsed ? item.label : undefined}
                className={`nav-item w-full flex items-center gap-3 px-3 py-2.5 text-left ${active ? 'active' : ''}`}
                style={{ color: active ? '#C5A059' : 'rgba(255,255,255,0.48)' }}>
                <span className="shrink-0" style={{ opacity: active ? 1 : 0.72 }}>{item.icon}</span>
                {!collapsed && <span className="text-xs tracking-wider font-light truncate">{item.label}</span>}
              </button>
            );
          })}
      </nav>

      {/* Footer */}
      <div className="soft-border-top p-3 space-y-1.5">
        {!collapsed && profile && (
          <div className="sidebar-user-card px-2.5 py-2 animate-fade-in">
            <p className="text-white text-xs font-medium truncate">{profile.full_name}</p>
            <p className="text-xs capitalize text-gold-muted mt-0.5">{profile.role}</p>
          </div>
        )}

        <button onClick={() => signOut()}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left"
          style={{ color: 'rgba(255,255,255,0.36)', transition: 'color 0.22s, background 0.22s' }}
          onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = '#ef4444'; b.style.background = 'rgba(239,68,68,0.07)'; }}
          onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = 'rgba(255,255,255,0.36)'; b.style.background = 'transparent'; }}>
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span className="text-xs tracking-wider font-light">Cerrar Sesión</span>}
        </button>

        <button onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 rounded-lg"
          style={{ color: 'rgba(197,160,89,0.38)', transition: 'color 0.22s, background 0.22s' }}
          onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = '#C5A059'; b.style.background = 'rgba(197,160,89,0.06)'; }}
          onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = 'rgba(197,160,89,0.38)'; b.style.background = 'transparent'; }}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}

// ── Navegación móvil ──────────────────────────────────────────────────────────
type MobileNavProps = {
  current: Page;
  onChange: (p: Page) => void;
  role: string;
  visiblePages: Page[];
  profile: any;
  signOut: () => void;
};

const MOBILE_ICONS: Record<string, React.ReactNode> = {
  dashboard:    <LayoutDashboard size={20} />,
  pos:          <ShoppingCart    size={20} />,
  customers:    <Users           size={20} />,
  crm:          <Bell            size={20} />,
  lab:          <FlaskConical    size={20} />,
  commissions:  <Trophy          size={20} />,
  cash:         <DollarSign      size={20} />,
  balances:     <AlertCircle     size={20} />,
  reports:      <BarChart3       size={20} />,
  simulator:    <Eye             size={20} />,
  branches:     <Building2       size={20} />,
  settings:     <Settings        size={20} />,
  sales_history:<ClipboardList   size={20} />,
  stock:        <Package         size={20} />,
};

const MOBILE_LABELS: Record<string, string> = {
  dashboard:    'Inicio',
  pos:          'Ventas',
  customers:    'Clientes',
  crm:          'CRM',
  lab:          'Lab',
  commissions:  'Premios',
  cash:         'Caja',
  balances:     'Saldos',
  reports:      'Reportes',
  simulator:    'Simul.',
  branches:     'Sucursales',
  settings:     'Config.',
  sales_history:'Mis Ventas',
  stock:        'Stock',
};

function MobileNav({ current, onChange, role, visiblePages, profile, signOut }: MobileNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const primaryPages: Page[] = (() => {
    if (role === 'laboratorio') return ['lab'];
    if (role === 'vendedora')   return ['pos', 'sales_history', 'cash', 'balances'];
    return ['dashboard', 'pos', 'cash', 'balances'];
  })();

  const secondaryPages = visiblePages.filter(p => !primaryPages.includes(p));

  return (
    <>
      {/* Header móvil */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(10,9,7,0.97)', borderBottom: '1px solid rgba(197,160,89,0.15)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(197,160,89,0.15)', border: '1px solid rgba(197,160,89,0.3)' }}>
            <Glasses size={14} style={{ color: '#C5A059' }} />
          </div>
          <div>
            <p className="text-xs font-medium tracking-wider text-white leading-tight">Óptica Excelent</p>
            <p className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.6)', fontSize: 10 }}>V10</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>{profile?.full_name?.split(' ')[0]}</span>
          <button onClick={() => setMenuOpen(!menuOpen)}
            className="flex flex-col gap-1 p-2 rounded-lg"
            style={{ background: menuOpen ? 'rgba(197,160,89,0.15)' : 'rgba(255,255,255,0.06)' }}>
            {menuOpen ? <X size={18} style={{ color: '#C5A059' }} /> : (
              <>
                <span className="block w-5 h-0.5 rounded" style={{ background: 'rgba(197,160,89,0.8)' }} />
                <span className="block w-5 h-0.5 rounded" style={{ background: 'rgba(197,160,89,0.8)' }} />
                <span className="block w-5 h-0.5 rounded" style={{ background: 'rgba(197,160,89,0.8)' }} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Menú lateral completo */}
      {menuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}>
          <div className="fixed top-0 right-0 bottom-0 w-64 flex flex-col"
            style={{ background: 'rgba(10,9,7,0.98)', borderLeft: '1px solid rgba(197,160,89,0.15)' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-4 pt-16 pb-4" style={{ borderBottom: '1px solid rgba(197,160,89,0.1)' }}>
              <p className="text-xs font-light text-white">{profile?.full_name}</p>
              <p className="text-xs font-light mt-0.5 capitalize" style={{ color: 'rgba(197,160,89,0.6)' }}>{profile?.role}</p>
            </div>
            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
              {visiblePages.map(page => {
                const active = current === page;
                return (
                  <button key={page} onClick={() => { onChange(page); setMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left"
                    style={{ background: active ? 'rgba(197,160,89,0.12)' : 'transparent', color: active ? '#C5A059' : 'rgba(255,255,255,0.55)' }}>
                    <span style={{ opacity: active ? 1 : 0.7 }}>{MOBILE_ICONS[page]}</span>
                    <span className="text-sm font-light">{MOBILE_LABELS[page] ?? page}</span>
                    {active && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: '#C5A059' }} />}
                  </button>
                );
              })}
            </nav>
            <div className="p-3" style={{ borderTop: '1px solid rgba(197,160,89,0.1)' }}>
              <button onClick={signOut}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl"
                style={{ color: 'rgba(239,68,68,0.7)', background: 'rgba(239,68,68,0.06)' }}>
                <LogOut size={18} />
                <span className="text-sm font-light">Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="h-14 shrink-0" />

      {/* Barra inferior */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center"
        style={{ background: 'rgba(10,9,7,0.97)', borderTop: '1px solid rgba(197,160,89,0.15)', backdropFilter: 'blur(12px)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {primaryPages.filter(p => visiblePages.includes(p)).map(page => {
          const active = current === page;
          return (
            <button key={page} onClick={() => onChange(page)}
              className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5"
              style={{ color: active ? '#C5A059' : 'rgba(255,255,255,0.38)' }}>
              <span style={{ opacity: active ? 1 : 0.6 }}>{MOBILE_ICONS[page]}</span>
              <span style={{ fontSize: 9, fontWeight: 300, letterSpacing: '0.05em' }}>{MOBILE_LABELS[page]}</span>
              {active && <span className="w-1 h-1 rounded-full" style={{ background: '#C5A059' }} />}
            </button>
          );
        })}
        {secondaryPages.length > 0 && (
          <button onClick={() => setMenuOpen(true)}
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5"
            style={{ color: 'rgba(255,255,255,0.38)' }}>
            <ChevronDown size={20} style={{ opacity: 0.6 }} />
            <span style={{ fontSize: 9, fontWeight: 300 }}>Más</span>
          </button>
        )}
      </div>

      <div className="h-16 shrink-0" />
    </>
  );
}
