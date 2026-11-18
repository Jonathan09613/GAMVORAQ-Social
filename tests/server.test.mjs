// Funciones del servidor de la v7 probadas con WebCrypto real y peticiones simuladas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptPayload, importVapid, vapidHeader, sendPush, pushMessage, b64u, unb64u } from '../supabase/functions/_shared/webpush.js';
import { systemPrompt, cleanHistory, coachText, anthropic, openaiCompatible, pickAi } from '../supabase/functions/vora-ai/ai.js';
import { parseSteamProfile, normName, matchGames, resolveSteamId, ownedGames } from '../supabase/functions/steam-import/steam.js';
import { verifyDiscord, handleInteraction, COMMANDS, level } from '../supabase/functions/discord/discord.js';
const { subtle } = globalThis.crypto;
const enc = new TextEncoder(), dec = new TextDecoder();

// ── Lado del navegador: descifrar como lo haría el servicio push del usuario (RFC 8291) ──
async function browserSubscription() {
  const ua = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { ua, p256dh: b64u(new Uint8Array(await subtle.exportKey('raw', ua.publicKey))), auth: b64u(auth) };
}
async function hkdf(salt, ikm, info, len) { const k = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']); return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8)); }
async function decrypt(body, sub) {
  const salt = body.slice(0, 16), rs = new DataView(body.buffer, body.byteOffset).getUint32(16), idlen = body[20], asPublic = body.slice(21, 21 + idlen);
  assert.equal(rs, 4096); assert.equal(idlen, 65);
  const asKey = await subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKey }, sub.ua.privateKey, 256));
  const uaPublic = unb64u(sub.p256dh);
  const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(unb64u(sub.auth), ecdh, info, 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, body.slice(21 + idlen)));
  assert.equal(plain.at(-1), 2, 'delimitador de último registro');
  return dec.decode(plain.slice(0, -1));
}

test('push: el navegador puede descifrar lo que cifra el servidor', async () => {
  const sub = await browserSubscription();
  const body = await encryptPayload(JSON.stringify({ title: 'GAMVORAQ', body: '¡Hola! 🎮' }), sub.p256dh, sub.auth);
  assert.deepEqual(JSON.parse(await decrypt(body, sub)), { title: 'GAMVORAQ', body: '¡Hola! 🎮' });
});

test('push: la firma VAPID es un JWT ES256 válido para el servicio push', async () => {
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = b64u(new Uint8Array(await subtle.exportKey('raw', pair.publicKey))), { d } = await subtle.exportKey('jwk', pair.privateKey);
  const vapid = await importVapid(pub, d);
  const header = await vapidHeader('https://fcm.googleapis.com/fcm/send/abc', vapid, 'mailto:a@b.c', Date.parse('2026-11-11T00:00:00Z'));
  const [, token, k] = header.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(k, pub);
  const [h, p, s] = token.split('.');
  const claims = JSON.parse(dec.decode(unb64u(p)));
  assert.equal(claims.aud, 'https://fcm.googleapis.com'); assert.equal(claims.sub, 'mailto:a@b.c');
  assert.equal(claims.exp, Date.parse('2026-11-11T00:00:00Z') / 1000 + 12 * 3600);
  assert.ok(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, unb64u(s), enc.encode(`${h}.${p}`)));
});

test('push: envío con cabeceras correctas y texto por tipo de aviso', async () => {
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const vapid = await importVapid(b64u(new Uint8Array(await subtle.exportKey('raw', pair.publicKey))), (await subtle.exportKey('jwk', pair.privateKey)).d);
  const sub = await browserSubscription(); let seen;
  const status = await sendPush({ endpoint: 'https://push.example/x', p256dh: sub.p256dh, auth: sub.auth }, pushMessage({ kind: 'session', body: 'Nueva partida' }), { vapid, subject: 'mailto:a@b.c', fetch: async (u, init) => { seen = init; return { status: 201 }; } });
  assert.equal(status, 201);
  assert.equal(seen.headers['Content-Encoding'], 'aes128gcm');
  assert.match(seen.headers.Authorization, /^vapid t=/);
  assert.equal(JSON.parse(await decrypt(seen.body, sub)).url, '/#squads');
  assert.equal(pushMessage({ kind: 'desconocido', body: 'x' }).url, '/#notifications');
});

test('IA: instrucciones seguras, historial limpio y alterno', () => {
  const sp = systemPrompt({ nick: 'Nova', language: 'en', minor: true, mode: 'coach' });
  assert.match(sp, /inglés/); assert.match(sp, /menor de edad/); assert.match(sp, /3 consejos/); assert.match(sp, /800 911 2000/);
  const h = cleanHistory([{ role: 'vora', text: 'hola' }, { role: 'me', text: 'a' }, { role: 'me', text: 'b' }, { role: 'vora', text: 'c' }], 'nuevo');
  assert.deepEqual(h.map(m => m.role), ['user', 'assistant', 'user'], 'empieza por el usuario y alterna');
  assert.equal(h[0].content, 'a\nb');
  assert.equal(cleanHistory(Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? 'vora' : 'me', text: 'x'.repeat(900) })), 'y').length <= 16, true);
  assert.match(coachText({ game: 'Valorant', result: 'loss', notes: 'nos faltó comunicación' }), /perdimos/);
});

test('IA: Anthropic y proveedor compatible con OpenAI', async () => {
  let req;
  const a = anthropic({ key: 'k', model: 'claude-haiku-5-5', fetch: async (u, init) => { req = { u, ...init, body: JSON.parse(init.body) }; return { ok: true, json: async () => ({ content: [{ type: 'text', text: '¡GG!' }] }) }; } });
  assert.equal(await a.complete('sys', [{ role: 'user', content: 'hola' }]), '¡GG!');
  assert.equal(req.u, 'https://api.anthropic.com/v1/messages');
  assert.equal(req.headers['anthropic-version'], '2023-06-01');
  assert.equal(req.body.system, 'sys'); assert.equal(req.body.model, 'claude-haiku-5-5');
  const o = openaiCompatible({ key: 'k', model: 'm', baseUrl: 'https://x.example/v1/', fetch: async (u, init) => { req = { u, body: JSON.parse(init.body) }; return { ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) }; } });
  assert.equal(await o.complete('sys', [{ role: 'user', content: 'hola' }]), 'ok');
  assert.equal(req.u, 'https://x.example/v1/chat/completions'); assert.equal(req.body.messages[0].role, 'system');
  assert.equal(pickAi({}), null); assert.equal(pickAi({ AI_API_KEY: 'k' }), null, 'sin modelo no adivina');
  assert.equal(pickAi({ ANTHROPIC_API_KEY: 'k' }).name, 'anthropic');
});

test('Steam: perfiles, nombres y emparejamiento con el catálogo', async () => {
  assert.deepEqual(parseSteamProfile('https://steamcommunity.com/profiles/76561197960287930/'), { steamid: '76561197960287930' });
  assert.deepEqual(parseSteamProfile('https://steamcommunity.com/id/gabelogannewell'), { vanity: 'gabelogannewell' });
  assert.deepEqual(parseSteamProfile('nova_gg'), { vanity: 'nova_gg' });
  assert.throws(() => parseSteamProfile('https://otro.sitio/xyz?a=b'), /No reconozco/);
  assert.equal(normName("Tom Clancy's Rainbow Six® Siege"), 'tom clancy s rainbow six siege');
  const r = matchGames([{ name: 'VALORANT', playtime_forever: 10 }, { name: 'Hades™', playtime_forever: 900 }, { name: 'Celeste', playtime_forever: 300 }, { name: 'Demo', playtime_forever: 5 }],
    [{ id: 2, name: 'Valorant' }, { id: 9, name: 'Hades' }]);
  assert.deepEqual(r.matched.sort(), [2, 9]);
  assert.deepEqual(r.fresh.map(g => g.name), ['Celeste'], 'solo se proponen juegos con al menos 2 horas');
  const f = async u => ({ ok: true, json: async () => (u.includes('Resolve') ? { response: { success: 1, steamid: '76561197960287930' } } : { response: {} }) });
  assert.equal(await resolveSteamId({ vanity: 'x' }, 'key', f), '76561197960287930');
  await assert.rejects(ownedGames('76561197960287930', 'key', f), /privada/);
});

test('Discord: firma Ed25519 real y comandos', async () => {
  const pair = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pubHex = Buffer.from(await subtle.exportKey('raw', pair.publicKey)).toString('hex');
  const body = JSON.stringify({ type: 1 }), ts = '1731300000';
  const sig = Buffer.from(await subtle.sign({ name: 'Ed25519' }, pair.privateKey, enc.encode(ts + body))).toString('hex');
  assert.equal(await verifyDiscord(pubHex, sig, ts, body), true);
  assert.equal(await verifyDiscord(pubHex, sig, ts, body + ' '), false, 'cuerpo alterado');
  assert.equal(await verifyDiscord(pubHex, '00'.repeat(64), ts, body), false);
  assert.deepEqual(await handleInteraction({ type: 1 }, {}), { type: 1 });
  const now = Date.parse('2026-11-11T20:00:00Z');
  const db = {
    available: async g => [{ name: 'Luna', game: 'Valorant', platform: 'PC', until: new Date(now + 30 * 60000).toISOString(), mode: 'normal' }].filter(a => !g || a.game.toLowerCase().includes(g)),
    openSessions: async () => [], passport: async u => (u === 'luna' ? { name: 'Luna', sessions: 15, raters: 11, tags: { amable: 10 } } : null)
  };
  const r1 = await handleInteraction({ type: 2, data: { name: 'disponibles', options: [{ name: 'juego', value: 'val' }] } }, db, {}, now);
  assert.match(r1.data.embeds[0].description, /Luna.*Valorant.*quedan 30 min/);
  assert.deepEqual(r1.data.allowed_mentions, { parse: [] }, 'nunca menciona a nadie');
  assert.match((await handleInteraction({ type: 2, data: { name: 'partidas' } }, db, { APP_URL: 'https://x.app' })).data.content, /https:\/\/x\.app/);
  assert.match((await handleInteraction({ type: 2, data: { name: 'pasaporte', options: [{ name: 'usuario', value: '@Luna' }] } }, db)).data.embeds[0].description, /Compañero GG/);
  assert.match((await handleInteraction({ type: 2, data: { name: 'pasaporte', options: [{ name: 'usuario', value: 'nadie' }] } }, db)).data.content, /No encontré/);
  assert.equal(level({ sessions: 40, raters: 25 }), 'Leyenda GG');
  assert.deepEqual(COMMANDS.map(c => c.name), ['disponibles', 'partidas', 'pasaporte']);
});
