import { useEffect, useState } from 'react';
import { Building2, MapPin, Phone, ShoppingBag, TrendingUp } from 'lucide-react';
import { getSales } from '../lib/salesStorage';

const SUCURSALES = ['Azara', 'Fernando', 'Caacupé', 'La Fina'];

const BRANCH_IMAGES = [
  'https://images.pexels.com/photos/1005638/pexels-photo-1005638.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3184639/pexels-photo-3184639.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/1181304/pexels-photo-1181304.jpeg?auto=compress&cs=tinysrgb&w=600',
];

const BRANCH_INFO: Record<string, { address: string; phone: string }> = {
  'Azara':    { address: 'Sucursal Azara',    phone: '0981-000001' },
  'Fernando': { address: 'Sucursal Fernando', phone: '0981-000002' },
  'Caacupé':  { address: 'Sucursal Caacupé',  phone: '0981-000003' },
  'La Fina':  { address: 'Sucursal La Fina',  phone: '0981-000004' },
};

function fmt(n: number) {
  return n.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function branchMatch(stored: string, name: string): boolean {
  const normalize = (s: string) => s.toLowerCase()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ü/g, 'u');
  return normalize(stored).includes(normalize(name)) || normalize(name).includes(normalize(stored));
}

export default function BranchesPage() {
  const [stats, setStats] = useState<{ name: string; count: number; total: number }[]>([]);

  useEffect(() => {
    const localSales = getSales();
    const result = SUCURSALES.map(name => {
      const sales = localSales.filter(s => branchMatch(s.sucursalVenta || '', name));
      return {
        name,
        count: sales.length,
        total: sales.reduce((a, s) => a + (Number(s.total) || 0), 0),
      };
    });
    setStats(result);
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-5xl">

      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-light tracking-wider text-white">Sucursales</h1>
          <p className="text-xs font-light mt-0.5 tracking-wide" style={{ color: 'rgba(197,160,89,0.65)' }}>
            Red de sedes · Óptica Yolanda
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-light"
          style={{ background: 'rgba(197,160,89,0.07)', border: '1px solid rgba(197,160,89,0.20)', color: '#C5A059' }}>
          <Building2 size={12} />
          {SUCURSALES.length} sedes activas
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {SUCURSALES.map((name, i) => {
          const s    = stats.find(x => x.name === name) ?? { count: 0, total: 0 };
          const info = BRANCH_INFO[name] ?? { address: '', phone: '' };

          return (
            <div key={name} className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(197,160,89,0.18)', transition: 'border-color 0.28s, box-shadow 0.28s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(197,160,89,0.42)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(197,160,89,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(197,160,89,0.18)'; e.currentTarget.style.boxShadow = 'none'; }}>

              {/* Foto */}
              <div className="relative h-36 overflow-hidden">
                <img src={BRANCH_IMAGES[i % BRANCH_IMAGES.length]} className="w-full h-full object-cover" alt={name} />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.75) 100%)' }} />
                <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                  <h3 className="text-white text-lg font-light tracking-wider">{name}</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.9)' }} />
                    <span className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.55)' }}>Activa</span>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-4 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-light" style={{ color: 'rgba(255,255,255,0.42)' }}>
                    <MapPin size={11} style={{ color: '#C5A059', flexShrink: 0 }} />
                    <span>{info.address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-light" style={{ color: 'rgba(255,255,255,0.42)' }}>
                    <Phone size={11} style={{ color: '#C5A059', flexShrink: 0 }} />
                    {info.phone}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-2" style={{ borderTop: '1px solid rgba(197,160,89,0.10)' }}>
                  <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.10)' }}>
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <ShoppingBag size={11} style={{ color: '#C5A059' }} />
                      <span className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.65)' }}>Ventas</span>
                    </div>
                    <p className="text-xl font-light text-white">{s.count}</p>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.10)' }}>
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <TrendingUp size={11} style={{ color: '#C5A059' }} />
                      <span className="text-xs font-light" style={{ color: 'rgba(197,160,89,0.65)' }}>Ingresos</span>
                    </div>
                    <p className="text-sm font-light text-white leading-tight">Gs. {fmt(s.total)}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
