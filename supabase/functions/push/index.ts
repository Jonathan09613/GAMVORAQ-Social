// GAMVORAQ · Edge Function «push»
// La llama la base de datos (trigger + pg_net) cada vez que se crea un aviso. Envía la notificación a los
// dispositivos suscritos de esa persona y borra las suscripciones vencidas.
// Variables: PUSH_SECRET (el mismo valor que guardaste en private.settings), VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
//            VAPID_SUBJECT (por ejemplo mailto:tu-correo@ejemplo.com). Desplegar con --no-verify-jwt.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { importVapid, sendPush, pushMessage } from '../_shared/webpush.js';
import { keys } from '../_shared/http.js';

const env = Deno.env.toObject();
const k = keys(env);
let vapid: Awaited<ReturnType<typeof importVapid>> | null = null;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Usa POST', { status: 405 });
  const secret = req.headers.get('x-push-secret') || '';
  if (!env.PUSH_SECRET || secret.length !== env.PUSH_SECRET.length || secret !== env.PUSH_SECRET) return new Response('No autorizado', { status: 401 });
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return new Response('Faltan las llaves VAPID', { status: 503 });
  vapid ||= await importVapid(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

  const n = await req.json().catch(() => null);
  if (!n?.user_id) return new Response('Falta user_id', { status: 400 });
  const admin = createClient(k.url, k.secretKey, { auth: { persistSession: false } });
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', n.user_id).limit(10);
  let sent = 0;
  const devices: string[] = [];
  for (const s of subs || []) {
    // Tipo de dispositivo según el servicio de avisos (sin revelar la dirección completa).
    const host = (() => { try { return new URL(s.endpoint).hostname; } catch { return '?'; } })();
    const kind = /apple/.test(host) ? 'iphone' : /mozilla/.test(host) ? 'firefox' : /windows|notify\.windows/.test(host) ? 'edge' : 'chrome';
    try {
      const status = await sendPush(s, pushMessage(n), { vapid, subject: env.VAPID_SUBJECT || 'mailto:soporte@gamvoraq.app' });
      if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', s.id);
      if (status < 300) sent++;
      devices.push(`${kind}:${status}`);
    } catch (err) { console.error('push', (err as Error).message); devices.push(`${kind}:error`); }
  }
  return new Response(JSON.stringify({ sent, devices }), { headers: { 'Content-Type': 'application/json' } });
});
