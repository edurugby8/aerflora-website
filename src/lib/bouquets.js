// Local rules behind "Encuentra tu ramo": every answer changes the proposal
// (name, description, flowers, palette, size, dedication and illustration).

export const FLOWERS = {
  rosa: 'Rosa de jardín',
  peonia: 'Peonía',
  ranunculo: 'Ranúnculo',
  margarita: 'Margarita',
  gerbera: 'Gerbera',
  tulipan: 'Tulipán',
  lavanda: 'Lavanda',
  anemona: 'Anémona',
  cosmos: 'Cosmos',
  cala: 'Cala',
  espigas: 'Espigas',
  paniculata: 'Paniculata',
  eucalipto: 'Eucalipto',
  olivo: 'Ramas de olivo',
};
// foliage and fillers are drawn behind or between the blooms
export const FILLERS = new Set(['lavanda', 'espigas', 'paniculata', 'eucalipto', 'olivo']);

export const EMOTIONS = [
  {
    id: 'amor', label: 'Amor', hint: 'Para decir te quiero',
    flowers: ['rosa', 'peonia'],
    palette: [['Rosa peonía', '#e58fa6'], ['Rojo granada', '#b8435a'], ['Rubor', '#f4c9d2']],
    line: 'Habla el idioma más antiguo de las flores: el cariño que no necesita explicación.',
    dedication: 'Contigo, cualquier día florece.',
  },
  {
    id: 'gratitud', label: 'Gratitud', hint: 'Para dar las gracias',
    flowers: ['ranunculo', 'margarita'],
    palette: [['Melocotón', '#f2b48c'], ['Albaricoque', '#e58f66'], ['Crema', '#f6e7cf']],
    line: 'Un gracias que se queda en la mesa y se recuerda cada vez que alguien lo mira.',
    dedication: 'Gracias por estar, siempre a tiempo.',
  },
  {
    id: 'alegria', label: 'Alegría', hint: 'Para celebrar',
    flowers: ['gerbera', 'tulipan'],
    palette: [['Amarillo limón', '#f2cf5b'], ['Coral', '#f08a6b'], ['Fucsia suave', '#e46f9a']],
    line: 'Colores que suenan a risa y a celebración compartida.',
    dedication: 'Que hoy todo te salga redondo.',
  },
  {
    id: 'animo', label: 'Ánimo', hint: 'Para acompañar',
    flowers: ['anemona', 'lavanda'],
    palette: [['Azul nube', '#9fbcd8'], ['Lavanda', '#b4a1d4'], ['Blanco nube', '#f6f3ee']],
    line: 'Tonos serenos que acompañan sin hacer ruido, como un abrazo que dura.',
    dedication: 'Paso a paso. Y aquí estoy.',
  },
  {
    id: 'porquesi', label: 'Porque sí', hint: 'Sin motivo, con intención',
    flowers: ['cosmos', 'tulipan'],
    palette: [['Lila', '#c9afe0'], ['Rosa chicle', '#f2a3c3'], ['Verde lima', '#c3d785']],
    line: 'Las mejores sorpresas no esperan a una fecha del calendario.',
    dedication: 'Porque sí. Porque tú.',
  },
];

export const STYLES = [
  {
    id: 'silvestre', label: 'Silvestre', hint: 'Libre, como recién cogido del campo',
    extras: ['espigas', 'paniculata'], accent: ['Verde salvia', '#8fa77e'], wrap: 'twine',
    line: 'Montado a mano alzada, con tallos sueltos, espigas y verdes de campo.',
  },
  {
    id: 'romantico', label: 'Romántico', hint: 'Suave, lleno y envolvente',
    extras: ['ranunculo', 'eucalipto'], accent: ['Rosa empolvado', '#e8c4c2'], wrap: 'tissue',
    line: 'Una cúpula de pétalos redondos envuelta en papel de seda.',
  },
  {
    id: 'minimalista', label: 'Minimalista', hint: 'Pocas flores, mucho espacio',
    extras: ['cala', 'olivo'], accent: ['Blanco hueso', '#efe9dd'], wrap: 'vase',
    line: 'Pocos tallos, líneas limpias y espacio para que cada flor respire.',
  },
];

export const SIZES = [
  { id: 'detalle', label: 'Un detalle', hint: 'Unos 7 tallos', stems: 7, format: 'ramillete de mano', line: 'Un ramillete pequeño, perfecto para una mesa o una taza bonita.' },
  { id: 'abrazo', label: 'Un abrazo', hint: 'Unos 15 tallos', stems: 15, format: 'ramo mediano', line: 'Un ramo que se sostiene con las dos manos, como un abrazo.' },
  { id: 'celebracion', label: 'Una gran celebración', hint: 'Más de 30 tallos', stems: 32, format: 'gran ramo', line: 'Un ramo generoso que llena la habitación y la ocasión.' },
];

const NAMES = {
  amor: { silvestre: 'Corazón de pradera', romantico: 'Abrazo de nube', minimalista: 'Un solo latido' },
  gratitud: { silvestre: 'Gracias de campo', romantico: 'Tarde de melocotón', minimalista: 'Gracias en voz baja' },
  alegria: { silvestre: 'Luz de primavera', romantico: 'Fiesta de pétalos', minimalista: 'Rayo de sol' },
  animo: { silvestre: 'Viento a favor', romantico: 'Nube que acompaña', minimalista: 'Nuevo comienzo' },
  porquesi: { silvestre: 'Paseo sin prisa', romantico: 'Sorpresa de algodón', minimalista: 'Porque sí' },
};

// occasions from the rest of the page preselect some answers
export const OCCASIONS = {
  cumpleanos: { label: 'Cumpleaños', preset: { emotion: 'alegria' } },
  aniversarios: { label: 'Aniversario', preset: { emotion: 'amor' } },
  bodas: { label: 'Boda', preset: { emotion: 'amor', size: 'celebracion' } },
  detalles: { label: 'Pequeño detalle', preset: { emotion: 'porquesi', size: 'detalle' } },
};

const find = (list, id) => list.find((x) => x.id === id);

export function dedicationFor(emotionId) {
  return find(EMOTIONS, emotionId)?.dedication ?? '';
}

/** Builds the proposal for a complete set of answers. */
export function compose({ emotion: e, style: s, size: z }, occasionId) {
  const emotion = find(EMOTIONS, e), style = find(STYLES, s), size = find(SIZES, z);
  if (!emotion || !style || !size) return null;
  let flowers = [...new Set([...emotion.flowers, ...style.extras])];
  if (size.id === 'detalle') flowers = flowers.slice(0, 3);
  if (size.id === 'celebracion') flowers = [...new Set([...flowers, style.id === 'minimalista' ? 'eucalipto' : 'paniculata', 'eucalipto'])];
  const palette = [...emotion.palette, style.accent].map(([name, hex]) => ({ name, hex }));
  const occasion = OCCASIONS[occasionId];
  return {
    key: `${e}-${s}-${z}`,
    name: NAMES[e][s],
    occasion: occasion?.label ?? null,
    emotion, style, size, flowers, palette,
    description: `${emotion.line} ${style.line} ${size.line}`,
  };
}

export function summary(p, dedication) {
  return [
    `Mi propuesta Aerflora: «${p.name}»`,
    p.occasion ? `Ocasión: ${p.occasion}` : null,
    `Quiero expresar: ${p.emotion.label} · Estilo: ${p.style.label} · Tamaño: ${p.size.label} (${p.size.hint.toLowerCase()})`,
    `Flores: ${p.flowers.map((f) => FLOWERS[f]).join(', ')}`,
    `Paleta: ${p.palette.map((c) => c.name).join(', ')}`,
    dedication?.trim() ? `Dedicatoria: «${dedication.trim()}»` : null,
  ].filter(Boolean).join('\n');
}

// illustration recipes for the collection and occasion cards
export const ART = {
  temporada: { seed: 11, arrangement: 'wild', count: 12, wrap: 'kraft', flowers: ['peonia', 'ranunculo', 'margarita', 'tulipan'], fillers: ['eucalipto', 'espigas'], colors: ['#f2b48c', '#e58fa6', '#f6e7cf', '#f2cf5b'] },
  preservadas: { seed: 23, arrangement: 'dome', count: 9, wrap: 'cloche', flowers: ['rosa', 'ranunculo'], fillers: ['espigas', 'lavanda'], colors: ['#c99f9c', '#d8c3a6', '#b79a8e', '#e9dcc6'], muted: true },
  composiciones: { seed: 37, arrangement: 'low', count: 16, wrap: 'tray', flowers: ['rosa', 'peonia', 'anemona', 'ranunculo'], fillers: ['eucalipto', 'olivo'], colors: ['#f4c9d2', '#ffffff', '#e8c4c2', '#f6e7cf'], candles: true },
  cumpleanos: { seed: 41, arrangement: 'wild', count: 11, wrap: 'kraft', flowers: ['gerbera', 'tulipan', 'cosmos'], fillers: ['paniculata', 'eucalipto'], colors: ['#f2cf5b', '#f08a6b', '#e46f9a', '#c9afe0'], confetti: true },
  aniversarios: { seed: 53, arrangement: 'dome', count: 13, wrap: 'tissue', flowers: ['rosa', 'peonia'], fillers: ['eucalipto'], colors: ['#b8435a', '#e58fa6', '#f4c9d2'] },
  bodas: { seed: 67, arrangement: 'cascade', count: 14, wrap: 'ribbon', flowers: ['peonia', 'rosa', 'anemona', 'cala'], fillers: ['eucalipto', 'paniculata', 'olivo'], colors: ['#ffffff', '#f6f0e4', '#f4e6e6'] },
  detalles: { seed: 79, arrangement: 'single', count: 2, wrap: 'bud', flowers: ['tulipan', 'anemona'], fillers: ['olivo'], colors: ['#e58fa6', '#ffffff'] },
};

/** Illustration recipe for a proposal. */
export function artFor(p) {
  const arrangement = { silvestre: 'wild', romantico: 'dome', minimalista: 'line' }[p.style.id];
  const count = { detalle: 5, abrazo: 9, celebracion: 15 }[p.size.id] + (p.style.id === 'minimalista' ? -2 : 0);
  const seed = [...p.key].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return {
    seed, arrangement, count, wrap: { twine: 'twine', tissue: 'tissue', vase: 'vase' }[p.style.wrap],
    flowers: p.flowers.filter((f) => !FILLERS.has(f)),
    fillers: p.flowers.filter((f) => FILLERS.has(f)),
    colors: p.palette.map((c) => c.hex),
    scale: { detalle: 0.82, abrazo: 1, celebracion: 1.12 }[p.size.id],
  };
}
