import { useEffect, useState } from 'react';
import { Building2, MapPin, Phone, ShoppingBag, TrendingUp, Users } from 'lucide-react';
import { supabase, Branch } from '../lib/supabase';
import { getSales } from '../lib/salesStorage';

type BranchStats = Branch & {
  salesCount: number;
  totalRevenue: number;
  localSalesCount: number;
  localRevenue: number;
};

const BRANCH_IMAGES = [
  'https://images.pexels.com/photos/1005638/pexels-photo-1005638.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3184639/pexels-photo-3184639.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/1181304/pexels-photo-1181304.jpeg?auto=compress&cs=tinysrgb&w=600',
];

function fmt(n: number) {
  return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<BranchStats[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);

    const { data: branchData } = await supabase.from('branches').select('*').order('name');
    const { data: salesData  } = await supabase.from('sales').select('branch_id, total');

    // Aggregate localStorage sales by branch name
    const localSales = getSales();
    const localByName: Record<string, { count: number; total: number }> = {};
    for (const s of localSales) {
      const bn = (s.sucursalVenta || '').trim();
      if (!bn) continue;
      if (!localByName[bn]) localByName[bn] = { count: 0, total: 0 };
      localByName[bn].count++;
      localByName[bn].total += Number(s.total) || 0;
    }

    const stats: BranchStats[] = (branchData || []).map(b => {
      const dbSales = (salesData || []).filter(s => s.branch_id === b.id);
      const loc = localByName[b.name] ?? { count: 0, total: 0 };
      return {
        ...b,
        salesCount:      dbSales.length,
        totalRevenue:    dbSales.reduce((a, s) => a + Number(s.total), 0),
        localSalesCount: loc.count,
        localRevenue:    loc.total,
      };
    });

    // Append any localStorage-only branch names not in Supabase
    const knownNames = new Set(stats.map(b => b.name));
    Object.entries(localByName).forEach(([name, loc]) => {
      if (knownNames.has(name)) return;
      stats.push({
        id: `local-${name}`, name, address: null as any, phone: null as any,
        salesCount: 0, totalRevenue: 0,
        localSalesCount: loc.count, localRevenue: loc.total,
      });
    });

    setBranches(stats);
    setLoading(false);
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-light tracking-wider text-white">Sucursales</h1>
          <p className="text-xs font-light mt-0.5 tracking-wide" style={{ color: 'rgba(197,160,89,0.65)' }}>
            Red de sedes · Optica Yolanda
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-light"
          style={{ background: 'rgba(197,160,89,0.07)', border: '1px solid rgba(197,160,89,0.20)', color: '#C5A059' }}>
          <Building2 size={12} />
          {branches.length} sedes activas
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-72 rounded-2xl shimmer" />
          ))}
        </div>
      ) : branches.length === 0 ? (
        <div className="text-center py-20">
          <Building2 size={36} className="mx-auto mb-3" style={{ color: 'rgba(197,160,89,0.25)' }} />
          <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.28)' }}>
            No hay sucursales configuradas
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {branches.map((branch, i) => {
            const totalCount   = branch.salesCount + branch.localSalesCount;
            const totalRevenue = branch.totalRevenue + branch.localRevenue;

            return (
              <div
                key={branch.id}
                className="rounded-2xl overflow-hidden group transition-all duration-300"
                style={{
                  background: 'rgba(255,255,255,0.018)',
                  border: '1px solid rgba(197,160,89,0.18)',
                  transition: 'border-color 0.28s, box-shadow 0.28s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(197,160,89,0.42)';
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(197,160,89,0.08)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(197,160,89,0.18)';
                  e.currentTarget.style.boxShadow = 'none';
                }}>

                {/* Photo strip */}
                <div className="relative h-36 overflow-hidden">
                  <img
                    src={BRANCH_IMAGES[i % BRANCH_IMAGES.length]}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    alt={branch.name}
                  />
                  <div className="absolute inset-0"
                    style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.75) 100%)' }} />

                  {/* Name overlay */}
                  <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                    <div>
                      <h3 className="text-white text-lg font-light tracking-wider leading-tight">
                        {branch.name}
                      </h3>
                    </div>
                    {/* Active dot */}
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                        style={{ boxShadow: '0 0 6px rgba(52,211,153,0.9)' }} />
                      <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.55)' }}>Activa</span>
                    </div>
                  </div>
                </div>

                {/* Info body */}
                <div className="p-4 space-y-3">
                  {/* Address & phone */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-light"
                      style={{ color: 'rgba(255,255,255,0.42)' }}>
                      <MapPin size={11} style={{ color: '#C5A059', flexShrink: 0 }} />
                      <span className="truncate">{branch.address || 'Direccion no configurada'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-light"
                      style={{ color: 'rgba(255,255,255,0.42)' }}>
                      <Phone size={11} style={{ color: '#C5A059', flexShrink: 0 }} />
                      {branch.phone || 'Telefono no configurado'}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-2.5 pt-2"
                    style={{ borderTop: '1px solid rgba(197,160,89,0.10)' }}>
                    <div className="rounded-xl p-3 text-center"
                      style={{ background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.10)' }}>
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <ShoppingBag size={11} style={{ color: '#C5A059' }} />
                        <span className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.65)' }}>Ventas</span>
                      </div>
                      <p className="text-xl font-light text-white">{totalCount}</p>
                    </div>
                    <div className="rounded-xl p-3 text-center"
                      style={{ background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.10)' }}>
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <TrendingUp size={11} style={{ color: '#C5A059' }} />
                        <span className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.65)' }}>Ingresos</span>
                      </div>
                      <p className="text-sm font-light text-white leading-tight">
                        Gs. {fmt(totalRevenue)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
