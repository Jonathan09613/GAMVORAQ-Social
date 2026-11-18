import test from 'node:test';
import assert from 'node:assert/strict';
import { translate, setUiLang, detectUiLang, UI_LANGS } from '../src/i18n/index.js';
import d1 from '../src/i18n/dict1.js';
import d2 from '../src/i18n/dict2.js';
import d3 from '../src/i18n/dict3.js';
import d4 from '../src/i18n/dict4.js';
import d5 from '../src/i18n/dict5.js';
import { parseAppLink } from '../src/pwa.js';
import { pushMessage } from '../supabase/functions/_shared/webpush.js';
import { matchGames } from '../supabase/functions/steam-import/steam.js';

globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = String(v); }, removeItem(k) { delete this.store[k]; } };
globalThis.document = { documentElement: {} };

test('idioma de la interfaz: detección y cambio', () => {
  assert.equal(detectUiLang({ language: 'pt-BR' }), 'pt');
  assert.equal(detectUiLang({ language: 'en-GB' }), 'en');
  assert.equal(detectUiLang({ language: 'es-MX' }), 'es');
  assert.equal(detectUiLang({ language: 'fr-FR' }), 'es', 'otros idiomas usan español');
  assert.deepEqual(UI_LANGS.map(l => l[0]), ['es', 'en', 'pt']);
});

test('diccionario completo: cada texto tiene inglés y portugués, y los {n} coinciden', () => {
  for (const dict of [d1, d2, d3, d4, d5]) for (const [es, tr] of Object.entries(dict)) {
    assert.equal(Array.isArray(tr) && tr.length, 2, es);
    assert.ok(tr[0] && tr[1], es);
    const n = (es.match(/\{n\}/g) || []).length;
    assert.equal((tr[0].match(/\{n\}/g) || []).length, n, 'en ' + es);
    assert.equal((tr[1].match(/\{n\}/g) || []).length, n, 'pt ' + es);
  }
});

test('traducción en vivo: exacta, con números, con nombres y por segmentos', () => {
  setUiLang('es');
  assert.equal(translate('Crear squad'), 'Crear squad', 'en español no cambia nada');
  setUiLang('en');
  assert.equal(translate('Crear squad'), 'Create squad');
  assert.equal(translate('  Inicio  '), '  Home  ', 'conserva los espacios');
  assert.equal(translate('Ronda 2/5'), 'Round 2/5');
  assert.equal(translate('Buenas noches, Kai'), 'Good evening, Kai');
  assert.equal(translate('Valorant · organiza Luna · 4/5 confirmados'), 'Valorant · hosted by Luna · 4/5 confirmed');
  assert.equal(translate('Texto que escribió una persona'), 'Texto que escribió una persona', 'lo desconocido se deja igual');
  setUiLang('pt');
  assert.equal(translate('Mis squads'), 'Meus squads');
  assert.equal(translate('Hoy 09:00 p.m.'), 'Hoje 09:00 p.m.');
  setUiLang('es');
});

test('enlaces web+gamvoraq:// de la app', () => {
  assert.deepEqual(parseAppLink('web+gamvoraq://perfil/Nova'), { tab: 'profile', username: 'nova' });
  assert.deepEqual(parseAppLink('web%2Bgamvoraq%3A%2F%2Fsquad%2Fs1'), { tab: 'squads', squad: 's1' });
  assert.deepEqual(parseAppLink('web+gamvoraq://mensajes'), { tab: 'squads', messages: true });
  assert.equal(parseAppLink('https://otro.sitio/perfil/x'), null, 'solo el protocolo propio');
  assert.equal(parseAppLink('javascript:alert(1)'), null);
});

test('push: título por tipo y un aviso por chat', () => {
  const a = pushMessage({ kind: 'message', body: 'Ana: hola', ref_id: 'c1' }), b = pushMessage({ kind: 'message', body: 'Ana: otra', ref_id: 'c2' });
  assert.equal(a.title, 'Mensaje nuevo'); assert.notEqual(a.tag, b.tag);
  assert.equal(pushMessage({ kind: 'squad_invite', body: 'x' }).url, '/#squads');
  assert.equal(pushMessage({ kind: 'test', body: 'x' }).title, 'GAMVORAQ');
});

test('Steam: guarda el número de la tienda para mostrar portadas', () => {
  const { matched, fresh, appids } = matchGames([{ name: 'Terraria', appid: 105600, playtime_forever: 10 }, { name: 'Juego Nuevo', appid: 42, playtime_forever: 300 }], [{ id: 7, name: 'Terraria' }]);
  assert.deepEqual(matched, [7]); assert.equal(appids[7], 105600); assert.equal(fresh[0].appid, 42);
});
