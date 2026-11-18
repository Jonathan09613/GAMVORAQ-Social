// GAMVORAQ · Edge Function «translate»
// Traduce mensajes al idioma principal de la persona que los lee, con caché compartida en la base de datos.
//
// Seguridad:
//  - Exige sesión: la identidad sale del token del usuario, nunca del cuerpo de la petición.
//  - El texto original se lee CON LA SESIÓN DEL USUARIO, así que las políticas RLS deciden qué puede traducir.
//    Nadie puede pedir la traducción de un mensaje privado que no puede leer.
//  - La caché y el contador de uso solo se tocan con la clave secreta, que nunca sale del servidor.
//  - Límite diario de caracteres por persona (TRANSLATE_DAILY_CHARS, 20 000 por defecto) para controlar el costo.
//
// Variables (supabase secrets set ...):
//   DEEPL_API_KEY            · o GOOGLE_TRANSLATE_API_KEY · o LIBRETRANSLATE_URL (+ LIBRETRANSLATE_API_KEY)
//   TRANSLATE_PROVIDER       · opcional: deepl | google | libretranslate
//   TRANSLATE_DAILY_CHARS    · opcional
//   ALLOWED_ORIGINS          · opcional, lista separada por comas (por ejemplo https://gamvoraq.netlify.app)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { pickProvider, translateAll, parseRequest, LANGS } from './providers.js';

const env = Deno.env.toObject();
const URL_ = env.SUPABASE_URL;
const keyFrom = (json: string | undefined, legacy: string | undefined) => {
  try { if (json) return JSON.parse(json).default as string; } catch { /* formato inesperado */ }
  return legacy;
};
const PUBLIC_KEY = keyFrom(env.SUPABASE_PUBLISHABLE_KEYS, env.SUPABASE_ANON_KEY)!;
const SECRET_KEY = keyFrom(env.SUPABASE_SECRET_KEYS, env.SUPABASE_SERVICE_ROLE_KEY)!;
const DAILY = Number(env.TRANSLATE_DAILY_CHARS || 20000);
const ORIGINS = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

function cors(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allow = !ORIGINS.length ? '*' : ORIGINS.includes(origin) ? origin : ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}
const reply = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return reply(req, 405, { error: 'Usa POST' });

  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return reply(req, 401, { error: 'Inicia sesión para traducir' });
  const asUser = createClient(URL_, PUBLIC_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const admin = createClient(URL_, SECRET_KEY, { auth: { persistSession: false } });

  const { data: who, error: authError } = await asUser.auth.getUser(auth.slice(7));
  if (authError || !who?.user) return reply(req, 401, { error: 'Sesión no válida' });
  const uid = who.user.id;

  let request;
  try { request = parseRequest(await req.json()); } catch (err) { return reply(req, 400, { error: (err as Error).message }); }

  // Idioma de destino: el que pide la app o, si no, el idioma principal del perfil.
  let target = request.target;
  if (!target) {
    const { data: me } = await asUser.from('profiles').select('language').eq('id', uid).single();
    target = me?.language && LANGS.includes(me.language) ? me.language : 'es';
  }

  // 1. Caché compartida.
  const results: Record<string, { source: string; id: string; text: string; source_lang: string | null; same: boolean; cached: boolean }> = {};
  const bySource = new Map<string, string[]>();
  for (const it of request.items) bySource.set(it.source, [...(bySource.get(it.source) || []), it.id]);
  for (const [source, ids] of bySource) {
    const { data } = await admin.from('message_translations').select('message_id, translated, source_lang')
      .eq('source', source).eq('target_lang', target).in('message_id', ids);
    for (const row of data || []) {
      results[`${source}:${row.message_id}`] = { source, id: row.message_id, text: row.translated, source_lang: row.source_lang, same: row.source_lang === target, cached: true };
    }
  }

  // 2. Originales que faltan, leídos con la sesión del usuario (RLS decide).
  const pending: { source: string; id: string; body: string }[] = [];
  for (const [source, ids] of bySource) {
    const missing = ids.filter(id => !results[`${source}:${id}`]);
    if (!missing.length) continue;
    const { data, error } = await asUser.from(source).select('id, body').in('id', missing);
    if (error) return reply(req, 400, { error: `No se pudieron leer los mensajes (${source})` });
    for (const row of data || []) if (row.body?.trim()) pending.push({ source, id: row.id, body: String(row.body).slice(0, 5000) });
  }

  let limited = false;
  if (pending.length) {
    const provider = pickProvider(env);
    if (!provider) return reply(req, 503, { error: 'El traductor no está configurado en el servidor', translations: Object.values(results) });

    // 3. Límite diario por persona.
    const chars = pending.reduce((n, p) => n + p.body.length, 0);
    const { data: used, error: usageError } = await admin.rpc('add_translation_usage', { uid, n: chars });
    if (usageError) return reply(req, 500, { error: 'No se pudo registrar el uso del traductor' });
    if (Number(used) > DAILY) { limited = true; await admin.rpc('add_translation_usage', { uid, n: -chars }); }

    if (!limited) {
      let translated;
      try { translated = await translateAll(provider, pending.map(p => p.body), target); }
      catch (err) { console.error(err); return reply(req, 502, { error: 'El servicio de traducción no respondió', translations: Object.values(results) }); }
      const rows = pending.map((p, i) => {
        const src = translated[i].source, same = src === target;
        const text = same ? p.body : translated[i].text;
        results[`${p.source}:${p.id}`] = { source: p.source, id: p.id, text, source_lang: src, same, cached: false };
        return { source: p.source, message_id: p.id, target_lang: target, source_lang: src, translated: text, provider: provider.name };
      });
      const { error: saveError } = await admin.from('message_translations').upsert(rows, { onConflict: 'source,message_id,target_lang' });
      if (saveError) console.error('cache', saveError.message);
    }
  }

  return reply(req, limited ? 429 : 200, {
    target,
    translations: Object.values(results),
    ...(limited ? { error: 'Llegaste al límite diario de traducción. Vuelve a intentarlo mañana.' } : {})
  });
});
