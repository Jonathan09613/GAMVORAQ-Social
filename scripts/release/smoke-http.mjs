// Comprueba respuestas HTTP de un despliegue real. Uso: node scripts/release/smoke-http.mjs https://dominio
const input = process.argv[2];
if (!input) { console.error('Indica URL HTTPS de despliegue.'); process.exit(1); }
const base = new URL(input);
if (base.protocol !== 'https:') { console.error('Se requiere HTTPS.'); process.exit(1); }
const endpoints = ['/', '/manifest.webmanifest', '/sw.js', '/offline.html'];
let failures = 0;
for (const endpoint of endpoints) {
  try {
    const url = new URL(endpoint, base);
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'follow' });
    const body = await response.text();
    const valid = response.ok && body.length > 10;
    console.log(valid ? 'OK' : 'ERROR', response.status, url.href);
    if (!valid) failures++;
    if (valid && endpoint.endsWith('.webmanifest')) JSON.parse(body);
  } catch (err) {
    console.error('ERROR', endpoint, err.message);
    failures++;
  }
}
if (failures) { console.error(`${failures} fallo(s) de smoke test`); process.exit(1); }
console.log('Smoke test HTTP completado.');
