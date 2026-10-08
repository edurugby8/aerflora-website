// Botanical illustrations drawn in SVG from a small recipe (see
// lib/bouquets.js): blooms, foliage and wrap all depend on the choices, and a
// seed keeps every composition stable between renders.
import { useMemo } from 'react';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)));
  return `rgb(${ch.join(',')})`;
}
const LEAF = '#6f8a52', LEAF_D = '#556d3e';

// ------------------------------------------------------------------ blooms
const ring = (n, f) => Array.from({ length: n }, (_, k) => f((k / n) * Math.PI * 2, k));

export function Bloom({ type, r, c }) {
  switch (type) {
    case 'rosa':
      return (
        <g>
          {ring(7, (a, k) => <ellipse key={k} cx={Math.cos(a) * r * 0.42} cy={Math.sin(a) * r * 0.42} rx={r * 0.55} ry={r * 0.45} transform={`rotate(${(a * 180) / Math.PI} ${Math.cos(a) * r * 0.42} ${Math.sin(a) * r * 0.42})`} fill={shade(c, 0.08)} stroke={shade(c, -0.18)} strokeWidth={r * 0.03} />)}
          <circle r={r * 0.62} fill={c} />
          <path d={`M ${-r * 0.45} 0 A ${r * 0.45} ${r * 0.45} 0 1 1 ${r * 0.1} ${r * 0.44} M ${-r * 0.28} ${-r * 0.05} A ${r * 0.28} ${r * 0.28} 0 1 1 ${r * 0.12} ${r * 0.26} M ${-r * 0.12} 0 A ${r * 0.12} ${r * 0.12} 0 1 1 ${r * 0.08} ${r * 0.1}`} fill="none" stroke={shade(c, -0.3)} strokeWidth={r * 0.05} strokeLinecap="round" />
        </g>
      );
    case 'peonia':
      return (
        <g>
          {ring(10, (a, k) => <ellipse key={`o${k}`} cx={Math.cos(a) * r * 0.5} cy={Math.sin(a) * r * 0.5} rx={r * 0.5} ry={r * 0.38} transform={`rotate(${(a * 180) / Math.PI} ${Math.cos(a) * r * 0.5} ${Math.sin(a) * r * 0.5})`} fill={c} stroke={shade(c, -0.15)} strokeWidth={r * 0.025} />)}
          {ring(7, (a, k) => <ellipse key={`i${k}`} cx={Math.cos(a + 0.4) * r * 0.25} cy={Math.sin(a + 0.4) * r * 0.25} rx={r * 0.36} ry={r * 0.26} transform={`rotate(${((a + 0.4) * 180) / Math.PI} ${Math.cos(a + 0.4) * r * 0.25} ${Math.sin(a + 0.4) * r * 0.25})`} fill={shade(c, 0.18)} stroke={shade(c, -0.12)} strokeWidth={r * 0.02} />)}
          <circle r={r * 0.2} fill={shade(c, 0.35)} />
        </g>
      );
    case 'ranunculo':
      return (
        <g>
          {[1, 0.82, 0.64, 0.47, 0.31].map((k, i) => <circle key={i} r={r * k} fill={shade(c, i % 2 ? 0.12 : -0.02 - i * 0.03)} stroke={shade(c, -0.22)} strokeWidth={r * 0.025} />)}
          <circle r={r * 0.12} fill="#5b6b3a" />
        </g>
      );
    case 'margarita': {
      const p = shade(c, 0.75);
      return (
        <g>
          {ring(14, (a, k) => <ellipse key={k} cx={Math.cos(a) * r * 0.55} cy={Math.sin(a) * r * 0.55} rx={r * 0.5} ry={r * 0.14} transform={`rotate(${(a * 180) / Math.PI} ${Math.cos(a) * r * 0.55} ${Math.sin(a) * r * 0.55})`} fill={p} stroke={shade(c, -0.1)} strokeWidth={r * 0.02} />)}
          <circle r={r * 0.3} fill="#e9b93b" /><circle r={r * 0.3} fill="none" stroke="#c99422" strokeWidth={r * 0.05} strokeDasharray={`${r * 0.05} ${r * 0.05}`} />
        </g>
      );
    }
    case 'gerbera':
      return (
        <g>
          {ring(20, (a, k) => <ellipse key={k} cx={Math.cos(a) * r * 0.6} cy={Math.sin(a) * r * 0.6} rx={r * 0.45} ry={r * 0.11} transform={`rotate(${(a * 180) / Math.PI} ${Math.cos(a) * r * 0.6} ${Math.sin(a) * r * 0.6})`} fill={c} stroke={shade(c, -0.2)} strokeWidth={r * 0.02} />)}
          <circle r={r * 0.34} fill={shade(c, -0.25)} /><circle r={r * 0.22} fill="#4b3526" />
        </g>
      );
    case 'tulipan':
      return (
        <g>
          <path d={`M ${-r * 0.6} ${r * 0.1} C ${-r * 0.7} ${-r * 0.6} ${-r * 0.25} ${-r} 0 ${-r * 0.78} C ${r * 0.25} ${-r} ${r * 0.7} ${-r * 0.6} ${r * 0.6} ${r * 0.1} C ${r * 0.38} ${r * 0.6} ${-r * 0.38} ${r * 0.6} ${-r * 0.6} ${r * 0.1} Z`} fill={c} stroke={shade(c, -0.22)} strokeWidth={r * 0.04} />
          <path d={`M ${-r * 0.28} ${r * 0.35} C ${-r * 0.35} ${-r * 0.3} 0 ${-r * 0.9} 0 ${-r * 0.9} C 0 ${-r * 0.9} ${r * 0.35} ${-r * 0.3} ${r * 0.28} ${r * 0.35} Z`} fill={shade(c, 0.15)} />
        </g>
      );
    case 'anemona': {
      const p = shade(c, 0.55);
      return (
        <g>
          {ring(6, (a, k) => <circle key={k} cx={Math.cos(a) * r * 0.48} cy={Math.sin(a) * r * 0.48} r={r * 0.46} fill={p} stroke={shade(c, -0.1)} strokeWidth={r * 0.025} />)}
          <circle r={r * 0.3} fill="#2c2b35" />
          {ring(12, (a, k) => <circle key={`d${k}`} cx={Math.cos(a) * r * 0.36} cy={Math.sin(a) * r * 0.36} r={r * 0.05} fill="#2c2b35" />)}
        </g>
      );
    }
    case 'cosmos':
      return (
        <g>
          {ring(8, (a, k) => <path key={k} transform={`rotate(${(a * 180) / Math.PI})`} d={`M 0 0 C ${r * 0.25} ${-r * 0.2} ${r * 0.95} ${-r * 0.32} ${r * 0.95} 0 C ${r * 0.95} ${r * 0.32} ${r * 0.25} ${r * 0.2} 0 0 Z`} fill={c} stroke={shade(c, -0.2)} strokeWidth={r * 0.025} />)}
          <circle r={r * 0.22} fill="#e2b33a" />
        </g>
      );
    case 'cala':
      return (
        <g>
          <path d={`M 0 ${r * 0.9} C ${-r * 0.55} ${r * 0.2} ${-r * 0.7} ${-r * 0.6} ${-r * 0.1} ${-r} C ${r * 0.4} ${-r * 0.7} ${r * 0.5} ${-r * 0.1} ${r * 0.25} ${r * 0.4} C ${r * 0.15} ${r * 0.6} ${r * 0.05} ${r * 0.8} 0 ${r * 0.9} Z`} fill={shade(c, 0.6)} stroke={shade(c, -0.15)} strokeWidth={r * 0.04} />
          <path d={`M ${-r * 0.02} ${r * 0.2} L ${-r * 0.08} ${-r * 0.55}`} stroke="#e9b93b" strokeWidth={r * 0.14} strokeLinecap="round" />
        </g>
      );
    default:
      return <circle r={r} fill={c} />;
  }
}

// ------------------------------------------------------------------ foliage & fillers
function Filler({ type, x0, y0, angle, len, rand, muted }) {
  const ex = x0 + Math.cos(angle) * len, ey = y0 + Math.sin(angle) * len;
  const pt = (t) => [x0 + (ex - x0) * t, y0 + (ey - y0) * t];
  const leafC = muted ? '#9aa58b' : LEAF;
  const stem = <path className="stem" pathLength="1" d={`M ${x0} ${y0} L ${ex} ${ey}`} stroke={muted ? '#8d8a74' : LEAF_D} strokeWidth="2" fill="none" />;
  switch (type) {
    case 'eucalipto':
      return <g>{stem}{[0.35, 0.5, 0.62, 0.74, 0.85, 0.95].map((t, k) => { const [x, y] = pt(t); const s = k % 2 ? 1 : -1; return <circle key={k} cx={x + s * 9 * Math.sin(angle)} cy={y - s * 9 * Math.cos(angle)} r={8 - t * 3} fill={muted ? '#a9b4a6' : '#8fae9c'} stroke="#6f8c7c" strokeWidth="1" />; })}</g>;
    case 'olivo':
      return <g>{stem}{[0.3, 0.45, 0.58, 0.7, 0.82, 0.93].map((t, k) => { const [x, y] = pt(t); const s = k % 2 ? 1 : -1; const a = (angle * 180) / Math.PI + s * 35; return <ellipse key={k} cx={x} cy={y} rx="13" ry="3.5" transform={`rotate(${a} ${x} ${y}) translate(${s * 10} 0)`} fill={k % 3 ? '#7d8a52' : '#9aa56a'} />; })}</g>;
    case 'espigas':
      return <g>{stem}{Array.from({ length: 9 }, (_, k) => { const [x, y] = pt(0.72 + k * 0.035); const s = k % 2 ? 1 : -1; return <ellipse key={k} cx={x + s * 3} cy={y} rx="2.6" ry="6" transform={`rotate(${(angle * 180) / Math.PI + 90 + s * 25} ${x + s * 3} ${y})`} fill={muted ? '#cdb58e' : '#d8b66a'} />; })}</g>;
    case 'lavanda':
      return <g>{stem}{Array.from({ length: 10 }, (_, k) => { const [x, y] = pt(0.66 + k * 0.035); return <circle key={k} cx={x + (k % 2 ? 2.5 : -2.5)} cy={y} r={3.2 - k * 0.12} fill={muted ? '#a598b5' : '#9b86c6'} />; })}</g>;
    case 'paniculata': {
      const [cx, cy] = pt(1);
      return <g>{stem}{Array.from({ length: 14 }, (_, k) => <circle key={k} cx={cx + (rand() - 0.5) * 30} cy={cy + (rand() - 0.5) * 24} r={2 + rand() * 1.6} fill="#ffffff" stroke="#e7e2d6" strokeWidth="0.6" />)}</g>;
    }
    default:
      return null;
  }
}

// ------------------------------------------------------------------ composition
function layout(recipe) {
  const { seed, arrangement, count, scale = 1 } = recipe;
  const rand = rng(seed);
  const heads = [];
  let origin = [200, 350];
  const push = (x, y, r) => heads.push({ x, y, r });
  if (arrangement === 'dome' || arrangement === 'cascade') {
    const R = 104 * scale, cy = arrangement === 'cascade' ? 190 : 205;
    for (let k = 0; k < count; k++) {
      const t = (k + 0.5) / count, a = k * 2.39996;
      push(200 + Math.cos(a) * R * Math.sqrt(t), cy + Math.sin(a) * R * 0.72 * Math.sqrt(t) - (1 - t) * 14, (24 + rand() * 9) * scale);
    }
    if (arrangement === 'cascade') for (let k = 0; k < 5; k++) push(205 + k * 9 + rand() * 10, 280 + k * 34, 18 - k * 1.5);
  } else if (arrangement === 'wild') {
    for (let k = 0; k < count; k++) {
      const t = k / Math.max(1, count - 1);
      push(200 + (t - 0.5) * 230 * scale + (rand() - 0.5) * 34, 230 - Math.sin(t * Math.PI) * 110 * scale + (rand() - 0.5) * 60, (20 + rand() * 12) * scale);
    }
  } else if (arrangement === 'line') {
    origin = [200, 330];
    for (let k = 0; k < count; k++) {
      const a = -Math.PI / 2 + ((k / Math.max(1, count - 1)) - 0.5) * 1.1 * scale;
      const L = (165 + rand() * 75) * scale;
      push(200 + Math.cos(a) * L, 330 + Math.sin(a) * L, (25 + rand() * 6) * scale);
    }
  } else if (arrangement === 'low') {
    origin = [200, 360];
    for (let k = 0; k < count; k++) push(70 + (k / (count - 1)) * 260 + (rand() - 0.5) * 18, 330 - Math.sin((k / (count - 1)) * Math.PI) * 50 + (rand() - 0.5) * 26, 22 + rand() * 8);
  } else if (arrangement === 'single') {
    origin = [200, 380];
    push(185, 170, 34); push(232, 215, 24);
  }
  return { heads: heads.sort((a, b) => a.y - b.y), origin, rand };
}

function Wrap({ type, origin }) {
  const [ox, oy] = origin;
  switch (type) {
    case 'kraft':
      return (
        <g>
          <path d="M 110 290 L 290 290 L 228 470 L 172 470 Z" fill="#e3cfab" stroke="#c8b08a" strokeWidth="1.5" />
          <path d="M 110 290 L 200 470 M 290 290 L 200 470" stroke="#cdb48c" strokeWidth="1.2" fill="none" />
          <path d="M 175 345 C 150 330 140 360 168 360 M 225 345 C 250 330 260 360 232 360" stroke="#5e6a46" strokeWidth="5" fill="none" strokeLinecap="round" />
          <rect x="172" y="340" width="56" height="12" rx="6" fill="#5e6a46" />
        </g>
      );
    case 'tissue':
      return (
        <g>
          <path d="M 96 270 Q 130 250 150 280 Q 175 248 200 280 Q 225 248 250 280 Q 270 250 304 270 L 232 470 L 168 470 Z" fill="#f3e3e1" stroke="#e2c8c6" strokeWidth="1.5" />
          <path d="M 120 300 L 200 470 L 280 300" fill="none" stroke="#e8d2d0" strokeWidth="1.2" />
          <rect x="170" y="352" width="60" height="10" rx="5" fill="#d98ea2" />
        </g>
      );
    case 'twine':
    case 'ribbon':
      return (
        <g>
          {[-14, -7, 0, 7, 14].map((dx) => <path key={dx} className="stem" pathLength="1" d={`M ${ox + dx * 0.4} ${oy} L ${ox + dx} 470`} stroke={LEAF_D} strokeWidth="3" />)}
          {type === 'twine'
            ? <g stroke="#a88a5f" strokeWidth="2.5" fill="none"><path d={`M ${ox - 16} ${oy + 18} L ${ox + 16} ${oy + 14} M ${ox - 16} ${oy + 25} L ${ox + 16} ${oy + 21}`} /><path d={`M ${ox + 14} ${oy + 18} C ${ox + 40} ${oy + 30} ${ox + 30} ${oy + 55} ${ox + 44} ${oy + 70}`} /></g>
            : <g fill="none" strokeLinecap="round"><path d={`M ${ox - 18} ${oy + 20} L ${ox + 18} ${oy + 20}`} stroke="#f2ece0" strokeWidth="12" /><path d={`M ${ox + 4} ${oy + 22} C ${ox + 50} ${oy + 60} ${ox - 10} ${oy + 90} ${ox + 40} ${oy + 140}`} stroke="#f2ece0" strokeWidth="7" /><path d={`M ${ox - 4} ${oy + 22} C ${ox - 40} ${oy + 70} ${ox + 10} ${oy + 100} ${ox - 26} ${oy + 140}`} stroke="#e9dfcd" strokeWidth="6" /></g>}
        </g>
      );
    case 'vase':
      return (
        <g>
          <rect x="172" y="320" width="56" height="150" rx="16" fill="rgba(214,226,224,0.55)" stroke="#b9c8c4" strokeWidth="2" />
          <rect x="176" y="380" width="48" height="86" rx="12" fill="rgba(170,196,190,0.35)" />
          <path d="M 184 335 L 184 455" stroke="rgba(255,255,255,0.7)" strokeWidth="4" strokeLinecap="round" />
        </g>
      );
    case 'bud':
      return (
        <g>
          <path d="M 188 330 L 188 360 C 150 375 150 470 200 470 C 250 470 250 375 212 360 L 212 330 Z" fill="rgba(206,222,218,0.6)" stroke="#aebfbb" strokeWidth="2" />
          <path d="M 172 400 C 172 380 180 372 186 370" stroke="rgba(255,255,255,0.75)" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'cloche':
      return (
        <g>
          <ellipse cx="200" cy="452" rx="120" ry="18" fill="#a98a69" />
          <rect x="80" y="436" width="240" height="16" rx="8" fill="#b9997a" />
          <path d="M 92 440 L 92 210 C 92 80 308 80 308 210 L 308 440" fill="rgba(235,242,244,0.28)" stroke="rgba(170,190,196,0.9)" strokeWidth="2.5" />
          <circle cx="200" cy="96" r="12" fill="rgba(235,242,244,0.5)" stroke="rgba(170,190,196,0.9)" strokeWidth="2.5" />
          <path d="M 120 220 C 120 150 150 118 182 106" stroke="rgba(255,255,255,0.8)" strokeWidth="5" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'tray':
      return <g><ellipse cx="200" cy="378" rx="168" ry="26" fill="#d9ccb4" stroke="#c4b496" strokeWidth="1.5" /><ellipse cx="200" cy="372" rx="150" ry="18" fill="#e8dcc4" /></g>;
    default:
      return null;
  }
}

export default function BouquetArt({ recipe, title, animate = false, className = '' }) {
  const art = useMemo(() => {
    const { heads, origin, rand } = layout(recipe);
    const [ox, oy] = origin;
    const types = recipe.flowers.length ? recipe.flowers : ['rosa'];
    const fillerItems = [];
    const nF = recipe.arrangement === 'single' ? 2 : Math.round(heads.length * 0.9) + 2;
    for (let k = 0; k < nF && recipe.fillers?.length; k++) {
      const spread = recipe.arrangement === 'low' ? 1.7 : recipe.arrangement === 'line' ? 0.9 : 1.25;
      const a = -Math.PI / 2 + (rand() - 0.5) * spread * 2;
      fillerItems.push({ type: recipe.fillers[k % recipe.fillers.length], angle: a, len: (recipe.arrangement === 'low' ? 140 : 170 + rand() * 90) * (recipe.scale ?? 1) });
    }
    const blooms = heads.map((h, k) => ({
      ...h, type: types[Math.floor(rand() * types.length)],
      c: recipe.colors[k % recipe.colors.length], rot: rand() * 360,
    }));
    return { blooms, fillerItems, ox, oy, rand };
  }, [recipe]);
  const { blooms, fillerItems, ox, oy } = art;
  const frontWrap = ['kraft', 'tissue', 'vase', 'bud', 'cloche'].includes(recipe.wrap);
  const confettiRand = rng(recipe.seed + 3);
  return (
    <svg className={`bouquet-art${animate ? ' is-animated' : ''} ${className}`} viewBox="0 0 400 500" role="img" aria-label={title} preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={`glow-${recipe.seed}`} cx="50%" cy="38%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" /><stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* soft clouds behind the bouquet */}
      <circle cx="200" cy="200" r="190" fill={`url(#glow-${recipe.seed})`} />
      <g fill="#ffffff" opacity="0.75">
        <ellipse cx="80" cy="430" rx="110" ry="34" /><ellipse cx="190" cy="452" rx="130" ry="36" /><ellipse cx="330" cy="436" rx="110" ry="30" />
        <ellipse cx="320" cy="90" rx="70" ry="18" opacity="0.6" /><ellipse cx="70" cy="120" rx="56" ry="14" opacity="0.5" />
      </g>
      {recipe.candles && (
        <g>
          {[140, 262].map((x, k) => <g key={x}><rect x={x - 9} y={190 + k * 20} width="18" height={170 - k * 20} rx="4" fill="#f6efe2" stroke="#e1d6c2" /><path d={`M ${x} ${178 + k * 20} C ${x - 6} ${188 + k * 20} ${x + 6} ${188 + k * 20} ${x} ${178 + k * 20}`} fill="#f5c46a" /><ellipse cx={x} cy={184 + k * 20} rx="5" ry="9" fill="#f7cf74" opacity="0.9" /></g>)}
        </g>
      )}
      <g className="foliage">
        {fillerItems.map((f, k) => <g key={k} className="bloom" style={{ '--i': k * 0.4 }}><Filler {...f} x0={ox} y0={oy} rand={art.rand} muted={recipe.muted} /></g>)}
      </g>
      <g className="stems">
        {blooms.map((b, k) => <path key={k} className="stem" pathLength="1" d={`M ${ox} ${oy} Q ${(ox + b.x) / 2} ${(oy + b.y) / 2 + 30} ${b.x} ${b.y}`} stroke={recipe.muted ? '#8d8a74' : LEAF_D} strokeWidth="2.6" fill="none" />)}
      </g>
      {!frontWrap && <Wrap type={recipe.wrap} origin={[ox, oy]} />}
      <g className="blooms">
        {blooms.map((b, k) => (
          <g key={k} transform={`translate(${b.x} ${b.y})`}>
            <g className="bloom" style={{ '--i': k + 2 }}>
              <g transform={`rotate(${b.rot})`}><Bloom type={b.type} r={b.r} c={b.c} /></g>
            </g>
          </g>
        ))}
      </g>
      {frontWrap && <Wrap type={recipe.wrap} origin={[ox, oy]} />}
      {recipe.confetti && <g>{Array.from({ length: 26 }, (_, k) => { const x = 20 + confettiRand() * 360, y = 20 + confettiRand() * 200; return <rect key={k} x={x} y={y} width="7" height="3" rx="1.5" transform={`rotate(${confettiRand() * 180} ${x} ${y})`} fill={recipe.colors[k % recipe.colors.length]} opacity="0.85" />; })}</g>}
    </svg>
  );
}
