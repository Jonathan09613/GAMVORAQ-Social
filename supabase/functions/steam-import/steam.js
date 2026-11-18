// Importar la biblioteca de Steam: interpretar el perfil, pedir los juegos y emparejarlos con el catálogo.
const API = 'https://api.steampowered.com';

/** Acepta SteamID64, URL /profiles/<id>, URL /id/<nombre> o el nombre personalizado. */
export function parseSteamProfile(input) {
  const s = String(input || '').trim();
  if (!s) throw new Error('Escribe tu perfil de Steam');
  const id = s.match(/(?:^|\/profiles\/)(7656\d{13})(?:\/|$)/);
  if (id) return { steamid: id[1] };
  const vanity = s.match(/steamcommunity\.com\/id\/([A-Za-z0-9_-]{2,32})/) || s.match(/^([A-Za-z0-9_-]{2,32})$/);
  if (vanity) return { vanity: vanity[1] };
  throw new Error('No reconozco ese perfil de Steam. Pega la URL de tu perfil.');
}
/** Nombre comparable: sin marcas, acentos, símbolos ni mayúsculas. */
export const normName = n => String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[™®©]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();

/** Empareja los juegos de Steam con el catálogo. Los no encontrados con al menos `minMinutes` jugados se proponen como nuevos. */
export function matchGames(owned, catalog, { minMinutes = 120, maxNew = 20 } = {}) {
  const byName = new Map(catalog.map(g => [normName(g.name), g.id]));
  const matched = new Set(), fresh = [], appids = {};
  for (const g of owned || []) {
    const id = byName.get(normName(g.name));
    if (id != null) { matched.add(id); if (g.appid) appids[id] = Number(g.appid); }
    else if ((g.playtime_forever || 0) >= minMinutes && g.name) fresh.push({ name: String(g.name).slice(0, 100), minutes: g.playtime_forever, appid: Number(g.appid) || null });
  }
  fresh.sort((a, b) => b.minutes - a.minutes);
  // appids: id del catálogo → número de Steam (sirve para mostrar la portada oficial del juego).
  return { matched: [...matched], fresh: fresh.slice(0, maxNew), appids };
}

export async function resolveSteamId(profile, key, f = fetch) {
  if (profile.steamid) return profile.steamid;
  const res = await f(`${API}/ISteamUser/ResolveVanityURL/v1/?key=${encodeURIComponent(key)}&vanityurl=${encodeURIComponent(profile.vanity)}`);
  if (!res.ok) throw new Error(`Steam respondió ${res.status}`);
  const data = await res.json();
  if (data?.response?.success !== 1 || !data.response.steamid) throw new Error('No encontramos ese perfil de Steam');
  return data.response.steamid;
}
export async function ownedGames(steamid, key, f = fetch) {
  const res = await f(`${API}/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(key)}&steamid=${steamid}&include_appinfo=true&include_played_free_games=true&format=json`);
  if (!res.ok) throw new Error(`Steam respondió ${res.status}`);
  const data = await res.json();
  const games = data?.response?.games;
  if (!Array.isArray(games)) throw new Error('Tu biblioteca de Steam es privada. En Steam: Perfil → Editar perfil → Privacidad → «Detalles del juego: Público».');
  return games;
}
