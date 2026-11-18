// GAMVORAQ · Edge Function «steam-import»
// Agrega a la biblioteca de la persona los juegos de su cuenta de Steam (perfil con «Detalles del juego» público).
// Los juegos que no estaban en el catálogo y que jugó al menos 2 horas se agregan al catálogo.
// Variables: STEAM_API_KEY (https://steamcommunity.com/dev/apikey). Límite: STEAM_DAILY_LIMIT (5 por defecto).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseSteamProfile, matchGames, resolveSteamId, ownedGames } from './steam.js';
import { keys, cors, json } from '../_shared/http.js';

const env = Deno.env.toObject();
const k = keys(env);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req, env) });
  if (req.method !== 'POST') return json(req, env, 405, { error: 'Usa POST' });
  const auth = req.headers.get('Authorization') || '';
  const asUser = createClient(k.url, k.publicKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const admin = createClient(k.url, k.secretKey, { auth: { persistSession: false } });
  const { data: who } = await asUser.auth.getUser(auth.replace(/^Bearer /, ''));
  if (!who?.user) return json(req, env, 401, { error: 'Inicia sesión' });
  if (!env.STEAM_API_KEY) return json(req, env, 503, { error: 'La importación de Steam no está configurada en el servidor' });

  let profile;
  try { profile = parseSteamProfile((await req.json().catch(() => ({}))).profile); } catch (err) { return json(req, env, 400, { error: (err as Error).message }); }
  const { data: allowed } = await admin.rpc('use_function', { uid: who.user.id, fname: 'steam', max_per_day: Number(env.STEAM_DAILY_LIMIT || 5) });
  if (!allowed) return json(req, env, 429, { error: 'Ya importaste varias veces hoy. Inténtalo mañana.' });

  try {
    const steamid = await resolveSteamId(profile, env.STEAM_API_KEY);
    const owned = await ownedGames(steamid, env.STEAM_API_KEY);
    const { data: catalog } = await admin.from('games').select('id, name, steam_appid').limit(5000);
    const { matched, fresh, appids } = matchGames(owned, catalog || []);
    // Portadas: guarda el número de Steam de los juegos del catálogo que aún no lo tenían.
    const missingCover = (catalog || []).filter((g: any) => appids[g.id] && !g.steam_appid);
    await Promise.all(missingCover.slice(0, 50).map((g: any) => admin.from('games').update({ steam_appid: appids[g.id] }).eq('id', g.id).is('steam_appid', null)));
    let created: number[] = [];
    if (fresh.length) {
      await admin.from('games').upsert(fresh.map(g => ({ name: g.name, genre: null, platform: 'PC', steam_appid: g.appid })), { onConflict: 'name', ignoreDuplicates: true });
      const { data } = await admin.from('games').select('id').in('name', fresh.map(g => g.name));
      created = (data || []).map((g: any) => g.id);
    }
    const ids = [...new Set([...matched, ...created])];
    if (ids.length) await admin.from('user_games').upsert(ids.map(game_id => ({ user_id: who.user.id, game_id })), { onConflict: 'user_id,game_id', ignoreDuplicates: true });
    return json(req, env, 200, { owned: owned.length, added: ids.length, newInCatalog: fresh.map(g => g.name) });
  } catch (err) {
    return json(req, env, 400, { error: (err as Error).message });
  }
});
