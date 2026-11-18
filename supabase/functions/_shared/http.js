// Utilidades comunes de las Edge Functions de GAMVORAQ (Deno).
export function keys(env) {
  const pick = (json, legacy) => { try { if (json) return JSON.parse(json).default; } catch { /* formato inesperado */ } return legacy; };
  return { url: env.SUPABASE_URL, publicKey: pick(env.SUPABASE_PUBLISHABLE_KEYS, env.SUPABASE_ANON_KEY), secretKey: pick(env.SUPABASE_SECRET_KEYS, env.SUPABASE_SERVICE_ROLE_KEY) };
}
export function cors(req, env) {
  const origins = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': !origins.length ? '*' : origins.includes(origin) ? origin : origins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin'
  };
}
export const json = (req, env, status, body) => new Response(JSON.stringify(body), { status, headers: { ...cors(req, env), 'Content-Type': 'application/json' } });
