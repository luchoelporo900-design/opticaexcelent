import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BranchProvider, useBranch } from './context/BranchContext';
import LoginPage from './pages/LoginPage';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import POSPage from './pages/POSPage';
import CustomersPage from './pages/CustomersPage';
import CRMPage from './pages/CRMPage';
import LabPage from './pages/LabPage';
import SimulatorPage from './pages/SimulatorPage';
import BranchesPage from './pages/BranchesPage';
import SettingsPage from './pages/SettingsPage';
import CommissionsPage from './pages/CommissionsPage';
import CashPage from './pages/CashPage';
import ReportPage from './pages/ReportPage';
import BalancesPage from './pages/BalancesPage';

type Page = 'dashboard' | 'pos' | 'customers' | 'lab' | 'simulator' | 'branches' | 'crm' | 'settings' | 'commissions' | 'cash' | 'reports' | 'balances';

function AppContent() {
  const { user, loading, devMode, profile } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');
  const [sidebarSearch, setSidebarSearch] = useState('');

  const { setActiveBranchId, branches } = useBranch();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'gerente';

  // Auto-set active branch to the user's assigned branch when profile loads
  useEffect(() => {
    if (profile?.branch_id && branches.length > 0) {
      setActiveBranchId(profile.branch_id);
    }
  }, [profile?.branch_id, branches.length]);

  // Redirect non-admins away from settings if they somehow land there
  useEffect(() => {
    if (page === 'settings' && profile && !isAdmin) setPage('dashboard');
  }, [profile, page, isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center"
        style={{
          background:
            'radial-gradient(ellipse 80% 55% at 50% 0%, rgba(197,160,89,0.042) 0%, transparent 58%), #000',
        }}>
        <div className="text-center space-y-5 animate-fade-in">
          <div className="gold-spinner mx-auto" />
          <div>
            <p className="text-xs font-light tracking-[0.28em] uppercase text-gold-muted">
              Óptica Yolanda
            </p>
            <p className="text-xs font-light tracking-widest mt-1" style={{ color: 'rgba(255,255,255,0.20)' }}>
              cargando sistema...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user && !devMode) return <LoginPage />;

  const pages: Record<Page, React.ReactNode> = {
    dashboard: <Dashboard />,
    pos: <POSPage />,
    customers: <CustomersPage initialSearch={sidebarSearch} onSearchConsumed={() => setSidebarSearch('')} />,
    crm: <CRMPage />,
    lab: <LabPage />,
    commissions: <CommissionsPage />,
    simulator: <SimulatorPage />,
    branches: <BranchesPage />,
    settings: <SettingsPage />,
    cash: <CashPage />,
    reports: <ReportPage />,
    balances: <BalancesPage />,
  };

  return (
    <div className="flex min-h-screen bg-black">
      <Sidebar current={page} onChange={(p, q) => { setPage(p); if (q) setSidebarSearch(q); }} />
      <main className="flex-1 overflow-y-auto min-h-screen cinematic-bg animate-fade-in">
        {pages[page]}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BranchProvider>
        <AppContent />
      </BranchProvider>
    </AuthProvider>
  );
}
