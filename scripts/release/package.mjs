// Crea una copia de distribucion con metadatos, sin incluir .env ni llaves.
import fs from 'node:fs';
import path from 'node:path';
const origin = path.resolve('dist');
const target = path.resolve('release');
if (!fs.existsSync(path.join(origin, 'index.html'))) {
  console.error('Primero ejecuta npm run build');
  process.exit(1);
}
fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(origin, target, { recursive: true });
const info = {
  producto: 'GAMVORAQ Social',
  revision: process.env.GITHUB_SHA || 'local',
  creado_en: new Date().toISOString(),
  origen: 'dist/',
  incluye_credenciales: false
};
fs.writeFileSync(path.join(target, 'release-info.json'), JSON.stringify(info, null, 2) + '\n');
console.log('Paquete preparado en release/');
