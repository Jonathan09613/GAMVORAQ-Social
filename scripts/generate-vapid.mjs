// Genera las llaves VAPID para las notificaciones push. Uso: node scripts/generate-vapid.mjs
// La pública va en .env (VITE_VAPID_PUBLIC_KEY) y en Supabase; la privada SOLO en Supabase (supabase secrets set).
const { subtle } = globalThis.crypto;
const b64u = b => Buffer.from(b).toString('base64url');
const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pub = b64u(new Uint8Array(await subtle.exportKey('raw', pair.publicKey)));
const { d } = await subtle.exportKey('jwk', pair.privateKey);
const secret = b64u(crypto.getRandomValues(new Uint8Array(24)));
console.log(`\nLlave pública  (VITE_VAPID_PUBLIC_KEY y VAPID_PUBLIC_KEY):\n${pub}\n`);
console.log(`Llave privada  (VAPID_PRIVATE_KEY, nunca en el frontend):\n${d}\n`);
console.log(`Secreto para la base de datos (PUSH_SECRET):\n${secret}\n`);
console.log('Comando para Supabase:');
console.log(`npx supabase secrets set VAPID_PUBLIC_KEY=${pub} VAPID_PRIVATE_KEY=${d} PUSH_SECRET=${secret} VAPID_SUBJECT=mailto:tu-correo@ejemplo.com\n`);
