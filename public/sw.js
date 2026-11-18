/* GAMVORAQ Social · Service Worker v11
 * - Navegación: red primero (4 s) y, si falla, la app guardada o /offline.html.
 * - /assets/ (archivos con hash): caché primero, son inmutables.
 * - Estáticos y tipografías: sirve lo guardado y actualiza en segundo plano.
 * - Supabase: API, autenticación y tiempo real NUNCA pasan por la caché (los datos viven en IndexedDB, no aquí).
 *   Las URL firmadas de MEMORIES (privadas) tampoco se guardan. Solo se cachean imágenes públicas.
 */
const VERSION = 'v21';
const STATIC = `gamvoraq-static-${VERSION}`, PAGES = `gamvoraq-pages-${VERSION}`, IMAGES = `gamvoraq-img-${VERSION}`, FONTS = `gamvoraq-fonts-${VERSION}`;
const KEEP = [STATIC, PAGES, IMAGES, FONTS];
const CORE = ['/fonts/instrument-sans-400.woff', '/fonts/instrument-sans-700.woff', '/fonts/tektur-500.woff', '/offline.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png', '/icons/favicon-32.png', '/logo-gamvoraq.png', '/icons/icon-maskable-192.png', '/icons/shortcut-available.png', '/icons/shortcut-schedule.png', '/icons/shortcut-play.png', '/icons/shortcut-messages.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const statics = await caches.open(STATIC);
    await Promise.all(CORE.map(url => statics.add(url).catch(() => {})));
    // La página de inicio y los archivos con hash que referencia, para que funcione sin conexión desde la primera instalación.
    try {
      const res = await fetch('/', { cache: 'no-cache' });
      if (res.ok) {
        const html = await res.clone().text();
        await (await caches.open(PAGES)).put('/', res);
        const assets = [...new Set([...html.matchAll(/["'(](\/assets\/[^"')\s]+)/g)].map(m => m[1]))];
        await Promise.all(assets.map(a => statics.add(a).catch(() => {})));
      }
    } catch { /* sin red durante la instalación: se completará en el primer uso */ }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('gamvoraq-') && !KEEP.includes(n)).map(n => caches.delete(n)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });

const isSupabase = url => /\.supabase\.(co|in)$/.test(url.hostname);
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName), keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map(k => cache.delete(k)));
}
async function staleWhileRevalidate(request, cacheName, { max } = {}) {
  const cache = await caches.open(cacheName), cached = await cache.match(request);
  const network = fetch(request).then(res => { if (res && (res.ok || res.type === 'opaque')) { cache.put(request, res.clone()); if (max) trim(cacheName, max); } return res; }).catch(() => null);
  return cached || (await network) || Response.error();
}
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName), cached = await cache.match(request); if (cached) return cached;
  const res = await fetch(request); if (res.ok) cache.put(request, res.clone()); return res;
}
async function navigate(event) {
  const pages = await caches.open(PAGES);
  try {
    const preload = await event.preloadResponse; if (preload) { pages.put('/', preload.clone()); return preload; }
    const res = await Promise.race([fetch(event.request), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))]);
    if (res.ok && new URL(event.request.url).pathname === '/') pages.put('/', res.clone());
    return res;
  } catch {
    return (await pages.match('/')) || (await caches.match('/offline.html')) || Response.error();
  }
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (isSupabase(url)) {
    // Solo imágenes públicas de Storage; todo lo demás (API, auth, firmadas) va directo a la red.
    if (url.pathname.startsWith('/storage/v1/object/public/')) event.respondWith(staleWhileRevalidate(req, IMAGES, { max: 80 }));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') { event.respondWith(staleWhileRevalidate(req, FONTS, { max: 30 })); return; }
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') { event.respondWith(navigate(event)); return; }
  if (url.pathname.startsWith('/assets/')) { event.respondWith(cacheFirst(req, STATIC)); return; }
  if (/\.(?:png|svg|webp|jpg|jpeg|gif|ico|webmanifest|css|js|woff2?)$/.test(url.pathname)) event.respondWith(staleWhileRevalidate(req, STATIC));
});

/* ───── Notificaciones push (v14) ─────
 * App cerrada o en segundo plano → notificación del sistema (con sonido y vibración del teléfono).
 * App abierta y a la vista → la app muestra su propia tarjeta con sonido; aquí solo se le avisa para que se actualice.
 * En iPhone siempre se muestra la notificación (Safari exige mostrar una por cada push). */
const IOS = /iphone|ipad|ipod/i.test(self.navigator?.userAgent || '');
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() }; }
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = wins.find(w => w.visibilityState === 'visible' && w.focused);
    wins.forEach(w => w.postMessage({ type: 'push', data }));
    // El aviso de prueba siempre se muestra, aunque la app siga abierta (llega en 1–2 segundos).
    if (open && !IOS && data.tag !== 'gvq-test') return;
    await self.registration.showNotification(data.title || 'GAMVORAQ', {
      body: data.body || 'Tienes un aviso nuevo', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
      tag: data.tag || 'gvq', renotify: true, vibrate: [80, 60, 80], timestamp: Date.now(),
      data: { url: data.url || '/#notifications' }
    });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) { if (new URL(w.url).origin === self.location.origin) { await w.focus(); w.navigate?.(url); return; } }
    await self.clients.openWindow(url);
  })());
});

/* ───── v11: capacidades avanzadas de PWA ───── */
const tellClients = async msg => { const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }); wins.forEach(w => w.postMessage(msg)); return wins.length; };

// Sincronización en segundo plano: al volver la conexión, la app envía lo que quedó pendiente.
self.addEventListener('sync', event => {
  if (event.tag === 'gvq-outbox') event.waitUntil(tellClients({ type: 'flush-outbox' }));
});

// Sincronización periódica: refresca la app guardada para que abra al día, y avisa a las ventanas abiertas.
self.addEventListener('periodicsync', event => {
  if (event.tag !== 'gvq-refresh') return;
  event.waitUntil((async () => {
    try { const res = await fetch('/', { cache: 'no-cache' }); if (res.ok) await (await caches.open(PAGES)).put('/', res); } catch { /* sin red */ }
    await tellClients({ type: 'refresh' });
  })());
});

// Widgets de Windows 11 (panel de widgets): atajos de GAMVORAQ.
async function renderWidget(widget) {
  try {
    const [template, data] = await Promise.all([
      fetch(widget.definition.msAcTemplate).then(r => r.text()),
      fetch(widget.definition.data).then(r => r.json())
    ]);
    data.base = self.location.origin; data.icon = self.location.origin + '/icons/icon-192.png';
    await self.widgets.updateByTag(widget.definition.tag, { template, data: JSON.stringify(data) });
  } catch (err) { console.warn('widget', err); }
}
self.addEventListener('widgetinstall', event => { event.waitUntil(renderWidget(event.widget)); });
self.addEventListener('widgetresume', event => { event.waitUntil(renderWidget(event.widget)); });
self.addEventListener('widgetclick', event => {
  if (event.action === 'open') event.waitUntil(self.clients.openWindow('/'));
});
self.addEventListener('activate', event => {
  if (!self.widgets?.getByTag) return;
  event.waitUntil(self.widgets.getByTag('gvq-quick').then(w => (w ? renderWidget(w) : null)).catch(() => {}));
});
