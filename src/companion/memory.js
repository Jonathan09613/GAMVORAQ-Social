// Memoria local de VORA. Todo se guarda en el dispositivo (localStorage); nada se envía a servidores.
// Las funciones reciben el "storage" por parámetro para poder probarlas sin navegador.

export const PALETTES = {
  crimson: { label: 'Carmesí', a: '#e11d2e', b: '#ff6b75', rgb: '255,74,92' },
  cyan:    { label: 'Cian',    a: '#0891b2', b: '#67e8f9', rgb: '34,211,238' },
  violet:  { label: 'Violeta', a: '#7c3aed', b: '#c4b5fd', rgb: '167,139,250' },
  amber:   { label: 'Ámbar',   a: '#d97706', b: '#fcd34d', rgb: '251,191,36' },
  mint:    { label: 'Menta',   a: '#059669', b: '#6ee7b7', rgb: '52,211,153' },
  rose:    { label: 'Rosa',    a: '#db2777', b: '#f9a8d4', rgb: '244,114,182' },
  ice:     { label: 'Hielo',   a: '#2563eb', b: '#bfdbfe', rgb: '147,197,253' },
  gold:    { label: 'Oro',     a: '#b45309', b: '#fde68a', rgb: '253,230,138' },
  toxic:   { label: 'Tóxico',  a: '#65a30d', b: '#d9f99d', rgb: '190,242,100' },
  ghost:   { label: 'Fantasma', a: '#64748b', b: '#e2e8f0', rgb: '226,232,240' }
};
// Apariencia: todo desbloqueado desde el inicio (los accesorios especiales siguen ligados al vínculo).
export const EYES = [
  { id: 'classic', label: 'Clásicos' }, { id: 'pixel', label: 'Píxel' }, { id: 'cat', label: 'Felinos' },
  { id: 'star', label: 'Estrella' }, { id: 'visor', label: 'Visor' }, { id: 'sleepy', label: 'Chill' }
];
export const MOUTHS = [{ id: 'smile', label: 'Sonrisa' }, { id: 'fang', label: 'Colmillo' }, { id: 'cat', label: 'Gatuna' }, { id: 'wide', label: 'Enorme' }];
export const EARS = [{ id: 'crest', label: 'Cresta' }, { id: 'cat', label: 'Orejas' }, { id: 'antenna', label: 'Antena' }, { id: 'horns', label: 'Cuernos' }];
export const SHELLS = [{ id: 'hex', label: 'Escudo' }, { id: 'orb', label: 'Orbe' }, { id: 'cube', label: 'Cubo' }];

export const VIBES = [
  { id: 'animo',     label: 'Animado',   desc: 'Energía, ánimo y mucho GG.' },
  { id: 'calma',     label: 'Tranquilo', desc: 'Voz suave, sin prisas.' },
  { id: 'estratega', label: 'Estratega', desc: 'Directo, con consejos y planes.' }
];

// Los accesorios se desbloquean al subir el nivel de vínculo.
export const ACCESSORIES = [
  { id: 'none',    label: 'Sin accesorio', bond: 1 },
  { id: 'headset', label: 'Auriculares',   bond: 2 },
  { id: 'cap',     label: 'Gorra',         bond: 3 },
  { id: 'glasses', label: 'Gafas',         bond: 4 },
  { id: 'bandana', label: 'Bandana',       bond: 1 },
  { id: 'bow',     label: 'Moño',          bond: 1 },
  { id: 'crown',   label: 'Corona',        bond: 5 },
  { id: 'halo',    label: 'Aureola',       bond: 5 }
];

export const BOND_THRESHOLDS = [0, 12, 40, 90, 170];

export function defaultMemory(nowIso = new Date().toISOString()) {
  return {
    v: 1,
    name: 'VORA',
    color: 'crimson',
    vibe: 'animo',
    accessory: 'none',
    eyes: 'classic', mouth: 'smile', ears: 'crest', shell: 'hex',
    nickname: '',
    favGame: '',
    onboarded: false,
    firstSeen: nowIso,
    lastSeen: nowIso,
    bond: 0,
    xp: 0,
    streak: 0,
    bestStreak: 0,
    days: 0,
    lastDay: '',
    counts: { day: '', pet: 0, chat: 0, react: 0, mood: 0 },
    missions: { day: '', list: [], progress: {}, claimed: {}, bonus: false },
    achievements: [],
    scores: { trivia: 0, rps: 0, guess: 0, emoji: 0, reflex: 0, memory: 0 },
    reminders: [],
    water: { day: '', count: 0 },
    quiet: false,
    sound: false,
    hidden: false,
    pos: { side: 'right', y: 0.92 },
    history: [],
    sessionsDone: 0
  };
}

const keyFor = uid => `gvq:vora:${uid || 'guest'}`;

function merge(base, saved) {
  const out = { ...base, ...saved };
  out.counts = { ...base.counts, ...(saved.counts || {}) };
  out.missions = { ...base.missions, ...(saved.missions || {}) };
  out.scores = { ...base.scores, ...(saved.scores || {}) };
  out.pos = { ...base.pos, ...(saved.pos || {}) };
  out.history = Array.isArray(saved.history) ? saved.history.slice(-40) : [];
  out.achievements = Array.isArray(saved.achievements) ? saved.achievements : [];
  out.reminders = Array.isArray(saved.reminders) ? saved.reminders.filter(r => r && Number.isFinite(r.at) && typeof r.text === 'string').slice(0, 20) : [];
  out.water = saved.water && typeof saved.water === 'object' ? { day: String(saved.water.day || ''), count: Number(saved.water.count) || 0 } : base.water;
  if (!PALETTES[out.color]) out.color = 'crimson'; // v10: de vuelta al rojo (los tonos verdes de la v9 pasan a Carmesí)
  if (!VIBES.some(v => v.id === out.vibe)) out.vibe = 'animo';
  if (!ACCESSORIES.some(a => a.id === out.accessory)) out.accessory = 'none';
  if (!EYES.some(x => x.id === out.eyes)) out.eyes = 'classic';
  if (!MOUTHS.some(x => x.id === out.mouth)) out.mouth = 'smile';
  if (!EARS.some(x => x.id === out.ears)) out.ears = 'crest';
  if (!SHELLS.some(x => x.id === out.shell)) out.shell = 'hex';
  return out;
}

export function loadMemory(uid, storage = globalThis.localStorage) {
  const base = defaultMemory();
  try {
    const raw = storage?.getItem(keyFor(uid));
    if (!raw) return base;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return base;
    return merge(base, saved);
  } catch { return base; }
}

export function saveMemory(uid, mem, storage = globalThis.localStorage) {
  try { storage?.setItem(keyFor(uid), JSON.stringify(mem)); return true; } catch { return false; }
}

export function forgetMemory(uid, storage = globalThis.localStorage) {
  try { storage?.removeItem(keyFor(uid)); } catch { /* sin almacenamiento disponible */ }
  return defaultMemory();
}

/** Añade un mensaje al historial de chat (máximo 40) y devuelve la memoria. */
export function pushHistory(mem, who, text) {
  mem.history = [...(mem.history || []), { who, text: String(text).slice(0, 600), t: Date.now() }].slice(-40);
  return mem;
}

/** La apariencia que se guarda en el perfil (para verla igual en todos tus dispositivos). */
export const lookOf = m => ({ color: m.color, accessory: m.accessory, eyes: m.eyes, mouth: m.mouth, ears: m.ears, shell: m.shell, name: m.name });
/** Aplica una apariencia guardada en el servidor, validando cada valor. */
export function applyLookTo(mem, look = {}) {
  if (!look || typeof look !== 'object') return mem;
  if (PALETTES[look.color]) mem.color = look.color;
  if (ACCESSORIES.some(a => a.id === look.accessory)) mem.accessory = look.accessory;
  if (EYES.some(x => x.id === look.eyes)) mem.eyes = look.eyes;
  if (MOUTHS.some(x => x.id === look.mouth)) mem.mouth = look.mouth;
  if (EARS.some(x => x.id === look.ears)) mem.ears = look.ears;
  if (SHELLS.some(x => x.id === look.shell)) mem.shell = look.shell;
  if (typeof look.name === 'string' && look.name.trim()) mem.name = look.name.trim().slice(0, 12);
  return mem;
}
