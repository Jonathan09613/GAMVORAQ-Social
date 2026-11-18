// Instalación de GAMVORAQ en cualquier dispositivo: detecta plataforma y navegador y devuelve los pasos exactos.
// Lógica pura (sin DOM) para poder probarla con node:test.

/** @returns {{ os: string, browser: string, id: string, label: string, mobile: boolean }} */
export function detectPlatform(ua = '', { maxTouchPoints = 0, platform = '' } = {}) {
  const u = String(ua);
  const iPadOS = /Macintosh/.test(u) && maxTouchPoints > 1; // iPadOS 13+ se presenta como Mac
  let os = 'other';
  if (/iPhone|iPod/.test(u)) os = 'ios';
  else if (/iPad/.test(u) || iPadOS) os = 'ipados';
  else if (/Android/.test(u)) os = 'android';
  else if (/CrOS/.test(u)) os = 'chromeos';
  else if (/Windows/.test(u) || /Win/.test(platform)) os = 'windows';
  else if (/Mac OS X|Macintosh/.test(u)) os = 'macos';
  else if (/Linux/.test(u)) os = 'linux';

  let browser = 'other';
  if (/SamsungBrowser/.test(u)) browser = 'samsung';
  else if (/EdgA?\/|EdgiOS/.test(u)) browser = 'edge';
  else if (/OPR\/|Opera/.test(u)) browser = 'opera';
  else if (/FxiOS|Firefox\//.test(u)) browser = 'firefox';
  else if (/CriOS|Chrome\//.test(u)) browser = 'chrome';
  else if (/Safari\//.test(u)) browser = 'safari';

  const mobile = ['ios', 'ipados', 'android'].includes(os);
  let id;
  if (os === 'ios' || os === 'ipados') id = browser === 'safari' ? 'ios-safari' : 'ios-other';
  else if (os === 'android') id = browser === 'firefox' ? 'android-firefox' : browser === 'samsung' ? 'android-samsung' : 'android-chrome';
  else if (os === 'macos' && browser === 'safari') id = 'mac-safari';
  else if (browser === 'firefox') id = 'desktop-firefox';
  else if (['chrome', 'edge', 'opera'].includes(browser) || os === 'chromeos') id = browser === 'edge' ? 'desktop-edge' : 'desktop-chrome';
  else id = 'other';
  return { os, browser, id, label: GUIDES[id].label, mobile };
}

/** Pasos por plataforma. «prompt» = el navegador permite el botón «Instalar» de un toque. */
export const GUIDES = {
  'android-chrome': { label: 'Android · Chrome', icon: 'smartphone', prompt: true, steps: [
    'Toca «Instalar app» aquí abajo (o el menú ⋮ de Chrome → «Instalar aplicación»).',
    'Confirma con «Instalar». GAMVORAQ aparecerá en tu cajón de apps como cualquier otra.',
    'Ábrela desde el icono: pantalla completa, sin barra del navegador y con avisos push.'
  ] },
  'android-samsung': { label: 'Android · Samsung Internet', icon: 'smartphone', prompt: true, steps: [
    'Toca el icono de descarga en la barra de direcciones, o el menú ☰ → «Añadir página a» → «Pantalla de inicio».',
    'Confirma «Instalar». La app queda en tu pantalla de inicio y en el cajón de apps.'
  ] },
  'android-firefox': { label: 'Android · Firefox', icon: 'smartphone', prompt: false, steps: [
    'Toca el menú ⋮ de Firefox.',
    'Elige «Instalar» o «Añadir a pantalla de inicio».',
    'Si quieres avisos push y mejor rendimiento, ábrela una vez con Chrome y usa «Instalar aplicación».'
  ] },
  'ios-safari': { label: 'iPhone / iPad · Safari', icon: 'smartphone', prompt: false, steps: [
    'Toca el botón Compartir (el cuadrado con la flecha hacia arriba) en la barra de Safari.',
    'Desliza y elige «Añadir a pantalla de inicio».',
    'Deja activado «Abrir como app web» y toca «Añadir».',
    'Abre GAMVORAQ desde su icono. Desde ahí puedes activar los avisos push (iOS 16.4 o superior).'
  ] },
  'ios-other': { label: 'iPhone / iPad · otro navegador', icon: 'smartphone', prompt: false, steps: [
    'Toca el botón Compartir del navegador (en Chrome está junto a la barra de direcciones).',
    'Elige «Añadir a pantalla de inicio» y confirma.',
    'Si no aparece la opción, abre esta misma dirección en Safari y repite los pasos.'
  ] },
  'desktop-chrome': { label: 'Computadora · Chrome', icon: 'monitor', prompt: true, steps: [
    'Haz clic en «Instalar app» aquí abajo, o en el icono de instalar (pantalla con flecha) a la derecha de la barra de direcciones.',
    'Confirma «Instalar». Se abre en su propia ventana y aparece en el menú Inicio, el Dock o el lanzador.',
    'Puedes anclarla a la barra de tareas como cualquier programa.'
  ] },
  'desktop-edge': { label: 'Computadora · Microsoft Edge', icon: 'monitor', prompt: true, steps: [
    'Haz clic en «Instalar app» aquí abajo, o en el menú ⋯ → «Aplicaciones» → «Instalar GAMVORAQ».',
    'Confirma. Queda en el menú Inicio y se puede anclar a la barra de tareas.'
  ] },
  'mac-safari': { label: 'Mac · Safari', icon: 'monitor', prompt: false, steps: [
    'En la barra de menús elige Archivo → «Añadir al Dock» (macOS Sonoma o superior).',
    'Confirma el nombre y haz clic en «Añadir». GAMVORAQ se abre en su propia ventana desde el Dock.'
  ] },
  'desktop-firefox': { label: 'Computadora · Firefox', icon: 'monitor', prompt: false, steps: [
    'Firefox de escritorio no instala apps web todavía.',
    'Abre esta misma dirección en Chrome o Edge y pulsa «Instalar app»; mientras tanto puedes usarla aquí sin problema.'
  ] },
  other: { label: 'Otro navegador', icon: 'globe', prompt: false, steps: [
    'Busca en el menú del navegador «Instalar aplicación» o «Añadir a pantalla de inicio».',
    'Si no existe, ábrela en Chrome, Edge o Safari, que sí permiten instalarla.'
  ] }
};
export const GUIDE_ORDER = ['android-chrome', 'ios-safari', 'desktop-chrome', 'desktop-edge', 'mac-safari', 'android-samsung', 'android-firefox', 'ios-other', 'desktop-firefox'];

/**
 * Contenido compartido desde otra app (Web Share Target, método GET).
 * Devuelve el borrador del post o null si no hay nada.
 */
export function parseShare(search = '') {
  const p = new URLSearchParams(search);
  const title = (p.get('title') || '').trim(), text = (p.get('text') || '').trim();
  let url = (p.get('url') || '').trim();
  if (url && !/^https?:\/\//i.test(url)) url = '';
  // Muchas apps meten el enlace dentro de «text»: no lo repetimos.
  const parts = [title, text, url && !text.includes(url) ? url : ''].filter(Boolean);
  const unique = parts.filter((x, i) => parts.indexOf(x) === i);
  const body = unique.join('\n').slice(0, 5000);
  return body ? body : null;
}

/** ¿Mostrar la invitación a instalar? No en la app ya instalada, ni si la rechazó hace menos de 14 días. */
export function shouldOfferInstall({ standalone, installable, platformId, dismissedAt = 0, now = Date.now() }) {
  if (standalone) return false;
  if (dismissedAt && now - dismissedAt < 14 * 864e5) return false;
  return Boolean(installable || platformId === 'ios-safari' || platformId === 'mac-safari');
}
