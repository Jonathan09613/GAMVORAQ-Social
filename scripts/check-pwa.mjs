// Revisa que GAMVORAQ cumpla los requisitos de una app web progresiva instalable antes de publicar.
// Uso: npm run check:pwa   (sin dependencias; lee public/ e index.html)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath: en Windows la ruta de import.meta.url empieza con «/C:/», que rompía las rutas.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = p => path.join(root, 'public', p.replace(/^\//, '').split('?')[0]);
const errors = [], warnings = [], ok = [];
const pngSize = file => { const b = fs.readFileSync(file); if (b.toString('ascii', 1, 4) !== 'PNG') return null; return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`; };

let m;
try { m = JSON.parse(fs.readFileSync(pub('manifest.webmanifest'), 'utf8')); ok.push('manifest.webmanifest es JSON válido'); }
catch (err) { errors.push('manifest.webmanifest no se puede leer: ' + err.message); }

if (m) {
  for (const k of ['id', 'name', 'short_name', 'start_url', 'scope', 'display', 'background_color', 'theme_color', 'icons', 'description']) (m[k] ? ok : errors).push(`${m[k] ? '' : 'Falta '}campo «${k}»`);
  if (!['standalone', 'fullscreen', 'minimal-ui'].includes(m.display)) errors.push('display debe ser standalone, fullscreen o minimal-ui');
  if ((m.short_name || '').length > 12) warnings.push('short_name tiene más de 12 caracteres y puede cortarse bajo el icono');
  const check = (list, label) => (list || []).forEach(i => {
    const f = pub(i.src);
    if (!fs.existsSync(f)) { errors.push(`${label}: no existe ${i.src}`); return; }
    const real = pngSize(f); if (real && i.sizes && real !== i.sizes) errors.push(`${label}: ${i.src} dice ${i.sizes} pero mide ${real}`);
  });
  check(m.icons, 'Icono'); check(m.screenshots, 'Captura'); (m.shortcuts || []).forEach(s => check(s.icons, `Atajo «${s.short_name}»`));
  const has = (size, purpose) => (m.icons || []).some(i => i.sizes === size && (i.purpose || 'any').split(' ').includes(purpose));
  (has('192x192', 'any') && has('512x512', 'any') ? ok : errors).push('Iconos 192 y 512 «any»');
  (has('512x512', 'maskable') ? ok : warnings).push('Icono adaptable (maskable) 512 para Android');
  const sw = (m.screenshots || []).map(s => s.form_factor);
  (sw.includes('wide') && sw.includes('narrow') ? ok : warnings).push('Capturas «wide» y «narrow» (instalación enriquecida)');
  (m.share_target ? ok : warnings).push('share_target: recibir contenido compartido desde otras apps');
  (m.shortcuts?.length ? ok : warnings).push('Atajos del icono (shortcuts)');
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
(html.includes('rel="manifest"') ? ok : errors).push('index.html enlaza el manifiesto');
(html.includes('apple-touch-icon') ? ok : warnings).push('Icono para iPhone (apple-touch-icon)');
const splash = [...html.matchAll(/apple-touch-startup-image"[^>]*href="([^"]+)"/g)].map(x => x[1]);
const missing = splash.filter(s => !fs.existsSync(pub(s)));
(splash.length && !missing.length ? ok : warnings).push(`Pantallas de arranque iOS (${splash.length})${missing.length ? ' — faltan: ' + missing.join(', ') : ''}`);
(fs.existsSync(pub('sw.js')) ? ok : errors).push('Service worker public/sw.js');
const sw = fs.readFileSync(pub('sw.js'), 'utf8');
(/addEventListener\('fetch'/.test(sw) ? ok : errors).push('El service worker responde peticiones (modo sin conexión)');
(fs.existsSync(pub('offline.html')) ? ok : warnings).push('Página sin conexión offline.html');
const reg = fs.readFileSync(path.join(root, 'src', 'pwa.js'), 'utf8');
(reg.includes("register('/sw.js')") ? ok : errors).push('La app registra el service worker');

// Las 16 capacidades que revisa PWABuilder (y que GAMVORAQ implementa).
const has = (cond) => Boolean(cond);
const caps = m ? [
  ['Instalable (manifiesto completo + iconos adaptables)', has(m.name && m.icons?.some(i => (i.purpose || '').includes('maskable')))],
  ['Funciona sin conexión (service worker + offline.html)', /addEventListener\('fetch'/.test(sw) && fs.existsSync(pub('offline.html'))],
  ['Instalación enriquecida (capturas wide y narrow)', has(m.screenshots?.some(x => x.form_factor === 'wide') && m.screenshots?.some(x => x.form_factor === 'narrow'))],
  ['Notificaciones push', /addEventListener\('push'/.test(sw)],
  ['Sincronización en segundo plano (Background Sync)', /addEventListener\('sync'/.test(sw)],
  ['Sincronización periódica (Periodic Sync)', /addEventListener\('periodicsync'/.test(sw)],
  ['Insignia en el icono (Badging)', reg.includes('setAppBadge')],
  ['Atajos del icono (shortcuts)', has(m.shortcuts?.length)],
  ['Compartir hacia la app (share_target)', has(m.share_target)],
  ['Abrir archivos (file_handlers)', has(m.file_handlers?.length)],
  ['Protocolo propio web+gamvoraq (protocol_handlers)', has(m.protocol_handlers?.length)],
  ['Control de lanzamiento (launch_handler)', has(m.launch_handler)],
  ['Abrir enlaces en la app (handle_links)', has(m.handle_links)],
  ['Barra de título integrada (window-controls-overlay)', has(m.display_override?.includes('window-controls-overlay'))],
  ['Panel lateral de Edge (edge_side_panel)', has(m.edge_side_panel)],
  ['Widgets de Windows (widgets)', has(m.widgets?.length) && /widgetinstall/.test(sw) && (m.widgets || []).every(w => fs.existsSync(pub(w.ms_ac_template)) && fs.existsSync(pub(w.data)))]
] : [];
console.log('\nCapacidades de PWA (' + caps.filter(c => c[1]).length + '/' + caps.length + '):');
caps.forEach(([label, okk], i) => console.log(`  ${okk ? '✓' : '✗'} ${String(i + 1).padStart(2)}. ${label}`));
caps.filter(c => !c[1]).forEach(c => warnings.push('Falta la capacidad: ' + c[0]));
console.log('');
ok.forEach(x => console.log('  ✓ ' + x));
warnings.forEach(x => console.log('  ! ' + x));
errors.forEach(x => console.log('  ✗ ' + x));
console.log(`\n${errors.length ? '✗ Hay ' + errors.length + ' problema(s) que impiden instalar la app.' : '✓ Lista para instalarse como app (recuerda publicarla con HTTPS).'}${warnings.length ? ` ${warnings.length} aviso(s).` : ''}`);
process.exit(errors.length ? 1 : 0);
