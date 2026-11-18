// Traducción: detección local, motor del cliente (caché, lotes, «Ver original») y proveedores del servidor.
import test from 'node:test';
import assert from 'node:assert/strict';
import { detectLang, translatable, browserLang, createTranslator, fromLabel } from '../src/translate.js';
import { deepl, google, libre, pickProvider, translateAll, parseRequest } from '../supabase/functions/translate/providers.js';

test('detecta idiomas comunes y duda cuando el texto es corto', () => {
  assert.equal(detectLang('¿Quién se une esta noche a la partida?'), 'es');
  assert.equal(detectLang('Anyone want to join the game tonight? We need one more'), 'en');
  assert.equal(detectLang('Alguém quer jogar hoje à noite? Vamos montar um time'), 'pt');
  assert.equal(detectLang('Wer will heute Abend mit uns spielen?'), 'de');
  assert.equal(detectLang('Qui veut jouer ce soir avec nous ?'), 'fr');
  assert.equal(detectLang('今夜一緒にゲームしませんか'), 'ja');
  assert.equal(detectLang('오늘 밤 같이 게임할 사람'), 'ko');
  assert.equal(detectLang('GG'), null);
  assert.equal(detectLang('ok va'), null);
});

test('no traduce emojis, números ni siglas sueltas', () => {
  assert.equal(translatable('GG'), false);
  assert.equal(translatable('🎮🔥 123'), false);
  assert.equal(translatable('nice game'), true);
});

test('idioma del navegador con respaldo en español', () => {
  assert.equal(browserLang({ languages: ['pt-BR', 'en'] }), 'pt');
  assert.equal(browserLang({ languages: ['ru-RU'], language: 'ru' }), 'es');
});

test('etiqueta «Traducido del…»', () => {
  assert.equal(fromLabel('en'), 'del inglés');
  assert.equal(fromLabel(null), 'de otro idioma');
});

const memoryStorage = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };
const wait = ms => new Promise(r => setTimeout(r, ms));

test('el motor agrupa peticiones, guarda en caché y respeta «Ver original»', async () => {
  const calls = [];
  let updates = 0;
  const tr = createTranslator({
    storage: memoryStorage(), delay: 5, onUpdate: () => updates++,
    invoke: async body => { calls.push(body); return { data: { translations: body.items.map(i => ({ ...i, text: `[${body.target}] ${i.id}`, source_lang: 'en', same: false })) }, status: 200 }; }
  });
  tr.configure({ user: 'u1', language: 'es' });
  const a = { source: 'direct_messages', id: 'm1', body: 'Anyone want to play tonight?' };
  const b = { source: 'direct_messages', id: 'm2', body: 'Let us join the ranked game' };
  assert.equal(tr.view(a).mode, 'pending');
  assert.equal(tr.view(b).mode, 'pending');
  assert.equal(tr.view({ ...a, mine: true }).mode, 'plain', 'los mensajes propios no se traducen');
  assert.equal(tr.view({ source: 'direct_messages', id: 'm3', body: '¿Quién juega hoy en la noche?' }).mode, 'plain', 'ya está en mi idioma');
  await wait(30);
  assert.equal(calls.length, 1, 'un solo lote');
  assert.equal(calls[0].items.length, 2);
  const v = tr.view(a);
  assert.equal(v.mode, 'translated');
  assert.equal(v.text, '[es] m1');
  assert.equal(v.original, a.body);
  assert.equal(v.from, 'en');
  tr.toggle(v.key);
  assert.equal(tr.view(a).mode, 'original');
  assert.equal(tr.view(a).text, a.body);
  tr.toggle(v.key);
  assert.equal(tr.view(a).mode, 'translated');
  assert.ok(updates >= 1);
  // Cambiar de idioma pide de nuevo; la caché anterior se conserva por idioma.
  tr.configure({ user: 'u1', language: 'pt' });
  assert.equal(tr.view(a).mode, 'pending');
  await wait(30);
  assert.equal(tr.view(a).text, '[pt] m1');
  assert.equal(calls.length, 2);
});

test('la caché sobrevive a una recarga de la misma cuenta', async () => {
  const storage = memoryStorage();
  const invoke = async body => ({ data: { translations: body.items.map(i => ({ ...i, text: 'hola', source_lang: 'en' })) }, status: 200 });
  const one = createTranslator({ storage, invoke, delay: 1 });
  one.configure({ user: 'u9', language: 'es' });
  one.view({ source: 'posts', id: 'p1', body: 'hello there my friend' });
  await wait(20);
  let asked = 0;
  const two = createTranslator({ storage, delay: 1, invoke: async b => { asked++; return invoke(b); } });
  two.configure({ user: 'u9', language: 'es' });
  assert.equal(two.view({ source: 'posts', id: 'p1', body: 'hello there my friend' }).mode, 'translated');
  assert.equal(asked, 0);
});

test('si el servidor no tiene traductor, ofrece reintentar sin insistir', async () => {
  let asked = 0;
  const tr = createTranslator({ storage: memoryStorage(), delay: 1, invoke: async () => { asked++; return { error: new Error('x'), status: 503, data: { error: 'no' } }; } });
  tr.configure({ user: 'u2', language: 'es' });
  const m = { source: 'squad_messages', id: 's1', body: 'Ready for the raid tonight?' };
  tr.view(m); await wait(20);
  assert.match(tr.disabled, /no está configurado/);
  assert.equal(tr.view(m).mode, 'offer');
  tr.view({ source: 'squad_messages', id: 's2', body: 'Who brings the snacks tonight?' }); await wait(20);
  assert.equal(asked, 1, 'no vuelve a llamar mientras el servicio está deshabilitado');
});

test('modo manual: con la traducción automática apagada solo se ofrece', () => {
  const tr = createTranslator({ storage: memoryStorage(), invoke: async () => ({ data: { translations: [] } }) });
  tr.configure({ user: 'u3', language: 'es', autoTranslate: false });
  assert.equal(tr.view({ source: 'comments', id: 'c1', body: 'What a great game it was' }).mode, 'offer');
  assert.equal(tr.stats().pending, 0);
});

test('demostración: usa la tabla local de traducciones', async () => {
  const tr = createTranslator({ storage: memoryStorage(), delay: 1, demoTable: { m9: { from: 'en', es: 'Hola equipo', pt: 'Olá time' } } });
  tr.configure({ user: 'demo', language: 'es', isDemo: true });
  tr.view({ source: 'direct_messages', id: 'm9', body: 'Hello team, ready?' });
  await wait(450);
  assert.equal(tr.view({ source: 'direct_messages', id: 'm9', body: 'Hello team, ready?' }).text, 'Hola equipo');
});

// ───────── Proveedores (servidor) con fetch simulado ─────────
const fakeFetch = (reply) => { const seen = []; const f = async (url, init) => { seen.push({ url, init: { ...init, body: JSON.parse(init.body) } }); return { ok: true, json: async () => reply(seen.at(-1)) }; }; f.seen = seen; return f; };

test('DeepL: dominio gratuito, variantes de idioma y detección', async () => {
  const f = fakeFetch(() => ({ translations: [{ detected_source_language: 'EN', text: 'Hola' }] }));
  const p = deepl({ key: 'abc:fx', fetch: f });
  const out = await p.translate(['Hello'], 'en');
  assert.equal(f.seen[0].url, 'https://api-free.deepl.com/v2/translate');
  assert.equal(f.seen[0].init.headers.Authorization, 'DeepL-Auth-Key abc:fx');
  assert.equal(f.seen[0].init.body.target_lang, 'EN-US');
  assert.deepEqual(out, [{ text: 'Hola', source: 'en' }]);
  await deepl({ key: 'pro', fetch: f }).translate(['x'], 'pt');
  assert.equal(f.seen[1].url, 'https://api.deepl.com/v2/translate');
  assert.equal(f.seen[1].init.body.target_lang, 'PT-BR');
});

test('Google y LibreTranslate devuelven el mismo formato', async () => {
  const g = fakeFetch(() => ({ data: { translations: [{ translatedText: 'Hi', detectedSourceLanguage: 'es' }] } }));
  assert.deepEqual(await google({ key: 'k', fetch: g }).translate(['Hola'], 'en'), [{ text: 'Hi', source: 'es' }]);
  assert.equal(g.seen[0].init.body.format, 'text');
  const l = fakeFetch(({ init }) => ({ translatedText: init.body.q.map(x => x.toUpperCase()), detectedLanguage: init.body.q.map(() => ({ language: 'fr' })) }));
  assert.deepEqual(await libre({ url: 'https://lt.example/', fetch: l }).translate(['a', 'b'], 'es'), [{ text: 'A', source: 'fr' }, { text: 'B', source: 'fr' }]);
  assert.equal(l.seen[0].url, 'https://lt.example/translate');
});

test('elige proveedor según las variables y traduce por lotes', async () => {
  assert.equal(pickProvider({}).name, 'free');
  assert.equal(pickProvider({ TRANSLATE_PROVIDER: 'none' }), null);
  assert.equal(pickProvider({ LIBRETRANSLATE_URL: 'https://x' }).name, 'libretranslate');
  assert.equal(pickProvider({ DEEPL_API_KEY: 'k', GOOGLE_TRANSLATE_API_KEY: 'g' }).name, 'deepl');
  assert.equal(pickProvider({ DEEPL_API_KEY: 'k', GOOGLE_TRANSLATE_API_KEY: 'g', TRANSLATE_PROVIDER: 'google' }).name, 'google');
  let calls = 0;
  const fake = { translate: async texts => { calls++; return texts.map(t => ({ text: t, source: 'en' })); } };
  const out = await translateAll(fake, Array.from({ length: 60 }, (_, i) => String(i)), 'es', 25);
  assert.equal(out.length, 60); assert.equal(calls, 3);
});

test('valida la petición: fuentes permitidas, ids y duplicados', () => {
  const id = '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90';
  const r = parseRequest({ items: [{ source: 'direct_messages', id }, { source: 'direct_messages', id }, { source: 'profiles', id }, { source: 'posts', id: 'no-uuid' }], target: 'en' });
  assert.deepEqual(r, { items: [{ source: 'direct_messages', id }], target: 'en' });
  assert.equal(parseRequest({ items: [{ source: 'posts', id }], target: 'xx' }).target, null);
  assert.throws(() => parseRequest({ items: [] }), /No hay mensajes/);
  assert.throws(() => parseRequest({}), /Falta/);
});

test('traductor gratuito: une los fragmentos y detecta el idioma', async () => {
  const { freeGoogle } = await import('../supabase/functions/translate/providers.js');
  const fake = async url => ({ ok: true, json: async () => [[['Hola ', 'Hello '], ['amigo', 'friend']], null, 'en'], url });
  const out = await freeGoogle({ fetch: fake }).translate(['Hello friend'], 'es');
  assert.deepEqual(out, [{ text: 'Hola amigo', source: 'en' }]);
});
test('respaldo del navegador: Google y luego MyMemory', async () => {
  const { translateFree } = await import('../src/freetranslate.js');
  const calls = [];
  const fake = async url => { calls.push(url); if (url.includes('googleapis')) return { ok: false, status: 429 }; return { ok: true, json: async () => ({ responseStatus: 200, responseData: { translatedText: 'Olá pessoal' } }) }; };
  const [r] = await translateFree(['Hola, ¿quién quiere jugar esta noche? Vamos con el equipo'], 'pt', fake);
  assert.equal(r.text, 'Olá pessoal'); assert.equal(r.source, 'es'); assert.equal(calls.length, 2);
  const [none] = await translateFree(['x'], 'pt', async () => { throw new Error('offline'); });
  assert.equal(none, null);
  await translateFree(['ok ok'], 'pt', fake); assert.ok(calls.at(-1).includes('langpair=autodetect|pt'));
});

test('v12: cambiar de idioma varias veces conserva el original', async () => {
  const { translate, setUiLang, uiLangFor } = await import('../src/i18n/index.js');
  assert.equal(uiLangFor('fr'), 'fr'); assert.equal(uiLangFor('xx'), 'en'); assert.equal(uiLangFor('pt'), 'pt');
  setUiLang('en'); assert.equal(translate('Mensajes'), 'Messages'); assert.equal(translate('3 votos'), '3 votes');
  setUiLang('pt'); assert.equal(translate('Mensajes'), 'Mensagens');
  setUiLang('es'); assert.equal(translate('Mensajes'), 'Mensajes');
});
test('v12: errores del servidor explicados', async () => {
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const { explainError } = await import('../src/v12.js');
  assert.match(explainError({ code: '42501', message: 'permission denied for function is_squad_staff' }), /migración 007/);
  assert.match(explainError({ code: '42501', message: 'new row violates row-level security policy for table "play_sessions"' }), /agendar/);
  assert.match(explainError({ code: '42501', message: 'new row violates row-level security policy for table "quests"' }), /008/);
  assert.equal(explainError({ message: 'otra cosa' }), null);
});

test('v13: portada de Steam: elige el juego correcto por nombre', async () => {
  const { bestMatch } = await import('../supabase/functions/game-feed/normalize.js');
  const items = [{ id: 1, name: 'Batman™: Arkham Origins Blackgate' }, { id: 209000, name: 'Batman™: Arkham Origins' }];
  assert.equal(bestMatch('Batman™: Arkham Origins', items), 209000);
  assert.equal(bestMatch('Overwatch®', [{ id: 2357570, name: 'Overwatch® 2' }]), 2357570);
  assert.equal(bestMatch('Juego inventado', [{ id: 5, name: 'Otra cosa distinta' }]), null);
});
test('v13: portadas con varios servidores de Steam', async () => {
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const { gameCovers } = await import('../src/v11.js');
  const c = gameCovers({ id: 1, name: 'ARK', steam_appid: 346110 });
  assert.equal(c.length, 4); assert.match(c[0], /shared\.akamai\.steamstatic\.com\/store_item_assets\/steam\/apps\/346110\/header\.jpg/);
  assert.equal(gameCovers({ id: 2, name: 'X', image_url: 'https://x.test/a.jpg', steam_appid: 5 })[0], 'https://x.test/a.jpg');
});
test('v13: qué textos de la interfaz se mandan a traducir', async () => {
  const { looksSpanish } = await import('../src/i18n/index.js');
  assert.ok(looksSpanish('Supervivencia')); assert.ok(looksSpanish('Buscamos pasar el rato con cualquier cosa')); assert.ok(looksSpanish('Videojuego'));
  assert.ok(!looksSpanish('Los Pros')); assert.ok(!looksSpanish('The Forest')); assert.ok(!looksSpanish('Overwatch®')); assert.ok(!looksSpanish('@nova'));
});
test('v13: italiano y otros idiomas: toda la interfaz pasa por inglés y se traduce', async () => {
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const { translate, setUiLang, useMachineTranslation } = await import('../src/i18n/index.js');
  const calls = [];
  useMachineTranslation(async (texts, target, from) => { calls.push({ texts, target, from }); return texts.map(t => `[${target}] ${t}`); });
  setUiLang('it');
  assert.equal(translate('Mensajes'), 'Messages');            // mientras llega, en inglés
  assert.equal(translate('Buscamos pasar el rato con amigos'), 'Buscamos pasar el rato con amigos');
  await new Promise(r => setTimeout(r, 350));
  assert.equal(translate('Mensajes'), '[it] Messages');
  assert.equal(translate('Buscamos pasar el rato con amigos'), '[it] Buscamos pasar el rato con amigos');
  assert.ok(calls.some(c => c.from === 'en') && calls.some(c => c.from === 'es'));
  setUiLang('es'); assert.equal(translate('Mensajes'), 'Mensajes');
});
test('v13: lotes de interfaz por GET (caben en la dirección) y respaldo', async () => {
  const { chunkForUrl, translateUiBatch } = await import('../src/freetranslate.js');
  const many = Array.from({ length: 100 }, (_, i) => `Texto de prueba número ${i} con varias palabras`);
  const groups = chunkForUrl(many); assert.ok(groups.length > 1 && groups.flat().length === 100);
  const fake = async url => { const q = new URL(url).searchParams.get('q'); return { ok: true, json: async () => [[[q.split('\n').map(l => 'JA:' + l).join('\n'), q]], null, 'es'] }; };
  const out = await translateUiBatch(many, 'ja', 'es', fake);
  assert.equal(out[57], 'JA:Texto de prueba número 57 con varias palabras');
  const server = await translateUiBatch(['Hola'], 'ja', 'es', fake, async t => t.map(x => 'SRV:' + x));
  assert.deepEqual(server, ['SRV:Hola']);
});
