// Web Push sin dependencias: cifrado aes128gcm (RFC 8291 / RFC 8188) y firma VAPID (RFC 8292) con WebCrypto.
// Funciona en Deno (Supabase Edge Functions) y en Node 20+ (pruebas).
const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();

export function b64u(bytes) {
  let s = ''; const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
const concat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };

async function hkdf(salt, ikm, info, length) {
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

/** Cifra `payload` para una suscripción { p256dh, auth } (base64url). Devuelve el cuerpo binario listo para enviar. */
export async function encryptPayload(payload, p256dh, auth, { salt = crypto.getRandomValues(new Uint8Array(16)), serverKeys } = {}) {
  const uaPublic = unb64u(p256dh), authSecret = unb64u(auth);
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error('Suscripción push inválida');
  const as = serverKeys || await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await subtle.exportKey('raw', as.publicKey));
  const uaKey = await subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(authSecret, ecdh, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const plain = concat(typeof payload === 'string' ? enc.encode(payload) : payload, new Uint8Array([2])); // 0x02 = último registro
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain));
  const header = new Uint8Array(21 + asPublic.length);
  header.set(salt, 0); new DataView(header.buffer).setUint32(16, 4096); header[20] = asPublic.length; header.set(asPublic, 21);
  return concat(header, cipher);
}

/** Importa las llaves VAPID (pública: 65 bytes base64url; privada: «d» de 32 bytes base64url). */
export async function importVapid(publicKey, privateKey) {
  const pub = unb64u(publicKey);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('VAPID_PUBLIC_KEY inválida');
  const jwk = { kty: 'EC', crv: 'P-256', x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: privateKey, ext: true };
  const key = await subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  return { key, publicKey };
}
/** Cabecera Authorization VAPID para el servicio push de `endpoint`. */
export async function vapidHeader(endpoint, vapid, subject, now = Date.now()) {
  const aud = new URL(endpoint).origin;
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const sig = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, vapid.key, enc.encode(`${head}.${body}`)));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${vapid.publicKey}`;
}
/** Envía una notificación. Devuelve el estado HTTP (201 = aceptada; 404/410 = suscripción vencida). */
export async function sendPush(sub, payload, { vapid, subject, ttl = 86400, fetch: f = fetch }) {
  const body = await encryptPayload(JSON.stringify(payload), sub.p256dh, sub.auth);
  const res = await f(sub.endpoint, {
    method: 'POST',
    headers: { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', 'TTL': String(ttl), 'Urgency': 'normal', 'Authorization': await vapidHeader(sub.endpoint, vapid, subject) },
    body
  });
  return res.status;
}

/** Texto y destino de cada tipo de aviso. */
const PUSH_TITLE = { message: 'Mensaje nuevo', squad_message: 'Chat de tu squad', squad_invite: 'Invitación a un squad', squad: 'Tu squad', follow: 'Nuevo seguidor', session: 'Partida agendada', guide: 'Modo primer día', wave: 'Sala tranquila', league: 'Liga', family: 'Modo familia', quest: 'Retos', quest_review: 'Evidencia por revisar', memory: 'Recuerdos del squad', test: 'GAMVORAQ' };
export function pushMessage(n) {
  const route = { message: '/?tab=messages', squad_message: '/#squads', squad: '/#squads', squad_invite: '/#squads', session: '/#squads', guide: '/#play', wave: '/#play', league: '/#communities', family: '/#profile', conduct: '/#profile', follow: '/#notifications', quest: '/#communities', quest_review: '/#notifications', memory: '/#squads', moderation: '/#notifications' };
  // Un aviso por chat: los mensajes nuevos del mismo chat reemplazan al anterior en el teléfono en vez de apilarse.
  const tag = n.ref_id && ['message', 'squad_message'].includes(n.kind) ? `gvq-${n.kind}-${n.ref_id}` : `gvq-${n.kind || 'aviso'}`;
  return { title: PUSH_TITLE[n.kind] || 'GAMVORAQ', body: String(n.body || 'Tienes un aviso nuevo').slice(0, 180), url: route[n.kind] || '/#notifications', tag };
}
