// Valida archivos esenciales de la version compilada, sin conectarse a un servidor.
import fs from 'node:fs';
import path from 'node:path';

const base = path.resolve(process.argv[2] || 'dist');
const required = [
  'index.html', 'manifest.webmanifest', 'sw.js', 'offline.html',
  'icons/icon-192.png', 'icons/icon-512.png', 'logo-gamvoraq.png'
];
const failures = required.filter(f => !fs.existsSync(path.join(base, f)));
const assets = path.join(base, 'assets');
if (!fs.existsSync(assets) || !fs.readdirSync(assets).some(f => f.endsWith('.js'))) {
  failures.push('assets/*.js');
}
if (fs.existsSync(path.join(base, 'manifest.webmanifest'))) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(base, 'manifest.webmanifest'), 'utf8'));
    if (m.name !== 'GAMVORAQ Social' || !m.icons?.length) failures.push('manifesto incompleto');
  } catch { failures.push('manifesto JSON invalido'); }
}
if (failures.length) {
  console.error('Faltan artefactos:', failures.join(', '));
  process.exit(1);
}
console.log('Liberacion verificada:', base);
