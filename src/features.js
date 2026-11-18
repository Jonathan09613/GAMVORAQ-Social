// Reglas de las funciones nuevas de la v6. Todo es puro (sin DOM ni red) para poder probarlo.
import { uiLocale } from './i18n/index.js';

const MIN = 60000, HOUR = 3600000, DAY = 86400000;
const ts = v => new Date(v).getTime();

// ───────────────────────── Disponible para jugar ─────────────────────────
export const AVAIL_DURATIONS = [[30, '30 minutos'], [60, '1 hora'], [120, '2 horas'], [240, '4 horas']];
export const availabilityActive = (a, now = Date.now()) => Boolean(a && ts(a.until) > now);
/** Tiempo restante corto: «quedan 45 min», «quedan 2 h». */
export function remainingLabel(until, now = Date.now()) {
  const ms = ts(until) - now;
  if (!(ms > 0)) return 'terminó';
  if (ms < HOUR) return `quedan ${Math.max(1, Math.round(ms / MIN))} min`;
  const total = Math.round(ms / MIN), h = Math.floor(total / 60), m = total % 60;
  return `quedan ${h} h${m >= 5 ? ` ${m} min` : ''}`;
}

// ───────────────────────── Juego accesible ─────────────────────────
export const PLAY_TAGS = [
  ['sin_microfono', 'Juego sin micrófono', 'mic-off'],
  ['solo_texto', 'Me comunico por texto', 'message-square-text'],
  ['paciencia', 'Busco gente paciente', 'heart-handshake'],
  ['sin_presion', 'Partidas sin presión', 'coffee'],
  ['una_mano', 'Juego con una mano', 'hand'],
  ['lector_pantalla', 'Uso lector de pantalla', 'accessibility'],
  ['daltonismo', 'Tengo daltonismo', 'eye'],
  ['principiante', 'Estoy empezando', 'sparkles']
];
export const PLAY_TAG_LABEL = Object.fromEntries(PLAY_TAGS.map(([k, l]) => [k, l]));
export const ACCESS_TAGS = new Set(['sin_microfono', 'solo_texto', 'paciencia', 'sin_presion', 'una_mano', 'lector_pantalla', 'daltonismo', 'principiante']);

// ───────────────────────── Agenda de partidas ─────────────────────────
/** 'cancelled' · 'upcoming' · 'soon' (menos de 1 h) · 'live' · 'ended' */
export function sessionState(s, now = Date.now()) {
  if (!s) return 'ended';
  if (s.status === 'cancelled') return 'cancelled';
  const start = ts(s.starts_at), end = start + (Number(s.duration_min) || 60) * MIN;
  if (now >= end) return 'ended';
  if (now >= start) return 'live';
  if (start - now <= HOUR) return 'soon';
  return 'upcoming';
}
export const SESSION_LABEL = { cancelled: 'Cancelada', upcoming: 'Próxima', soon: 'Empieza pronto', live: 'En curso', ended: 'Terminó' };
export const going = (rsvps, sid) => rsvps.filter(r => r.session_id === sid && r.status === 'going');

/** Se puede calificar a compañeros desde que empieza la partida y durante 14 días, si ambos confirmaron. */
export function rateableMates(s, rsvps, me, now = Date.now()) {
  if (!s || s.status === 'cancelled') return [];
  const start = ts(s.starts_at);
  if (now < start || now - start > 14 * DAY) return [];
  const list = going(rsvps, s.id).map(r => r.user_id);
  if (!list.includes(me)) return [];
  return list.filter(u => u !== me);
}

/** Archivo .ics (RFC 5545) para añadir la partida al calendario del teléfono o la computadora. */
export function sessionIcs(s, { game = '', squad = '', url = '' } = {}) {
  const stamp = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = v => String(v || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const end = ts(s.starts_at) + (Number(s.duration_min) || 60) * MIN;
  const desc = [game && `Juego: ${game}`, squad && `Squad: ${squad}`, 'Organizado en GAMVORAQ'].filter(Boolean).join('\n');
  const fold = line => { const out = []; let rest = line; while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ' ' + rest.slice(74); } out.push(rest); return out.join('\r\n'); };
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GAMVORAQ//Agenda//ES', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${s.id}@gamvoraq`, `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(s.starts_at)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(s.title)}`, `DESCRIPTION:${esc(desc)}`, ...(url ? [`URL:${esc(url)}`] : []),
    'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', `DESCRIPTION:${esc(s.title)} empieza en 15 minutos`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
}
/** Valor para <input type="datetime-local"> en hora local. */
export function localInputValue(date) {
  const d = new Date(date), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
/** «Hoy 21:00», «Mañana 18:30», «vie 14 nov, 20:00». */
export function whenLabel(date, now = Date.now()) {
  const d = new Date(date), n = new Date(now);
  const hm = d.toLocaleTimeString(uiLocale(), { hour: '2-digit', minute: '2-digit' });
  const day0 = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day0(d) - day0(n)) / DAY);
  if (diff === 0) return `Hoy ${hm}`;
  if (diff === 1) return `Mañana ${hm}`;
  if (diff === -1) return `Ayer ${hm}`;
  return `${d.toLocaleDateString(uiLocale(), { weekday: 'short', day: 'numeric', month: 'short' })}, ${hm}`;
}

// ───────────────────────── Química de equipo y Pasaporte GG ─────────────────────────
export const CHEM_TAGS = [
  ['entendimos', 'Nos entendimos', 'handshake'],
  ['comunicacion', 'Buena comunicación', 'message-circle'],
  ['divertido', 'Me divertí', 'laugh'],
  ['amable', 'Fue amable', 'heart'],
  ['puntual', 'Llegó a tiempo', 'clock']
];
export const CHEM_LABEL = Object.fromEntries(CHEM_TAGS.map(([k, l]) => [k, l]));
export const cleanTags = tags => [...new Set((tags || []).map(String))].filter(t => CHEM_LABEL[t]).slice(0, 5);

export const PASSPORT_LEVELS = [
  { id: 'nuevo', label: 'Recién llegado', sessions: 0, raters: 0, icon: 'sparkles' },
  { id: 'camino', label: 'En camino', sessions: 1, raters: 0, icon: 'rocket' },
  { id: 'confiable', label: 'Confiable', sessions: 3, raters: 3, icon: 'badge-check' },
  { id: 'gg', label: 'Compañero GG', sessions: 10, raters: 8, icon: 'award' },
  { id: 'leyenda', label: 'Leyenda GG', sessions: 30, raters: 20, icon: 'crown' }
];
/** Nivel del Pasaporte a partir de los números agregados de gg_passport(). */
export function passportLevel(p = {}) {
  const sessions = Number(p.sessions) || 0, raters = Number(p.raters) || 0;
  let idx = 0;
  PASSPORT_LEVELS.forEach((l, i) => { if (sessions >= l.sessions && raters >= l.raters) idx = i; });
  const level = PASSPORT_LEVELS[idx], next = PASSPORT_LEVELS[idx + 1] || null;
  let pct = 100;
  if (next) {
    const part = (v, a, b) => (b > a ? Math.min(1, Math.max(0, (v - a) / (b - a))) : 1);
    pct = Math.round(((part(sessions, level.sessions, next.sessions) + part(raters, level.raters, next.raters)) / 2) * 100);
  }
  return { ...level, index: idx, next, pct, sessions, raters };
}
export function topTags(tags = {}, n = 3) {
  return Object.entries(tags).filter(([k, v]) => CHEM_LABEL[k] && v > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([k, v]) => ({ id: k, label: CHEM_LABEL[k], count: v }));
}
/** Puntos de química → bono para SYNC (con tope, para no tapar los demás criterios). */
export function chemistryBonus(entry) {
  if (!entry || !(entry.points > 0)) return null;
  const bonus = Math.min(25, entry.points * 3);
  return { bonus, why: `buena química en ${entry.sessions} ${entry.sessions === 1 ? 'partida' : 'partidas'}` };
}

// ───────────────────────── «Mientras no estabas» ─────────────────────────
/**
 * Resumen local de lo nuevo desde `since` (sin IA, solo conteos).
 * data: tablas de la app · me: id · since: ms · now: ms
 */
export function awaySummary(data, me, since, now = Date.now()) {
  if (!data || !me || !since) return { total: 0, lines: [] };
  const after = r => ts(r.created_at) > since;
  const lines = [];
  const mySquads = new Set((data.squad_members || []).filter(m => m.user_id === me).map(m => m.squad_id));
  for (const s of data.squads || []) {
    if (!mySquads.has(s.id)) continue;
    const n = (data.squad_messages || []).filter(m => m.squad_id === s.id && m.sender_id !== me && after(m)).length;
    if (n) lines.push({ kind: 'squad', id: s.id, count: n, text: `${n} ${n === 1 ? 'mensaje nuevo' : 'mensajes nuevos'} en ${s.name}` });
  }
  const myConvs = (data.conversations || []).filter(c => c.user_low === me || c.user_high === me);
  const dmCount = (data.direct_messages || []).filter(m => m.sender_id !== me && after(m) && myConvs.some(c => c.id === m.conversation_id)).length;
  if (dmCount) lines.push({ kind: 'dm', count: dmCount, text: `${dmCount} ${dmCount === 1 ? 'mensaje privado' : 'mensajes privados'}` });
  const myComms = new Set((data.community_members || []).filter(m => m.user_id === me).map(m => m.community_id));
  const posts = (data.posts || []).filter(p => p.author_id !== me && after(p) && p.community_id && myComms.has(p.community_id)).length;
  if (posts) lines.push({ kind: 'posts', count: posts, text: `${posts} ${posts === 1 ? 'publicación nueva' : 'publicaciones nuevas'} en tus comunidades` });
  const visible = new Set((data.play_sessions || []).map(s => s.id));
  const soon = (data.play_sessions || []).filter(s => visible.has(s.id) && s.status !== 'cancelled' && ts(s.starts_at) > now && ts(s.starts_at) - now < DAY
    && (data.session_rsvps || []).some(r => r.session_id === s.id && r.user_id === me && r.status === 'going')).length;
  if (soon) lines.push({ kind: 'sessions', count: soon, text: `${soon} ${soon === 1 ? 'partida agendada' : 'partidas agendadas'} en las próximas 24 h` });
  return { total: lines.reduce((n, l) => n + l.count, 0), lines };
}

// ───────────────────────── Modo tilt ─────────────────────────
const FRUSTRATION = /\b(perd[ií]|perdimos|otra vez perd|me rindo|odio este juego|que asco|qué asco|estoy hart[oa]|no puedo m[aá]s|tilt|tilteado|tilteada|ragequit|rage|i quit|i hate this game|so tilted|lag de m|equipo de mancos|mancos|manco)\b/i;
export const isFrustrated = text => FRUSTRATION.test(String(text || ''));
/**
 * Decide si VORA debe sugerir una pausa. signals: [{ at, kind: 'frustration' | 'guardian' }]
 * Dos señales en 10 minutos activan la sugerencia; luego descansa 30 minutos.
 */
export function tiltCheck(signals, lastNudge = 0, now = Date.now()) {
  if (now - lastNudge < 30 * MIN) return false;
  const recent = signals.filter(s => now - s.at <= 10 * MIN);
  return recent.length >= 2;
}

// ───────────────────────── Protección de menores (espejo de la base de datos) ─────────────────────────
/** Mismo criterio conservador que private.age_band(): quien cumple 18 este año cuenta como menor. */
export function ageBand(birthYear, now = new Date()) {
  const y = Number(birthYear);
  if (!y) return 'unknown';
  return now.getFullYear() - y >= 18 ? 'adult' : 'minor';   // v13: desde los 18 (antes 19)
}
export const BIRTH_YEARS = (now = new Date()) => Array.from({ length: 90 }, (_, i) => now.getFullYear() - 10 - i);

// ═════════════════════════ v7 ═════════════════════════

// ───────────────────────── Aniversarios de squad ─────────────────────────
const MILESTONES = [[1, 'un mes'], [3, 'tres meses'], [6, 'medio año']];
/** Meses completos entre dos fechas (calendario). */
export function monthsBetween(from, to) {
  const a = new Date(from), b = new Date(to);
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m--;
  return Math.max(0, m);
}
/** Etiqueta del tiempo juntos: «2 meses juntos», «1 año juntos». */
export function togetherLabel(since, now = Date.now()) {
  const m = monthsBetween(since, now);
  if (m < 1) { const d = Math.max(1, Math.floor((now - ts(since)) / DAY)); return `${d} ${d === 1 ? 'día' : 'días'} juntos`; }
  if (m < 12) return `${m} ${m === 1 ? 'mes' : 'meses'} juntos`;
  const y = Math.floor(m / 12); return `${y} ${y === 1 ? 'año' : 'años'} juntos`;
}
/**
 * Aniversarios que caen hoy o en los últimos 3 días, según cuándo entré a cada squad.
 * Hitos: 1, 3 y 6 meses, y cada año.
 */
export function anniversaries(squads, members, me, now = Date.now()) {
  const out = [];
  for (const m of members) {
    if (m.user_id !== me || !m.joined_at) continue;
    const s = squads.find(x => x.id === m.squad_id); if (!s) continue;
    const months = monthsBetween(m.joined_at, now);
    if (months < 1) continue;
    const label = months % 12 === 0 ? `${months / 12} ${months === 12 ? 'año' : 'años'}` : (MILESTONES.find(([n]) => n === months) || [])[1];
    if (!label) continue;
    const j = new Date(m.joined_at), date = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), j.getDate(), j.getHours(), j.getMinutes());
    const ago = Math.floor((now - date.getTime()) / DAY);
    if (ago >= 0 && ago <= 3) out.push({ squad: s, months, label, text: `Hoy se cumple${ago ? 'n' : ''} ${label} desde que entraste a ${s.name}`.replace('Hoy se cumplen', ago === 1 ? 'Ayer se cumplieron' : `Hace ${ago} días se cumplieron`) });
  }
  return out;
}

// ───────────────────────── Ligas locales ─────────────────────────
/** Calendario todos contra todos (método del círculo). Con número impar, cada ronda alguien descansa. */
export function roundRobin(teamIds) {
  const t = [...teamIds]; if (t.length < 2) return [];
  if (t.length % 2) t.push(null);
  const n = t.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = t[i], b = t[n - 1 - i];
      if (a && b) rounds.push({ round: r + 1, home: r % 2 ? b : a, away: r % 2 ? a : b });
    }
    t.splice(1, 0, t.pop());
  }
  return rounds;
}
/** Tabla de posiciones: 3 puntos por victoria, 1 por empate. Desempate: diferencia, a favor, nombre. */
export function standings(teams, matches, nameOf = id => id) {
  const row = id => ({ id, name: nameOf(id), pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 });
  const tab = new Map(teams.map(id => [id, row(id)]));
  for (const m of matches) {
    if (m.status !== 'played' || !tab.has(m.home_squad) || !tab.has(m.away_squad)) continue;
    const h = tab.get(m.home_squad), a = tab.get(m.away_squad), hs = Number(m.home_score), as = Number(m.away_score);
    h.pj++; a.pj++; h.gf += hs; h.gc += as; a.gf += as; a.gc += hs;
    if (hs > as) { h.g++; a.p++; h.pts += 3; } else if (hs < as) { a.g++; h.p++; a.pts += 3; } else { h.e++; a.e++; h.pts++; a.pts++; }
  }
  return [...tab.values()].sort((x, y) => y.pts - x.pts || (y.gf - y.gc) - (x.gf - x.gc) || y.gf - x.gf || String(x.name).localeCompare(String(y.name)));
}
export const LEAGUE_SCOPES = [['escuela', 'Escuela'], ['universidad', 'Universidad'], ['ciudad', 'Ciudad'], ['comunidad', 'Comunidad en línea']];
export const LEAGUE_STATUS = { inscripciones: 'Inscripciones abiertas', en_curso: 'En curso', terminada: 'Terminada' };

// ───────────────────────── Coach de partida (sin IA) ─────────────────────────
const COACH_RULES = [
  [/comunic|callout|nadie habl|no habl|micro|no se entend/i, 'Antes de empezar, acuerden 3 avisos cortos (por ejemplo «enemigo», «voy», «ayuda»). Menos palabras, más claridad.'],
  [/tilt|enoj|frustr|rage|grit|toxic|insult/i, 'Cuando sientas tilt, haz una pausa de 2 minutos entre partidas: agua, estirarte y respirar. Jugar enojado baja la puntería y la toma de decisiones.'],
  [/posici|mapa|flanc|rotac|zona/i, 'Revisa el mapa cada pocos segundos y decide tu posición antes del combate, no durante. Moverse con el equipo vale más que una buena puntería sola.'],
  [/punter|aim|disparo|fall[eé]|headshot/i, 'Practica 10 minutos de calentamiento de puntería antes de jugar y apunta a la altura de la cabeza al caminar.'],
  [/econom|compr|dinero|recurso|farm|oro/i, 'Coordinen las compras o los recursos en equipo: guarden juntos y gasten juntos para tener rondas fuertes.'],
  [/lag|internet|ping|conexi/i, 'Si hubo lag, juega con cable o cerca del router y cierra descargas. Es mejor avisar al equipo al inicio que culparse después.'],
  [/nuevo|principiante|aprend|no s[eé] jugar/i, 'Elige un solo rol o personaje y domínalo antes de cambiar. En Jugar puedes pedir una guía en el modo «primer día».']
];
export function coachTips({ result = '', notes = '' } = {}) {
  const tips = COACH_RULES.filter(([rx]) => rx.test(notes)).map(([, t]) => t);
  const base = ['Al terminar, cada quien dice una cosa que salió bien y una a mejorar. Corto y sin culpas.', 'Graba o recuerda un momento clave y piensa qué harías distinto. Un ajuste por partida es suficiente.', 'Agenda la próxima partida con el mismo equipo: la química mejora jugando juntos.'];
  for (const b of base) if (tips.length < 3) tips.push(b);
  const cheer = result === 'win' ? '¡Buen trabajo! Repitan lo que funcionó.' : result === 'loss' ? 'Perder también enseña. La próxima va mejor. ✦' : '¡A seguir jugando con buena vibra!';
  return { tips: tips.slice(0, 3), cheer };
}
