import { useState } from 'react';
import { Eye, Sun, Moon, Zap, Layers } from 'lucide-react';

type SimTab = 'multifocal' | 'antireflejo' | 'fotocromático' | 'espesores';
type MultifocalType = 'estandar' | 'digital' | '4khd' | 'quantum';

// ── Scene images ──────────────────────────────────────────────────────────────
// Multifocal: daytime driving road — clear foreground lane (near), road ahead
// (mid), vanishing point horizon (far) — perfect three-plane PAL demonstration
const SCENE_IMAGE =
  'https://images.unsplash.com/photo-1506015391300-4802dc74de2e?auto=format&fit=crop&q=80&w=2000';
// AR: night highway with oncoming car headlights — the canonical AR demo scene
const NIGHT_IMAGE =
  'https://images.unsplash.com/photo-1542223616-9de9adb5e3e8?auto=format&fit=crop&q=80&w=2000';
// Photochromic: outdoor bright daylight, person outside
const OUTDOOR_IMAGE =
  'https://images.pexels.com/photos/1172253/pexels-photo-1172253.jpeg?auto=compress&cs=tinysrgb&w=1400';

// ── Lens options ──────────────────────────────────────────────────────────────
type LensOption = {
  id: MultifocalType;
  label: string;
  sublabel: string;
  tag: string;
  tagColor: string;
  corridorW: number;   // INTERMEDIA zone width fraction (0→1)
  topW: number;        // LEJANA zone width fraction
  botW: number;        // CERCA zone width fraction
  blurPx: number;      // peripheral aberration blur (px)
  desc: string[];
};

const LENS_OPTIONS: LensOption[] = [
  {
    id: 'estandar', label: 'Estándar', sublabel: 'Pasillo estrecho',
    tag: 'Económico', tagColor: '#f59e0b',
    corridorW: 0.11, topW: 0.28, botW: 0.20, blurPx: 32,
    desc: ['Pasillo visual ~14mm', 'Aberraciones laterales pronunciadas', 'Adaptación 2–4 semanas'],
  },
  {
    id: 'digital', label: 'Digital', sublabel: 'Pasillo ampliado',
    tag: 'Recomendado', tagColor: '#3b82f6',
    corridorW: 0.24, topW: 0.44, botW: 0.34, blurPx: 16,
    desc: ['Pasillo visual ~17mm', 'Zona intermedia mejorada', 'Adaptación 1–2 semanas'],
  },
  {
    id: '4khd', label: '4K HD', sublabel: 'Campo visual amplio',
    tag: 'Premium', tagColor: '#10b981',
    corridorW: 0.42, topW: 0.68, botW: 0.56, blurPx: 7,
    desc: ['Pasillo visual ≥20mm', 'Diseño free-form computarizado', 'Adaptación casi inmediata'],
  },
  {
    id: 'quantum', label: 'Quantum IA', sublabel: 'Sin aberraciones',
    tag: 'Exclusivo', tagColor: '#C5A059',
    corridorW: 1, topW: 1, botW: 1, blurPx: 0,
    desc: ['Diseño asférico personalizado por IA', 'Visión 100% nítida de borde a borde', 'Adaptación inmediata'],
  },
];

type IndexOption = {
  value: string; label: string;
  thickness: number; relW: number; color: string;
};

const INDEX_OPTIONS: IndexOption[] = [
  { value: '1.50', label: 'Estándar',      thickness: 8.5, relW: 1.00, color: '#6b7280' },
  { value: '1.56', label: 'Delgado',       thickness: 7.2, relW: 0.82, color: '#3b82f6' },
  { value: '1.67', label: 'Muy delgado',   thickness: 5.4, relW: 0.60, color: '#10b981' },
  { value: '1.74', label: 'Ultra delgado', thickness: 3.8, relW: 0.42, color: '#C5A059' },
];

// ── SVG frame geometry (shared across simulators) ─────────────────────────────
// ViewBox: 960 × 460. Two elliptical lenses, side by side, luxury proportions.
const FW = 960, FH = 460;          // total frame viewBox
const LCY = 210;                   // lens centre Y
const LRX = 154, LRY = 118;       // lens radii (wide, cinematic proportions)
const LL_CX = 242, RL_CX = 718;   // left / right lens centre X
const BR_L = LL_CX + LRX + 3;    // bridge attach left
const BR_R = RL_CX - LRX - 3;    // bridge attach right

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────
export default function SimulatorPage() {
  const [tab,  setTab]  = useState<SimTab>('multifocal');
  const [lens, setLens] = useState<MultifocalType>('estandar');
  const [ar,   setAr]   = useState(false);
  const [tint, setTint] = useState(0);
  const [idx,  setIdx]  = useState('1.50');

  const curLens = LENS_OPTIONS.find(o => o.id === lens)!;
  const curIdx  = INDEX_OPTIONS.find(o => o.value === idx)!;

  return (
    <div className="p-6 space-y-6" style={{ background: '#000', minHeight: '100%' }}>

      <div>
        <h1 className="text-2xl font-light tracking-wider text-white">Simuladores de Lentes</h1>
        <p className="text-sm font-light mt-1" style={{ color: 'rgba(197,160,89,0.65)' }}>
          Demostración fotorrealista para clientes — Óptica Yolanda
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap">
        {([
          { id: 'multifocal',    label: 'Multifocal',          icon: <Layers size={14} /> },
          { id: 'antireflejo',   label: 'Anti-Reflejo',        icon: <Eye    size={14} /> },
          { id: 'fotocromático', label: 'Fotocromático',       icon: <Sun    size={14} /> },
          { id: 'espesores',     label: 'Índices / Espesores', icon: <Zap    size={14} /> },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-light transition-all duration-200"
            style={{
              background: tab === t.id ? 'rgba(197,160,89,0.14)' : 'rgba(255,255,255,0.03)',
              color:      tab === t.id ? '#C5A059'               : 'rgba(255,255,255,0.45)',
              border:    `1px solid ${tab === t.id ? 'rgba(197,160,89,0.38)' : 'rgba(255,255,255,0.07)'}`,
            }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ════ MULTIFOCAL ════ */}
      {tab === 'multifocal' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {LENS_OPTIONS.map(opt => {
              const on = lens === opt.id;
              return (
                <button key={opt.id} onClick={() => setLens(opt.id)}
                  className="flex flex-col items-start p-3 rounded-xl text-left transition-all duration-200"
                  style={{
                    background: on ? 'rgba(197,160,89,0.07)' : 'rgba(255,255,255,0.02)',
                    border:    `1px solid ${on ? 'rgba(197,160,89,0.44)' : 'rgba(255,255,255,0.06)'}`,
                    boxShadow:  on ? `0 0 22px ${opt.tagColor}28` : 'none',
                  }}>
                  <span className="text-xs px-2 py-0.5 rounded-full mb-2 font-light"
                    style={{
                      background: on ? `${opt.tagColor}22` : 'rgba(255,255,255,0.05)',
                      color:      on ?  opt.tagColor        : 'rgba(255,255,255,0.3)',
                    }}>
                    {opt.tag}
                  </span>
                  <p className="text-xs font-semibold" style={{ color: on ? '#fff' : 'rgba(255,255,255,0.55)' }}>
                    {opt.label}
                  </p>
                  <p className="text-xs mt-0.5 font-light" style={{ color: 'rgba(255,255,255,0.32)' }}>
                    {opt.sublabel}
                  </p>
                </button>
              );
            })}
          </div>

          <MultifocalFrame image={SCENE_IMAGE} lens={curLens} />

          <div className="rounded-xl border p-5 space-y-3"
            style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(197,160,89,0.12)' }}>
            <p className="text-xs tracking-widest uppercase font-light" style={{ color: 'rgba(197,160,89,0.6)' }}>
              Amplitud del Pasillo Visual
            </p>
            <div className="space-y-2.5">
              {LENS_OPTIONS.map(opt => (
                <div key={opt.id} className="flex items-center gap-3">
                  <span className="text-xs font-light w-20 shrink-0"
                    style={{ color: lens === opt.id ? opt.tagColor : 'rgba(255,255,255,0.38)' }}>
                    {opt.label}
                  </span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${opt.corridorW * 100}%`,
                        background: lens === opt.id
                          ? `linear-gradient(to right,${opt.tagColor},${opt.tagColor}aa)`
                          : 'rgba(255,255,255,0.12)',
                      }} />
                  </div>
                  <span className="text-xs font-light w-8 text-right shrink-0"
                    style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {Math.round(opt.corridorW * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════ ANTI-REFLEJO ════ */}
      {tab === 'antireflejo' && (
        <div className="space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.6)' }}>
              Tratamiento Anti-Reflejo
            </p>
            <button onClick={() => setAr(!ar)}
              className="relative w-14 h-7 rounded-full transition-all duration-300"
              style={{ background: ar ? 'linear-gradient(to right,#C5A059,#8B6914)' : 'rgba(255,255,255,0.12)' }}>
              <div className="absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all duration-300"
                style={{ left: ar ? '1.75rem' : '0.25rem' }} />
            </button>
            <span className="text-xs font-light" style={{ color: ar ? '#C5A059' : 'rgba(255,255,255,0.38)' }}>
              {ar ? 'Con Anti-Reflejo Premium' : 'Sin Anti-Reflejo'}
            </span>
          </div>

          <ARGlassesFrame image={NIGHT_IMAGE} withAR={ar} />

          <div className="p-4 rounded-xl border text-xs font-light"
            style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(197,160,89,0.14)' }}>
            <p className="text-white text-sm font-light mb-3">¿Qué elimina el Anti-Reflejo?</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Destellos tipo starburst',     color: '#ef4444' },
                { label: 'Halos alrededor de faros',     color: '#f59e0b' },
                { label: 'Fatiga visual nocturna',       color: '#3b82f6' },
                { label: 'Reflejos fantasma en cristal', color: '#10b981' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2"
                  style={{ color: 'rgba(255,255,255,0.48)' }}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════ FOTOCROMÁTICO ════ */}
      {tab === 'fotocromático' && (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Sun  size={15} style={{ color: '#f59e0b' }} />
                <p className="text-xs font-light tracking-widest uppercase" style={{ color: 'rgba(197,160,89,0.6)' }}>
                  Oscurecimiento Transitions Gen 8
                </p>
                <Moon size={15} style={{ color: '#6b7280' }} />
              </div>
              <span className="text-xs font-light px-3 py-1 rounded-full"
                style={{ background: 'rgba(197,160,89,0.1)', color: '#C5A059' }}>
                {tint === 0  ? 'Transparente'  :
                 tint < 25   ? 'Leve tinte'     :
                 tint < 55   ? 'Moderado'        :
                 tint < 82   ? 'Gris Carbón'     : 'Máximo'} — {tint}%
              </span>
            </div>
            <input type="range" min={0} max={100} value={tint}
              onChange={e => setTint(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right,#C5A059 ${tint}%,rgba(255,255,255,0.1) ${tint}%)` }}
            />
            <div className="flex justify-between text-xs font-light" style={{ color: 'rgba(255,255,255,0.28)' }}>
              <span>Interior / Nublado</span>
              <span>Sol directo (100%)</span>
            </div>
          </div>
          <PhotochromicFrame image={OUTDOOR_IMAGE} tint={tint} />
          <div className="rounded-xl border p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(197,160,89,0.12)' }}>
            <p className="text-xs tracking-widest uppercase font-light" style={{ color: 'rgba(197,160,89,0.6)' }}>
              Escala Transitions
            </p>
            <div className="flex gap-0.5 h-6 rounded-lg overflow-hidden">
              {[...Array(20)].map((_, i) => (
                <div key={i} className="flex-1" style={{
                  background: `rgba(${28-i*1.2},${28-i*1.2},${28-i*0.9},${0.06+i*0.056})`,
                  outline: Math.round(tint/5) === i ? '2px solid #C5A059' : 'none',
                  outlineOffset: '-2px',
                }} />
              ))}
            </div>
            <div className="flex justify-between text-xs font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <span>Transparente</span><span>Gris Carbón 85%</span>
            </div>
          </div>
        </div>
      )}

      {/* ════ ESPESORES ════ */}
      {tab === 'espesores' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {INDEX_OPTIONS.map(opt => {
              const on = idx === opt.value;
              return (
                <button key={opt.value} onClick={() => setIdx(opt.value)}
                  className="flex flex-col items-start p-4 rounded-xl text-left transition-all duration-200"
                  style={{
                    background: on ? 'rgba(197,160,89,0.07)' : 'rgba(255,255,255,0.02)',
                    border:    `1px solid ${on ? 'rgba(197,160,89,0.44)' : 'rgba(255,255,255,0.06)'}`,
                    boxShadow:  on ? `0 0 24px ${opt.color}22` : 'none',
                  }}>
                  <p className="text-2xl font-light mb-1" style={{ color: on ? opt.color : 'rgba(255,255,255,0.45)' }}>
                    {opt.value}
                  </p>
                  <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.38)' }}>{opt.label}</p>
                  <p className="text-xs mt-2 font-medium" style={{ color: on ? opt.color : 'rgba(255,255,255,0.2)' }}>
                    {opt.thickness}mm centro
                  </p>
                </button>
              );
            })}
          </div>
          <div className="rounded-xl border p-6 space-y-5"
            style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(197,160,89,0.14)' }}>
            <p className="text-xs tracking-widest uppercase font-light" style={{ color: 'rgba(197,160,89,0.6)' }}>
              Corte transversal — Índice {idx} · {curIdx.thickness}mm
            </p>
            <LensCrossSection idx={curIdx} />
          </div>
          <div className="p-4 rounded-xl border text-xs font-light space-y-2"
            style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(197,160,89,0.12)' }}>
            <p className="text-white text-sm font-light mb-2">¿Cuál índice elegir?</p>
            {[
              { v: '1.50', c: '#6b7280', t: 'Recetas bajas (hasta ±2.00). Opción más económica.' },
              { v: '1.56', c: '#3b82f6', t: 'Recetas moderadas (±2.00 a ±4.00). Buen balance.' },
              { v: '1.67', c: '#10b981', t: 'Recetas altas (±4.00 a ±6.00). Lente fino.' },
              { v: '1.74', c: '#C5A059', t: 'Recetas muy altas (>±6.00). Ultra delgado.' },
            ].map(r => (
              <p key={r.v} style={{ color: 'rgba(255,255,255,0.48)' }}>
                · <span style={{ color: r.c }}>{r.v}</span> — {r.t}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared SVG frame <defs> — gold gradients, AR shimmer, bevel, hinges
// Rendered once, referenced by both MultifocalFrame and ARGlassesFrame.
// ─────────────────────────────────────────────────────────────────────────────
function FrameDefs() {
  return (
    <defs>
      <linearGradient id="fg" x1="0%" y1="0%" x2="100%" y2="120%">
        <stop offset="0%"   stopColor="#F5E090" />
        <stop offset="22%"  stopColor="#D4AC60" />
        <stop offset="55%"  stopColor="#C5A059" />
        <stop offset="78%"  stopColor="#9A7328" />
        <stop offset="100%" stopColor="#6B4A0E" />
      </linearGradient>
      <linearGradient id="fg2" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"   stopColor="#F0D880" />
        <stop offset="50%"  stopColor="#C5A059" />
        <stop offset="100%" stopColor="#7A5214" />
      </linearGradient>
      {/* AR iridescent coating shimmer on lens edge */}
      <linearGradient id="far" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"   stopColor="rgba(0,240,180,0.60)" />
        <stop offset="40%"  stopColor="rgba(0,160,255,0.28)" />
        <stop offset="100%" stopColor="rgba(0,220,180,0.52)" />
      </linearGradient>
      {/* Lens bevel: top-left specular highlight */}
      <linearGradient id="fbev" x1="18%" y1="0%" x2="82%" y2="100%">
        <stop offset="0%"   stopColor="rgba(255,255,255,0.22)" />
        <stop offset="52%"  stopColor="rgba(255,255,255,0.06)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
      </linearGradient>
      {/* Hinge screw face */}
      <radialGradient id="fhn" cx="38%" cy="32%" r="62%">
        <stop offset="0%"   stopColor="#F0D880" />
        <stop offset="60%"  stopColor="#C5A059" />
        <stop offset="100%" stopColor="#5A3A08" />
      </radialGradient>
      {/* Nose pad */}
      <radialGradient id="fnp" cx="50%" cy="30%" r="55%">
        <stop offset="0%"   stopColor="#E8CC70" />
        <stop offset="100%" stopColor="#8B6018" />
      </radialGradient>
    </defs>
  );
}

// Draws the physical frame elements: temple arms, bridge, lens rings, hinges.
// Does NOT fill lens interiors — caller places lens content behind the SVG.
function FrameShape({ showLabels = false, leftLabel = '', rightLabel = '' }: {
  showLabels?: boolean; leftLabel?: string; rightLabel?: string;
}) {
  const hinge = LCY - LRY + 28;   // hinge Y position

  return (
    <>
      {/* ── Temple shadows (rendered first, behind arms) ── */}
      <path
        d={`M ${LL_CX - LRX + 10} ${hinge} L 44 ${hinge - 32} L 24 ${LCY + LRY + 12}`}
        fill="none" stroke="rgba(0,0,0,0.30)" strokeWidth="10"
        strokeLinecap="round" strokeLinejoin="round" transform="translate(2,3)"
      />
      <path
        d={`M ${RL_CX + LRX - 10} ${hinge} L ${FW - 44} ${hinge - 32} L ${FW - 24} ${LCY + LRY + 12}`}
        fill="none" stroke="rgba(0,0,0,0.30)" strokeWidth="10"
        strokeLinecap="round" strokeLinejoin="round" transform="translate(-2,3)"
      />

      {/* ── Left temple arm ── */}
      <path
        d={`M ${LL_CX - LRX + 10} ${hinge} L 44 ${hinge - 32} L 24 ${LCY + LRY + 12}`}
        fill="none" stroke="url(#fg)" strokeWidth="9"
        strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Highlight streak on temple */}
      <path
        d={`M ${LL_CX - LRX + 10} ${hinge} L 44 ${hinge - 32}`}
        fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* ── Right temple arm ── */}
      <path
        d={`M ${RL_CX + LRX - 10} ${hinge} L ${FW - 44} ${hinge - 32} L ${FW - 24} ${LCY + LRY + 12}`}
        fill="none" stroke="url(#fg2)" strokeWidth="9"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d={`M ${RL_CX + LRX - 10} ${hinge} L ${FW - 44} ${hinge - 32}`}
        fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* ── Bridge ── */}
      <path
        d={`M ${BR_L} ${LCY - 20} C ${BR_L + 22} ${LCY - 62}, ${BR_R - 22} ${LCY - 62}, ${BR_R} ${LCY - 20}`}
        fill="none" stroke="url(#fg)" strokeWidth="7" strokeLinecap="round"
      />
      {/* Bridge highlight */}
      <path
        d={`M ${BR_L} ${LCY - 20} C ${BR_L + 22} ${LCY - 62}, ${BR_R - 22} ${LCY - 62}, ${BR_R} ${LCY - 20}`}
        fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="2" strokeLinecap="round"
      />

      {/* ── Nose pad detail ── */}
      {[BR_L - 4, BR_R + 4].map((px, i) => (
        <g key={i}>
          <ellipse cx={px + (i === 0 ? -6 : 6)} cy={LCY - 12} rx="6" ry="9"
            fill="url(#fnp)" opacity="0.80" />
        </g>
      ))}

      {/* ── LEFT LENS ring ── */}
      {/* Drop shadow */}
      <ellipse cx={LL_CX + 2} cy={LCY + 4} rx={LRX + 7} ry={LRY + 7}
        fill="none" stroke="rgba(0,0,0,0.48)" strokeWidth="12" />
      {/* AR iridescent shimmer */}
      <ellipse cx={LL_CX} cy={LCY} rx={LRX + 2} ry={LRY + 2}
        fill="none" stroke="url(#far)" strokeWidth="3.5" opacity="0.72" />
      {/* Main gold ring */}
      <ellipse cx={LL_CX} cy={LCY} rx={LRX} ry={LRY}
        fill="none" stroke="url(#fg)" strokeWidth="8" />
      {/* Bevel top-arc highlight */}
      <ellipse cx={LL_CX} cy={LCY} rx={LRX - 3} ry={LRY - 3}
        fill="none" stroke="url(#fbev)" strokeWidth="2.5"
        strokeDasharray={`${Math.PI * LRX * 1.06} ${Math.PI * LRX * 2}`}
        strokeDashoffset={`-${Math.PI * LRX * 0.47}`}
      />

      {/* ── RIGHT LENS ring ── */}
      <ellipse cx={RL_CX + 2} cy={LCY + 4} rx={LRX + 7} ry={LRY + 7}
        fill="none" stroke="rgba(0,0,0,0.48)" strokeWidth="12" />
      <ellipse cx={RL_CX} cy={LCY} rx={LRX + 2} ry={LRY + 2}
        fill="none" stroke="url(#far)" strokeWidth="3.5" opacity="0.72" />
      <ellipse cx={RL_CX} cy={LCY} rx={LRX} ry={LRY}
        fill="none" stroke="url(#fg)" strokeWidth="8" />
      <ellipse cx={RL_CX} cy={LCY} rx={LRX - 3} ry={LRY - 3}
        fill="none" stroke="url(#fbev)" strokeWidth="2.5"
        strokeDasharray={`${Math.PI * LRX * 1.06} ${Math.PI * LRX * 2}`}
        strokeDashoffset={`-${Math.PI * LRX * 0.47}`}
      />

      {/* ── Hinge screws ── */}
      {[LL_CX - LRX + 12, RL_CX + LRX - 12].map((hx, hi) => (
        <g key={hi}>
          <circle cx={hx} cy={hinge} r="8" fill="url(#fhn)" />
          <circle cx={hx} cy={hinge} r="4.5" fill="rgba(0,0,0,0.55)" />
          <circle cx={hx} cy={hinge} r="2"   fill="rgba(255,255,255,0.32)" />
          {/* Screw slot */}
          <line x1={hx - 2.5} y1={hinge - 3.5} x2={hx + 2.5} y2={hinge + 3.5}
            stroke="rgba(255,255,255,0.20)" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      ))}

      {/* ── Column labels ── */}
      {showLabels && (
        <>
          <text x={LL_CX} y={LCY + LRY + 26} textAnchor="middle"
            fill="rgba(197,160,89,0.38)" fontSize="10"
            fontFamily="'Urbanist','Inter',sans-serif" fontWeight="200" letterSpacing="0.22em">
            {leftLabel}
          </text>
          <text x={RL_CX} y={LCY + LRY + 26} textAnchor="middle"
            fill="rgba(197,160,89,0.38)" fontSize="10"
            fontFamily="'Urbanist','Inter',sans-serif" fontWeight="200" letterSpacing="0.22em">
            {rightLabel}
          </text>
        </>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MultifocalFrame
//
// Shows the scene inside a luxury glasses frame.
// LEFT lens  = always sharp (reference, no lens)
// RIGHT lens = progressive — blurred periphery + sharp corridor + zone labels
//
// Progressive mask technique:
//   Three separate radial-gradient masks composited with mask-composite:add.
//   Each gradient is centred at a vision zone (LEJANA/INTERMEDIA/CERCA).
//   Width at each zone scales with the lens corridorW and topW/botW fractions.
//   The INTERMEDIA zone is always narrowest (the corridor waist).
//   Outside all three zones: only the blurred base image shows → aberration.
// ─────────────────────────────────────────────────────────────────────────────
function MultifocalFrame({ image, lens }: { image: string; lens: LensOption }) {
  const noBlur = lens.blurPx === 0;
  const color  = lens.tagColor;

  // Mask widths per zone (% of lens width)
  const farW  = Math.round(lens.topW      * 90 + 10);   // 10% … 100%
  const midW  = Math.round(lens.corridorW * 58 + 8);    //  8% …  66%
  const nearW = Math.round(lens.botW      * 86 + 10);   // 10% …  96%

  const inner = '22%', outer = '70%';

  // Three-zone hourglass mask
  const maskImage = noBlur ? 'none' : [
    `radial-gradient(ellipse ${farW}% 32% at 50% 18%, black ${inner}, transparent ${outer})`,
    `radial-gradient(ellipse ${midW}% 26% at 50% 50%, black ${inner}, transparent ${outer})`,
    `radial-gradient(ellipse ${nearW}% 32% at 50% 82%, black ${inner}, transparent ${outer})`,
  ].join(', ');

  const vigAlpha = noBlur ? 0 : Math.min(0.88, 0.90 * (1 - lens.corridorW * 0.75));

  // Convert SVG coordinates → CSS percentages of container
  const p = (v: number, total: number) => `${(v / total * 100).toFixed(2)}%`;

  const llLeft   = p(LL_CX - LRX, FW);
  const llTop    = p(LCY - LRY,   FH);
  const llW      = p(LRX * 2,     FW);
  const llH      = p(LRY * 2,     FH);
  const rlLeft   = p(RL_CX - LRX, FW);

  const lensShadow = [
    'inset 0 4px 10px rgba(255,255,255,0.14)',
    'inset 0 -5px 12px rgba(0,0,0,0.36)',
    'inset 5px 0 10px rgba(0,0,0,0.16)',
    'inset -5px 0 10px rgba(0,0,0,0.16)',
  ].join(', ');

  return (
    <div style={{
      background: 'linear-gradient(155deg, #0b0a07 0%, #19140a 55%, #0b0a07 100%)',
      border: '1px solid rgba(197,160,89,0.20)',
      boxShadow: '0 28px 90px rgba(0,0,0,0.95), 0 0 0 1px rgba(0,0,0,0.60)',
      borderRadius: '1.25rem',
      padding: '14px 14px 20px',
      position: 'relative',
    }}>

      {/* Badge row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 14, marginBottom: 10, flexWrap: 'wrap',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 14px', borderRadius: 999,
          background: `${color}1a`, border: `1px solid ${color}44`,
          color, fontSize: 10.5, fontWeight: 300,
          letterSpacing: '0.16em', textTransform: 'uppercase',
          fontFamily: "'Urbanist','Inter',sans-serif",
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: color,
            boxShadow: `0 0 7px ${color}`, display: 'inline-block' }} />
          {lens.label}
        </span>
        <span style={{
          fontSize: 10.5, color: 'rgba(255,255,255,0.24)', fontWeight: 300,
          fontFamily: "'Urbanist','Inter',sans-serif", letterSpacing: '0.10em',
        }}>
          {noBlur
            ? '100% nítido · Sin aberraciones laterales · Quantum IA'
            : `Pasillo visual ${Math.round(lens.corridorW * 100)}% · aberración lateral activa`}
        </span>
      </div>

      {/* Viewport */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: `${FW}/${FH}` }}>

        {/* ── LEFT LENS — sharp reference ── */}
        <div style={{
          position: 'absolute', left: llLeft, top: llTop, width: llW, height: llH,
          overflow: 'hidden', borderRadius: '52%',
          boxShadow: lensShadow,
        }}>
          <img src={image} alt="" style={{
            position: 'absolute', inset: '-6%', width: '112%', height: '112%',
            objectFit: 'cover',
            filter: 'brightness(1.05) contrast(1.08)',
          }} />
          {/* Specular glare */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse 55% 38% at 26% 18%, rgba(255,255,255,0.09) 0%, transparent 62%)',
            pointerEvents: 'none',
          }} />
          {/* Reference tag */}
          <div style={{
            position: 'absolute', bottom: '10%', left: '50%', transform: 'translateX(-50%)',
            padding: '3px 12px', borderRadius: 999,
            background: 'rgba(0,0,0,0.72)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.45)',
            fontFamily: "'Urbanist','Inter',sans-serif",
            fontSize: 8, fontWeight: 200, letterSpacing: '0.28em',
            whiteSpace: 'nowrap', pointerEvents: 'none',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          }}>
            SIN LENTE · REFERENCIA
          </div>
        </div>

        {/* ── RIGHT LENS — progressive ── */}
        <div style={{
          position: 'absolute', left: rlLeft, top: llTop, width: llW, height: llH,
          overflow: 'hidden', borderRadius: '52%',
          boxShadow: lensShadow,
        }}>
          {/* Layer 1: blurred base — fills entire lens (aberration zones) */}
          <img src={image} alt="" style={{
            position: 'absolute', inset: '-10%', width: '120%', height: '120%',
            objectFit: 'cover',
            filter: noBlur
              ? 'brightness(1.05) contrast(1.10)'
              : `blur(${lens.blurPx}px) brightness(0.88) saturate(0.80)`,
            transition: 'filter 0.50s cubic-bezier(0.4,0,0.2,1)',
          }} />

          {/* Layer 2: sharp image clipped to progressive corridor mask */}
          <img src={image} alt="" style={{
            position: 'absolute', inset: '-6%', width: '112%', height: '112%',
            objectFit: 'cover',
            filter: 'brightness(1.05) contrast(1.10)',
            WebkitMaskImage: maskImage,
            maskImage,
            WebkitMaskComposite: 'source-over, source-over',
            maskComposite: 'add, add',
            WebkitMaskSize: '100% 100%',
            maskSize: '100% 100%',
          }} />

          {/* Layer 3: radial vignette — darkens peripheral blurred zones */}
          {!noBlur && (
            <div style={{
              position: 'absolute', inset: 0,
              background: `radial-gradient(
                ellipse ${Math.round(midW * 0.60 + 10)}% ${Math.round(midW * 0.50 + 12)}% at 50% 50%,
                transparent 44%,
                rgba(0,0,0,${vigAlpha}) 100%
              )`,
              pointerEvents: 'none',
            }} />
          )}

          {/* Layer 4: specular glare */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse 58% 40% at 26% 18%, rgba(255,255,255,0.09) 0%, transparent 64%)',
            pointerEvents: 'none',
          }} />

          {/* Zone labels — centred in each vision zone */}
          <ZoneLabel top="17%" color={color} text="[ LEJANA ]"
            active={noBlur || lens.topW > 0.55} />
          <ZoneLabel top="50%" color={color} text="[ INTERMEDIA ]"
            active />
          <ZoneLabel top="83%" color={color} text="[ CERCA ]"
            active={noBlur || lens.botW > 0.55} />
        </div>

        {/* ── SVG luxury frame — sits on top of lens windows ── */}
        <svg
          viewBox={`0 0 ${FW} ${FH}`}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <FrameDefs />
          <FrameShape
            showLabels
            leftLabel="OJO IZQUIERDO · REFERENCIA"
            rightLabel={`OJO DERECHO · ${lens.label.toUpperCase()}`}
          />
        </svg>
      </div>

      {/* Descriptor pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14, justifyContent: 'center' }}>
        {lens.desc.map(d => (
          <span key={d} style={{
            fontSize: 10.5, fontWeight: 300, padding: '4px 14px', borderRadius: 999,
            background: `${color}0d`, color: 'rgba(255,255,255,0.44)',
            border: `1px solid ${color}20`,
            fontFamily: "'Urbanist','Inter',sans-serif",
            letterSpacing: '0.06em',
          }}>
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}

// Vision zone label — Urbanist Thin, floats inside the lens div
function ZoneLabel({ top, color, text, active }: {
  top: string; color: string; text: string; active: boolean;
}) {
  return (
    <div style={{
      position: 'absolute', left: '50%', top,
      transform: 'translate(-50%, -50%)',
      padding: '4px 14px', borderRadius: 3,
      background: 'rgba(0,0,0,0.65)',
      border: `1px solid ${active ? color + '58' : 'rgba(255,255,255,0.09)'}`,
      color: active ? color : 'rgba(255,255,255,0.22)',
      fontFamily: "'Urbanist','Inter',sans-serif",
      fontSize: 8.5, fontWeight: 200,
      letterSpacing: '0.34em', textTransform: 'uppercase',
      whiteSpace: 'nowrap', zIndex: 10, pointerEvents: 'none',
      textShadow: active ? `0 0 14px ${color}95` : 'none',
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      transition: 'color 0.40s, border-color 0.40s, text-shadow 0.40s',
    }}>
      {text}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ARGlassesFrame
//
// Both lenses inside ONE luxury glasses frame.
// LEFT  = Sin AR: photo with pure CSS filter explosion — no canvas, no shapes.
//   filter: blur(1.5px) brightness(1.5) drop-shadow(0 0 28px #fff)
//   + a secondary div with mix-blend-mode:screen white radial halos over the
//     headlight zones to simulate blown-out glare that bleeds into road scene.
// RIGHT = Con AR: photo sharp, dark, high-contrast.
//   filter: brightness(1.10) contrast(1.20) saturate(1.05)
// ─────────────────────────────────────────────────────────────────────────────
function ARGlassesFrame({ image, withAR }: { image: string; withAR: boolean }) {
  const p = (v: number, total: number) => `${(v / total * 100).toFixed(2)}%`;

  const llLeft = p(LL_CX - LRX, FW);
  const llTop  = p(LCY - LRY,   FH);
  const llW    = p(LRX * 2,     FW);
  const llH    = p(LRY * 2,     FH);
  const rlLeft = p(RL_CX - LRX, FW);

  const lensShadow = [
    'inset 0 4px 10px rgba(255,255,255,0.12)',
    'inset 0 -5px 12px rgba(0,0,0,0.40)',
    'inset 5px 0 10px rgba(0,0,0,0.18)',
    'inset -5px 0 10px rgba(0,0,0,0.18)',
  ].join(', ');

  return (
    <div style={{
      background: 'linear-gradient(155deg, #0b0a07 0%, #19140a 55%, #0b0a07 100%)',
      border: '1px solid rgba(197,160,89,0.20)',
      boxShadow: '0 28px 90px rgba(0,0,0,0.95), 0 0 0 1px rgba(0,0,0,0.60)',
      borderRadius: '1.25rem',
      padding: '14px 14px 20px',
      position: 'relative',
    }}>

      {/* State labels */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 10,
      }}>
        <span style={{
          fontSize: 10.5, fontWeight: 300, letterSpacing: '0.16em', textTransform: 'uppercase',
          fontFamily: "'Urbanist','Inter',sans-serif",
          color: !withAR ? 'rgba(239,68,68,0.90)' : 'rgba(255,255,255,0.22)',
          transition: 'color 0.4s',
        }}>Sin Anti-Reflejo</span>
        <span style={{
          width: 1, height: 12, background: 'rgba(197,160,89,0.25)', display: 'inline-block',
        }} />
        <span style={{
          fontSize: 10.5, fontWeight: 300, letterSpacing: '0.16em', textTransform: 'uppercase',
          fontFamily: "'Urbanist','Inter',sans-serif",
          color: withAR ? '#C5A059' : 'rgba(255,255,255,0.22)',
          transition: 'color 0.4s',
        }}>Con Anti-Reflejo Premium</span>
      </div>

      {/* Viewport */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: `${FW}/${FH}` }}>

        {/* ── LEFT LENS — Sin AR: blown-out glare via CSS only ── */}
        <div style={{
          position: 'absolute', left: llLeft, top: llTop, width: llW, height: llH,
          overflow: 'hidden', borderRadius: '52%', boxShadow: lensShadow,
          outline: !withAR ? '2px solid rgba(239,68,68,0.48)' : 'none',
          transition: 'outline-color 0.4s',
        }}>
          {/*
            CSS-only glare simulation:
            blur(1.5px)         — lens scatters light across edges of bright sources
            brightness(1.5)     — overall overexposure from uncoated glass
            drop-shadow(...)    — photons "bleed" outward from every bright pixel
            saturate(0.75)      — colour desaturates under intense glare
            contrast(0.90)      — shadow detail crushed by bloom
          */}
          <img src={image} alt="" style={{
            position: 'absolute', inset: '-6%', width: '112%', height: '112%',
            objectFit: 'cover',
            filter: 'blur(1.5px) brightness(1.5) drop-shadow(0 0 28px rgba(255,255,255,0.95)) drop-shadow(0 0 12px rgba(255,220,180,0.80)) saturate(0.72) contrast(0.88)',
            transition: 'filter 0.55s ease',
          }} />

          {/* White halo overlay — screen blend over headlight zones */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            mixBlendMode: 'screen',
            background: [
              'radial-gradient(ellipse 42% 38% at 38% 46%, rgba(255,255,255,0.72) 0%, rgba(255,255,220,0.28) 45%, transparent 75%)',
              'radial-gradient(ellipse 36% 32% at 63% 41%, rgba(255,255,255,0.65) 0%, rgba(255,240,200,0.24) 42%, transparent 72%)',
              'radial-gradient(ellipse 20% 18% at 50% 68%, rgba(255,230,180,0.40) 0%, transparent 65%)',
            ].join(', '),
          }} />

          <div style={{
            position: 'absolute', bottom: '10%', left: '50%', transform: 'translateX(-50%)',
            padding: '3px 12px', borderRadius: 999,
            background: 'rgba(180,20,20,0.86)', border: '1px solid rgba(239,68,68,0.52)',
            color: '#fff',
            fontFamily: "'Urbanist','Inter',sans-serif",
            fontSize: 8, fontWeight: 300, letterSpacing: '0.24em',
            whiteSpace: 'nowrap', pointerEvents: 'none',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          }}>
            GLARE · STARBURST · DESLUMBRAMIENTO
          </div>
        </div>

        {/* ── RIGHT LENS — Con AR: sharp, dark, ultra-clear ── */}
        <div style={{
          position: 'absolute', left: rlLeft, top: llTop, width: llW, height: llH,
          overflow: 'hidden', borderRadius: '52%', boxShadow: lensShadow,
          outline: withAR ? '2px solid rgba(197,160,89,0.58)' : 'none',
          transition: 'outline-color 0.4s',
        }}>
          <img src={image} alt="" style={{
            position: 'absolute', inset: '-6%', width: '112%', height: '112%',
            objectFit: 'cover',
            filter: 'brightness(1.10) contrast(1.22) saturate(1.06)',
            transition: 'filter 0.55s ease',
          }} />
          {/* Subtle AR coating lens glare — tiny specular top-left */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 50% 35% at 24% 16%, rgba(255,255,255,0.07) 0%, transparent 58%)',
          }} />
          <div style={{
            position: 'absolute', bottom: '10%', left: '50%', transform: 'translateX(-50%)',
            padding: '3px 12px', borderRadius: 999,
            background: 'rgba(10,160,100,0.90)', border: '1px solid rgba(16,185,129,0.58)',
            color: '#fff',
            fontFamily: "'Urbanist','Inter',sans-serif",
            fontSize: 8, fontWeight: 300, letterSpacing: '0.24em',
            whiteSpace: 'nowrap', pointerEvents: 'none',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          }}>
            VISIÓN HD · SIN HALOS · ALTO CONTRASTE
          </div>
        </div>

        {/* ── SVG luxury frame ── */}
        <svg
          viewBox={`0 0 ${FW} ${FH}`}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <FrameDefs />
          <FrameShape
            showLabels
            leftLabel="SIN ANTI-REFLEJO"
            rightLabel="CON ANTI-REFLEJO PREMIUM"
          />
        </svg>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PhotochromicFrame
// ─────────────────────────────────────────────────────────────────────────────
function PhotochromicFrame({ image, tint }: { image: string; tint: number }) {
  const t = tint / 100;
  const overlayOpacity = t * 0.86;
  const photoBrightness = 1 - t * 0.20;

  return (
    <div className="relative rounded-2xl overflow-hidden"
      style={{ border: '1px solid rgba(197,160,89,0.22)', boxShadow: '0 12px 40px rgba(0,0,0,0.74)' }}>

      <img src={image} className="w-full object-cover block" style={{ maxHeight: 420 }} alt="" />

      {/* Neutral grey Transitions overlay */}
      <div className="absolute inset-0" style={{
        background: `rgba(28,28,28,${overlayOpacity})`,
        transition: 'background 2s ease',
      }} />

      {/* Slight blue-grey cast at full activation — true to Transitions Gen 8 */}
      <div className="absolute inset-0" style={{
        background: `rgba(22,26,32,${t * 0.12})`,
        transition: 'background 2s ease',
        mixBlendMode: 'multiply',
      }} />

      {/* backdrop desaturation */}
      <div className="absolute inset-0" style={{
        backdropFilter: `saturate(${1 - t * 0.34}) brightness(${photoBrightness})`,
        WebkitBackdropFilter: `saturate(${1 - t * 0.34}) brightness(${photoBrightness})`,
        transition: 'backdrop-filter 2s ease, -webkit-backdrop-filter 2s ease',
      }} />

      {/* SVG frame overlay */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 480"
        preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="pcgl" cx="28%" cy="24%" r="38%">
            <stop offset="0%"   stopColor={`rgba(255,255,255,${Math.max(0, 0.12 - t*0.12)})`} />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <linearGradient id="pcc" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#00ffe0" stopOpacity="0.38" />
            <stop offset="50%"  stopColor="#40c8a0" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#00e5ff" stopOpacity="0.34" />
          </linearGradient>
          <linearGradient id="pcr" x1="0%" y1="0%" x2="100%" y2="120%">
            <stop offset="0%"   stopColor="#EDD07A" />
            <stop offset="40%"  stopColor="#C5A059" />
            <stop offset="100%" stopColor="#6B4A0E" />
          </linearGradient>
        </defs>
        {/* Left lens */}
        <ellipse cx="258" cy="204" rx="162" ry="122" fill="url(#pcgl)" />
        <ellipse cx="258" cy="204" rx="162" ry="122" fill="none" stroke="url(#pcc)" strokeWidth="3.5" opacity="0.70" />
        <ellipse cx="258" cy="204" rx="162" ry="122" fill="none" stroke="url(#pcr)" strokeWidth="5" opacity="0.90" />
        {/* Right lens */}
        <ellipse cx="542" cy="204" rx="162" ry="122" fill="url(#pcgl)" />
        <ellipse cx="542" cy="204" rx="162" ry="122" fill="none" stroke="url(#pcc)" strokeWidth="3.5" opacity="0.70" />
        <ellipse cx="542" cy="204" rx="162" ry="122" fill="none" stroke="url(#pcr)" strokeWidth="5" opacity="0.90" />
        <path d="M 422 196 Q 400 174 378 196" fill="none" stroke="url(#pcr)" strokeWidth="4.5" opacity="0.90" />
        <line x1="96"  y1="172" x2="52"  y2="152" stroke="url(#pcr)" strokeWidth="4.5" strokeLinecap="round" opacity="0.90" />
        <line x1="704" y1="172" x2="748" y2="152" stroke="url(#pcr)" strokeWidth="4.5" strokeLinecap="round" opacity="0.90" />
        {tint > 0 && (
          <text x="400" y="388" textAnchor="middle"
            fill={`rgba(197,160,89,${Math.min(0.80, t*0.88)})`}
            fontSize="10" fontFamily="'Urbanist','Inter',sans-serif"
            fontWeight="200" letterSpacing="0.18em">
            TRANSITIONS GEN 8 — {tint}% OSCURECIMIENTO
          </text>
        )}
      </svg>

      {/* Status label */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="px-4 py-2 rounded-full text-xs font-light whitespace-nowrap"
          style={{
            background: 'rgba(0,0,0,0.84)', backdropFilter: 'blur(12px)',
            color: tint > 45 ? '#C5A059' : 'rgba(255,255,255,0.80)',
            border: '1px solid rgba(255,255,255,0.07)', transition: 'color 0.5s',
            fontFamily: "'Urbanist','Inter',sans-serif", letterSpacing: '0.12em',
          }}>
          {tint === 0  ? 'Lente transparente — Interior'  :
           tint < 22   ? 'Leve tinte — Sombra exterior'   :
           tint < 52   ? 'Tinte moderado — Sol parcial'   :
           tint < 80   ? 'Gris Carbón — Sol fuerte'       :
                         'Oscurecimiento máximo — Sol directo'}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LensCrossSection
// ─────────────────────────────────────────────────────────────────────────────
function LensCrossSection({ idx }: { idx: IndexOption }) {
  const W = 300, H = 140, cx = W / 2;
  const maxEdge = 94, minCtr = 7;
  const edgePx = Math.round(minCtr + (maxEdge - minCtr) * idx.relW);
  const ctrPx  = Math.max(minCtr, Math.round(edgePx * 0.27));
  const tEdge  = (H - edgePx) / 2;
  const tCtr   = (H - ctrPx)  / 2;
  const path   = `M 22 ${tEdge} Q ${cx} ${tCtr} ${W-22} ${tEdge} L ${W-22} ${tEdge+edgePx} Q ${cx} ${tCtr+ctrPx} 22 ${tEdge+edgePx} Z`;
  const front  = `M 22 ${tEdge} Q ${cx} ${tCtr} ${W-22} ${tEdge}`;
  const back   = `M 22 ${tEdge+edgePx} Q ${cx} ${tCtr+ctrPx} ${W-22} ${tEdge+edgePx}`;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-10">
      <svg width={W} height={H + 16} viewBox={`0 0 ${W} ${H+16}`} className="shrink-0">
        <defs>
          <linearGradient id="lcg" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor={idx.color} stopOpacity="0.38" />
            <stop offset="50%"  stopColor={idx.color} stopOpacity="0.13" />
            <stop offset="100%" stopColor={idx.color} stopOpacity="0.38" />
          </linearGradient>
          <filter id="lcglow">
            <feGaussianBlur stdDeviation="1.4" result="b" />
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <path d={path}  fill="url(#lcg)" />
        <path d={front} fill="none" stroke={idx.color} strokeWidth="2.2" opacity="0.85" filter="url(#lcglow)" />
        <path d={back}  fill="none" stroke={idx.color} strokeWidth="2.2" opacity="0.85" filter="url(#lcglow)" />
        <line x1={cx} y1={tCtr-7}       x2={cx}   y2={tCtr+ctrPx+7}
          stroke={idx.color} strokeWidth="1" strokeDasharray="3,2" strokeOpacity="0.5" />
        <line x1={cx-7} y1={tCtr}       x2={cx+7} y2={tCtr}
          stroke={idx.color} strokeWidth="1.5" strokeOpacity="0.8" />
        <line x1={cx-7} y1={tCtr+ctrPx} x2={cx+7} y2={tCtr+ctrPx}
          stroke={idx.color} strokeWidth="1.5" strokeOpacity="0.8" />
        <text x={cx+11} y={tCtr+ctrPx/2+4} fill={idx.color} fontSize="11" opacity="0.9" fontFamily="monospace">
          {idx.thickness}mm
        </text>
      </svg>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-light mb-1" style={{ color: 'rgba(255,255,255,0.36)' }}>Índice de refracción</p>
          <p className="text-4xl font-light" style={{ color: idx.color }}>{idx.value}</p>
        </div>
        <div>
          <p className="text-xs font-light mb-0.5" style={{ color: 'rgba(255,255,255,0.36)' }}>Espesor central</p>
          <p className="text-xl font-light text-white">{idx.thickness}mm</p>
        </div>
        <div>
          <p className="text-xs font-light mb-0.5" style={{ color: 'rgba(255,255,255,0.36)' }}>Reducción vs 1.50</p>
          <p className="text-xl font-light" style={{ color: idx.color }}>
            {idx.relW === 1.0 ? 'Base' : `-${Math.round((1-idx.relW)*100)}% más fino`}
          </p>
        </div>
      </div>
    </div>
  );
}
