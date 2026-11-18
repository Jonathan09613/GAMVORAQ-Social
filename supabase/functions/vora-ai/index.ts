// GAMVORAQ · Edge Function «vora-ai»
// Respuestas con IA para VORA (charla y coach de partida). Solo se usa si la persona lo activa en Ajustes.
// Seguridad: exige sesión; límite diario por persona (AI_DAILY_LIMIT, 40 por defecto); el historial se acota y no se guarda.
// Variables: ANTHROPIC_API_KEY (+ VORA_MODEL opcional)  ·  o  AI_API_KEY + AI_MODEL (+ AI_BASE_URL) para un proveedor compatible con OpenAI.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { systemPrompt, cleanHistory, coachText, pickAi } from './ai.js';
import { keys, cors, json } from '../_shared/http.js';

const env = Deno.env.toObject();
const k = keys(env);
const LIMIT = Number(env.AI_DAILY_LIMIT || 40);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req, env) });
  if (req.method !== 'POST') return json(req, env, 405, { error: 'Usa POST' });
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return json(req, env, 401, { error: 'Inicia sesión' });
  const asUser = createClient(k.url, k.publicKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const admin = createClient(k.url, k.secretKey, { auth: { persistSession: false } });
  const { data: who } = await asUser.auth.getUser(auth.slice(7));
  if (!who?.user) return json(req, env, 401, { error: 'Sesión no válida' });

  const ai = pickAi(env);
  if (!ai) return json(req, env, 503, { error: 'La IA de VORA no está configurada en el servidor' });
  const body = await req.json().catch(() => ({}));
  const mode = body.mode === 'coach' ? 'coach' : 'chat';
  const text = mode === 'coach' ? coachText(body.coach || {}) : String(body.text || '').trim();
  if (!text) return json(req, env, 400, { error: 'Escribe algo' });

  const { data: allowed, error: usageError } = await admin.rpc('use_function', { uid: who.user.id, fname: 'ai', max_per_day: LIMIT });
  if (usageError) return json(req, env, 500, { error: 'No se pudo registrar el uso' });
  if (!allowed) return json(req, env, 429, { error: 'VORA ya usó su IA por hoy contigo. Mañana sigue la charla; mientras, respondo con mis reglas.' });

  const [{ data: profile }, { data: band }] = await Promise.all([
    asUser.from('profiles').select('display_name, language').eq('id', who.user.id).single(),
    asUser.rpc('my_age_band')
  ]);
  const system = systemPrompt({ name: String(body.name || 'VORA').slice(0, 24), nick: String(body.nick || profile?.display_name || '').slice(0, 30), language: profile?.language || 'es', minor: band === 'minor', mode });
  const messages = cleanHistory(mode === 'coach' ? [] : body.history, text);
  try {
    const reply = await ai.complete(system, messages, mode === 'coach' ? 450 : 300);
    return json(req, env, 200, { text: reply.slice(0, 1500) });
  } catch (err) {
    console.error((err as Error).message);
    return json(req, env, 502, { error: 'La IA no respondió. Respondo con mis reglas mientras.' });
  }
});
