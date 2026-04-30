import { useEffect, useState } from 'react';
import { Building2, MapPin, Phone, TrendingUp } from 'lucide-react';
import { supabase, Branch } from '../lib/supabase';

type BranchStats = Branch & { salesCount: number; totalRevenue: number };

const BRANCH_IMAGES = [
  'https://images.pexels.com/photos/1005638/pexels-photo-1005638.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3184639/pexels-photo-3184639.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/1181304/pexels-photo-1181304.jpeg?auto=compress&cs=tinysrgb&w=600',
];

export default function BranchesPage() {
  const [branches, setBranches] = useState<BranchStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: branchData } = await supabase.from('branches').select('*');
      const { data: salesData } = await supabase.from('sales').select('branch_id, total');

      const stats = (branchData || []).map(b => {
        const branchSales = (salesData || []).filter(s => s.branch_id === b.id);
        return {
          ...b,
          salesCount: branchSales.length,
          totalRevenue: branchSales.reduce((acc, s) => acc + Number(s.total), 0)
        };
      });

      setBranches(stats);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl text-white font-light tracking-wider">Sucursales</h1>
        <p className="text-sm font-light mt-1" style={{ color: 'rgba(197,160,89,0.7)' }}>
          Red de 4 sucursales · Óptica Yolanda
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-64 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {branches.map((branch, i) => (
            <div key={branch.id} className="rounded-2xl border overflow-hidden group transition-all duration-300"
              style={{ borderColor: 'rgba(197,160,89,0.2)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(197,160,89,0.5)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(197,160,89,0.2)')}>
              <div className="relative h-36 overflow-hidden">
                <img src={BRANCH_IMAGES[i % BRANCH_IMAGES.length]} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={branch.name} />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.8))' }} />
                <div className="absolute bottom-3 left-4">
                  <h3 className="text-white text-lg font-light tracking-wider">{branch.name}</h3>
                </div>
                <div className="absolute top-3 right-3">
                  <div className="w-2 h-2 rounded-full bg-green-400 shadow-lg"
                    style={{ boxShadow: '0 0 8px rgba(74,222,128,0.8)' }} />
                </div>
              </div>

              <div className="p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center gap-2 text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <MapPin size={12} style={{ color: '#C5A059' }} />
                  {branch.address || 'Dirección no configurada'}
                </div>
                <div className="flex items-center gap-2 text-xs font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <Phone size={12} style={{ color: '#C5A059' }} />
                  {branch.phone || 'Teléfono no configurado'}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t" style={{ borderColor: 'rgba(197,160,89,0.1)' }}>
                  <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(197,160,89,0.06)' }}>
                    <p className="text-lg text-white font-light">{branch.salesCount}</p>
                    <p className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.6)' }}>Ventas</p>
                  </div>
                  <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(197,160,89,0.06)' }}>
                    <p className="text-sm text-white font-light">Gs. {branch.totalRevenue.toLocaleString()}</p>
                    <p className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.6)' }}>Ingresos</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
