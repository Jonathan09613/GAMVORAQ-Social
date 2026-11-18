// Reglas puras de progreso: nivel, racha, misiones diarias, vínculo y logros.
// Sin efectos secundarios: reciben y devuelven la memoria, para que sean fáciles de probar.
import { BOND_THRESHOLDS } from './memory.js';

/** Fecha local en formato AAAA-MM-DD. */
export function dayKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function previousDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - 1));
  const p = n => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
}

// ---- Nivel ----
export const xpNeeded = level => 80 + (level - 1) * 40; // XP para pasar de `level` a `level+1`
export function levelFromXp(xp) {
  let level = 1, left = Math.max(0, Math.floor(xp));
  while (left >= xpNeeded(level)) { left -= xpNeeded(level); level++; }
  const need = xpNeeded(level);
  return { level, into: left, need, pct: (left / need) * 100 };
}
export function award(mem, amount) {
  const before = levelFromXp(mem.xp).level;
  mem.xp = Math.max(0, mem.xp + Math.round(amount));
  const after = levelFromXp(mem.xp).level;
  return { mem, leveledUp: after > before, level: after, gained: Math.round(amount) };
}

// ---- Vínculo con VORA ----
export function bondLevel(points) {
  let lvl = 1;
  BOND_THRESHOLDS.forEach((t, i) => { if (points >= t) lvl = i + 1; });
  const next = BOND_THRESHOLDS[lvl] ?? null;
  const base = BOND_THRESHOLDS[lvl - 1];
  return { level: lvl, next, pct: next == null ? 100 : ((points - base) / (next - base)) * 100 };
}
const BOND_RULES = { pet: { gain: 1, cap: 5 }, chat: { gain: 1, cap: 10 }, mood: { gain: 1, cap: 3 } };
/** Suma vínculo con topes diarios para evitar abusos (p. ej. hacer clic sin parar). */
export function addBond(mem, kind, amount) {
  const rule = BOND_RULES[kind];
  const before = bondLevel(mem.bond).level;
  let gain = amount ?? (rule ? rule.gain : 1);
  if (rule) {
    const used = mem.counts[kind] || 0;
    gain = Math.max(0, Math.min(gain, rule.cap - used));
    mem.counts[kind] = used + gain;
  }
  mem.bond += gain;
  const after = bondLevel(mem.bond).level;
  return { mem, gained: gain, leveledUp: after > before, level: after };
}

// ---- Racha y día nuevo ----
export function touchDay(mem, today = dayKey()) {
  if (mem.lastDay === today) return { mem, firstOfDay: false, streakBroken: false, returningAfter: 0 };
  const returningAfter = mem.lastDay ? daysBetween(mem.lastDay, today) : 0;
  let streakBroken = false;
  if (mem.lastDay === previousDay(today)) mem.streak += 1;
  else { streakBroken = Boolean(mem.lastDay) && mem.streak > 1; mem.streak = 1; }
  mem.bestStreak = Math.max(mem.bestStreak, mem.streak);
  mem.days += 1;
  mem.lastDay = today;
  mem.counts = { day: today, pet: 0, chat: 0, react: 0, mood: 0 };
  mem.missions = { day: today, list: pickMissions(today).map(m => m.id), progress: {}, claimed: {}, bonus: false };
  return { mem, firstOfDay: true, streakBroken, returningAfter };
}
export function daysBetween(a, b) {
  const t = k => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86400000);
}

// ---- Misiones diarias ----
export const MISSION_POOL = [
  { id: 'react3',   event: 'react',      goal: 3, xp: 15, label: 'Reacciona a 3 publicaciones',        icon: 'sparkles',        tab: 'home' },
  { id: 'post1',    event: 'post',       goal: 1, xp: 25, label: 'Comparte una publicación positiva',  icon: 'message-square',  modal: 'compose' },
  { id: 'comment2', event: 'comment',    goal: 2, xp: 15, label: 'Deja 2 comentarios amables',         icon: 'message-circle',  tab: 'home' },
  { id: 'avail1',   event: 'available',  goal: 1, xp: 20, label: 'Márcate disponible para jugar',      icon: 'circle-dot',      modal: 'set-available' },
  { id: 'follow1',  event: 'follow',     goal: 1, xp: 15, label: 'Sigue a un jugador nuevo',           icon: 'user-plus',       tab: 'play' },
  { id: 'dm1',      event: 'dm',         goal: 1, xp: 15, label: 'Saluda a alguien por mensaje',       icon: 'messages-square', tab: 'play' },
  { id: 'rsvp1',    event: 'rsvp',       goal: 1, xp: 20, label: 'Confirma o agenda una partida',      icon: 'calendar-check',  tab: 'squads' },
  { id: 'chem1',    event: 'chemistry',  goal: 1, xp: 20, label: 'Califica la química de una partida', icon: 'handshake',       tab: 'squads' },
  { id: 'chat3',    event: 'vora_chat',  goal: 3, xp: 10, label: 'Conversa con VORA',                  icon: 'bot',             panel: 'chat' },
  { id: 'game1',    event: 'minigame',   goal: 1, xp: 15, label: 'Juega un mini-juego de VORA',            icon: 'brain',           panel: 'games' },
  { id: 'session1', event: 'session',    goal: 1, xp: 30, label: 'Completa una sesión «Juntos»',       icon: 'timer',           panel: 'together' },
  { id: 'lib1',     event: 'game_added', goal: 1, xp: 10, label: 'Añade un juego a tu biblioteca',     icon: 'gamepad-2',       tab: 'profile' },
  { id: 'quest1',   event: 'quest',      goal: 1, xp: 20, label: 'Participa en un reto',               icon: 'target',          tab: 'communities' },
  { id: 'memory1',  event: 'memory',     goal: 1, xp: 20, label: 'Guarda o aprueba un recuerdo',       icon: 'images',          tab: 'squads' }
];
export const MISSION_BONUS_XP = 20;

function hashString(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Mismo día → mismas misiones (determinista), distinto día → otro conjunto. */
export function pickMissions(day, n = 3) {
  const rng = mulberry32(hashString(day));
  const pool = [...MISSION_POOL];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, n);
}
export const missionById = id => MISSION_POOL.find(m => m.id === id);

export function todaysMissions(mem) {
  return (mem.missions.list || []).map(id => {
    const m = missionById(id); if (!m) return null;
    const progress = Math.min(m.goal, mem.missions.progress[id] || 0);
    return { ...m, progress, done: progress >= m.goal, claimed: Boolean(mem.missions.claimed[id]) };
  }).filter(Boolean);
}

/** Registra un evento de la app. Devuelve las misiones recién completadas. */
export function track(mem, event, amount = 1) {
  const completed = [];
  for (const id of mem.missions.list || []) {
    const m = missionById(id);
    if (!m || m.event !== event || mem.missions.claimed[id]) continue;
    const before = mem.missions.progress[id] || 0;
    if (before >= m.goal) continue;
    const next = Math.min(m.goal, before + amount);
    mem.missions.progress[id] = next;
    if (next >= m.goal) completed.push(id);
  }
  return { mem, completed };
}

/** Reclama la recompensa de una misión terminada. */
export function claim(mem, id) {
  const m = missionById(id);
  if (!m || mem.missions.claimed[id] || (mem.missions.progress[id] || 0) < m.goal) return { mem, ok: false };
  mem.missions.claimed[id] = true;
  const before = levelFromXp(mem.xp).level;
  award(mem, m.xp);
  let bonus = 0;
  const all = (mem.missions.list || []).every(x => mem.missions.claimed[x]);
  if (all && !mem.missions.bonus) { mem.missions.bonus = true; bonus = MISSION_BONUS_XP; award(mem, bonus); }
  const level = levelFromXp(mem.xp).level;
  return { mem, ok: true, xp: m.xp, bonus, allDone: all, leveledUp: level > before, level };
}

// ---- Logros ----
export const ACHIEVEMENTS = [
  { id: 'hello',   label: 'Primer saludo',      desc: 'Conversaste con VORA.',          test: m => m.history.some(h => h.who === 'me') },
  { id: 'streak3', label: 'Constante',          desc: '3 días seguidos con VORA.',      test: m => m.bestStreak >= 3 },
  { id: 'streak7', label: 'Inseparables',       desc: '7 días seguidos con VORA.',      test: m => m.bestStreak >= 7 },
  { id: 'lvl5',    label: 'Nivel 5',            desc: 'Llegaste al nivel 5.',           test: m => levelFromXp(m.xp).level >= 5 },
  { id: 'bond3',   label: 'Amigos de verdad',   desc: 'Vínculo nivel 3 con VORA.',      test: m => bondLevel(m.bond).level >= 3 },
  { id: 'focus',   label: 'Foco compartido',    desc: 'Completaste una sesión Juntos.', test: m => m.sessionsDone >= 1 },
  { id: 'trivia',  label: 'Cerebro gamer',      desc: 'Acertaste 5/5 en la trivia.',    test: m => m.scores.trivia >= 5 },
  { id: 'emoji',   label: 'Ojo de emoji',       desc: 'Adivinaste 5/5 juegos por emojis.', test: m => (m.scores.emoji || 0) >= 5 },
  { id: 'reflex',  label: 'Reflejos de pro',    desc: 'Reaccionaste en menos de 250 ms.',  test: m => (m.scores.reflex || 0) > 0 && m.scores.reflex < 250 },
  { id: 'memory',  label: 'Memoria de elefante', desc: 'Completaste la memoria en 9 movimientos o menos.', test: m => (m.scores.memory || 0) > 0 && m.scores.memory <= 9 },
  { id: 'rps',     label: 'Leo tu mente',       desc: 'Le ganaste a VORA en piedra, papel o tijera.', test: m => (m.scores.rps || 0) >= 1 },
  { id: 'water',   label: 'Bien hidratado',     desc: 'Llegaste a 8 vasos de agua en un día.', test: m => (m.water?.count || 0) >= 8 },
  { id: 'planner', label: 'Estratega',          desc: 'Usaste 5 herramientas de VORA.',     test: m => (m.counts.tools || 0) >= 5 }
];
export function checkAchievements(mem) {
  const fresh = [];
  for (const a of ACHIEVEMENTS) if (!mem.achievements.includes(a.id) && a.test(mem)) { mem.achievements.push(a.id); fresh.push(a); }
  return fresh;
}
