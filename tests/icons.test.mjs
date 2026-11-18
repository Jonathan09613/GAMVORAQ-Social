// Garantiza que cada icono pedido en el código exista en el registro de ui.js (evita cuadros vacíos).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });

test('todos los iconos usados existen en el registro', () => {
  const ui = readFileSync('src/ui.js', 'utf8');
  const keys = new Set([...ui.matchAll(/'([a-z0-9-]+)':\s*[A-Z]/g)].map(m => m[1]));
  const missing = [];
  for (const f of walk('src')) {
    if (f.endsWith('ui.js')) continue;
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/\bicon\(\s*'([a-z0-9-]+)'/g)) if (!keys.has(m[1])) missing.push(`${f}: ${m[1]}`);
    for (const m of s.matchAll(/\bicon:\s*'([a-z0-9-]+)'/g)) if (!keys.has(m[1])) missing.push(`${f}: ${m[1]}`);
    // Listas de la v6 como ['id', 'Etiqueta', 'icono'] (PLAY_TAGS, CHEM_TAGS) y mapas { tipo: 'icono' }.
    if (f.endsWith('features.js')) for (const m of s.matchAll(/\['[a-z_]+',\s*'[^']+',\s*'([a-z0-9-]+)'\]/g)) if (!keys.has(m[1])) missing.push(`${f}: ${m[1]}`);
    for (const m of s.matchAll(/\bicon\(\{[^}]*\}\[/g)) for (const n of m[0].matchAll(/:\s*'([a-z0-9-]+)'/g)) if (!keys.has(n[1])) missing.push(`${f}: ${n[1]}`);
  }
  assert.deepEqual(missing, []);
});
