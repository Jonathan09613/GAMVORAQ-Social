// GAMVORAQ v11: reglas de cliente para menores, squads con roles, mensajes leídos, seguimientos e imágenes de juegos.
// Todo lo importante también lo hace cumplir el servidor (migración 006); aquí solo se decide qué mostrar.
import { state, d, getProfile } from './state.js';
import { e, icon, hueFor } from './ui.js';
import { ageBand } from './features.js';

const me = () => state.user?.id;

// ───────────── Menores ─────────────
export function myBirthYear() { return (d().profile_private || []).find(p => p.user_id === me())?.birth_year || null; }
export function myBand() { return ageBand(myBirthYear()); }
/** Hace falta registrar la edad para mensajes privados, squads y guías (solo si la base ya tiene la migración 003). */
export const needsAge = () => !(d()._missing || []).includes('profile_private') && !myBirthYear();
export function ageGateCard(context = '') {
  if (!needsAge()) return '';
  const now = new Date().getFullYear();
  const years = Array.from({ length: now - 7 - 1930 + 1 }, (_, i) => now - 7 - i);
  return `<section class="card card-pad age-gate"><div class="row">${icon('shield-check', 20)}<span class="eyebrow">Protección de menores</span></div>
    <h3>Registra tu año de nacimiento</h3>
    <p class="card-desc">${e(context || 'Ayúdanos a proteger a los menores de la comunidad registrando tu año de nacimiento.')} Nadie más lo ve: solo sirve para que adultos y menores no se escriban en privado ni compartan squads. <b>Se registra una sola vez.</b></p>
    <form class="row wrap" data-form="birth-year"><select class="select" name="birth_year" required aria-label="Año de nacimiento" style="max-width:200px"><option value="">Elige el año</option>${years.map(y => `<option value="${y}">${y}</option>`).join('')}</select><button class="btn btn-primary btn-sm" type="submit">${icon('check', 15)} Guardar</button></form></section>`;
}

// ───────────── Imágenes de juegos ─────────────
// Steam cambió dónde guarda las portadas: se prueban varios servidores oficiales en orden. Si ninguno
// funciona (o el juego no tiene número de Steam), la app busca la portada oficial y la guarda para todos.
export function steamCovers(appid) {
  const id = Number(appid); if (!(id > 0)) return [];
  return [`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`, `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`, `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/capsule_231x87.jpg`];
}
/** Portada del juego: la guardada (subida o encontrada) y después las de Steam. */
export function gameCovers(g) {
  if (!g) return [];
  const list = [];
  if (g.image_url && /^https?:\/\//.test(g.image_url)) list.push(g.image_url);
  for (const u of steamCovers(g.steam_appid)) if (!list.includes(u)) list.push(u);
  return list;
}
export const gameCover = g => gameCovers(g)[0] || '';
/** Juegos que necesitan buscar portada (los pide main.js en segundo plano). */
export const coverWanted = new Set();
// Portada de diseño (cuando no hay imagen o todas fallan): color y símbolo por género, y el nombre del juego
// en letra condensada. Así ningún juego queda con un hueco o una sola letra.
const GENRE_LOOK = [
  [/battle|shooter|fps|disparo|tácti/i, 'crosshair', 352], [/moba|estrategia|strategy|rts|4x/i, 'swords', 268],
  [/deporte|sport|fútbol|futbol|basket|carrera|racing|conducción/i, 'trophy', 28], [/cooperativ|party|fiesta|social/i, 'users', 312],
  [/rpg|rol|aventura|adventure|souls|acción/i, 'gem', 222], [/sandbox|supervivencia|survival|construcción|crafting/i, 'flame', 140],
  [/plataforma|metroidvania|roguelike|indie/i, 'sparkles', 190], [/simulación|simulation|granja|vida/i, 'coffee', 96],
  [/música|music|ritmo|rhythm/i, 'music', 296], [/lucha|fighting/i, 'zap', 8], [/cartas|card|puzzle/i, 'dices', 46]
];
const STOP = new Set(['of', 'the', 'de', 'la', 'el', 'and', 'y', 'to', 'a']);
export function gameMonogram(name = '') {
  const words = String(name).replace(/[:!.,'’™®-]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w.toLowerCase()));
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + (/^\d+$/.test(words[1]) ? words[1] : words[1][0])).toUpperCase().slice(0, 3);
}
export function gameLook(g) {
  const hit = GENRE_LOOK.find(([re]) => re.test(g?.genre || ''));
  const base = hit ? hit[2] : hueFor(g?.name || ''), shift = hueFor(g?.name || '') % 40 - 20;
  return { icon: hit ? hit[1] : 'gamepad-2', h: (base + shift + 360) % 360 };
}
/** Arte del juego: imagen si existe; si falla, el siguiente servidor; al final, la portada de diseño. */
export function gameArt(g, cls = '') {
  const urls = gameCovers(g), look = gameLook(g), name = e(g?.name || 'Juego');
  if (!urls.length && g?.id) coverWanted.add(g.id);
  return `<span class="game-cover ${cls}" style="--h:${look.h}" aria-hidden="true"><span class="gc-art"><span class="gc-ic">${icon(look.icon, 14)}</span><b class="gc-mono">${e(gameMonogram(g?.name))}</b><b class="gc-title">${name}</b></span>${urls.length ? `<img src="${e(urls[0])}" data-alt="${e(urls.slice(1).join('|'))}" data-game="${e(g?.id ?? '')}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="window.gvqImgFail&&window.gvqImgFail(this)">` : ''}</span>`;
}


// ───────────── Foto de squads y comunidades ─────────────
/** Foto del grupo si tiene; si no, el arte de respaldo (`fallback`). Con `editable`, tocarla abre el selector de imagen. */
export function groupArt(kind, obj, cls = '', fallback = '', editable = false) {
  const url = obj?.avatar_url && /^(https:\/\/|blob:)/.test(obj.avatar_url) ? obj.avatar_url : '';
  const inner = url ? `<span class="group-photo ${cls}"><img src="${e(url)}" alt="" loading="lazy" decoding="async"></span>` : fallback;
  if (!editable) return inner;
  return `<label class="photo-edit" title="Cambiar foto">${inner}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="sr-only" data-photo-kind="${e(kind)}" data-photo-id="${e(obj.id)}" aria-label="Cambiar la foto"><span class="pe-badge" aria-hidden="true">${icon('camera', 14)}</span></label>`;
}

// ───────────── Squads ─────────────
export const ROLE_LABEL = { owner: 'Dueño', admin: 'Admin', member: 'Integrante' };
export function squadRole(sid, uid = me()) { return (d().squad_members || []).find(m => m.squad_id === sid && m.user_id === uid)?.role || null; }
export const isSquadStaff = sid => ['owner', 'admin'].includes(squadRole(sid));
export const squadCount = sid => (d().squad_members || []).filter(m => m.squad_id === sid).length;
export const squadFull = s => squadCount(s.id) >= (s.max_members || 12);
/** ¿Encajo en este squad por rango de edad? (si el squad no tiene rango, sí). */
export function squadFitsMe(s) {
  const band = myBand();
  // v13: sin edad registrada cuentas como adulto (nunca entras a squads de menores).
  const mine = band === 'minor' ? 'minor' : 'adult';
  return (!s.age_band || s.age_band === 'unknown' ? 'adult' : s.age_band) === mine;
}
export const myInvites = () => (d().squad_invites || []).filter(i => i.user_id === me());
export const isMuted = sid => Boolean((d().squad_members || []).find(m => m.squad_id === sid && m.user_id === me())?.muted);

// ───────────── Mensajes: leídos y «Visto» ─────────────
export function lastRead(kind, chatId, uid = me()) {
  return (d().chat_reads || []).find(r => r.user_id === uid && r.chat_kind === kind && r.chat_id === chatId)?.last_read_at || '';
}
export function unreadIn(kind, chatId) {
  const since = lastRead(kind, chatId);
  const rows = kind === 'dm' ? (d().direct_messages || []).filter(m => m.conversation_id === chatId) : (d().squad_messages || []).filter(m => m.squad_id === chatId);
  return rows.filter(m => m.sender_id !== me() && !m.pending && (!since || String(m.created_at) > since)).length;
}
export function latestIn(kind, chatId) {
  const rows = kind === 'dm' ? (d().direct_messages || []).filter(m => m.conversation_id === chatId) : (d().squad_messages || []).filter(m => m.squad_id === chatId);
  return rows.reduce((m, r) => (!r.pending && String(r.created_at) > m ? String(r.created_at) : m), '');
}
/** El último mensaje mío que la otra persona ya leyó. */
export function seenUpTo(conversation) {
  if (!conversation) return '';
  const peer = conversation.user_low === me() ? conversation.user_high : conversation.user_low;
  return lastRead('dm', conversation.id, peer);
}
export const dmUnreadTotal = () => (d().conversations || []).filter(c => c.user_low === me() || c.user_high === me()).reduce((n, c) => n + (unreadIn('dm', c.id) ? 1 : 0), 0);

// ───────────── Seguimientos ─────────────
export const followersOf = id => (d().follows || []).filter(f => f.followed_id === id).map(f => f.follower_id);
export const followingOf = id => (d().follows || []).filter(f => f.follower_id === id).map(f => f.followed_id);
export const followsMe = id => (d().follows || []).some(f => f.follower_id === id && f.followed_id === me());
/** El servidor decide los casos de edad (un adulto no puede seguir a un menor); aquí solo evitamos seguirse a uno mismo. */
export const canFollow = id => id !== me();
export const profileName = id => getProfile(id)?.display_name || 'Alguien';
