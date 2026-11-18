// Capacidades PWA: registro del service worker, actualizaciones, instalación, estado de red e insignia de la app.
const listeners = new Map();
export const on = (name, fn) => { (listeners.get(name) || listeners.set(name, new Set()).get(name)).add(fn); return () => listeners.get(name)?.delete(fn); };
const emit = (name, payload) => listeners.get(name)?.forEach(fn => { try { fn(payload); } catch (err) { console.warn(err); } });

let deferredPrompt = null, registration = null, updating = false, started = false;

export const isOnline = () => globalThis.navigator?.onLine !== false;
export const canInstall = () => Boolean(deferredPrompt);
export const isStandalone = () => Boolean(globalThis.matchMedia?.('(display-mode: standalone)').matches || globalThis.navigator?.standalone === true);
export const isIos = () => /iphone|ipad|ipod/i.test(globalThis.navigator?.userAgent || '') && !globalThis.MSStream;
export const hasServiceWorker = () => 'serviceWorker' in navigator;

export function initPWA({ production = false } = {}) {
  if (started) return; started = true;
  addEventListener('online', () => emit('online'));
  addEventListener('offline', () => emit('offline'));
  addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); deferredPrompt = ev; emit('installable'); });
  addEventListener('appinstalled', () => { deferredPrompt = null; emit('installed'); });

  if (!production || !hasServiceWorker()) return;
  navigator.serviceWorker.register('/sw.js').then(reg => {
    registration = reg;
    if (reg.waiting && navigator.serviceWorker.controller) emit('update');
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) emit('update'); });
    });
    setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
  }).catch(err => console.warn('SW:', err));
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updating) location.reload(); });
}

/** Sincronización en segundo plano: pide al navegador avisar cuando vuelva la conexión. */
export async function requestBackgroundSync() {
  try { const reg = await navigator.serviceWorker?.ready; await reg?.sync?.register('gvq-outbox'); return Boolean(reg?.sync); } catch { return false; }
}
/** Sincronización periódica (Chrome/Edge con la app instalada): refresca la app cada ~12 h. */
export async function enablePeriodicSync() {
  try {
    const reg = await navigator.serviceWorker?.ready; if (!reg?.periodicSync) return false;
    const st = await navigator.permissions?.query({ name: 'periodic-background-sync' }).catch(() => null);
    if (st && st.state !== 'granted') return false;
    await reg.periodicSync.register('gvq-refresh', { minInterval: 12 * 60 * 60 * 1000 }); return true;
  } catch { return false; }
}
/** Mensajes del service worker (sincronización). */
export function onWorkerMessage(fn) { try { navigator.serviceWorker?.addEventListener('message', ev => fn(ev.data || {})); } catch { /* sin SW */ } }
/** Archivos abiertos con GAMVORAQ desde el sistema (File Handling API). */
export function onLaunchFiles(fn) {
  try { if ('launchQueue' in window) window.launchQueue.setConsumer(async params => { const files = await Promise.all((params.files || []).map(h => h.getFile())); if (files.length) fn(files); }); } catch { /* no soportado */ }
}
/** Enlaces web+gamvoraq://perfil/usuario · squad/<id> · comunidad/<id> · jugar · mensajes */
export function parseAppLink(raw = '') {
  let s = String(raw || ''); try { s = decodeURIComponent(s); } catch { /* tal cual */ }
  const m = s.match(/^web\+gamvoraq:(?:\/\/)?([a-z]+)\/?([A-Za-z0-9_-]{0,64})/i); if (!m) return null;
  const kind = m[1].toLowerCase(), arg = m[2] || '';
  if (['perfil', 'profile', 'u'].includes(kind) && arg) return { tab: 'profile', username: arg.toLowerCase() };
  if (kind === 'squad' && arg) return { tab: 'squads', squad: arg };
  if (['comunidad', 'community'].includes(kind) && arg) return { tab: 'communities', community: arg };
  if (['jugar', 'play'].includes(kind)) return { tab: 'play' };
  if (['mensajes', 'messages'].includes(kind)) return { tab: 'squads', messages: true };
  return { tab: 'home' };
}

export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice.catch(() => ({ outcome: 'dismissed' }));
  deferredPrompt = null;
  return choice.outcome;
}
export function applyUpdate() {
  if (!registration?.waiting) { location.reload(); return; }
  updating = true;
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
}
/** Insignia con el número de avisos sin leer en el icono de la app instalada (donde esté disponible). */
export function setBadge(count) {
  try { if (count > 0) navigator.setAppBadge?.(count); else navigator.clearAppBadge?.(); } catch { /* no soportado */ }
}
export async function clearCaches() {
  if (!globalThis.caches) return 0;
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k.startsWith('gamvoraq-')).map(k => caches.delete(k)));
  return keys.length;
}
