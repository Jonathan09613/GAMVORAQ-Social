import './styles/base.css';
import './styles/layout.css';
import './styles/views.css';
import './styles/home.css';
import './styles/vora.css';
import './styles/v6.css';
import './styles/v8.css';
import './styles/v9.css';
import './styles/vora9.css';
import './styles/v11.css';
import './styles/v12.css';
import './styles/v15.css';
import { supabase, configured, must } from './client.js';
import { loadAll, addRow, deleteRow, updateRow, upload, uploadMemory, signMemory, loadPassport, loadPrivateOk, loadOlder, callFunction } from './data.js';
import { guardianCheck, normalizeMessage, softenMessage } from './guardian.js';
import { e, icon, btn, avatar } from './ui.js';
import * as notices from './notices.js';
import * as player from './player.js';
import * as media from './chatmedia.js';
import { state, d, me, getProfile, member, squadMember, squadStaff, isFollowing, isBlocked, myGames, theirGames, unreadCount, pendingMemoryCount, ROUTES, LEGACY_TABS } from './state.js';
import * as pwa from './pwa.js';
import { detectPlatform, parseShare, shouldOfferInstall } from './install.js';
import * as offline from './offline.js';
import { createVora } from './companion/vora.js';
import { compatibility } from './sync.js';
import { createTranslator, browserLang, LANG_CODES } from './translate.js';
import { translateFree, translateUiBatch } from './freetranslate.js';
import { viewMessages, viewAdmin, v12Modal, explainError, DM_REASON, peerOf, radarCard, healthBanner } from './v12.js';
import { searchMusic, gameRadar } from './apis.js';
import { DEMO_TRANSLATIONS } from './demo-translations.js';
import { awaySummary, isFrustrated, tiltCheck, sessionIcs, cleanTags, passportLevel, topTags, PLAY_TAG_LABEL, coachTips, roundRobin, whenLabel, going, availabilityActive, sessionState } from './features.js';
import { renderAuth } from './views/auth.js';
import { renderShell, netBar, paletteHtml, filterPalette, xpChipHtml, sideVoraHtml } from './views/shell.js';
import { viewHome } from './views/home.js';
import { viewPlay } from './views/play.js';
import { viewSquads } from './views/squads.js';
import { viewCommunities } from './views/communities.js';
import { viewProfile, viewNotifications } from './views/profile.js';
import { modalContent } from './views/modals.js';
import { useTranslator, canMessage } from './views/components.js';
import { isMuted, latestIn, lastRead, myBirthYear, needsAge, coverWanted } from './v11.js';
import { initUiLang, startUiTranslation, setUiLang, translateTree, translate, uiLang, uiLangFor, useMachineTranslation } from './i18n/index.js';
initUiLang();
useMachineTranslation((texts, target, from) => navigator.onLine === false ? null : translateUiBatch(texts, target, from, undefined,
  supabase ? async (t, tg, src) => { const { data, error } = await supabase.functions.invoke('game-feed', { body: { kind: 'ui', texts: t, target: tg, source: src } }); return error ? null : data?.texts; } : null));

const app = document.querySelector('#app');
const uid = () => state.user?.id;
const tabIds = new Set(ROUTES.map(([id]) => id));
const MIN = 60000;

// ───────────────────────── Avisos ─────────────────────────
let toastBox, toastTimer;
function notify(msg, ok = false) {
  if (!toastBox) { toastBox = document.createElement('div'); toastBox.className = 'toast-stack'; toastBox.setAttribute('role', 'status'); toastBox.setAttribute('aria-live', 'polite'); document.body.append(toastBox); }
  toastBox.replaceChildren();
  const t = document.createElement('div'); t.className = 'toast' + (ok ? ' ok' : '');
  t.innerHTML = `${icon(ok ? 'circle-check' : 'info', 18)}<span></span>`; t.querySelector('span').textContent = translate(msg);
  toastBox.append(t); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 4800);
}
function friendly(err) {
  const m = `${err?.code || ''} ${err?.message || ''}`;
  const clear = explainError(err);
  // Se añade el detalle técnico del servidor para poder diagnosticar si algo vuelve a fallar.
  if (clear) return /P0001/.test(m) ? clear : `${clear} (Detalle: ${String(err?.message || err?.code || '').slice(0, 140)})`;
  if (err?.code === 'P0001' && err?.message) return err.message;
  if (offline.isNetworkError(err)) return 'No hay conexión con el servidor. Inténtalo de nuevo cuando vuelvas a estar en línea.';
  if (/rate_limit/i.test(m)) return 'Vas muy rápido. Espera un minuto antes de seguir enviando.';
  if (/invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(m)) return 'Confirma tu correo antes de iniciar sesión.';
  if (/already registered|already been registered/i.test(m)) return 'Ese correo ya tiene una cuenta. Prueba iniciar sesión.';
  if (/password should be at least|weak password/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Espera unos minutos e inténtalo otra vez.';
  if (/duplicate key|23505/i.test(m)) return 'Eso ya existe (por ejemplo, el usuario ya está en uso o ya calificaste a esa persona).';
  if (/row-level security|42501|permission denied/i.test(m)) return 'No tienes permiso para hacer eso.';
  if (/P0001/.test(m) && err?.message) return err.message;
  return err?.message || 'No fue posible completar la acción.';
}

// ───────────────────────── Capa de datos (real o demostración en memoria) ─────────────────────────
const rid = () => (globalThis.crypto?.randomUUID?.() || 'id-' + Math.random().toString(36).slice(2));
function tableRows(t) { return (d()[t] ||= []); }
function demoAdd(table, values) {
  const row = { id: rid(), created_at: new Date().toISOString(), ...values };
  tableRows(table).push(row);
  // Los disparadores de la base de datos real se emulan aquí.
  if (table === 'communities') tableRows('community_members').push({ community_id: row.id, user_id: values.owner_id, role: 'owner' });
  if (table === 'squads') tableRows('squad_members').push({ squad_id: row.id, user_id: values.owner_id, role: 'owner' });
  if (table === 'play_sessions') { row.status = 'scheduled'; tableRows('session_rsvps').push({ session_id: row.id, user_id: values.host_id, status: 'going' }); }
  if (table === 'quests') row.badge_name = values.badge_name;
  if (table === 'guide_requests') { row.status = 'pending'; row.helpful = null; }
  return row;
}
const matches = (row, filter) => Object.entries(filter).every(([k, v]) => String(row[k]) === String(v));
async function add(table, values) { return state.demo ? demoAdd(table, values) : addRow(table, values); }
async function addMany(table, rows) { if (state.demo) { rows.forEach(r => demoAdd(table, r)); return; } must(await supabase.from(table).insert(rows)); }
async function del(table, filter) { if (state.demo) { d()[table] = tableRows(table).filter(r => !matches(r, filter)); return; } return deleteRow(table, filter); }
async function upd(table, filter, changes) {
  if (!state.demo) return updateRow(table, filter, changes);
  const hit = tableRows(table).filter(r => matches(r, filter)); hit.forEach(r => Object.assign(r, changes));
  if (table === 'quest_entries' && changes.status === 'approved') hit.forEach(r => { const q = d().quests.find(x => x.id === r.quest_id); tableRows('badges').push({ id: rid(), user_id: r.user_id, name: q?.badge_name || 'Insignia', created_at: new Date().toISOString() }); });
  return hit;
}
/** Inserta o actualiza por clave (disponibilidad, asistencia, datos privados). */
async function upsert(table, values, conflict) {
  if (state.demo) {
    const keys = conflict.split(','), rows = tableRows(table), hit = rows.find(r => keys.every(k => String(r[k]) === String(values[k])));
    if (hit) Object.assign(hit, values); else rows.push({ created_at: new Date().toISOString(), ...values });
    return values;
  }
  return must(await supabase.from(table).upsert(values, { onConflict: conflict }));
}
/** Funciones del servidor (migración 006). En la demostración se emulan en memoria. */
/** Usa la función del servidor (migración 008); si aún no existe, recurre al método anterior. */
async function viaRpc(name, args, fallback) {
  try { return await rpc(name, args); }
  catch (err) { if (/PGRST202|Could not find the function|does not exist/i.test(`${err?.code} ${err?.message}`)) return fallback(); throw err; }
}
// ───── Portadas de juegos: siguiente servidor si falla, y búsqueda de la portada oficial ─────
window.gvqImgFail = img => {
  const rest = (img.dataset.alt || '').split('|').filter(Boolean);
  if (rest.length) { img.dataset.alt = rest.slice(1).join('|'); img.src = rest[0]; return; }
  const id = Number(img.dataset.game); img.remove();
  if (id) { coverWanted.add(id); coverBroken.add(id); scheduleCovers(); }
};
const coverBroken = new Set(), coverAsked = new Set(); let coverTimer;
function scheduleCovers() { clearTimeout(coverTimer); coverTimer = setTimeout(fetchCovers, 1200); }
async function fetchCovers() {
  if (state.demo || !state.user || !navigator.onLine) return;
  const games = [...coverWanted].filter(id => !coverAsked.has(id)).slice(0, 30).map(id => d().games.find(g => g.id === id)).filter(Boolean);
  coverWanted.clear(); if (!games.length) return;
  games.forEach(g => coverAsked.add(g.id));
  try {
    const { data, error } = await supabase.functions.invoke('game-feed', { body: { kind: 'covers', games: games.map(g => ({ id: g.id, name: g.name, appid: g.steam_appid || null })) } });
    const found = (!error && data?.covers) || []; if (!found.length) return;
    found.forEach(c => { const g = d().games.find(x => x.id === c.id); if (g) { g.image_url = c.url; g.steam_appid = g.steam_appid || c.appid; } });
    softRender();
    await rpc('set_game_covers', { items: found.map(c => ({ ...c, replace: coverBroken.has(c.id) })) }).catch(() => {});
  } catch { /* la función game-feed aún no está desplegada: quedan las iniciales */ }
}
let downOnBackdrop = false;
document.addEventListener('pointerdown', ev => { downOnBackdrop = ev.target.classList?.contains('modal-back'); }, true);
async function rpc(name, args = {}) {
  if (!state.demo) { const { data, error } = await supabase.rpc(name, args); if (error) throw error; return data; }
  const me_ = uid(), members = tableRows('squad_members');
  switch (name) {
    case 'accept_squad_invite': {
      d().squad_invites = tableRows('squad_invites').filter(i => !(i.squad_id === args.sid && i.user_id === me_));
      if (!members.some(m => m.squad_id === args.sid && m.user_id === me_)) members.push({ squad_id: args.sid, user_id: me_, role: 'member', joined_at: new Date().toISOString() });
      return null;
    }
    case 'transfer_squad': {
      members.forEach(m => { if (m.squad_id === args.sid && m.user_id === me_) m.role = 'admin'; if (m.squad_id === args.sid && m.user_id === args.new_owner) m.role = 'owner'; });
      const sq = d().squads.find(x => x.id === args.sid); if (sq) sq.owner_id = args.new_owner; return null;
    }
    case 'test_push': tableRows('notifications').push({ id: rid(), user_id: me_, kind: 'test', body: '¡Las notificaciones de GAMVORAQ funcionan en este dispositivo! 🎮', created_at: new Date().toISOString() }); return null;
    case 'push_check': return { pg_net: true, url: true, secret: true, devices: 0, demo: true };
    case 'am_i_admin': return true;
    default: return null;
  }
}
/** Sube la portada de un juego a la carpeta games/ (solo administradores de la app). */
async function uploadGameImage(file, gameId) {
  if (state.demo) return uploadImage(file);
  if (!file?.type?.startsWith('image/')) throw new Error('Selecciona una imagen válida');
  if (file.size > 5 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 5 MB');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
  const path = `games/${gameId}-${Date.now()}.${ext}`;
  must(await supabase.storage.from('gamvoraq').upload(path, file, { contentType: file.type, cacheControl: '86400', upsert: false }));
  return supabase.storage.from('gamvoraq').getPublicUrl(path).data.publicUrl;
}
/** Marca como leído el chat que estás viendo («Visto» y no leídos en todos tus dispositivos). */
let readTimer = null; const readSent = new Map();
function syncChatRead() {
  clearTimeout(readTimer);
  readTimer = setTimeout(async () => {
    if (!state.user || !['squads', 'messages'].includes(state.tab) || document.hidden || (d()._missing || []).includes('chat_reads')) return;
    let kind = null, chatId = null;
    if (state.tab === 'messages') {
      const c = d().conversations.find(x => x.id === state.selectedConversation);
      if (c) { kind = 'dm'; chatId = c.id; }
    } else if ((state.squadsView || 'mine') === 'mine' && (state.squadPane || 'chat') === 'chat') {
      const mine = d().squads.filter(x => squadMember(x.id)); const sq = mine.find(x => x.id === state.selectedSquad) || mine[0];
      if (sq) { kind = 'squad'; chatId = sq.id; }
    }
    if (!kind) return;
    const latest = latestIn(kind, chatId); if (!latest || lastRead(kind, chatId) >= latest) return;
    const key = kind + ':' + chatId; if (readSent.get(key) === latest) return; readSent.set(key, latest);
    const row = { user_id: uid(), chat_kind: kind, chat_id: chatId, last_read_at: new Date(Math.max(Date.now(), new Date(latest).getTime())).toISOString() };
    try {
      await upsert('chat_reads', row, 'user_id,chat_kind,chat_id');
      if (!state.demo) { const list = tableRows('chat_reads'), hit = list.find(r => r.user_id === row.user_id && r.chat_kind === kind && r.chat_id === chatId); if (hit) Object.assign(hit, row); else list.push(row); }
      tableRows('notifications').forEach(n => { if (n.user_id === uid() && !n.read_at && n.ref_id === chatId && ['message', 'squad_message'].includes(n.kind)) n.read_at = row.last_read_at; });
      afterData(); softRefreshBadges();
    } catch (err) { console.warn('leído', err); }
  }, 350);
}
function softRefreshBadges() { if (['squads', 'messages'].includes(state.tab)) { const y = scrollY; render(); scrollTo(0, y); } else updateChrome(); }

async function uploadImage(file) {
  if (!state.demo) return upload(file, uid());
  if (!file || !file.type.startsWith('image/')) throw new Error('Selecciona una imagen válida');
  if (file.size > 5 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 5 MB');
  return URL.createObjectURL(file);
}
async function markAllRead() {
  const now = new Date().toISOString();
  if (state.demo) { tableRows('notifications').forEach(n => { if (n.user_id === uid() && !n.read_at) n.read_at = now; }); return; }
  await viaRpc('mark_notifications_read', { ids: null }, async () => must(await supabase.from('notifications').update({ read_at: now }).eq('user_id', uid()).is('read_at', null)));
  // Al instante en pantalla, aunque la recarga tarde.
  tableRows('notifications').forEach(n => { if (n.user_id === uid() && !n.read_at) n.read_at = now; });
  afterData();
}
async function ensureConversation(otherId) {
  const [low, high] = [otherId, uid()].sort();
  const cur = d().conversations.find(c => c.user_low === low && c.user_high === high); if (cur) return cur;
  if (state.demo) return demoAdd('conversations', { user_low: low, user_high: high });
  try { return await rpc('start_dm', { target: otherId }); }
  catch (err) { if (!/PGRST202|Could not find the function|does not exist/i.test(`${err?.code} ${err?.message}`)) throw err; }
  const r = await supabase.from('conversations').insert({ user_low: low, user_high: high }).select().single();
  if (r.error) {
    if (r.error.code === '23505') return must(await supabase.from('conversations').select('*').eq('user_low', low).eq('user_high', high).single());
    if (/42501|row-level security/i.test(`${r.error.code} ${r.error.message}`)) throw new Error('Esta persona no puede recibir mensajes privados tuyos (protección de menores o bloqueo).');
    throw r.error;
  }
  return r.data;
}

// ───────────────────────── Traducción automática ─────────────────────────
let trTimer;
const translator = createTranslator({
  demoTable: DEMO_TRANSLATIONS, free: (texts, target) => translateFree(texts, target),
  onUpdate: () => { clearTimeout(trTimer); trTimer = setTimeout(() => { if (state.user && state.data) render(); const n = translator.takeNotice(); if (n) notify(n); }, 60); },
  invoke: async (body, batch = []) => {
    const fallback = async () => {
      // Sin servidor de traducción: traducción gratuita directa desde el navegador.
      const res = await translateFree(batch.map(it => it.body), body.target);
      const translations = batch.map((it, i) => {
        const r = res[i]; if (!r) return null;
        const same = r.source === body.target || r.text.trim().toLowerCase() === String(it.body).trim().toLowerCase();
        return { source: it.source, id: it.id, text: r.text, source_lang: r.source, same };
      }).filter(Boolean);
      return translations.length ? { data: { translations }, status: 200 } : { data: null, error: new Error('sin traducción'), status: 502 };
    };
    try {
      const { data, error } = await supabase.functions.invoke('translate', { body });
      if (!error && data?.translations?.length) return { data, status: 200 };
      if (!error) return fallback();
      const status = error.context?.status || 0;
      if (status === 429) return { data: null, error, status };
      return fallback();
    } catch { return fallback(); }
  }
});
useTranslator(translator);
function configureTranslator() {
  const p = me();
  // El idioma del perfil manda en todos tus dispositivos (interfaz + traducción de mensajes).
  if (LANG_CODES.includes(p.language) && uiLangFor(p.language) !== uiLang()) { setUiLang(p.language); }
  translator.configure({ user: state.demo ? 'demo' : uid(), language: LANG_CODES.includes(p.language) ? p.language : browserLang(), autoTranslate: p.auto_translate !== false, isDemo: state.demo });
}
const SOURCE_TABLE = { direct_messages: 'direct_messages', squad_messages: 'squad_messages', channel_messages: 'channel_messages', comments: 'comments', posts: 'posts' };

// ───────────────────────── VORA con IA (opcional) ─────────────────────────
const aiKey = () => `gvq:ai:${uid()}`;
function loadAiPref() { try { state.aiOn = !state.demo && localStorage.getItem(aiKey()) === '1'; } catch { state.aiOn = false; } }
let aiWarned = false;
async function askAI(text, history, who) {
  if (!state.aiOn || state.demo || !state.online || !supabase) return null;
  const r = await callFunction('vora-ai', { mode: 'chat', text, history, name: who?.name, nick: who?.nick });
  if (r.status === 200 && r.data?.text) return r.data.text;
  if (!aiWarned && r.data?.error) { aiWarned = true; notify(r.data.error); }
  return null;
}

// ───────────────────────── Notificaciones push ─────────────────────────
const VAPID = import.meta.env?.VITE_VAPID_PUBLIC_KEY || '';
const b64uToBytes = s => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); };
async function pushRegistration() { try { return await navigator.serviceWorker?.getRegistration(); } catch { return null; } }
async function refreshPushState() {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  let on = false, text = '';
  if (state.demo) text = 'Disponible con una cuenta real.';
  else if (!supported) text = pwa.isIos() ? 'En iPhone primero instala la app en la pantalla de inicio.' : 'Este navegador no admite notificaciones push.';
  else if (!VAPID) text = 'Falta configurar la llave pública (VITE_VAPID_PUBLIC_KEY) en el .env.';
  else if (Notification.permission === 'denied') text = 'Bloqueaste las notificaciones en el navegador. Actívalas en la configuración del sitio.';
  else {
    const reg = await pushRegistration(), sub = await reg?.pushManager?.getSubscription();
    on = Boolean(sub) && Notification.permission === 'granted'; text = on ? 'Activadas en este dispositivo.' : '';
    if (on) await pushSaveRow(sub); // por si el servidor la borró o es otra cuenta en este dispositivo
  }
  state.push = { available: supported && Boolean(VAPID) && !state.demo && Notification.permission !== 'denied', on, text };
}
async function pushSaveRow(sub) {
  if (!sub || !uid() || state.demo) return;
  const j = sub.toJSON();
  try { await supabase.from('push_subscriptions').upsert({ user_id: uid(), endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' }); } catch { /* se reintenta al volver a entrar */ }
}
/** Al cerrar sesión, este dispositivo deja de recibir los avisos de esa cuenta. */
async function pushForget() {
  try { const sub = await (await pushRegistration())?.pushManager?.getSubscription(); if (sub && uid()) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint).eq('user_id', uid()); } catch { /* nada */ }
}
/** Explica en palabras simples por qué el teléfono no deja activar los avisos. */
function pushHelp(err) {
  const m = String(err?.message || err || ''), ua = navigator.userAgent;
  if (navigator.brave || /Brave/i.test(ua)) return 'Brave bloquea los avisos: abre brave://settings/privacy, activa «Usar los servicios de Google para mensajería push», reinicia Brave y vuelve a pulsar Activar. O abre GAMVORAQ en Chrome.';
  if (/push service error|AbortError|registration failed/i.test(m)) return 'Tu teléfono no pudo conectarse al servicio de avisos de Google. Revisa: 1) que no tengas VPN, bloqueador de anuncios o «DNS privado» activo; 2) que Google Play Services esté actualizado (los Huawei recientes no lo tienen); 3) en Chrome → Configuración → Notificaciones, que estén permitidas. Luego cierra la app y vuelve a pulsar Activar.';
  if (/NotAllowed|permission/i.test(m)) return 'Las notificaciones están bloqueadas para GAMVORAQ. Actívalas en la configuración del sitio o de la app y vuelve a intentarlo.';
  return 'No se pudieron activar los avisos en este dispositivo (' + m.slice(0, 80) + '). Cierra la app, ábrela otra vez y vuelve a pulsar Activar.';
}
async function pushOn() {
  if (!VAPID) throw new Error('Falta la llave pública de avisos (VITE_VAPID_PUBLIC_KEY) en el .env. Agrégala y vuelve a compilar.');
  if (await Notification.requestPermission() !== 'granted') { notify('No diste permiso para notificaciones.'); return; }
  const reg = await navigator.serviceWorker.ready;
  const key = b64uToBytes(VAPID);
  let sub;
  try { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }); }
  catch {
    // Suscripción vieja (otra llave) o fallo pasajero del servicio: se borra la anterior y se intenta otra vez.
    try { await (await reg.pushManager.getSubscription())?.unsubscribe(); } catch { /* nada */ }
    await new Promise(r => setTimeout(r, 800));
    try { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }); }
    catch (err) { throw new Error(pushHelp(err)); }
  }
  const j = sub.toJSON();
  await del('push_subscriptions', { endpoint: j.endpoint }).catch(() => {});
  must(await supabase.from('push_subscriptions').insert({ user_id: uid(), endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }));
  notify('Notificaciones activadas en este dispositivo.', true);
}
async function pushOff() {
  const reg = await pushRegistration(), sub = await reg?.pushManager?.getSubscription();
  if (sub) { await del('push_subscriptions', { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
  notify('Notificaciones desactivadas en este dispositivo.', true);
}

// ───────────────────────── Envíos en cola (modo sin conexión) ─────────────────────────
const QUEUE_TABLE = { post: 'posts', comment: 'comments', dm: 'direct_messages', 'squad-message': 'squad_messages', 'channel-message': 'channel_messages' };
async function sendItem(it) {
  const me_ = uid(), body = normalizeMessage(it.body, it.kind === 'post' ? 5000 : 2000);
  switch (it.kind) {
    case 'post': return add('posts', { author_id: me_, community_id: it.community_id || null, body });
    case 'comment': return add('comments', { author_id: me_, post_id: it.target, body });
    case 'dm': return add('direct_messages', { conversation_id: it.target, sender_id: me_, body });
    case 'squad-message': return state.demo ? add('squad_messages', { squad_id: it.target, sender_id: me_, body }) : viaRpc('send_squad_message', { target: it.target, body_text: body }, () => add('squad_messages', { squad_id: it.target, sender_id: me_, body }));
    case 'channel-message': return add('channel_messages', { channel_id: it.target, author_id: me_, body });
    default: throw new Error('Tipo de envío desconocido');
  }
}
async function submitText(kind, target, body, extra = {}) {
  const item = { kind, target, body, ...extra };
  if (!state.demo && !state.online) { offline.outboxAdd(uid(), item); overlayOutbox(); pwa.requestBackgroundSync(); return 'queued'; }
  try {
    const row = await sendItem(item);
    // Se muestra al instante, sin esperar a recargar todo.
    if (!state.demo && row?.id && QUEUE_TABLE[kind]) { const list = tableRows(QUEUE_TABLE[kind]); if (!list.some(r => r.id === row.id)) list.unshift(row); }
    return 'sent';
  }
  catch (err) {
    if (!state.demo && offline.isNetworkError(err)) { offline.outboxAdd(uid(), item); overlayOutbox(); pwa.requestBackgroundSync(); return 'queued'; }
    throw err;
  }
}
function overlayOutbox() {
  if (!state.data || !uid()) return;
  for (const t of Object.values(QUEUE_TABLE)) if (state.data[t]) state.data[t] = state.data[t].filter(r => !r.pending);
  const items = state.demo ? [] : offline.outboxList(uid());
  state.pendingCount = items.length;
  for (const it of items) {
    const row = { id: it.id, pending: true, created_at: new Date(it.at).toISOString() };
    const list = tableRows(QUEUE_TABLE[it.kind]);
    if (it.kind === 'post') list.push({ ...row, author_id: uid(), community_id: it.community_id || null, body: it.body });
    if (it.kind === 'comment') list.push({ ...row, post_id: it.target, author_id: uid(), body: it.body });
    if (it.kind === 'dm') list.push({ ...row, conversation_id: it.target, sender_id: uid(), body: it.body });
    if (it.kind === 'squad-message') list.push({ ...row, squad_id: it.target, sender_id: uid(), body: it.body });
    if (it.kind === 'channel-message') list.push({ ...row, channel_id: it.target, author_id: uid(), body: it.body });
  }
}
async function flushOutbox() {
  if (state.demo || !uid() || !offline.outboxList(uid()).length) return;
  state.syncing = true; render();
  const r = await offline.outboxFlush(uid(), sendItem);
  state.syncing = false;
  if (r.sent) { vora.event('synced', { count: r.sent }); notify(`Se enviaron ${r.sent} ${r.sent === 1 ? 'mensaje pendiente' : 'mensajes pendientes'}.`, true); }
  if (r.failed) notify(`${r.failed} ${r.failed === 1 ? 'envío no pudo enviarse' : 'envíos no pudieron enviarse'} y se descartó.`);
  await refresh();
}

// ───────────────────────── Carga de datos ─────────────────────────
let lastUnread = null;
async function enrich(data) {
  data._passport = { ...(state.data?._passport || {}), ...(data._passport || {}) };
  if (state.demo) { state.privateOk = null; return; }
  const ids = (data.profiles || []).map(p => p.id).filter(id => id !== uid()).slice(0, 500);
  const ok = await loadPrivateOk(ids);
  state.privateOk = ok ? new Set(ok) : null;
  for (const id of new Set([uid(), state.tab === 'profile' ? state.selectedUser : null].filter(Boolean))) {
    try { const p = await loadPassport(id); if (p) data._passport[id] = p; } catch (err) { console.warn('pasaporte', err); }
  }
}
async function ensurePassport(id) {
  if (state.demo || !id || d()._passport?.[id]) return;
  try { const p = await loadPassport(id); if (p) { d()._passport[id] = p; render(); } } catch (err) { console.warn(err); }
}
let refreshSeq = 0;
async function refresh() {
  if (state.demo) { render(); afterData(); return; }
  const mySeq = ++refreshSeq;
  try {
    const { data: auth } = await supabase.auth.getSession();
    if (!auth?.session) { if (!state.online) throw new TypeError('Failed to fetch'); sessionExpired(); return; }
    const data = await loadAll(false);
    const mems = (data.squad_memories || []).filter(m => m.image_path).slice(0, 40);
    await Promise.all(mems.map(async m => { try { m.image_url = await signMemory(m.image_path); } catch { m.image_url = null; } }));
    await enrich(data);
    if (!(data._missing || []).includes('squad_invites')) { try { state.isAdmin = Boolean(await rpc('am_i_admin')); } catch { state.isAdmin = false; } }
    if (state.isAdmin && state.tab === 'admin') loadAdminStats();
    // Si mientras tanto empezó otra recarga más nueva, esta (con datos más viejos) no se aplica.
    if (mySeq !== refreshSeq) return;
    state.data = data; state.stale = null;
    offline.saveSnapshot(uid(), data).then(ok => { if (ok) state.snapshotAt = Date.now(); });
  } catch (err) {
    if (offline.isNetworkError(err) || !state.online) {
      if (!state.data) {
        const snap = await offline.loadSnapshot(uid());
        if (!snap) throw err;
        state.data = snap.data; state.stale = snap.at; state.snapshotAt = snap.at;
      } else state.stale = state.stale || Date.now();
    } else throw err;
  }
  configureTranslator(); overlayOutbox(); if (me()?.companion) vora.setLook(me().companion); render(); afterData();
}
/** Avisos nuevos: tarjeta con sonido dentro de la app, o notificación del sistema si la app está en segundo plano. */
function liveNotices() {
  if (!state.user || !state.data) return;
  const fresh = notices.freshNotices(d().notifications || [], uid());
  for (const n of fresh.slice(-3)) {
    const chatOpen = (n.kind === 'message' && state.tab === 'messages' && n.ref_id && n.ref_id === state.selectedConversation)
      || (n.kind === 'squad_message' && state.tab === 'squads' && state.squadPane === 'chat' && n.ref_id && n.ref_id === state.selectedSquad);
    const visible = document.visibilityState === 'visible';
    if (visible && chatOpen) continue; // ya lo estás viendo
    if (visible) { const who = n.actor_id ? avatar(getProfile(n.actor_id), 'sm') : ''; notices.showNotice(n, { who }); }
    else if (!state.push?.on) notices.systemNotice(n, notices.noticeUrl(n)); // con push activo, el servidor ya lo envía
  }
  if (fresh.length && lastUnread !== null) vora.event('notifications', { count: fresh.length, chips: [{ l: 'Ver', a: 'go:notifications' }] });
}
// Invitación a activar los avisos push en este dispositivo (una vez; «Ahora no» la oculta 7 días).
const PUSH_ASK_KEY = 'gvq:pushAsk';
function maybeAskPush() {
  try {
    if (!state.user || state.demo || !state.push?.available || state.push.on || Notification.permission !== 'default') return;
    if (Date.now() - Number(localStorage.getItem(PUSH_ASK_KEY) || 0) < 7 * 86400000) return;
    if (document.querySelector('.push-ask')) return;
    const el = document.createElement('div'); el.className = 'push-ask';
    el.innerHTML = `<span class="notice-ic">${icon('bell-ring', 20)}</span><div class="grow"><b>${e(translate('Activa los avisos'))}</b><small>${e(translate('Entérate de mensajes, invitaciones y partidas aunque GAMVORAQ esté cerrada.'))}</small></div><div class="row">${btn('push-ask-later', 'Ahora no', 'btn btn-ghost btn-sm')}${btn('push-ask-on', 'Activar', 'btn btn-primary btn-sm')}</div>`;
    document.body.append(el);
  } catch { /* sin soporte */ }
}
function afterData() {
  if (coverWanted.size) scheduleCovers();
  const n = unreadCount();
  pwa.setBadge(n); document.title = (n ? `(${n}) ` : '') + 'GAMVORAQ';
  liveNotices();
  lastUnread = n;
}
let refreshTimer;
const scheduleRefresh = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => refresh().catch(console.warn), 450); };

// Realtime: mensajes, avisos, disponibilidad y agenda. RLS sigue filtrando cada fila.
let channel = null, chatChannel = null;
function subscribe() {
  if (!supabase || !state.user || state.demo) return;
  if (channel) supabase.removeChannel(channel);
  if (chatChannel) { supabase.removeChannel(chatChannel); chatChannel = null; }
  const on = (table, event = 'INSERT', filter) => ({ event, schema: 'public', table, ...(filter ? { filter } : {}) });
  // Canal aparte para chats nuevos (si la tabla aún no está en tiempo real, no afecta a lo demás).
  try { chatChannel = supabase.channel('gamvoraq-chats').on('postgres_changes', on('conversations'), scheduleRefresh).subscribe(); } catch { /* sin tiempo real para chats nuevos */ }
  channel = supabase.channel('gamvoraq-live')
    .on('postgres_changes', on('direct_messages'), scheduleRefresh).on('postgres_changes', on('squad_messages'), scheduleRefresh)
    .on('postgres_changes', on('channel_messages'), scheduleRefresh).on('postgres_changes', on('notifications', '*', `user_id=eq.${uid()}`), scheduleRefresh)
    .on('postgres_changes', on('squad_invites', '*'), scheduleRefresh).on('postgres_changes', on('chat_reads', '*'), scheduleRefresh)
    .on('postgres_changes', on('squad_members', '*'), scheduleRefresh).on('postgres_changes', on('direct_messages', 'DELETE'), scheduleRefresh).on('postgres_changes', on('squad_messages', 'DELETE'), scheduleRefresh)
    .on('postgres_changes', on('availability', '*'), scheduleRefresh).on('postgres_changes', on('play_sessions', '*'), scheduleRefresh)
    .on('postgres_changes', on('session_rsvps', '*'), scheduleRefresh)
    .on('postgres_changes', on('guide_requests', '*'), scheduleRefresh).on('postgres_changes', on('league_matches', '*'), scheduleRefresh)
    .on('postgres_changes', on('family_links', '*'), scheduleRefresh)
    .subscribe();
}

// ───────────────────────── «Mientras no estabas» ─────────────────────────
const seenKey = () => `gvq:seen:${state.demo ? 'demo' : uid()}`;
function computeAway() {
  let since = 0;
  try { since = Number(localStorage.getItem(seenKey())) || 0; } catch { /* sin almacenamiento */ }
  if (state.demo) since = Date.now() - 60 * MIN;
  if (!since || Date.now() - since < 10 * MIN) { state.away = null; return; }
  const s = awaySummary(d(), uid(), since);
  state.away = s.lines.length ? s : null;
}
function markSeen() { if (!state.user || state.demo) return; try { localStorage.setItem(seenKey(), String(Date.now())); } catch { /* nada */ } }

// ───────────────────────── Modo tilt ─────────────────────────
const tiltSignals = []; let lastTilt = 0;
function noteSignal(kind) {
  tiltSignals.push({ at: Date.now(), kind }); while (tiltSignals.length > 20) tiltSignals.shift();
  if (tiltCheck(tiltSignals, lastTilt)) {
    lastTilt = Date.now();
    vora.event('tilt', { priority: 2, chips: [{ l: 'Respirar 1 minuto', a: 'breathe' }, { l: 'Sesión de calma', a: 'session:start' }] });
  }
}

// ───────────────────────── Compañero VORA ─────────────────────────
const vora = createVora({
  getContext() {
    const others = (d().profiles || []).filter(p => p.id !== uid() && p.looking_for !== false && !isBlocked(p.id));
    let top = null;
    if (me() && others.length) {
      const best = others.map(p => ({ p, m: compatibility(me(), p, myGames(), theirGames(p.id)) })).sort((a, b) => b.m.score - a.m.score)[0];
      if (best) top = { id: best.p.id, name: best.p.display_name, score: best.m.score, why: best.m.why.slice(0, 2).join(', ') };
    }
    const now = Date.now(), rs = d().session_rsvps || [];
    const availableNow = me() ? (d().availability || []).filter(x => x.user_id !== uid() && x.mode !== 'silencioso' && availabilityActive(x, now) && !isBlocked(x.user_id)).map(x => getProfile(x.user_id)?.display_name).filter(Boolean) : [];
    const mine = me() ? (d().play_sessions || []).filter(x => ['upcoming', 'soon', 'live'].includes(sessionState(x, now)) && rs.some(r => r.session_id === x.id && r.user_id === uid() && r.status !== 'no' && r.status !== 'not_going')).sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)))[0] : null;
    const nextSession = mine ? { title: mine.title, when: whenLabel(mine.starts_at, now).replace(/^(Hoy|Mañana|Ayer)/, w => w.toLowerCase()), squad: (d().squads || []).find(q => q.id === mine.squad_id)?.name || '', going: rs.some(r => r.session_id === mine.id && r.user_id === uid() && r.status === 'going'), inMin: Math.round((new Date(mine.starts_at).getTime() - now) / 60000) } : null;
    return { topMatch: top, catalog: (d().games || []).slice(0, 30), libraryHint: myGames().map(id => (d().games || []).find(g => String(g.id) === String(id))?.name).filter(Boolean), online: state.online, unread: unreadCount(), pendingMemories: pendingMemoryCount(), availableNow, nextSession };
  },
  navigate: tab => (tab === 'demo' ? startDemo() : go(tab)),
  openModal: name => openModal(name),
  install: () => doInstall(),
  openProfile: id => go('profile', { selectedUser: id, profileTab: 'posts' }),
  openDm: id => openDm(id),
  askAI,
  requestRender: () => softRender(),
  // La apariencia se guarda también en el perfil (migración 007) para verla igual en el teléfono y la laptop.
  saveLook: look => { clearTimeout(lookTimer); lookTimer = setTimeout(() => { if (!state.user || state.demo || (d()._missing || []).includes('conversation_hides')) return; const p = me(); p.companion = look; upd('profiles', { id: uid() }, { companion: look }).catch(err => console.warn('apariencia', err)); }, 900); }
});
let lookTimer;
const voraState = () => (vora.isMounted() ? vora.getState() : null);
let softTimer;
function softRender() {
  clearTimeout(softTimer);
  softTimer = setTimeout(() => { if (!state.user) return; if (state.tab === 'home') render(); else updateChrome(); }, 220);
}
function updateChrome() {
  const v = voraState(); if (!v) return;
  const chip = document.querySelector('.xp-chip'); if (chip) chip.outerHTML = xpChipHtml(v);
  const side = document.querySelector('.side-vora'); if (side) side.outerHTML = sideVoraHtml(v);
}

// ───────────────────────── Render ─────────────────────────
function pwaInfo() { return { online: state.online, installable: state.installable, standalone: pwa.isStandalone(), ios: pwa.isIos(), snapshotAt: state.snapshotAt, pending: state.pendingCount, platform, origin: location.origin }; }
function pageHtml() {
  switch (state.tab) {
    case 'play': return viewPlay();
    case 'squads': return viewSquads();
    case 'communities': return viewCommunities();
    case 'profile': return viewProfile();
    case 'notifications': return viewNotifications();
    case 'messages': return viewMessages();
    case 'admin': return viewAdmin();
    default: return viewHome({ vora: voraState() || fallbackVora(), away: state.away });
  }
}
const fallbackVora = () => ({ name: 'VORA', missions: [], level: { level: 1, pct: 0, into: 0, need: 80 }, streak: 1, xp: 0, mood: 'happy', hidden: false, bond: { level: 1 }, days: 1 });
const demoBanner = () => `<div class="banner info demo-banner">${icon('eye', 16)}<span><b>Modo demostración.</b> Los datos son de ejemplo y los cambios viven solo en esta ventana. Prueba cambiar tu idioma en Ajustes para ver la traducción.</span></div>`;

function captureUi() {
  const out = { y: window.scrollY, fields: {}, focus: null, chats: [] };
  app.querySelectorAll('form[data-form]').forEach(f => {
    const key = `${f.dataset.form}|${f.dataset.id || ''}`;
    f.querySelectorAll('input, textarea').forEach(el => { if (el.name && el.value && !['file', 'password', 'checkbox', 'hidden', 'radio'].includes(el.type)) (out.fields[key] ||= {})[el.name] = el.value; });
  });
  const a = document.activeElement;
  if (a && app.contains(a) && a.name) { const f = a.closest('form[data-form]'); out.focus = { name: a.name, form: f ? `${f.dataset.form}|${f.dataset.id || ''}` : '', s: a.selectionStart, en: a.selectionEnd }; }
  out.chats = [...app.querySelectorAll('.chatbox')].map(el => el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  return out;
}
function restoreUi(ui, { top = false } = {}) {
  app.querySelectorAll('form[data-form]').forEach(f => {
    const vals = ui.fields[`${f.dataset.form}|${f.dataset.id || ''}`]; if (!vals) return;
    for (const [name, v] of Object.entries(vals)) { const el = f.elements[name]; if (el && 'value' in el && !el.value) el.value = v; }
  });
  app.querySelectorAll('.chatbox').forEach((el, i) => { if (ui.chats[i] ?? true) el.scrollTop = el.scrollHeight; });
  if (ui.focus && !top) {
    const sel = ui.focus.form ? [...app.querySelectorAll('form[data-form]')].find(f => `${f.dataset.form}|${f.dataset.id || ''}` === ui.focus.form)?.elements[ui.focus.name] : app.querySelector(`[name="${ui.focus.name}"]`);
    if (sel && typeof sel.focus === 'function') { sel.focus({ preventScroll: true }); try { sel.setSelectionRange(ui.focus.s, ui.focus.en); } catch { /* tipo sin selección */ } }
  }
  if (!top) window.scrollTo(0, ui.y);
}
function render(opts = {}) {
  try { renderInner(opts); crashCount = 0; player.refreshPageControls(); media.hydrate(supabase).catch(() => {}); }
  catch (err) { console.error('render', err); showCrash(err); }
}
/** Si una pantalla falla, se muestra el error dentro de la app (con menú) en vez de dejar todo en negro. */
function safePage() {
  try { return pageHtml(); }
  catch (err) {
    console.error('vista', state.tab, err);
    return `<section class="card card-pad crash-card"><h2>${icon('triangle-alert', 20)} Esta sección tuvo un problema</h2><p class="muted">El resto de la app sigue funcionando. Si se repite, manda captura de este recuadro.</p><pre class="crash-msg" data-noi18n>${e(String(err?.message || err))}\n${e(String(err?.stack || '').split('\n').slice(1, 4).join('\n'))}</pre><div class="row wrap">${btn('crash-home', 'Ir al inicio', 'btn btn-primary btn-sm')}${btn('crash-repair', 'Reparar y recargar', 'btn btn-soft btn-sm')}</div></section>`;
  }
}
let crashCount = 0;
function showCrash(err) {
  crashCount++;
  // Primer intento: volver al inicio sin nada seleccionado.
  if (crashCount === 1 && state.user) { Object.assign(state, { tab: 'home', selectedSquad: null, selectedCommunity: null, selectedConversation: null, selectedUser: null, modal: '' }); try { renderInner({}); return; } catch (e2) { err = e2; } }
  app.innerHTML = `<div style="min-height:100dvh;display:grid;place-items:center;padding:24px;background:#0b0709;color:#f3e9ec;font-family:system-ui,sans-serif">
    <div style="max-width:560px;width:100%;background:#17101a;border:1px solid #3a2530;border-radius:18px;padding:22px">
      <h2 style="margin:0 0 8px">GAMVORAQ tuvo un problema al abrir</h2>
      <p style="margin:0 0 12px;color:#bba">Tus datos están a salvo. Prueba «Reparar y recargar». Si vuelve a pasar, manda captura de esta pantalla.</p>
      <pre data-noi18n style="white-space:pre-wrap;word-break:break-word;background:#0b0709;border-radius:10px;padding:10px;font-size:12px;color:#ff9aa8;max-height:200px;overflow:auto">${e(String(err?.message || err))}\n${e(String(err?.stack || '').split('\n').slice(1, 5).join('\n'))}</pre>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button data-action="crash-repair" style="padding:12px 16px;border-radius:12px;border:0;background:#e11d48;color:#fff;font-weight:700">Reparar y recargar</button>
        <button data-action="crash-home" style="padding:12px 16px;border-radius:12px;border:1px solid #3a2530;background:none;color:#f3e9ec">Ir al inicio</button>
        <button data-action="logout" style="padding:12px 16px;border-radius:12px;border:1px solid #3a2530;background:none;color:#f3e9ec">Cerrar sesión</button>
      </div></div></div>`;
}
/** Borra la caché del service worker y las preferencias locales (no la sesión ni los datos del servidor) y recarga. */
async function repairApp() {
  try { const regs = await navigator.serviceWorker?.getRegistrations?.() || []; await Promise.all(regs.map(r => r.unregister())); } catch { /* nada */ }
  try { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); } catch { /* nada */ }
  try { Object.keys(localStorage).filter(k => k.startsWith('gvq:') && !k.startsWith('gvq:pendingBirth')).forEach(k => localStorage.removeItem(k)); sessionStorage.clear(); } catch { /* nada */ }
  location.replace(location.pathname);
}
window.addEventListener('error', ev => { if (!app.innerHTML.trim() || app.innerHTML.length < 40) showCrash(ev.error || ev.message); });
window.addEventListener('unhandledrejection', ev => { if (!app.innerHTML.trim()) showCrash(ev.reason); });
if (/[?&]reparar=1/.test(location.search)) repairApp();

function renderInner({ top = false, animate = false } = {}) {
  queueMicrotask(() => { if (coverWanted.size) scheduleCovers(); });
  const ui = captureUi();
  document.body.dataset.view = state.user ? 'app' : 'auth';
  document.documentElement.dataset.accent = state.accent;
  if (state.user && !state.data) { app.innerHTML = `<div class="boot" role="status" aria-live="polite"><img src="/icons/icon-192.png" alt="" width="72" height="72"><p>Cargando tu universo…</p></div>`; return; }
  if (!state.user) {
    app.innerHTML = renderAuth({ mode: state.authMode, configured, showPass: state.showPass, online: state.online, installable: state.installable, standalone: pwa.isStandalone() });
  } else {
    const net = netBar({ online: state.online, pending: state.pendingCount, updateReady: state.updateReady, stale: state.stale, syncing: state.syncing, installOffer: installOffer(), platform });
    let banner = ''; try { banner = state.demo ? demoBanner() : state.tab === 'messages' ? '' : healthBanner(); } catch { banner = ''; }
    app.innerHTML = renderShell({ page: banner + `<div class="${animate ? 'page-in' : ''}">${safePage()}</div>`, vora: voraState(), net });
  }
  restoreUi(ui, { top });
  if (state.modal && !document.querySelector('.modal-back')) { try { showModal(); } catch (err) { console.error('modal', err); state.modal = ''; } }
  if (state.user && state.data && ['squads', 'messages'].includes(state.tab)) syncChatRead();
}

// ───────────────────────── Superposiciones ─────────────────────────
let lastFocus = null;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])';
function trapFocus(root) {
  root.addEventListener('keydown', ev => {
    if (ev.key !== 'Tab') return;
    const items = [...root.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null); if (!items.length) return;
    const first = items[0], last = items.at(-1);
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); } else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  });
}
function showModal() {
  document.querySelector('.modal-back:not(.g-back)')?.remove();
  const [title, content] = modalContent({ pwa: pwaInfo(), vora: voraState() || { name: 'VORA', hidden: false }, translator, push: state.push, ai: state.aiOn });
  lastFocus = lastFocus || document.activeElement;
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-back" data-action="close-modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h3 id="modal-title">${e(title)}</h3><button type="button" class="btn btn-ghost btn-icon btn-sm" data-action="close-modal" aria-label="Cerrar">${icon('x', 18)}</button></div><div class="modal-body">${content}</div></div></div>`);
  const m = document.querySelector('.modal-back:not(.g-back) .modal'); trapFocus(m);
  if (state.modal.startsWith('share-passport')) drawPassport();
  setTimeout(() => m.querySelector('input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]),textarea,select,.btn-primary')?.focus({ preventScroll: true }), 40);
}
function openModal(name) { closeOverlays(); lastFocus = document.activeElement; state.modal = name; showModal(); }
function closeModal() { state.modal = ''; state.composeDraft = ''; document.querySelector('.modal-back:not(.g-back)')?.remove(); lastFocus?.focus?.({ preventScroll: true }); lastFocus = null; }
let palSel = 0;
function openPalette() {
  closeOverlays(); palSel = 0; lastFocus = document.activeElement;
  document.body.insertAdjacentHTML('beforeend', paletteHtml('', 0));
  const input = document.querySelector('#cmdk-q'); input.focus(); trapFocus(document.querySelector('.cmdk'));
  const redraw = () => { const tmp = document.createElement('div'); tmp.innerHTML = paletteHtml(input.value, palSel); const list = document.querySelector('#cmdk-list'); list.innerHTML = tmp.querySelector('#cmdk-list').innerHTML; list.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); };
  input.addEventListener('input', () => { palSel = 0; redraw(); });
  input.addEventListener('keydown', ev => {
    const n = filterPalette(input.value).length;
    if (ev.key === 'ArrowDown') { ev.preventDefault(); palSel = (palSel + 1) % Math.max(n, 1); redraw(); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); palSel = (palSel - 1 + n) % Math.max(n, 1); redraw(); }
    else if (ev.key === 'Enter') { ev.preventDefault(); const it = filterPalette(input.value)[palSel]; if (it) runPalette(it.id); }
  });
}
function closePalette() { document.querySelector('.cmdk-back')?.remove(); lastFocus?.focus?.({ preventScroll: true }); }
function closeOverlays() { document.querySelector('.cmdk-back')?.remove(); if (state.modal) closeModal(); }
function runPalette(id) {
  const [kind, arg] = id.split(':'); closePalette();
  if (kind === 'nav') return go(arg);
  switch (arg) {
    case 'compose': case 'settings': case 'set-available': case 'schedule-session': case 'edit-profile': return openModal(arg);
    case 'open-dms': return go('messages');
    case 'new-chat': return openModal('new-chat');
    case 'vora': return vora.open('chat');
    case 'session': return vora.open('together');
    case 'logout': return logout();
    case 'install': return pwa.isStandalone() ? notify('GAMVORAQ ya está instalada en este dispositivo.') : openModal('install');
    default:
  }
}

/** Pausa empática de GUARDIAN: la persona decide. Devuelve el texto a enviar, o null para volver a editar. */
function guardianDialog(text, problems) {
  return new Promise(resolve => {
    const soft = softenMessage(text), changed = soft !== text;
    const wrap = document.createElement('div'); wrap.className = 'modal-back g-back'; const prev = document.activeElement;
    wrap.innerHTML = `<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="g-title"><div class="modal-head"><h3 id="g-title">Una pausa antes de enviar</h3></div><div class="modal-body">
      <p class="help">GUARDIAN notó algo que podría caer mal. Tú decides qué hacer.</p>
      <ul class="g-list">${problems.map(p => `<li>${icon('shield-alert', 16)}<span>${e(p.message)}</span></li>`).join('')}</ul>
      ${changed ? `<div class="g-suggest"><b>Una versión más amable</b><p>${e(soft)}</p></div>` : ''}
      <div class="g-actions">${changed ? '<button class="btn btn-primary" data-g="soft">Usar la versión amable</button>' : ''}<button class="btn ${changed ? 'btn-soft' : 'btn-primary'}" data-g="edit">Volver a editar</button><button class="btn btn-ghost" data-g="send">Enviar como está</button></div></div></div>`;
    document.body.append(wrap); trapFocus(wrap);
    const done = v => { wrap.remove(); prev?.focus?.({ preventScroll: true }); resolve(v); };
    wrap.addEventListener('click', ev => { const g = ev.target.closest('[data-g]')?.dataset.g; if (g === 'soft') done(soft); else if (g === 'send') done(text); else if (g === 'edit') done(null); });
    wrap.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.stopPropagation(); done(null); } });
    wrap.querySelector('[data-g]').focus(); vora.event('guardian');
  });
}
/** Confirmación con un solo botón (sin escribir nada). Devuelve true si la persona confirma. */
function confirmDialog(title, body, okLabel = 'Sí, eliminar') {
  return new Promise(resolve => {
    const wrap = document.createElement('div'); wrap.className = 'modal-back g-back'; const prev = document.activeElement;
    wrap.innerHTML = `<div class="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="c-title"><div class="modal-head"><h3 id="c-title">${e(translate(title))}</h3></div><div class="modal-body">
      <p class="help">${e(translate(body))}</p>
      <div class="g-actions"><button class="btn btn-danger" data-c="ok">${icon('trash-2', 15)} ${e(translate(okLabel))}</button><button class="btn btn-ghost" data-c="no">${e(translate('Cancelar'))}</button></div></div></div>`;
    document.body.append(wrap); trapFocus(wrap);
    const done = v => { wrap.remove(); prev?.focus?.({ preventScroll: true }); resolve(v); };
    wrap.addEventListener('click', ev => { const c = ev.target.closest('[data-c]')?.dataset.c; if (c) done(c === 'ok'); else if (ev.target === wrap) done(false); });
    wrap.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.stopPropagation(); done(false); } });
    wrap.querySelector('[data-c="no"]').focus();
  });
}
async function guardText(text) {
  if (isFrustrated(text)) noteSignal('frustration');
  const problems = guardianCheck(text); if (!problems.length) return text;
  noteSignal('guardian');
  return guardianDialog(text, problems);
}

// ───────────────────────── Navegación ─────────────────────────
function go(tab, patch = {}, { push = true } = {}) {
  tab = LEGACY_TABS[tab] || tab;
  if (tab === 'squads' && patch.squadsView === 'dms') { tab = 'messages'; patch = { ...patch, squadsView: 'mine' }; }
  if (tab === 'admin' && !state.isAdmin) tab = 'home';
  if (tab === 'messages' && 'selectedConversation' in patch) { state.msgOpen = Boolean(patch.selectedConversation); checkDm(patch.selectedConversation); }
  if (tab === 'admin') loadAdminStats();
  if (!tabIds.has(tab)) tab = 'home';
  closeOverlays();
  if (tab !== state.tab) state.prevTab = state.tab;
  Object.assign(state, { tab, filter: '', search: '', modal: '' });
  if (tab !== 'communities') { state.selectedCommunity = null; state.selectedLeague = null; }
  if (tab === 'profile' && !('selectedUser' in patch)) Object.assign(state, { selectedUser: uid(), profileTab: 'posts' });
  Object.assign(state, patch);
  if (push && location.hash !== '#' + tab) { try { history.pushState({ tab }, '', '#' + tab); } catch { /* entorno sin historial */ } }
  render({ top: true, animate: true });
  window.scrollTo({ top: 0 });
  document.getElementById('main')?.focus({ preventScroll: true });
  vora.onNavigate(tab);
  if (tab === 'profile') ensurePassport(state.selectedUser);
}
async function openDm(id) {
  if (id === uid()) { notify(DM_REASON.self); return; }
  if (isBlocked(id)) { notify(DM_REASON.blocked); return; }
  // Si ya existe la conversación, se abre siempre (aunque sea de solo lectura).
  const existing = (d().conversations || []).find(c => (c.user_low === uid() && c.user_high === id) || (c.user_high === uid() && c.user_low === id));
  if (existing) {
    closeModal(); state.dmCheck[id] = undefined; go('messages', { selectedConversation: existing.id });
    // Si lo habías borrado «para ti», vuelve a aparecer en tu lista.
    if ((d().conversation_hides || []).some(h => h.conversation_id === existing.id && h.user_id === uid())) {
      d().conversation_hides = d().conversation_hides.filter(h => !(h.conversation_id === existing.id && h.user_id === uid()));
      if (!state.demo) del('conversation_hides', { user_id: uid(), conversation_id: existing.id }).catch(() => {});
    }
    return;
  }
  if (!ensureOnline()) return;
  const reason = await dmReason(id);
  // Respuestas del servidor viejo (sin la migración 008): se explica cómo resolverlo en vez de no hacer nada.
  if (reason === 'my_age') { state.pendingDm = id; closeModal(); openModal('age-gate'); notify('Tu servidor aún pide el año de nacimiento para chatear (falta la migración 008). Regístralo y se abrirá el chat.'); return; }
  if (reason === 'their_age') { notify('Esa persona no tiene edad registrada y tu servidor todavía lo exige: ejecuta la migración 008 en Supabase para poder escribirle.'); return; }
  if (reason !== 'ok') { notify(DM_REASON[reason] || 'No puedes escribirle a esta persona.'); return; }
  await run(async () => {
    const c = await ensureConversation(id); closeModal();
    // Se agrega al momento para abrir el chat sin esperar a recargar todo.
    if (c?.id && !d().conversations.some(x => x.id === c.id)) d().conversations.push(c);
    state.dmCheck[id] = 'ok'; go('messages', { selectedConversation: c.id });
    setTimeout(() => document.querySelector('form[data-form="dm"] input[name="body"]')?.focus(), 80);
    if (!state.demo) refresh().catch(() => {});
  });
}
/** ¿Por qué (no) puedo escribirle? Lo decide el servidor; en la demostración siempre se puede. */
async function dmReason(id) {
  if (state.demo) return 'ok';
  try { return (await rpc('dm_check', { target: id })) || 'ok'; }
  catch { return canMessage(id) ? 'ok' : 'their_age'; }
}
async function checkDm(convId) {
  const c = (d().conversations || []).find(x => x.id === convId); if (!c || state.demo) return;
  const peer = peerOf(c); if (state.dmCheck[peer]) return;
  state.dmCheck[peer] = await dmReason(peer); if (state.tab === 'messages') render();
}
async function loadAdminStats() {
  if (!state.isAdmin) return;
  if (state.demo) { state.adminStats = { users: d().profiles.length, new_week: 3, posts_day: d().posts.length, messages_day: d().direct_messages.length + d().squad_messages.length, open_reports: (d().reports || []).filter(r => r.status === 'open').length, suspended: (d().suspensions || []).length }; return; }
  try { state.adminStats = await rpc('admin_stats'); if (state.tab === 'admin') render(); } catch (err) { console.warn('admin', err); }
}
async function loadHealth() {
  if (state.demo) return;
  try { state.health = await rpc('gvq_health'); state.isAdmin = Boolean(state.health?.admin) || state.isAdmin; try { state.health.v13 = (await rpc('gvq_version')) >= 13; } catch { state.health.v13 = false; } }
  catch (err) { state.health = /function|PGRST202|does not exist/i.test(`${err?.code} ${err?.message}`) ? { missing: true } : null; }
}
async function loadRadar() {
  if (state.radar || !state.online) return;
  try { state.radar = await gameRadar(); if (state.tab === 'home') render(); } catch { /* sin conexión o API caída: el radar no se muestra */ }
}
function ensureOnline() {
  if (state.demo) return true;
  if (!supabase) { notify('Configura Supabase en el archivo .env.'); return false; }
  if (!state.online) { notify('Estás sin conexión. Esta acción necesita internet.'); return false; }
  return true;
}
/** Ejecuta algo en cuanto termine la acción en curso (las acciones no se encadenan para evitar dobles envíos). */
function afterBusy(fn, tries = 40) { if (!state.busy) fn(); else if (tries > 0) setTimeout(() => afterBusy(fn, tries - 1), 150); }
async function run(fn, trigger) {
  // Si hay otra acción en curso, esta espera su turno (antes se ignoraba el clic sin avisar).
  if (state.busy) {
    const start = Date.now();
    while (state.busy && Date.now() - start < 15000) await new Promise(r => setTimeout(r, 120));
    if (state.busy) { notify('La acción anterior sigue en curso. Inténtalo de nuevo en un momento.'); return; }
  }
  state.busy = true; document.body.classList.add('is-busy');
  const submit = trigger?.querySelector?.('[type=submit]'), old = submit?.innerHTML;
  if (submit) submit.disabled = true;
  try { await fn(); } catch (err) { console.error(err); notify(friendly(err)); }
  finally { state.busy = false; document.body.classList.remove('is-busy'); if (submit?.isConnected) { submit.disabled = false; if (old != null) submit.innerHTML = old; } }
}
const val = (form, name) => String(new FormData(form).get(name) || '').trim();
function download(name, content, type) {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const slug = s => String(s || 'partida').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40) || 'partida';

// ───────────────────────── Pasaporte GG como imagen ─────────────────────────
function passportText(p, data) {
  const lv = passportLevel(data), tags = topTags(data?.tags || {}, 3);
  return `Pasaporte GG de ${p.display_name} (@${p.username}) en GAMVORAQ\nNivel: ${lv.label}\n${lv.sessions} partidas jugadas · ${lv.raters} personas le dieron GG${tags.length ? `\nDestaca por: ${tags.map(t => `${t.label} (${t.count})`).join(', ')}` : ''}`;
}
function drawPassport() {
  const canvas = document.getElementById('pp-canvas'); if (!canvas?.getContext) return;
  const id = state.modal.split(':')[1] || uid(), p = getProfile(id), data = d()._passport?.[id] || {};
  const lv = passportLevel(data), tags = topTags(data.tags || {}, 3);
  const c = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  const acc = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#e11d2e';
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#120a10'); g.addColorStop(1, '#05040a');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const glow = c.createRadialGradient(W * .85, 0, 20, W * .85, 0, 600); glow.addColorStop(0, acc + '66'); glow.addColorStop(1, 'transparent');
  c.fillStyle = glow; c.fillRect(0, 0, W, H);
  c.strokeStyle = acc; c.lineWidth = 6; c.strokeRect(24, 24, W - 48, H - 48);
  const font = (w, s) => `${w} ${s}px Inter, system-ui, sans-serif`;
  c.fillStyle = acc; c.font = font(700, 30); c.fillText('PASAPORTE GG · GAMVORAQ', 72, 104);
  c.fillStyle = '#f5f0f2'; c.font = font(800, 84); c.fillText(p.display_name.slice(0, 22), 72, 214);
  c.fillStyle = '#aaa0a9'; c.font = font(500, 34); c.fillText(`@${p.username}${p.region ? ' · ' + p.region : ''}`, 72, 266);
  c.fillStyle = acc; c.font = font(800, 56); c.fillText(lv.label, 72, 368);
  c.fillStyle = '#f5f0f2'; c.font = font(700, 40);
  c.fillText(`${lv.sessions} partidas`, 72, 450); c.fillText(`${lv.raters} personas dieron GG`, 420, 450);
  c.font = font(600, 30); c.fillStyle = '#3ddc97';
  let x = 72; for (const t of tags) { const label = `${t.label} · ${t.count}`; const w = c.measureText(label).width + 40; c.strokeStyle = '#3ddc97'; c.lineWidth = 2; c.strokeRect(x, 494, w, 52); c.fillText(label, x + 20, 531); x += w + 18; }
  c.fillStyle = '#7a707a'; c.font = font(500, 24); c.fillText('Calificaciones positivas y anónimas de compañeros reales de partida.', 72, 590);
}

// ───────────────────────── PWA ─────────────────────────
const platform = detectPlatform(globalThis.navigator?.userAgent, { maxTouchPoints: globalThis.navigator?.maxTouchPoints || 0, platform: globalThis.navigator?.platform || '' });
// Contenido compartido desde otra app del teléfono (Web Share Target): se guarda hasta que haya sesión.
let sharedDraft = parseShare(location.search);
if (sharedDraft) { try { sessionStorage.setItem('gvq:share', sharedDraft); } catch { /* nada */ } } else { try { sharedDraft = sessionStorage.getItem('gvq:share'); } catch { /* nada */ } }
const INSTALL_KEY = 'gvq:installDismissed';
function installDismissedAt() { try { return Number(localStorage.getItem(INSTALL_KEY)) || 0; } catch { return 0; } }
function installOffer() { return shouldOfferInstall({ standalone: pwa.isStandalone(), installable: state.installable, platformId: platform.id, dismissedAt: installDismissedAt() }); }
/** Botón «Instalar»: si el navegador lo permite, instala de un toque; si no, abre la guía paso a paso de este dispositivo. */
async function doInstall({ guide = true } = {}) {
  if (pwa.isStandalone()) { notify('GAMVORAQ ya está instalada en este dispositivo.'); return; }
  const r = await pwa.promptInstall();
  if (r === 'accepted') { if (state.modal === 'install') closeModal(); return; }
  if (r === 'unavailable' && guide) openModal('install');
}
async function shareApp() {
  const url = location.origin + '/';
  const data = { title: 'GAMVORAQ', text: 'Instala GAMVORAQ en tu teléfono: la red social gamer que te cuida.', url };
  try { if (navigator.share) { await navigator.share(data); return; } } catch (err) { if (err?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); notify('Enlace copiado. Ábrelo en tu teléfono para instalar GAMVORAQ.', true); } catch { notify(`Abre ${url} en tu teléfono para instalarla.`); }
}
// Archivos abiertos con la app y enlaces web+gamvoraq:// (se guardan hasta que haya sesión).
let launchFiles = null, appLink = null;
try { appLink = pwa.parseAppLink(new URLSearchParams(location.search).get('link')); } catch { appLink = null; }
function useLaunchFiles() {
  if (!launchFiles || !state.user) return;
  const files = launchFiles; launchFiles = null;
  openModal('compose');
  setTimeout(() => { const input = document.querySelector('.modal input[type=file][name=image]'); if (!input) return; try { const dt = new DataTransfer(); dt.items.add(files[0]); input.files = dt.files; notify('Imagen lista para publicar.', true); } catch { notify('Adjunta la imagen desde «Imagen adjunta».'); } }, 80);
}
function useAppLink() {
  if (!appLink || !state.user) return;
  const l = appLink; appLink = null;
  if (l.username) { const p = d().profiles.find(x => x.username === l.username); if (p) return go('profile', { selectedUser: p.id, profileTab: 'posts' }); notify('No encontramos ese perfil.'); return; }
  if (l.squad) return go('squads', { squadsView: d().squads.some(x => x.id === l.squad && squadMember(x.id)) ? 'mine' : 'explore', selectedSquad: l.squad });
  if (l.community) return go('communities', { selectedCommunity: l.community });
  if (l.messages) return go('messages');
  go(l.tab || 'home');
}
function wirePwa() {
  pwa.onWorkerMessage(msg => {
    if (msg.type === 'flush-outbox' && state.user && state.online) flushOutbox().catch(console.warn);
    if (msg.type === 'refresh' && state.user) refresh().catch(console.warn);
    if (msg.type === 'push' && state.user) scheduleRefresh();
  });
  pwa.onLaunchFiles(files => { launchFiles = files.filter(f => f.type.startsWith('image/')).slice(0, 1); if (!launchFiles.length) launchFiles = null; else useLaunchFiles(); });
  if (pwa.isStandalone()) pwa.enablePeriodicSync();
  pwa.on('offline', () => { state.online = false; render(); if (state.user) vora.event('offline'); });
  pwa.on('online', async () => {
    state.online = true;
    if (!state.user) { render(); return; }
    vora.event('online'); notify('Volviste a estar en línea.', true);
    try { if (offline.outboxList(uid()).length) await flushOutbox(); else await refresh(); } catch (err) { console.warn(err); render(); }
  });
  pwa.on('installable', () => { state.installable = true; render(); if (state.user) vora.event('installable'); });
  pwa.on('installed', () => { state.installable = false; render(); if (state.user) vora.event('installed'); notify('GAMVORAQ se instaló correctamente.', true); });
  pwa.on('update', () => { state.updateReady = true; render(); if (state.user) vora.event('update'); });
}

// ───────────────────────── Sesión ─────────────────────────
/** Guarda el año de nacimiento que se eligió al crear la cuenta (una sola vez). */
async function applyPendingBirth(user) {
  const key = 'gvq:pendingBirth:' + String(user?.email || '').toLowerCase();
  let year = 0; try { year = Number(localStorage.getItem(key)) || 0; } catch { return; }
  if (!year || (d()._missing || []).includes('profile_private')) return;
  if (!myBirthYear()) { await upsert('profile_private', { user_id: user.id, birth_year: year, updated_at: new Date().toISOString() }, 'user_id'); await refresh(); }
  try { localStorage.removeItem(key); } catch { /* nada */ }
}
let entering = false;
async function enterApp(user, { demo = false } = {}) {
  if (entering) return; entering = true;
  try {
    Object.assign(state, { demo, isAdmin: demo, user, data: demo ? await loadAll(true) : null, authMode: 'login', showPass: false, stale: null, tab: initialTab(), modal: '', away: null, privateOk: null });
    if (/(^|[?&#=])messages\b/.test(location.search + location.hash)) state.tab = 'messages';
    Object.assign(state, { health: null, dmCheck: {}, msgOpen: false, adminStats: null });
    lastUnread = null; notices.resetNotices();
    const guess = demo ? 'Nova' : (user.user_metadata?.display_name || user.email?.split('@')[0] || '');
    vora.setUser(demo ? 'demo' : user.id, guess);
    if (!demo) { try { localStorage.setItem('gvq:lastUser', user.id); } catch { /* sin almacenamiento */ } }
    render({ top: true });
    if (demo) { configureTranslator(); afterData(); } else { await refresh(); const name = me()?.display_name; if (name && name !== guess) vora.setUser(user.id, name); subscribe(); }
    if (!demo) await applyPendingBirth(user).catch(err => console.warn('edad', err));
    if (!demo) await loadHealth();
    loadRadar();
    computeAway(); markSeen(); loadAiPref(); refreshPushState().then(() => { if (state.modal === 'settings') showModal(); setTimeout(maybeAskPush, 4000); });
    render({ top: true, animate: true });
    vora.greet();
    runDeepLink(); useAppLink(); useLaunchFiles();
    if (!demo && !me().language) notify('Elige tu idioma principal en Ajustes para leer los mensajes traducidos.');
    // La edad es obligatoria para lo privado: se pide al entrar hasta que se registre.
    if (!demo && needsAge() && !state.modal && !sessionStorage.getItem('gvq:age-asked')) setTimeout(() => { if (needsAge() && !state.modal) { sessionStorage.setItem('gvq:age-asked', '1'); openModal('age-gate'); } }, 900);
  } catch (err) {
    console.error(err); notify(friendly(err));
    state.user = null; state.data = null; render();
  } finally { entering = false; }
}
const startDemo = () => enterApp({ id: 'd1' }, { demo: true });
async function logout() {
  if (state.pendingCount && !confirm(`Tienes ${state.pendingCount} envío(s) pendiente(s) que se perderán si cierras sesión. ¿Cerrar sesión de todos modos?`)) return;
  const id = uid(), wasDemo = state.demo;
  markSeen();
  if (!wasDemo && supabase) { await pushForget(); notices.resetNotices(); try { await supabase.auth.signOut({ scope: 'local' }); } catch (err) { console.warn(err); } if (channel) { supabase.removeChannel(channel); channel = null; } if (chatChannel) { supabase.removeChannel(chatChannel); chatChannel = null; } await offline.clearOfflineData(id); try { localStorage.removeItem('gvq:lastUser'); } catch { /* nada */ } }
  player.stop(); media.cancelRecording(); media.stopVoice(); vora.signOut(); translator.signOut(); pwa.setBadge(0); document.title = 'GAMVORAQ';
  Object.assign(state, { demo: false, user: null, data: null, tab: 'home', modal: '', stale: null, pendingCount: 0, snapshotAt: null, authMode: 'login', privateOk: null, away: null });
  closeOverlays(); render({ top: true });
}
function sessionExpired() {
  notify('Tu sesión expiró. Inicia sesión de nuevo.');
  vora.signOut(); translator.signOut(); Object.assign(state, { user: null, data: null, tab: 'home', modal: '', stale: null });
  if (channel && supabase) { supabase.removeChannel(channel); channel = null; }
  render({ top: true });
}
function initialTab() {
  const q = new URLSearchParams(location.search).get('tab'), h = location.hash.slice(1);
  const pick = t => LEGACY_TABS[t] || t;
  return tabIds.has(pick(q)) ? pick(q) : tabIds.has(pick(h)) ? pick(h) : 'home';
}
function runDeepLink() {
  const a = new URLSearchParams(location.search).get('action');
  if (a === 'compose') openModal('compose');
  if (a === 'available') openModal('set-available');
  if (a === 'schedule') openModal('schedule-session');
  if (sharedDraft) { state.composeDraft = sharedDraft; sharedDraft = null; try { sessionStorage.removeItem('gvq:share'); } catch { /* nada */ } openModal('compose'); notify('Comparte lo que trajiste desde otra app.', true); }
  if (location.search) { try { history.replaceState({ tab: state.tab }, '', location.pathname + '#' + state.tab); } catch { /* nada */ } }
}

// ───────────────────────── Acciones (clics) ─────────────────────────
const MODAL_ACTIONS = new Set(['compose', 'edit-profile', 'create-community', 'create-squad', 'create-channel', 'create-quest', 'add-gallery', 'submit-quest', 'review-quest', 'create-memory', 'set-available', 'schedule-session', 'rate-session', 'settings', 'share-passport', 'guide-offer', 'guide-done', 'create-league', 'league-register', 'league-result', 'squad-edit', 'squad-invite', 'quest-edit', 'game-image', 'follow-list']);
async function handleClick(event) {
  const b = event.target.closest('[data-action]'); if (!b) return;
  const a = b.dataset.action, id = b.dataset.id, kind = b.dataset.kind, user = b.dataset.user;
  if (b.disabled) return;
  // Solo se cierra si el clic EMPEZÓ y terminó en el fondo (al seleccionar texto arrastrando no se cierra).
  if (a === 'close-modal-bg') { if (event.target === b && downOnBackdrop) closeModal(); return; }
  if (a === 'close-palette') { if (event.target === b) closePalette(); return; }
  switch (a) {
    case 'set-auth': state.authMode = id; state.showPass = false; render({ top: true }); return;
    case 'toggle-pass': { const inp = app.querySelector('input[name="password"]'); if (inp) { inp.type = inp.type === 'password' ? 'text' : 'password'; state.showPass = inp.type === 'text'; b.innerHTML = icon(state.showPass ? 'eye-off' : 'eye', 17); b.setAttribute('aria-label', state.showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'); b.setAttribute('aria-pressed', String(state.showPass)); } return; }
    case 'demo': startDemo(); return;
    case 'notice-close': notices.closeNotice(id); return;
    case 'voice-rec': {
      if (!ensureOnline()) return;
      try {
        await media.startRecording(kind, id, () => refreshAttSlot(kind, id));
        media.setAutoStop(() => sendVoice(kind, id));
        if (player.currentId()) player.toggle(); // pausa la música si sonaba
        refreshAttSlot(kind, id);
      } catch (err) { notify(err.message); }
      return;
    }
    case 'voice-stop': sendVoice(kind, id); return;
    case 'voice-cancel': media.cancelRecording(); refreshAttSlot(kind, id); return;
    case 'att-clear': media.clearPending(kind, id); refreshAttSlot(kind, id); return;
    case 'voice-play': {
      if (!media.toggleVoice(id)) { await media.hydrate(supabase); media.toggleVoice(id); }
      return;
    }
    case 'att-open': openPhoto(b.querySelector('img')?.src); return;
    case 'group-photo-remove': if (!ensureOnline()) return; await run(async () => { await setGroupPhoto(kind, id, null); notify('Foto quitada.', true); }); return;
    case 'notice-sound': notices.setSound(!notices.soundOn()); showModal(); return;
    case 'push-ask-later': try { localStorage.setItem(PUSH_ASK_KEY, String(Date.now())); } catch { /* nada */ } document.querySelector('.push-ask')?.remove(); return;
    case 'push-ask-on': if (!ensureOnline()) return; document.querySelector('.push-ask')?.remove(); await run(async () => { await pushOn(); await refreshPushState(); }); return;
    case 'install': doInstall(); return;
    case 'install-guide': openModal('install'); return;
    case 'install-share': shareApp(); return;
    case 'install-later': try { localStorage.setItem(INSTALL_KEY, String(Date.now())); } catch { /* nada */ } render(); notify('Listo, no te lo volveremos a sugerir en un tiempo. Está siempre en Ajustes.'); return;
    case 'nav': go(id); return;
    case 'nav-games': go('profile', { selectedUser: uid(), profileTab: 'games' }); return;
    case 'back': go(state.prevTab && state.prevTab !== 'profile' ? state.prevTab : 'play'); return;
    case 'logout': closeModal(); logout(); return;
    case 'palette': openPalette(); return;
    case 'palette-run': runPalette(id); return;
    case 'apply-update': pwa.applyUpdate(); return;
    case 'flush': if (ensureOnline()) flushOutbox().catch(err => notify(friendly(err))); return;
    case 'close-modal': closeModal(); return;
    case 'noop': return;
    // ── VORA ──
    case 'vora-open': vora.open('chat'); return;
    case 'vora-session': vora.open('together'); return;
    case 'vora-me': closeModal(); vora.open('me'); return;
    case 'vora-show': vora.show(); render(); if (state.modal) showModal(); return;
    case 'vora-hide': vora.hide(); render(); if (state.modal) showModal(); return;
    case 'mission-claim': { const r = vora.claimMission(id); if (!r.ok) notify('Aún no puedes reclamar esa misión.'); else notify(`+${r.xp + (r.bonus || 0)} XP reclamados${r.bonus ? ' (incluye el bonus del día)' : ''}.`, true); render(); return; }
    case 'mission-go': { const m = vora.getState().missions.find(x => x.id === id); if (!m) return; if (m.modal) openModal(m.modal); else if (m.panel) vora.open(m.panel); else if (m.tab) go(m.tab); return; }
    // ── Traducción ──
    case 'tr-toggle': translator.toggle(b.dataset.key); return;
    case 'tr-now': { const table = SOURCE_TABLE[b.dataset.source]; const row = table && tableRows(table).find(r => String(r.id) === String(id)); if (row) translator.translateNow({ source: table, id: row.id, body: row.body }); return; }
    case 'clear-translations': translator.clear(); notify('Traducciones guardadas borradas de este dispositivo.', true); if (state.modal) showModal(); render(); return;
    // ── Apariencia y datos locales ──
    case 'set-ui-lang': setUiLang(id); render(); if (state.modal) showModal(); translateTree(); notify('Preferencia guardada.', true); return;
    case 'set-accent': state.accent = id; try { localStorage.setItem('gvq:accent', id); } catch { /* nada */ } render(); if (state.modal) showModal(); return;
    case 'clear-offline': { await offline.clearOfflineData(uid()); const n = await pwa.clearCaches(); state.snapshotAt = null; state.pendingCount = 0; closeModal(); render(); notify(`Copia local borrada${n ? ' y caché de la app vaciado' : ''}.`, true); return; }
    case 'check-update': { notify('Buscando actualizaciones…'); try { const reg = await navigator.serviceWorker?.getRegistration(); await reg?.update(); } catch { /* sin SW */ } setTimeout(() => { if (!state.updateReady) notify('Ya tienes la última versión.', true); }, 1800); return; }
    // ── Navegación interna ──
    case 'open-dm': openDm(id); return;
    case 'open-dms': go('messages'); return;
    case 'open-squad': go('squads', { squadsView: 'mine', selectedSquad: id, squadPane: 'chat' }); return;
    case 'open-agenda': go('squads', { squadsView: 'mine', squadPane: 'agenda' }); return;
    case 'squads-view': state.squadsView = id; render(); return;
    case 'squad-pane': state.squadPane = id; render(); return;
    case 'community-pane': state.communityPane = id; render(); return;
    case 'view-user': go('profile', { selectedUser: id, profileTab: 'posts' }); return;
    case 'profile-tab': state.profileTab = id; state.search = ''; render(); return;
    case 'sync-filter': state.syncFilter = id; render(); return;
    case 'game-genre': state.gameGenre = id || ''; render(); return;
    case 'clear-community': state.selectedCommunity = null; render({ top: true }); return;
    case 'view-community': go('communities', { selectedCommunity: id, communityPane: 'posts' }); return;
    case 'select-channel': state.selectedChannel = id; render(); return;
    case 'select-conversation': state.selectedConversation = id; state.msgOpen = true; if (state.tab !== 'messages') go('messages', { selectedConversation: id }); else { checkDm(id); render(); } return;
    // ── v12: mensajes, reportes, música, encuestas, moderación, radar ──
    case 'crash-home': Object.assign(state, { tab: 'home', selectedSquad: null, selectedCommunity: null, selectedConversation: null, modal: '' }); crashCount = 0; render({ top: true }); return;
    case 'crash-repair': repairApp(); return;
    case 'msg-back': state.msgOpen = false; state.selectedConversation = null; render(); return;
    case 'new-chat': state.chatSearch = ''; openModal('new-chat'); return;
    case 'age-gate': openModal('age-gate'); return;
    case 'report': openModal(`report:${kind}:${id}`); return;
    case 'report-post': openModal(`report:post:${id}`); return;
    case 'radar-tab': state.radarTab = id; render(); return;
    case 'admin-tab': state.adminTab = id; render(); return;
    case 'admin-all': state.adminAll = !state.adminAll; render(); return;
    case 'track-play': playTrack(id); return;
    case 'track-share': {
      const t = state.musicResults?.items?.[Number(kind)]; if (!t) return;
      await run(async () => { await shareTrack(id, { title: t.title, artist: t.artist, artwork_url: t.artwork, preview_url: t.preview, link_url: t.link }); }); return;
    }
    case 'toggle-comments': state.filter = state.filter === 'comments:' + id ? '' : 'comments:' + id; render(); return;
    case 'dismiss-away': state.away = null; markSeen(); render(); return;
    // ── v7 ──
    case 'communities-view': state.communitiesView = id; state.selectedLeague = null; render(); return;
    case 'view-league': go('communities', { communitiesView: 'leagues', selectedLeague: id }); return;
    case 'clear-league': state.selectedLeague = null; render({ top: true }); return;
    case 'open-squad-public': if (squadMember(id)) go('squads', { squadsView: 'mine', selectedSquad: id, squadPane: 'chat' }); else go('squads', { squadsView: 'explore' }); return;
    case 'open-guides': go('play'); setTimeout(() => document.querySelector('.guide-box')?.scrollIntoView({ block: 'center' }), 120); return;
    case 'set-available': state.availMode = 'normal'; openModal('set-available'); return;
    case 'quiet-join': state.availMode = 'silencioso'; openModal('set-available'); return;
    case 'create-memory': state.memoryPrefill = null; openModal('create-memory' + (id ? ':' + id : '')); return;
    case 'coach': state.coachOut = null; openModal('coach:' + id); return;
    case 'steam-import': state.steamOut = ''; openModal('steam-import'); return;
    case 'guide-ask': state.guideAsk = { game: b.dataset.game }; openModal('guide-ask:' + id); return;
    case 'session-memory': {
      const s = (d().play_sessions || []).find(x => x.id === id); if (!s) return;
      state.memoryPrefill = { squad_id: s.squad_id, title: `${s.title} · ${whenLabel(s.starts_at)}`.slice(0, 90), participants: going(d().session_rsvps || [], s.id).map(r => r.user_id).filter(u => u !== uid()) };
      openModal('create-memory'); return;
    }
    case 'anniv-memory': {
      const sq = d().squads.find(x => x.id === id); if (!sq) return;
      state.memoryPrefill = { squad_id: id, title: `Aniversario en ${sq.name}`.slice(0, 90), story: 'Lo que más recuerdo de este tiempo juntos es…', participants: d().squad_members.filter(m => m.squad_id === id && m.user_id !== uid()).map(m => m.user_id) };
      openModal('create-memory'); return;
    }
    case 'ai-on': case 'ai-off': state.aiOn = a === 'ai-on'; try { localStorage.setItem(aiKey(), state.aiOn ? '1' : '0'); } catch { /* nada */ } aiWarned = false; notify(state.aiOn ? 'VORA usará IA cuando sus reglas no tengan respuesta.' : 'VORA vuelve a responder solo con sus reglas.', true); showModal(); return;
    case 'push-on': case 'push-off': if (!ensureOnline()) return; await run(async () => { if (a === 'push-on') await pushOn(); else await pushOff(); await refreshPushState(); showModal(); }); return;
    case 'family-view': {
      if (!ensureOnline()) return;
      state.familyData = null; openModal('family:' + id);
      const r = await supabase.rpc('family_overview', { minor: id });
      state.familyData = r.error ? { error: friendly(r.error) } : r.data; if (state.modal.startsWith('family')) showModal(); return;
    }
    case 'load-older': {
      if (!ensureOnline()) return;
      await run(async () => {
        const rows = await loadOlder(b.dataset.table, { [b.dataset.column]: id }, b.dataset.before);
        const have = new Set(tableRows(b.dataset.table).map(r => r.id));
        tableRows(b.dataset.table).push(...rows.filter(r => !have.has(r.id)));
        if (rows.length < 30) state.exhausted[`${b.dataset.table}:${id}`] = true;
        render(); if (!rows.length) notify('No hay más mensajes anteriores.');
      }); return;
    }
    case 'find-post': { const p = d().posts.find(x => x.id === id); if (p?.community_id) go('communities', { selectedCommunity: p.community_id, communityPane: 'posts', filter: 'comments:' + id }); return; }
    case 'session-ics': {
      const s = (d().play_sessions || []).find(x => x.id === id); if (!s) return;
      download(`${slug(s.title)}.ics`, sessionIcs(s, { game: d().games.find(g => String(g.id) === String(s.game_id))?.name, squad: d().squads.find(q => q.id === s.squad_id)?.name, url: location.origin + '/#squads' }), 'text/calendar');
      notify('Abre el archivo para añadir la partida a tu calendario (con aviso 15 min antes).', true); return;
    }
    case 'passport-download': { const cv = document.getElementById('pp-canvas'); cv?.toBlob(blob => blob && download('pasaporte-gg.png', blob, 'image/png')); return; }
    case 'passport-copy': { const id_ = state.modal.split(':')[1] || uid(); try { await navigator.clipboard.writeText(passportText(getProfile(id_), d()._passport?.[id_])); notify('Texto copiado.', true); } catch { notify('No se pudo copiar. Mantén presionado para copiar manualmente.'); } return; }
    case 'open-notice': {
      notices.closeNotice(id);
      const n = d().notifications.find(x => x.id === id); if (!n) return;
      if (!n.read_at && ensureOnline()) { (state.demo ? upd('notifications', { id }, { read_at: new Date().toISOString() }) : viaRpc('mark_notifications_read', { ids: [id] }, () => upd('notifications', { id }, { read_at: new Date().toISOString() }))).catch(console.warn); n.read_at = new Date().toISOString(); afterData(); }
      if (n.kind === 'message') return go('messages', { selectedConversation: n.ref_id || null });
      if (n.kind === 'moderation') return state.isAdmin && /reporte/i.test(n.body) ? go('admin') : null;
      if (n.kind === 'squad_message' || n.kind === 'squad') return go('squads', { squadsView: 'mine', selectedSquad: n.ref_id || state.selectedSquad, squadPane: 'chat' });
      if (n.kind === 'squad_invite') return go('squads', { squadsView: 'mine' });
      if (n.kind === 'quest_review') { openModal('review-quest:' + n.ref_id); return; }
      if (n.kind === 'session') return go('squads', { squadsView: 'mine', squadPane: 'agenda', selectedSquad: (d().play_sessions || []).find(s => s.id === n.ref_id)?.squad_id || state.selectedSquad });
      if (n.kind === 'follow' && n.actor_id) return go('profile', { selectedUser: n.actor_id, profileTab: 'posts' });
      if (n.kind === 'quest') return go('communities');
      if (n.kind === 'memory') return go('squads', { squadsView: 'mine', squadPane: 'memories' });
      render(); return;
    }
    default:
  }
  if (MODAL_ACTIONS.has(a)) { openModal(a + (id ? ':' + id : '')); return; }
  if (!ensureOnline()) return;
  await run(async () => {
    switch (a) {
      case 'clear-available': { await del('availability', { user_id: uid() }); await refresh(); notify('Ya no apareces como disponible.', true); break; }
      case 'wave': { await add('waves', { from_id: uid(), to_id: id }); await refresh(); notify(`Saludaste a ${getProfile(id).display_name} 👋`, true); break; }
      case 'ack-strike': {
        if (state.demo) d()._secondChance.forEach(x => { if (x.id === id) x.acknowledged = true; }); else must(await supabase.rpc('acknowledge_strike', { sid: id }));
        await refresh(); notify('Gracias por tu compromiso. Tu camino de vuelta ya empezó.', true); break;
      }
      case 'guide-accept': case 'guide-decline': {
        await upd('guide_requests', { id }, { status: a === 'guide-accept' ? 'accepted' : 'declined' }); await refresh();
        const r = (d().guide_requests || []).find(x => x.id === id);
        if (a === 'guide-accept' && r && canMessage(r.learner_id)) {
          // Se abre el chat aquí mismo: openDm() no puede correr mientras esta acción sigue en curso.
          const c = await ensureConversation(r.learner_id); if (!state.demo) await refresh();
          go('messages', { selectedConversation: c.id }); notify('¡Aceptaste! Escríbele para quedar de acuerdo.', true);
        } else notify('Solicitud respondida.', true);
        break;
      }
      case 'guide-cancel': { await upd('guide_requests', { id }, { status: 'done' }); await refresh(); notify('Solicitud cancelada.', true); break; }
      case 'guide-helpful': { await upd('guide_requests', { id }, { status: 'done', helpful: kind === 'yes' }); closeModal(); await refresh(); notify(kind === 'yes' ? '¡Gracias! Le avisamos a tu guía que le sirvió.' : 'Gracias por contarnos.', true); break; }
      case 'guide-unoffer': { await del('guide_offers', { user_id: uid(), game_id: Number(id) }); await refresh(); notify('Ya no te ofreces como guía en ese juego.', true); break; }
      case 'league-start': {
        const teams = d().league_teams.filter(t => t.league_id === id).map(t => t.squad_id);
        if (teams.length < 2) { notify('Hacen falta al menos 2 squads.'); return; }
        if (!confirm(`Se cierran las inscripciones y se crea un calendario de ${teams.length * (teams.length - 1) / 2} partidos (todos contra todos). ¿Continuar?`)) return;
        const base = new Date(); base.setDate(base.getDate() + 3); base.setHours(20, 0, 0, 0);
        const fixtures = roundRobin(teams).map(m => ({ league_id: id, round: m.round, home_squad: m.home, away_squad: m.away, scheduled_at: new Date(base.getTime() + (m.round - 1) * 7 * 86400000).toISOString(), status: 'scheduled' }));
        await addMany('league_matches', fixtures); await upd('leagues', { id }, { status: 'en_curso' }); await refresh(); notify('¡Calendario listo! Una ronda por semana.', true); break;
      }
      case 'league-finish': { if (!confirm('¿Terminar la liga? La tabla queda como resultado final.')) return; await upd('leagues', { id }, { status: 'terminada' }); await refresh(); notify('Liga terminada. ¡GG a todos los squads!', true); break; }
      case 'family-accept': { await upd('family_links', { guardian_id: id, minor_id: uid() }, { status: 'accepted' }); await refresh(); showModal(); notify('Aceptaste el modo familia. Puedes terminarlo cuando quieras.', true); break; }
      case 'family-remove': {
        if (!confirm('¿Terminar este acompañamiento familiar? La otra persona recibirá un aviso.')) return;
        await del('family_links', kind === 'guardian' ? { guardian_id: id, minor_id: uid() } : { guardian_id: uid(), minor_id: id }); await refresh(); showModal(); notify('Acompañamiento terminado.', true); break;
      }
      case 'rsvp': {
        await upsert('session_rsvps', { session_id: id, user_id: uid(), status: kind }, 'session_id,user_id');
        await refresh(); notify(kind === 'going' ? '¡Confirmado! Puedes añadirla a tu calendario.' : kind === 'maybe' ? 'Anotado como «tal vez».' : 'Avisaste que no puedes ir.', true);
        if (kind === 'going') vora.event('rsvp'); break;
      }
      case 'cancel-session': { if (!confirm('¿Cancelar esta partida? Se avisará a quienes confirmaron cuando vean la agenda.')) return; await upd('play_sessions', { id }, { status: 'cancelled' }); await refresh(); notify('Partida cancelada.', true); break; }
      case 'memory-approve': case 'memory-decline': { await upd('memory_consents', { memory_id: id, user_id: uid() }, { status: a === 'memory-approve' ? 'approved' : 'declined', decided_at: new Date().toISOString() }); await refresh(); notify('Preferencia guardada.', true); if (a === 'memory-approve') vora.event('memory'); break; }
      case 'memory-delete': { if (!confirm('¿Eliminar este recuerdo compartido?')) return; await del('squad_memories', { id }); await refresh(); break; }
      case 'react': {
        const prior = d().post_reactions.find(r => r.post_id === id && r.user_id === uid());
        if (prior && prior.kind === kind) await del('post_reactions', { post_id: id, user_id: uid() });
        else if (prior) await upd('post_reactions', { post_id: id, user_id: uid() }, { kind });
        else { await add('post_reactions', { post_id: id, user_id: uid(), kind }); vora.event('react'); }
        await refresh(); break;
      }
      case 'follow': {
        if (isFollowing(id)) await del('follows', { follower_id: uid(), followed_id: id });
        else {
          try { await add('follows', { follower_id: uid(), followed_id: id }); }
          catch (err) { if (/row-level security|42501/i.test(`${err?.code} ${err?.message}`)) throw new Error('No puedes seguir a esta persona (protección de menores o bloqueo).'); throw err; }
          vora.event('follow');
        }
        await refresh(); if (state.modal) showModal(); break;
      }
      case 'unblock-user': { await del('blocks', { blocker_id: uid(), blocked_id: id }); await refresh(); notify('Usuario desbloqueado.', true); if (state.modal) showModal(); break; }
      case 'block-user': { if (!confirm('¿Bloquear a esta persona? No podrán escribirse en privado y dejarán de verse en Jugar.')) return; await add('blocks', { blocker_id: uid(), blocked_id: id }); await refresh(); notify('Usuario bloqueado.', true); go('play'); break; }
      case 'toggle-game': { const gid = Number(id); if (myGames().map(Number).includes(gid)) await del('user_games', { user_id: uid(), game_id: gid }); else { await add('user_games', { user_id: uid(), game_id: gid }); vora.event('game_added'); } await refresh(); break; }
      case 'join-community': { if (member(id)) { await del('community_members', { community_id: id, user_id: uid() }); notify('Saliste de la comunidad.', true); } else { await add('community_members', { community_id: id, user_id: uid(), role: 'member' }); notify('Te uniste a la comunidad.', true); } await refresh(); break; }
      case 'join-squad': {
        if (squadMember(id)) break;
        try { await add('squad_members', { squad_id: id, user_id: uid(), role: 'member' }); }
        catch (err) { if (/row-level security|42501/i.test(`${err?.code} ${err?.message}`)) throw new Error(myBirthYear() ? 'No puedes unirte: el squad está lleno, es solo por invitación o es de otro rango de edad.' : 'Registra tu año de nacimiento (en Squads o en tu perfil) para unirte a squads.'); throw err; }
        notify('Ahora formas parte del squad.', true); vora.event('squad_join'); Object.assign(state, { squadsView: 'mine', selectedSquad: id, squadPane: 'chat' });
        await refresh(); break;
      }
      case 'leave-squad': { if (!confirm('¿Salir de este squad? Podrás volver si es abierto o si te invitan.')) return; await del('squad_members', { squad_id: id, user_id: uid() }); state.selectedSquad = null; notify('Saliste del squad.', true); await refresh(); break; }
      case 'squad-mute': { const m = !isMuted(id); await upd('squad_members', { squad_id: id, user_id: uid() }, { muted: m }); notify(m ? 'Silenciaste los avisos de este squad.' : 'Vuelves a recibir avisos de este squad.', true); await refresh(); break; }
      case 'squad-role': { await upd('squad_members', { squad_id: id, user_id: user }, { role: kind }); notify(kind === 'admin' ? 'Ahora es admin del squad.' : 'Ya no es admin.', true); await refresh(); break; }
      case 'squad-transfer': { if (!confirm(`¿Transferir el squad a ${getProfile(user).display_name}? Tú quedarás como admin.`)) return; await rpc('transfer_squad', { sid: id, new_owner: user }); notify('Squad transferido.', true); await refresh(); break; }
      case 'squad-kick': { if (!confirm(`¿Expulsar a ${getProfile(user).display_name} del squad?`)) return; await del('squad_members', { squad_id: id, user_id: user }); notify('Se quitó del squad.', true); await refresh(); break; }
      case 'squad-invite-send': { await add('squad_invites', { squad_id: id, user_id: user, invited_by: uid() }); notify(`Invitación enviada a ${getProfile(user).display_name}.`, true); await refresh(); if (state.modal) showModal(); break; }
      case 'squad-invite-cancel': { await del('squad_invites', { squad_id: id, user_id: user }); await refresh(); break; }
      case 'squad-invite-accept': { await rpc('accept_squad_invite', { sid: id }); await refresh(); go('squads', { squadsView: 'mine', selectedSquad: id, squadPane: 'chat' }); notify('¡Bienvenido al squad!', true); vora.event('squad_join'); break; }
      case 'squad-invite-decline': { await del('squad_invites', { squad_id: id, user_id: uid() }); notify('Invitación rechazada.', true); await refresh(); break; }
      case 'squad-delete': { const sq = d().squads.find(x => x.id === id); if (!sq || !(await confirmDialog(`¿Eliminar «${sq.name}»?`, 'Se borran su chat, agenda, música y recuerdos para todos los integrantes. No se puede deshacer.', 'Sí, eliminar squad'))) return; await del('squads', { id }); closeModal(); state.selectedSquad = null; await refresh(); notify('Squad eliminado.', true); break; }
      case 'delete-message': { if (!confirm('¿Borrar este mensaje para todos?')) return; await del(kind, { id }); await refresh(); notify('Mensaje borrado.', true); break; }
      case 'leave-quest': { if (!confirm('¿Abandonar este reto?')) return; if (state.demo) await del('quest_entries', { quest_id: id, user_id: uid() }); else await viaRpc('leave_quest', { target: id }, () => del('quest_entries', { quest_id: id, user_id: uid() })); notify('Saliste del reto.', true); await refresh(); break; }
      case 'quest-close': { await upd('quests', { id }, { ends_at: kind === 'close' ? new Date().toISOString() : null }); closeModal(); notify(kind === 'close' ? 'Reto cerrado: ya no acepta participantes.' : 'Reto reabierto.', true); await refresh(); break; }
      case 'quest-delete': { if (!confirm('¿Eliminar el reto? Se borran sus participaciones (las insignias ganadas se conservan si ya se entregaron).')) return; await del('quests', { id }); closeModal(); notify('Reto eliminado.', true); await refresh(); break; }
      case 'push-test': { await rpc('test_push'); notify('Enviamos un aviso de prueba. Si no llega en unos segundos, revisa el diagnóstico en Ajustes.', true); await refresh(); break; }
      case 'push-check': { state.pushCheck = await rpc('push_check'); showModal(); break; }
      case 'join-quest': { if (state.demo) await add('quest_entries', { quest_id: id, user_id: uid(), status: 'joined' }); else await viaRpc('join_quest', { target: id }, () => add('quest_entries', { quest_id: id, user_id: uid(), status: 'joined' })); notify('¡Te uniste al reto!', true); vora.event('quest_join'); await refresh(); break; }
      case 'approve-quest': case 'reject-quest': { { const changes = { status: a === 'approve-quest' ? 'approved' : 'rejected', reviewed_at: new Date().toISOString() };
        if (state.demo) await upd('quest_entries', { quest_id: id, user_id: user }, changes); else await viaRpc('review_quest_entry', { target: id, participant: user, approve: a === 'approve-quest' }, () => upd('quest_entries', { quest_id: id, user_id: user }, changes)); } notify('Participación revisada.', true); closeModal(); await refresh(); break; }
      case 'delete-post': { if (!confirm('¿Eliminar la publicación?')) return; await del('posts', { id }); await refresh(); break; }
      case 'delete-gallery': { if (!confirm('¿Quitar esta foto de tu galería?')) return; await del('gallery', { id, user_id: uid() }); await refresh(); break; }
      case 'review-report': case 'dismiss-report': { await upd('reports', { id }, { status: a === 'review-report' ? 'reviewed' : 'dismissed' }); await refresh(); break; }
      case 'read-all': { await markAllRead(); await refresh(); break; }
      // ── v12 ──
      case 'hide-chat': {
        if (!confirm('¿Borrar este chat para ti? La otra persona lo conserva. Si te vuelve a escribir, verás solo los mensajes nuevos.')) return;
        await upsert('conversation_hides', { user_id: uid(), conversation_id: id, hidden_at: new Date().toISOString() }, 'user_id,conversation_id');
        state.selectedConversation = null; state.msgOpen = false; await refresh(); notify('Chat borrado para ti.', true); break;
      }
      case 'delete-comment': { if (!confirm('¿Borrar este comentario?')) return; await del('comments', { id }); await refresh(); notify('Comentario borrado.', true); break; }
      case 'community-delete': {
        const c = d().communities.find(x => x.id === id); if (!c || !(await confirmDialog(`¿Eliminar «${c.name}»?`, 'Se borran sus canales, anuncios y retos para todos. No se puede deshacer.', 'Sí, eliminar comunidad'))) return;
        await del('communities', { id }); state.selectedCommunity = null; await refresh(); notify('Comunidad eliminada.', true); break;
      }
      case 'community-kick': { if (!confirm(`¿Sacar a ${getProfile(user).display_name} de la comunidad?`)) return; await del('community_members', { community_id: id, user_id: user }); await refresh(); notify('Se quitó de la comunidad.', true); break; }
      case 'community-role': {
        if (state.demo) tableRows('community_members').forEach(m => { if (m.community_id === id && m.user_id === user) m.role = kind; });
        else await rpc('set_community_role', { cid: id, target: user, new_role: kind });
        await refresh(); notify(kind === 'moderator' ? 'Ahora modera la comunidad.' : 'Ya no modera la comunidad.', true); break;
      }
      case 'track-like': {
        const mine = (d().track_likes || []).some(l => l.track_id === id && l.user_id === uid());
        if (mine) await del('track_likes', { track_id: id, user_id: uid() }); else await add('track_likes', { track_id: id, user_id: uid() });
        await refresh(); break;
      }
      case 'track-delete': { if (!confirm('¿Quitar esta canción de la playlist del squad?')) return; await del('squad_tracks', { id }); await refresh(); break; }
      case 'poll-vote': {
        const choice = Number(kind), mine = (d().squad_poll_votes || []).find(v => v.poll_id === id && v.user_id === uid());
        if (mine?.choice === choice) await del('squad_poll_votes', { poll_id: id, user_id: uid() });
        else await upsert('squad_poll_votes', { poll_id: id, user_id: uid(), choice }, 'poll_id,user_id');
        await refresh(); break;
      }
      case 'poll-delete': { if (!confirm('¿Eliminar esta encuesta y sus votos?')) return; await del('squad_polls', { id }); await refresh(); break; }
      case 'admin-refresh': { await refresh(); await loadAdminStats(); notify('Panel actualizado.', true); break; }
      case 'admin-delete': {
        const why = prompt('Motivo (se le muestra a la persona, opcional):', 'No respeta las normas de la comunidad'); if (why === null) return;
        if (state.demo) demoAdminDelete(kind, id); else await rpc('admin_delete', { kind, target: id, why });
        await refresh(); await loadAdminStats(); notify('Contenido eliminado y reporte resuelto.', true); break;
      }
      case 'admin-suspend': {
        const hours = Number(kind) || 24, why = prompt(`Motivo de la pausa de ${hours >= 48 ? Math.round(hours / 24) + ' días' : hours + ' horas'} (lo verá la persona):`, 'Acoso o lenguaje ofensivo'); if (why === null) return;
        if (state.demo) { const list = tableRows('suspensions').filter(x => x.user_id !== id); list.push({ user_id: id, until: new Date(Date.now() + hours * 3600000).toISOString(), reason: why, created_at: new Date().toISOString() }); d().suspensions = list; tableRows('reports').forEach(r => { if (r.reported_user_id === id && r.status === 'open') Object.assign(r, { status: 'reviewed', action: 'suspended' }); }); demoLog('suspend', 'user', id, `${hours} h · ${why}`); }
        else await rpc('admin_suspend', { target: id, hours, why });
        await refresh(); await loadAdminStats(); notify(`${getProfile(id).display_name} quedó en pausa.`, true); break;
      }
      case 'admin-unsuspend': {
        if (state.demo) { d().suspensions = tableRows('suspensions').filter(x => x.user_id !== id); demoLog('unsuspend', 'user', id); } else await rpc('admin_unsuspend', { target: id });
        await refresh(); await loadAdminStats(); notify('Pausa retirada.', true); break;
      }
      case 'admin-resolve': {
        if (state.demo) { tableRows('reports').forEach(r => { if (r.id === id) Object.assign(r, { status: kind, action: kind === 'reviewed' ? 'warned' : 'dismissed' }); }); demoLog(kind, 'report', id); } else await rpc('admin_resolve', { report: id, verdict: kind });
        await refresh(); await loadAdminStats(); notify(kind === 'reviewed' ? 'Reporte resuelto: la persona recibe una advertencia y su camino de segunda oportunidad.' : 'Reporte descartado.', true); break;
      }
      case 'admin-word-del': {
        if (state.demo) { d().blocked_words = tableRows('blocked_words').filter(w => w.word !== id); demoLog('word_remove', 'word', '', id); } else await rpc('admin_word', { term: id, adding: false });
        await refresh(); break;
      }
      default:
    }
  });
}

// ───────────────────────── v12: ayudas ─────────────────────────
function demoLog(action, target_kind, target_id, detail = '') { tableRows('mod_log').push({ id: rid(), actor_id: uid(), action, target_kind, target_id, detail, created_at: new Date().toISOString() }); }
function demoAdminDelete(kind, id) {
  const table = { post: 'posts', comment: 'comments', dm: 'direct_messages', squad_message: 'squad_messages', squad: 'squads', community: 'communities', track: 'squad_tracks' }[kind];
  if (table) d()[table] = tableRows(table).filter(r => r.id !== id);
  tableRows('reports').forEach(r => { if (r.target_id === id && r.status === 'open') Object.assign(r, { status: 'reviewed', action: 'deleted' }); });
  demoLog('delete', kind, id);
}
async function shareTrack(squadId, t) {
  const row = { squad_id: squadId, user_id: uid(), title: String(t.title).slice(0, 120), artist: String(t.artist).slice(0, 120), note: String(t.note || '').slice(0, 200), artwork_url: t.artwork_url || null, preview_url: t.preview_url || null, link_url: t.link_url || null };
  const saved = await add('squad_tracks', row);
  const vid = youtubeId(t.youtube || t.link_url || '');
  if (vid && saved?.id) { saved.youtube_id = vid; if (!state.demo) await rpc('set_track_video', { track: saved.id, vid }).catch(() => notify('La canción se compartió; para guardar su video completo ejecuta la migración 018.')); }
  // Se muestra al instante; la recarga completa sigue en segundo plano sin bloquear más canciones.
  if (!state.demo && saved?.id && !tableRows('squad_tracks').some(t => t.id === saved.id)) tableRows('squad_tracks').unshift(saved);
  render();
  notify(`🎵 Compartiste «${row.title}» con tu squad.`, true); vora.event('squad_join');
  if (!state.demo) refresh().catch(() => {});
}
// ───── Fotos y notas de voz en chats ─────
const FORM_OF = { dm: 'dm', squad: 'squad-message' };
function refreshAttSlot(kind, id) {
  const slot = document.querySelector(`[data-att-slot="${CSS.escape(kind + ':' + id)}"]`);
  if (slot) slot.innerHTML = media.composeExtras(kind, id);
  const form = slot?.closest('form'); form?.classList.toggle('is-recording', media.isRecording(kind, id));
}
async function sendVoice(kind, id) {
  const dur = await media.stopRecording(kind, id);
  refreshAttSlot(kind, id);
  if (!dur) { notify('No se grabó audio. Revisa el micrófono.'); return; }
  await run(async () => { await sendMedia(kind, id, ''); });
}
/** Envía el adjunto pendiente de ese chat (con el texto como comentario). */
async function sendMedia(kind, id, body) {
  const item = media.pendingFor(kind, id); if (!item) return false;
  if (!ensureOnline()) return true;
  const label = item.type === 'image' ? '📷 Foto' : '🎤 Mensaje de voz';
  const table = kind === 'dm' ? 'direct_messages' : 'squad_messages', chatKey = kind === 'dm' ? 'conversation_id' : 'squad_id';
  let row;
  if (state.demo) {
    row = { id: rid(), [chatKey]: id, sender_id: uid(), body: body || label, attachment_path: item.url, attachment_type: item.type, attachment_meta: item.meta, created_at: new Date().toISOString() };
    tableRows(table).push(row);
  } else {
    const path = await media.upload(supabase, kind, id, uid(), item);
    row = await rpc('send_chat_message', { kind, target: id, body_text: body || '', att_path: path, att_type: item.type, att_meta: item.meta });
    if (row?.id) { const list = tableRows(table); if (!list.some(r => r.id === row.id)) list.unshift(row); }
  }
  if (state.demo) mediaKeepAndClear(kind, id); else media.clearPending(kind, id);
  const form = document.querySelector(`form[data-form="${FORM_OF[kind]}"][data-id="${CSS.escape(id)}"]`); form?.reset();
  render(); if (!state.demo) refresh().catch(console.warn);
  return true;
}
// En demostración, la foto/audio vive en la memoria del navegador: no se libera la dirección temporal.
function mediaKeepAndClear(kind, id) { const it = media.pendingFor(kind, id); if (it) it.url = null; media.clearPending(kind, id); }
function openPhoto(src) {
  if (!src) return;
  const wrap = document.createElement('div'); wrap.className = 'photo-viewer'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', translate('Foto'));
  wrap.innerHTML = `<img src="${e(src)}" alt=""><button type="button" class="btn btn-soft btn-icon pv-close" aria-label="${e(translate('Cerrar'))}">${icon('x', 18)}</button>`;
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = ev => { if (ev.key === 'Escape') close(); };
  wrap.addEventListener('click', ev => { if (ev.target === wrap || ev.target.closest('.pv-close')) close(); });
  document.addEventListener('keydown', onKey); document.body.append(wrap); wrap.querySelector('.pv-close').focus();
}
document.addEventListener('change', ev => {
  const inp = ev.target.closest?.('input[data-chat-file]'); if (!inp) return;
  const file = inp.files?.[0]; inp.value = ''; if (!file) return;
  const { kind, id } = inp.dataset;
  media.prepareImage(kind, id, file).then(() => { refreshAttSlot(kind, id); document.querySelector(`form[data-form="${FORM_OF[kind]}"][data-id="${CSS.escape(id)}"] input[name="body"]`)?.focus(); }).catch(err => notify(err.message));
});
/** Foto de squad o comunidad: sube la imagen y la guarda (servidor valida que seas dueño/admin/moderación). */
async function setGroupPhoto(kind, id, file) {
  const table = kind === 'squad' ? 'squads' : 'communities';
  const url = file ? await uploadImage(file) : null;
  if (state.demo) { const row = (d()[table] || []).find(x => x.id === id); if (row) row.avatar_url = url; }
  else await viaRpc('set_group_photo', { kind, target: id, url }, () => upd(table, { id }, { avatar_url: url }));
  await refresh(); if (state.modal) showModal();
}
document.addEventListener('change', ev => {
  const inp = ev.target.closest?.('input[data-photo-kind]'); if (!inp) return;
  const file = inp.files?.[0]; if (!file) return;
  if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) { notify('Usa una imagen JPG, PNG, WEBP o GIF de máximo 5 MB.'); inp.value = ''; return; }
  if (!ensureOnline()) return;
  run(async () => { await setGroupPhoto(inp.dataset.photoKind, inp.dataset.photoId, file); notify('Foto actualizada.', true); });
});
function playTrack(id) {
  const t = (d().squad_tracks || []).find(x => x.id === id); if (!t) return;
  if (player.loadedId() === id && player.toggle(id)) return;
  const list = (d().squad_tracks || []).filter(x => x.squad_id === t.squad_id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  if (player.currentId()) media.stopVoice();
  player.play(t, list);
}
/** «https://youtu.be/ID», «youtube.com/watch?v=ID», «music.youtube.com/…», «/shorts/ID» o el ID solo. */
function youtubeId(text = '') {
  const s = String(text).trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
  return m && /youtu/.test(s) ? m[1] : null;
}
// Busca la canción completa en YouTube (función game-feed con YOUTUBE_API_KEY) y la guarda para todo el squad.
player.setResolver(async tr => {
  const fromLink = youtubeId(tr.link_url || ''); if (fromLink) return fromLink;
  if (state.demo || !state.online || !supabase) return null;
  const { data } = await supabase.functions.invoke('game-feed', { body: { kind: 'yt', q: `${tr.title} ${tr.artist}` } }).catch(() => ({ data: null }));
  const vid = data?.video?.id && /^[A-Za-z0-9_-]{11}$/.test(data.video.id) ? data.video.id : null;
  if (vid) rpc('set_track_video', { track: tr.id, vid }).catch(() => {});
  return vid;
});
player.onMissing(tr => { state.trackVideoFor = tr.id; if (state.tab === 'squads') render(); notify(`No encontramos «${tr.title}» completa. Pega el enlace de YouTube debajo de la canción.`); });
// Los iconos de reproducir/pausar de la lista siguen al reproductor.
player.onChange(() => { const now = player.currentId(); if (now === state.playing) return; state.playing = now; if (state.tab === 'squads' && state.squadPane === 'music' && !app.contains(document.activeElement?.closest?.('form'))) render(); });

// ───────────────────────── Formularios ─────────────────────────
const TEXT_FORMS = new Set(['comment', 'dm', 'squad-message', 'channel-message']);
async function afterTextSend(result, okEvent) {
  if (result === 'queued') { render(); notify('Sin conexión: se enviará automáticamente al reconectar.'); vora.event('queued'); }
  else { await refresh(); if (okEvent) vora.event(okEvent); }
}
async function handleSubmit(event) {
  const form = event.target.closest('[data-form]'); if (!form) return;
  event.preventDefault();
  const action = form.dataset.form, id = form.dataset.id;
  if (action === 'search') { state.search = val(form, 'term'); render(); return; }
  if (action === 'auth') {
    if (!configured) { notify('Primero configura Supabase en el archivo .env.'); return; }
    if (!state.online) { notify('Necesitas conexión para iniciar sesión.'); return; }
    if (!form.checkValidity()) { form.reportValidity(); return; }
    await run(async () => {
      const email = val(form, 'email'), password = String(new FormData(form).get('password') || '');
      if (state.authMode === 'register') {
        const year = Number(val(form, 'birth_year'));
        if (!year) throw new Error('Elige tu año de nacimiento.');
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: val(form, 'display_name') } } });
        if (error) throw error;
        // El año se guarda al primer inicio de sesión (si la cuenta requiere confirmar el correo, todavía no hay sesión).
        try { localStorage.setItem('gvq:pendingBirth:' + email.toLowerCase(), String(year)); } catch { /* sin almacenamiento */ }
        if (data.session) {
          await enterApp(data.user);
          try { await upd('profiles', { id: data.user.id }, { language: browserLang() }); await refresh(); } catch { /* migración 003 pendiente */ }
          notify('Cuenta creada. ¡Bienvenido!', true);
        } else notify('Revisa tu correo y confirma tu cuenta antes de iniciar sesión.', true);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await enterApp(data.user); notify('¡Bienvenido a GAMVORAQ!', true);
      }
    }, form);
    return;
  }
  const queueable = TEXT_FORMS.has(action) || (action === 'post' && !form.elements.image?.files?.[0]);
  if (!queueable && !ensureOnline()) return;
  if ((action === 'dm' || action === 'squad-message') && media.pendingFor(action === 'dm' ? 'dm' : 'squad', id)) {
    await run(async () => {
      let body = val(form, 'body');
      if (body) { const checked = await guardText(body); if (checked == null) return; body = checked; }
      await sendMedia(action === 'dm' ? 'dm' : 'squad', id, body);
    }, form);
    return;
  }
  await run(async () => {
    let body = val(form, 'body');
    if (['post', 'comment', 'dm', 'squad-message', 'channel-message'].includes(action)) {
      if (!body) throw new Error('Escribe algo, o adjunta una foto o una nota de voz.');
      const checked = await guardText(body); if (checked == null) return; body = checked;
    }
    switch (action) {
      case 'language': {
        const language = val(form, 'language'), auto = form.elements.auto_translate.checked;
        if (!LANG_CODES.includes(language)) throw new Error('Elige un idioma de la lista.');
        // Primero la interfaz (funciona aunque el servidor tarde); luego se guarda en el perfil para todos tus dispositivos.
        setUiLang(language); translator.clear();
        const p = me(); p.language = language; p.auto_translate = auto;
        try { await upd('profiles', { id: uid() }, { language, auto_translate: auto }); } catch (err) { console.warn('idioma', err); }
        configureTranslator(); closeModal(); await refresh(); configureTranslator(); render(); translateTree();
        notify('Idioma aplicado en toda la app.', true); break;
      }
      case 'availability': {
        const minutes = Math.min(360, Math.max(15, Number(new FormData(form).get('minutes')) || 60));
        const game_id = val(form, 'game_id') ? Number(val(form, 'game_id')) : null;
        const v7 = !(d()._missing || []).includes('waves');
        await upsert('availability', { user_id: uid(), game_id, platform: val(form, 'platform'), note: val(form, 'note').slice(0, 120), until: new Date(Date.now() + minutes * MIN).toISOString(), ...(v7 ? { mode: val(form, 'mode') === 'silencioso' ? 'silencioso' : 'normal' } : {}) }, 'user_id');
        state.flags.wasAvailable = true; closeModal(); await refresh(); notify('¡Listo! Tu gente ya puede ver que estás disponible.', true); vora.event('available'); break;
      }
      case 'session': {
        const when = new Date(val(form, 'starts_at'));
        if (!Number.isFinite(when.getTime())) throw new Error('Elige día y hora.');
        if (when.getTime() < Date.now() - 5 * MIN) throw new Error('La partida debe ser en el futuro.');
        const squad_id = val(form, 'squad_id') || null;
        if (squad_id && !squadMember(squad_id)) throw new Error('Debes pertenecer a ese squad.');
        const sessionRow = { host_id: uid(), squad_id, game_id: val(form, 'game_id') ? Number(val(form, 'game_id')) : null, title: val(form, 'title'), starts_at: when.toISOString(), duration_min: Number(val(form, 'duration_min')) || 60, capacity: Number(val(form, 'capacity')) || 5 };
        if (state.demo) await add('play_sessions', sessionRow); else await viaRpc('create_play_session', { p: sessionRow }, () => add('play_sessions', sessionRow));
        closeModal(); await refresh();
        if (squad_id) go('squads', { squadsView: 'mine', selectedSquad: squad_id, squadPane: 'agenda' }); else go('play');
        notify(squad_id ? 'Partida agendada. Tu squad recibió el aviso.' : 'Partida abierta publicada en Jugar.', true); vora.event('session_created'); break;
      }
      case 'coach': {
        const coach = { game: val(form, 'game'), result: new FormData(form).get('result') || '', notes: val(form, 'notes') };
        let out = null;
        if (state.aiOn && !state.demo && state.online) {
          const r = await callFunction('vora-ai', { mode: 'coach', coach });
          if (r.status === 200 && r.data?.text) out = { ai: true, text: r.data.text };
        }
        state.coachOut = out || { ai: false, ...coachTips(coach) };
        showModal(); vora.event('vora_chat'); break;
      }
      case 'guide-offer': { await upsert('guide_offers', { user_id: uid(), game_id: Number(val(form, 'game_id')), note: val(form, 'note').slice(0, 160) }, 'user_id,game_id'); closeModal(); await refresh(); notify('¡Gracias! Ahora apareces como guía en el modo primer día.', true); break; }
      case 'guide-ask': { await add('guide_requests', { guide_id: id, learner_id: uid(), game_id: Number(state.guideAsk?.game), message: val(form, 'message').slice(0, 300) }); closeModal(); await refresh(); notify('Solicitud enviada. Te avisaremos cuando responda.', true); break; }
      case 'league': { const l = await add('leagues', { owner_id: uid(), name: val(form, 'name'), scope: val(form, 'scope'), place: val(form, 'place'), game_id: val(form, 'game_id') ? Number(val(form, 'game_id')) : null, description: val(form, 'description'), status: 'inscripciones' }); closeModal(); await refresh(); go('communities', { communitiesView: 'leagues', selectedLeague: l.id }); notify('Liga creada. Comparte el enlace para que los squads se inscriban.', true); break; }
      case 'league-register': { await add('league_teams', { league_id: id, squad_id: val(form, 'squad_id'), registered_by: uid() }); closeModal(); await refresh(); notify('Tu squad quedó inscrito.', true); break; }
      case 'league-result': { await upd('league_matches', { id }, { home_score: Number(val(form, 'home_score')), away_score: Number(val(form, 'away_score')), status: 'played' }); closeModal(); await refresh(); notify('Resultado guardado. Los squads reciben el aviso.', true); break; }
      case 'steam': {
        if (state.demo) { state.steamOut = 'En la demostración no se conecta con Steam. Con una cuenta real se agregan tus juegos en segundos.'; showModal(); break; }
        const r = await callFunction('steam-import', { profile: val(form, 'profile') });
        state.steamOut = r.status === 200 ? `¡Listo! Encontramos ${r.data.owned} juegos en tu Steam y agregamos ${r.data.added} a tu biblioteca.${r.data.newInCatalog?.length ? ` Nuevos en el catálogo: ${r.data.newInCatalog.slice(0, 5).join(', ')}${r.data.newInCatalog.length > 5 ? '…' : ''}.` : ''}` : (r.data?.error || 'No se pudo importar ahora.');
        if (r.status === 200) { await refresh(); vora.event('game_added'); }
        showModal(); break;
      }
      case 'family': {
        const minorId = state.demo ? null : must(await supabase.rpc('family_lookup', { uname: val(form, 'username') }));
        if (!minorId) throw new Error('No se pudo enviar: revisa el usuario. Solo se pueden vincular cuentas de menores que indicaron su edad.');
        await add('family_links', { guardian_id: uid(), minor_id: minorId, status: 'pending' }); await refresh(); showModal(); notify('Solicitud enviada. Tu familiar debe aceptarla desde Ajustes.', true); break;
      }
      case 'rate': {
        const fd = new FormData(form), rows = [];
        for (const key of new Set([...fd.keys()].filter(k => k.startsWith('tag:')))) {
          const tags = cleanTags(fd.getAll(key)); if (tags.length) rows.push({ session_id: id, rater_id: uid(), ratee_id: key.slice(4), tags });
        }
        if (!rows.length) throw new Error('Elige al menos una etiqueta para alguien.');
        await addMany('chemistry_ratings', rows);
        closeModal(); await refresh(); notify(`¡Gracias! Calificaste a ${rows.length} ${rows.length === 1 ? 'persona' : 'personas'}.`, true); vora.event('chemistry');
        // Recuerdo automático: si fue una partida del squad, se propone guardar el momento con quienes jugaron.
        const ses = (d().play_sessions || []).find(x => x.id === id);
        if (ses?.squad_id && !(d().squad_memories || []).some(m => m.squad_id === ses.squad_id && m.title.startsWith(ses.title))) {
          state.memoryPrefill = { squad_id: ses.squad_id, title: `${ses.title} · ${whenLabel(ses.starts_at)}`.slice(0, 90), participants: going(d().session_rsvps || [], ses.id).map(r => r.user_id).filter(u => u !== uid()) };
          setTimeout(() => openModal('create-memory'), 350);
        }
        break;
      }
      case 'memory-create': {
        const squad_id = val(form, 'squad_id'); if (!squadMember(squad_id)) throw new Error('Debes pertenecer al squad.');
        const members = d().squad_members.filter(x => x.squad_id === squad_id && x.user_id !== uid()).map(x => x.user_id);
        const chosen = [...new Set(new FormData(form).getAll('participant_id').map(String))].filter(x => members.includes(x));
        const photo = form.elements.image?.files[0];
        const legacyMemory = async () => {
          const m = await add('squad_memories', { squad_id, author_id: uid(), title: val(form, 'title'), story: val(form, 'story') });
          try { if (chosen.length) await addMany('memory_consents', chosen.map(user_id => ({ memory_id: m.id, user_id, status: state.demo ? 'approved' : 'pending' }))); } catch (err) { await del('squad_memories', { id: m.id }); throw err; }
          return m;
        };
        const memory = state.demo ? await legacyMemory() : await viaRpc('create_squad_memory', { p: { squad_id, title: val(form, 'title'), story: val(form, 'story'), people: chosen } }, legacyMemory);
        let warn = '';
        if (photo) {
          try {
            if (state.demo) { memory.image_url = await uploadImage(photo); memory.image_path = 'demo'; }
            else { const image_path = await uploadMemory(photo, uid(), memory.id); await viaRpc('set_memory_image', { target: memory.id, path: image_path }, () => upd('squad_memories', { id: memory.id }, { image_path })); }
          } catch (err) { warn = 'El recuerdo se guardó sin foto: ' + err.message; }
        }
        state.memoryPrefill = null; closeModal(); await refresh(); go('squads', { squadsView: 'mine', selectedSquad: squad_id, squadPane: 'memories' });
        notify(warn || 'Recuerdo guardado y compartido con el squad.', !warn); vora.event('memory'); break;
      }
      case 'post': {
        if (body.length > 5000) throw new Error('Escribe una publicación de hasta 5000 caracteres.');
        const community_id = val(form, 'community_id') || null, file = form.elements.image?.files[0];
        let queued = false;
        if (!file) queued = (await submitText('post', null, body, { community_id })) === 'queued';
        else {
          const post = await add('posts', { author_id: uid(), community_id, body });
          try { const url = await uploadImage(file); await add('post_images', { post_id: post.id, url }); } catch (err) { notify('La publicación se guardó, pero la foto no: ' + err.message); }
        }
        closeModal(); if (queued) render(); else await refresh();
        if (community_id) go('communities', { selectedCommunity: community_id, communityPane: 'posts' }); else go('home');
        if (queued) { notify('Sin conexión: tu publicación se enviará al reconectar.'); vora.event('queued'); } else { notify('¡Publicación compartida!', true); vora.event('post'); }
        break;
      }
      case 'comment': { const r = await submitText('comment', id, body); state.filter = 'comments:' + id; form.reset(); await afterTextSend(r, 'comment'); break; }
      case 'dm': { const r = await submitText('dm', id, body); form.reset(); await afterTextSend(r, 'dm'); break; }
      case 'squad-message': { const r = await submitText('squad-message', id, body); form.reset(); await afterTextSend(r); break; }
      case 'channel-message': { const r = await submitText('channel-message', id, body); form.reset(); await afterTextSend(r); break; }
      case 'profile': {
        const fd = new FormData(form);
        const changes = { display_name: val(form, 'display_name'), username: val(form, 'username').toLowerCase(), bio: val(form, 'bio'), region: val(form, 'region'), platform: val(form, 'platform'), play_style: val(form, 'play_style'), mic_preference: val(form, 'mic_preference'), schedule: val(form, 'schedule'), looking_for: form.elements.looking_for.checked };
        const v6 = !(d()._missing || []).includes('profile_private');
        if (v6) { changes.language = LANG_CODES.includes(val(form, 'language')) ? val(form, 'language') : 'es'; changes.play_tags = [...new Set(fd.getAll('play_tags').map(String))].filter(t => PLAY_TAG_LABEL[t]); }
        if (!(d()._missing || []).includes('leagues')) changes.discord_visible = Boolean(form.elements.discord_visible?.checked);
        if (!/^[a-z0-9_]{3,25}$/.test(changes.username)) throw new Error('Usuario: 3-25 letras minúsculas, números o guion bajo');
        const file = form.elements.image.files[0]; if (file) changes.avatar_url = await uploadImage(file);
        const cover = form.elements.cover.files[0]; if (cover) changes.cover_url = await uploadImage(cover);
        await upd('profiles', { id: uid() }, changes);
        const year = Number(val(form, 'birth_year'));
        if (v6 && year) await upsert('profile_private', { user_id: uid(), birth_year: year, updated_at: new Date().toISOString() }, 'user_id');
        closeModal(); await refresh(); configureTranslator(); render();
        notify(v6 ? 'Perfil actualizado.' : 'Perfil actualizado. Ejecuta la migración 003 para guardar idioma y preferencias de juego.', true); vora.event('profile_saved'); break;
      }
      case 'community': await add('communities', { owner_id: uid(), name: val(form, 'name'), description: val(form, 'description') }); closeModal(); await refresh(); notify('Comunidad creada.', true); break;
      case 'channel': { const cid = val(form, 'community_id'); await add('channels', { created_by: uid(), community_id: cid, title: val(form, 'title'), description: val(form, 'description') }); closeModal(); await refresh(); go('communities', { selectedCommunity: cid, communityPane: 'news' }); notify('Canal creado.', true); break; }
      case 'squad': {
        const v11 = !(d()._missing || []).includes('squad_invites');
        const extra = v11 ? { privacy: val(form, 'privacy') === 'invitacion' ? 'invitacion' : 'abierto', max_members: Math.max(2, Math.min(50, Number(val(form, 'max_members')) || 12)) } : {};
        if (v11 && !(d()._missing || []).includes('conversation_hides')) extra.members_can_schedule = Boolean(form.elements.members_can_schedule?.checked);
        if (state.demo && d().squads.filter(x => x.owner_id === uid()).length >= 5) throw new Error('Puedes crear como máximo 5 squads');
        const row = { owner_id: uid(), name: val(form, 'name'), description: val(form, 'description'), game_id: val(form, 'game_id') ? Number(val(form, 'game_id')) : null, ...extra };
        // v13: el servidor crea el squad con una función que valida todo y explica el error exacto.
        const s = state.demo ? await add('squads', row) : await viaRpc('create_squad', { p: row }, () => add('squads', row));
        closeModal(); await refresh(); go('squads', { squadsView: 'mine', selectedSquad: s.id, squadPane: 'chat' }); notify('Squad creado. Eres el dueño: invita a tu gente desde «Invitar».', true); vora.event('squad_join'); break;
      }
      case 'squad-edit': {
        const max = Math.max(2, Math.min(50, Number(val(form, 'max_members')) || 12));
        if (max < d().squad_members.filter(m => m.squad_id === id).length) throw new Error('El cupo no puede ser menor que los integrantes actuales.');
        await upd('squads', { id }, { name: val(form, 'name'), description: val(form, 'description'), game_id: val(form, 'game_id') ? Number(val(form, 'game_id')) : null, privacy: val(form, 'privacy') === 'invitacion' ? 'invitacion' : 'abierto', max_members: max, ...((d()._missing || []).includes('conversation_hides') ? {} : { members_can_schedule: Boolean(form.elements.members_can_schedule?.checked) }) });
        closeModal(); await refresh(); notify('Squad actualizado.', true); break;
      }
      case 'invite-search': { state.inviteSearch = val(form, 'term'); showModal(); setTimeout(() => document.querySelector('.modal input[name="term"]')?.focus(), 50); break; }
      case 'birth-year': {
        const year = Number(val(form, 'birth_year')); if (!year) throw new Error('Elige tu año de nacimiento.');
        if (!confirm(`¿Confirmas que naciste en ${year}? Por seguridad no podrás cambiarlo desde la app.`)) return;
        await upsert('profile_private', { user_id: uid(), birth_year: year, updated_at: new Date().toISOString() }, 'user_id');
        if (state.modal === 'age-gate') closeModal();
        await refresh(); notify('Listo. Ya puedes usar mensajes privados, squads y guías.', true);
        if (state.pendingDm) { const target = state.pendingDm; state.pendingDm = null; afterBusy(() => openDm(target)); }
        break;
      }
      case 'game-image': {
        const file = form.elements.image.files[0], appid = val(form, 'steam_appid');
        const changes = { steam_appid: /^\d{1,8}$/.test(appid) ? Number(appid) : null };
        if (file) changes.image_url = await uploadGameImage(file, id);
        await upd('games', { id }, changes); closeModal(); await refresh(); notify('Portada actualizada.', true); break;
      }
      case 'quest-edit': { await upd('quests', { id }, { title: val(form, 'title'), description: val(form, 'description'), badge_name: val(form, 'badge_name') }); closeModal(); await refresh(); notify('Reto actualizado.', true); break; }
      case 'quest': {
        const cid = val(form, 'community_id') || null, row = { creator_id: uid(), community_id: cid, title: val(form, 'title'), description: val(form, 'description'), badge_name: val(form, 'badge_name') || 'Compañero GG' };
        const made = state.demo ? await add('quests', row) : await viaRpc('create_quest', { p: row }, () => add('quests', row));
        closeModal(); await refresh();
        // Si el servidor lo guardó pero las reglas de lectura lo esconden, se muestra igual y se avisa cómo repararlo.
        const madeRow = Array.isArray(made) ? made[0] : made;
        if (madeRow?.id && !d().quests.some(q => q.id === madeRow.id)) { d().quests.unshift(madeRow); notify('El reto se guardó, pero tu base de datos lo esconde. Ejecuta la migración 010_reparar_retos.sql en Supabase.'); }
        else notify('Reto publicado.', true);
        go('communities', cid ? { selectedCommunity: cid, communityPane: 'quests' } : {}); break; }
      case 'quest-proof': { const proof = val(form, 'proof'); if (proof.length < 5) throw new Error('Describe tu participación con al menos 5 caracteres.'); if (state.demo) await upd('quest_entries', { quest_id: id, user_id: uid() }, { proof, status: 'submitted' }); else await viaRpc('submit_quest_proof', { target: id, proof_text: proof }, () => upd('quest_entries', { quest_id: id, user_id: uid() }, { proof, status: 'submitted' })); closeModal(); await refresh(); notify('Evidencia enviada para revisión.', true); break; }
      case 'gallery': { const file = form.elements.image.files[0]; if (!file) throw new Error('Selecciona una fotografía'); const url = await uploadImage(file); await add('gallery', { user_id: uid(), url, caption: val(form, 'caption') }); closeModal(); await refresh(); notify('Imagen añadida a tu galería.', true); break; }
      case 'msg-search': { state.msgSearch = val(form, 'term'); render(); break; }
      case 'chat-search': { state.chatSearch = val(form, 'term'); showModal(); setTimeout(() => document.querySelector('.modal input[name="term"]')?.focus(), 40); break; }
      case 'admin-search': { state.adminSearch = val(form, 'term'); render(); break; }
      case 'report-any': {
        const kind = form.dataset.kind, reason = val(form, 'reason') || 'otro', detail = val(form, 'detail');
        const row = { reporter_id: uid(), reason, detail, status: 'open', target_kind: kind, target_id: id };
        if (kind === 'post') { const p = d().posts.find(x => x.id === id); row.post_id = id; row.community_id = p?.community_id || null; }
        if (kind === 'user') row.reported_user_id = id;
        if (state.demo) {
          const src = { post: d().posts, comment: d().comments, dm: d().direct_messages, squad_message: d().squad_messages }[kind]?.find(x => x.id === id);
          row.snapshot = src?.body || (kind === 'user' ? getProfile(id).display_name : ''); row.reported_user_id = row.reported_user_id || src?.author_id || src?.sender_id || null;
        }
        if (!state.demo && (d()._missing || []).includes('conversation_hides')) { if (kind !== 'post' && kind !== 'user') throw new Error('Para reportar mensajes, comentarios o squads, ejecuta la migración 007 en Supabase.'); delete row.target_kind; delete row.target_id; }
        await add('reports', row);
        const blockId = form.elements.also_block?.checked ? (kind === 'user' ? id : (d().direct_messages.find(m => m.id === id)?.sender_id)) : null;
        if (blockId && !isBlocked(blockId)) await add('blocks', { blocker_id: uid(), blocked_id: blockId });
        closeModal(); await refresh(); notify(blockId ? 'Reporte enviado y persona bloqueada. Gracias por cuidar la comunidad.' : 'Reporte enviado. La moderación lo revisará. Gracias por cuidar la comunidad.', true); break;
      }
      case 'music-search': {
        const q = val(form, 'q'); state.musicQuery = q; if (q.length < 2) throw new Error('Escribe al menos 2 letras.');
        let items = [];
        try { items = await searchMusic(q); } catch { items = []; }
        state.musicResults = { squad: id, items }; render(); if (!items.length) notify('No encontramos esa canción en línea. Escríbela a mano.');
        break;
      }
      case 'track-manual': {
        const link = val(form, 'youtube');
        if (link && !youtubeId(link)) throw new Error('Ese enlace no parece de YouTube. Cópialo desde el botón «Compartir» del video.');
        await shareTrack(id, { title: val(form, 'title'), artist: val(form, 'artist'), note: val(form, 'note'), youtube: link }); break;
      }
      case 'track-video': {
        const vid = youtubeId(val(form, 'youtube'));
        if (!vid) throw new Error('Pega el enlace del video de YouTube de esta canción.');
        const tr = (d().squad_tracks || []).find(x => x.id === id); if (!tr) break;
        if (!state.demo) await rpc('set_track_video', { track: id, vid });
        tr.youtube_id = vid; tr._ytTried = true; tr._ytFailed = false; state.trackVideoFor = null; render(); playTrack(id);
        notify('Listo: ahora se escucha completa.', true); break;
      }
      case 'poll': {
        const options = [0, 1, 2, 3].map(i => val(form, 'opt' + i)).filter(Boolean);
        if (options.length < 2) throw new Error('Escribe al menos 2 opciones.');
        const hours = Number(val(form, 'hours')) || 0;
        await add('squad_polls', { squad_id: id, creator_id: uid(), question: val(form, 'question'), options, closes_at: hours ? new Date(Date.now() + hours * 3600000).toISOString() : null });
        await refresh(); notify('Encuesta publicada. El squad recibe un aviso.', true); break;
      }
      case 'admin-word': {
        const w = val(form, 'word'); if (w.length < 2) throw new Error('Escribe una palabra o frase.');
        if (state.demo) { tableRows('blocked_words').push({ word: w.toLowerCase(), created_at: new Date().toISOString() }); demoLog('word_add', 'word', '', w); } else await rpc('admin_word', { term: w, adding: true });
        await refresh(); notify('Frase bloqueada en toda la app.', true); break;
      }
      case 'report': { const post = d().posts.find(p => p.id === id); if (!post) throw new Error('Publicación no encontrada'); await add('reports', { reporter_id: uid(), post_id: id, reported_user_id: post.author_id, community_id: post.community_id, reason: val(form, 'reason'), detail: val(form, 'detail'), status: 'open' }); closeModal(); await refresh(); notify('Reporte enviado para revisión.', true); break; }
      default:
    }
  }, form);
}

// ───────────────────────── Teclado y arranque ─────────────────────────
document.addEventListener('click', handleClick);
document.addEventListener('error', ev => {
  const t = ev.target;
  if (!(t instanceof HTMLImageElement) || !t.matches('.post-photo, .memory-photo, .cover-photo, .gallery-grid img')) return;
  const ph = document.createElement('div'); ph.className = `img-fallback ${t.className}`; ph.setAttribute('role', 'img'); ph.setAttribute('aria-label', `${t.alt || 'Imagen'} (no disponible ahora)`);
  ph.innerHTML = `${icon(state.online ? 'image' : 'cloud-off', 22)}<span>${state.online ? 'No se pudo cargar la imagen' : 'Disponible al volver a conectarte'}</span>`;
  t.replaceWith(ph);
}, true);
document.addEventListener('submit', handleSubmit);
document.addEventListener('change', ev => { const el = ev.target.closest?.('[data-change]'); if (el?.dataset.change === 'guide-game') { state.guideGame = el.value; render(); } });
document.addEventListener('keydown', ev => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k' && state.user) { ev.preventDefault(); document.querySelector('.cmdk-back') ? closePalette() : openPalette(); return; }
  if (ev.key !== 'Escape') return;
  if (document.querySelector('.g-back')) return;
  if (document.querySelector('.cmdk-back')) closePalette(); else if (state.modal) closeModal();
});
window.addEventListener('popstate', () => { const t = location.hash.slice(1); if (state.user && tabIds.has(t) && t !== state.tab) go(t, {}, { push: false }); });
let lastSeen = Date.now();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { lastSeen = Date.now(); markSeen(); return; }
  if (state.user && !state.demo && state.online && Date.now() - lastSeen > 30000) scheduleRefresh();
});
window.addEventListener('pagehide', markSeen);
// Las disponibilidades y partidas cambian con el tiempo: repintar cada minuto mantiene los contadores al día.
setInterval(() => { if (state.user && !state.modal && !document.hidden && ['home', 'play', 'squads'].includes(state.tab) && !app.contains(document.activeElement?.closest?.('form'))) render(); }, 60000);

async function start() {
  try { const a = localStorage.getItem('gvq:accent'); state.accent = ['crimson', 'cyan', 'violet', 'amber', 'mint'].includes(a) ? a : 'crimson'; } catch { /* nada */ }
  state.online = pwa.isOnline();
  pwa.initPWA({ production: Boolean(import.meta.env?.PROD) }); wirePwa(); startUiTranslation();
  if (import.meta.env?.DEV || location.search.includes('debug=1')) window.__gvq = { state, vora, go, render, notify, enterApp, translator, setUiLang, translate, afterData };
  if (!configured) { render(); return; }
  supabase.auth.onAuthStateChange((type, session) => {
    if (type === 'SIGNED_IN' && session?.user && !state.user && !entering) queueMicrotask(() => { if (!state.user && !entering) enterApp(session.user); });
    if (type === 'SIGNED_OUT' && state.user && !state.demo) sessionExpired();
  });
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) { await enterApp(data.session.user); return; }
    const last = !state.online && localStorage.getItem('gvq:lastUser');
    if (last && await offline.loadSnapshot(last)) { await enterApp({ id: last }); return; }
  } catch (err) { console.warn(err); }
  render();
}
start();
