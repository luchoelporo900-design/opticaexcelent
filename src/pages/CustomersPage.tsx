import { useEffect, useState } from 'react';
import { Search, UserPlus, Eye, Phone, MessageCircle } from 'lucide-react';
import { supabase, Customer } from '../lib/supabase';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    setCustomers(data || []);
    setLoading(false);
  }

  const filtered = customers.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.ci.includes(search) ||
    c.phone?.includes(search)
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-white font-light tracking-wider">Clientes</h1>
          <p className="text-sm font-light mt-1" style={{ color: 'rgba(197,160,89,0.7)' }}>
            {customers.length} clientes registrados
          </p>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(197,160,89,0.5)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, C.I. o teléfono..."
          className="w-full pl-9 pr-4 py-3 rounded-xl text-sm bg-transparent text-white outline-none border"
          style={{ borderColor: 'rgba(197,160,89,0.25)', background: 'rgba(255,255,255,0.03)' }} />
      </div>

      <div className="rounded-xl border overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(197,160,89,0.15)' }}>
        {loading ? (
          <div className="p-8 space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <UserPlus size={32} className="mx-auto mb-3 opacity-20" style={{ color: '#C5A059' }} />
            <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {search ? 'No se encontraron clientes' : 'No hay clientes registrados aún'}
            </p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(197,160,89,0.1)' }}>
                {['Nombre', 'C.I.', 'Teléfono', 'WhatsApp', 'Email', 'Fecha Registro', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-light tracking-wider uppercase"
                    style={{ color: 'rgba(197,160,89,0.6)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(customer => (
                <tr key={customer.id} className="border-b transition-colors"
                  style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(197,160,89,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td className="px-4 py-3 text-white font-light">{customer.full_name}</td>
                  <td className="px-4 py-3 font-mono font-light" style={{ color: '#C5A059' }}>{customer.ci}</td>
                  <td className="px-4 py-3 font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>{customer.phone || '-'}</td>
                  <td className="px-4 py-3 font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>{customer.whatsapp || '-'}</td>
                  <td className="px-4 py-3 font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>{customer.email || '-'}</td>
                  <td className="px-4 py-3 font-light" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {new Date(customer.created_at).toLocaleDateString('es-PY')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelected(customer)}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ color: 'rgba(197,160,89,0.5)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#C5A059')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(197,160,89,0.5)')}>
                        <Eye size={14} />
                      </button>
                      {(customer.whatsapp || customer.phone) && (
                        <a href={`https://wa.me/595${(customer.whatsapp || customer.phone || '').replace(/\D/g, '').replace(/^0/, '')}`}
                          target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-lg transition-all"
                          style={{ color: 'rgba(37,211,102,0.5)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#25d366')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(37,211,102,0.5)')}>
                          <MessageCircle size={14} />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Customer detail modal */}
      {selected && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setSelected(null)}>
          <div className="w-full max-w-md rounded-2xl border p-6 space-y-4"
            style={{ background: '#0a0a0a', borderColor: 'rgba(197,160,89,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-white font-light tracking-wider">Ficha del Cliente</h3>
              <button onClick={() => setSelected(null)} style={{ color: 'rgba(255,255,255,0.4)' }}>✕</button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Nombre', value: selected.full_name },
                { label: 'C.I.', value: selected.ci },
                { label: 'Teléfono', value: selected.phone || '-' },
                { label: 'WhatsApp', value: selected.whatsapp || '-' },
                { label: 'Email', value: selected.email || '-' },
                { label: 'Dirección', value: selected.address || '-' },
                { label: 'Fecha nacimiento', value: selected.birth_date ? new Date(selected.birth_date).toLocaleDateString('es-PY') : '-' },
                { label: 'Notas', value: selected.notes || '-' },
              ].map(f => (
                <div key={f.label} className="flex justify-between text-sm">
                  <span className="font-light" style={{ color: 'rgba(197,160,89,0.6)' }}>{f.label}</span>
                  <span className="font-light text-white text-right ml-4">{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
