// Avisos en vivo: tarjeta dentro de la app (con sonido y vibración) cuando llega algo nuevo,
// y notificación del sistema cuando la app está abierta pero en segundo plano.
import { e, icon } from './ui.js';
import { translate } from './i18n/index.js';

export const NOTICE_TITLE = { message: 'Mensaje nuevo', squad_message: 'Chat de tu squad', squad_invite: 'Invitación a un squad', squad: 'Tu squad', follow: 'Nuevo seguidor', session: 'Partida agendada', guide: 'Modo primer día', wave: 'Sala tranquila', league: 'Liga', family: 'Modo familia', quest: 'Retos', quest_review: 'Evidencia por revisar', memory: 'Recuerdos del squad', moderation: 'Moderación', test: 'GAMVORAQ' };
const NOTICE_ICON = { message: 'message-circle', squad_message: 'users', squad_invite: 'user-plus', squad: 'users', follow: 'user-plus', session: 'calendar-days', quest: 'trophy', quest_review: 'trophy', moderation: 'shield-check' };
const SOUND_KEY = 'gvq:noticeSound';

let seen = null, box = null;
const timers = new Map();

export const soundOn = () => { try { return localStorage.getItem(SOUND_KEY) !== '0'; } catch { return true; } };
export const setSound = on => { try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch { /* sin almacenamiento */ } };
export function resetNotices() { seen = null; box?.replaceChildren(); }

/** Devuelve los avisos sin leer que son nuevos (o que se actualizaron) desde la última vez. La primera llamada solo memoriza. */
export function freshNotices(list = [], me) {
  const mine = list.filter(n => n.user_id === me && !n.read_at);
  const cur = new Map(mine.map(n => [n.id, n.created_at]));
  if (!seen) { seen = cur; return []; }
  const fresh = mine.filter(n => seen.get(n.id) !== n.created_at);
  seen = cur;
  return fresh.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

let audio = null;
function ping() {
  if (!soundOn()) return;
  try {
    audio ||= new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    const t = audio.currentTime;
    [[880, 0], [1320, 0.11]].forEach(([f, d]) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.18, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.22);
      o.connect(g).connect(audio.destination); o.start(t + d); o.stop(t + d + 0.25);
    });
  } catch { /* sin audio */ }
}
// El navegador solo deja sonar después de que la persona toca la página una vez.
if (typeof document !== 'undefined') document.addEventListener('pointerdown', () => { try { audio ||= new (globalThis.AudioContext || globalThis.webkitAudioContext)(); audio.resume?.().catch(() => {}); } catch { /* sin audio */ } }, { once: true, capture: true });

export function closeNotice(id) {
  const el = box?.querySelector(`[data-notice="${CSS.escape(id)}"]`);
  clearTimeout(timers.get(id)); timers.delete(id);
  if (!el) return;
  el.classList.add('out'); setTimeout(() => el.remove(), 260);
}

/** Tarjeta dentro de la app. Al tocarla abre el aviso (acción «open-notice»). */
export function showNotice(n, { who } = {}) {
  if (!box) { box = document.createElement('div'); box.className = 'notice-stack'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.append(box); }
  closeNotice(n.id);
  const el = document.createElement('div');
  el.className = 'notice-pop'; el.dataset.notice = n.id;
  el.innerHTML = `<button type="button" class="notice-main" data-action="open-notice" data-id="${e(n.id)}">
      <span class="notice-ic">${who || icon(NOTICE_ICON[n.kind] || 'bell-ring', 20)}</span>
      <span class="notice-txt"><b>${e(translate(NOTICE_TITLE[n.kind] || 'GAMVORAQ'))}</b><span>${e(String(n.body || '').slice(0, 160))}</span></span>
    </button><button type="button" class="notice-x" data-action="notice-close" data-id="${e(n.id)}" aria-label="${e(translate('Cerrar'))}">${icon('x', 16)}</button>`;
  box.prepend(el);
  [...box.children].slice(3).forEach(x => x.remove());
  timers.set(n.id, setTimeout(() => closeNotice(n.id), 7000));
  ping();
  try { navigator.vibrate?.([70, 50, 70]); } catch { /* sin vibración */ }
}

/** Notificación del sistema mientras la app sigue abierta en segundo plano (sin depender del servidor). */
export async function systemNotice(n, url) {
  try {
    if (Notification.permission !== 'granted') return false;
    const reg = await navigator.serviceWorker?.getRegistration();
    const tag = n.ref_id && ['message', 'squad_message'].includes(n.kind) ? `gvq-${n.kind}-${n.ref_id}` : `gvq-${n.kind || 'aviso'}`;
    const opts = { body: String(n.body || '').slice(0, 180), icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag, renotify: true, vibrate: [70, 50, 70], data: { url } };
    if (reg) await reg.showNotification(translate(NOTICE_TITLE[n.kind] || 'GAMVORAQ'), opts);
    else new Notification(translate(NOTICE_TITLE[n.kind] || 'GAMVORAQ'), opts);
    return true;
  } catch { return false; }
}

const ROUTE = { message: '/?tab=messages', squad_message: '/#squads', squad: '/#squads', squad_invite: '/#squads', session: '/#squads', guide: '/#play', wave: '/#play', league: '/#communities', family: '/#profile', follow: '/#notifications', quest: '/#communities', quest_review: '/#notifications', memory: '/#squads', moderation: '/#notifications' };
export const noticeUrl = n => ROUTE[n.kind] || '/#notifications';
