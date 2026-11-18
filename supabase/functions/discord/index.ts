// GAMVORAQ · Edge Function «discord»: bot de Discord con comandos /disponibles, /partidas y /pasaporte.
// Discord llama a esta URL (Interactions Endpoint URL). No necesita un servidor siempre encendido.
// Privacidad: solo muestra perfiles con «Mostrar en Discord» activado y nunca cuentas de menores o sin edad declarada.
// Variables: DISCORD_PUBLIC_KEY (de tu aplicación en discord.com/developers), APP_URL (opcional). Desplegar con --no-verify-jwt.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyDiscord, handleInteraction } from './discord.js';
import { keys } from '../_shared/http.js';

const env = Deno.env.toObject();
const k = keys(env);
const admin = createClient(k.url, k.secretKey, { auth: { persistSession: false } });

async function visibleAdults(ids: string[]) {
  if (!ids.length) return new Map();
  const [{ data: profiles }, { data: priv }] = await Promise.all([
    admin.from('profiles').select('id, display_name, username, discord_visible').in('id', ids),
    admin.from('profile_private').select('user_id, birth_year').in('user_id', ids)
  ]);
  const year = new Date().getFullYear(), born = new Map((priv || []).map((p: any) => [p.user_id, p.birth_year]));
  return new Map((profiles || []).filter((p: any) => p.discord_visible && born.get(p.id) && year - Number(born.get(p.id)) >= 19).map((p: any) => [p.id, p]));
}
const db = {
  async available(gameName?: string) {
    const { data } = await admin.from('availability').select('user_id, until, platform, mode, games(name)').gt('until', new Date().toISOString()).limit(100);
    const ok = await visibleAdults((data || []).map((a: any) => a.user_id));
    return (data || []).filter((a: any) => ok.has(a.user_id) && (!gameName || String((a as any).games?.name || '').toLowerCase().includes(gameName.toLowerCase())))
      .map((a: any) => ({ name: ok.get(a.user_id).display_name, game: (a as any).games?.name, platform: a.platform, until: a.until, mode: a.mode }));
  },
  async openSessions() {
    const { data } = await admin.from('play_sessions').select('id, title, starts_at, capacity, host_id, games(name)').is('squad_id', null).eq('status', 'scheduled').gt('starts_at', new Date().toISOString()).order('starts_at').limit(20);
    const ok = await visibleAdults((data || []).map((s: any) => s.host_id));
    const list = (data || []).filter((s: any) => ok.has(s.host_id));
    const { data: rs } = await admin.from('session_rsvps').select('session_id').eq('status', 'going').in('session_id', list.map((s: any) => s.id));
    return list.map((s: any) => ({ title: s.title, starts_at: s.starts_at, capacity: s.capacity, game: (s as any).games?.name, host: ok.get(s.host_id).display_name, going: (rs || []).filter((r: any) => r.session_id === s.id).length }));
  },
  async passport(username: string) {
    const { data: p } = await admin.from('profiles').select('id, display_name').eq('username', username).maybeSingle();
    if (!p || !(await visibleAdults([p.id])).has(p.id)) return null;
    const { data } = await admin.rpc('gg_passport', { target: p.id });
    return { name: p.display_name, ...(data || {}) };
  }
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Usa POST', { status: 405 });
  const raw = await req.text();
  const valid = await verifyDiscord(env.DISCORD_PUBLIC_KEY, req.headers.get('X-Signature-Ed25519'), req.headers.get('X-Signature-Timestamp'), raw);
  if (!valid) return new Response('Firma inválida', { status: 401 });
  const out = await handleInteraction(JSON.parse(raw), db, env);
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
});
