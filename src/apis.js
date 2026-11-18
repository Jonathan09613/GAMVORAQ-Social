// APIs públicas y gratuitas que enriquecen GAMVORAQ (sin claves):
//  · iTunes Search (Apple): buscar canciones con portada y adelanto de 30 s para la música del squad.
//  · CheapShark: ofertas de juegos de PC en tiendas oficiales (Steam, GOG, Epic, Humble…).
//  · GamerPower: juegos gratis por tiempo limitado.
// Primero se intenta la Edge Function «game-feed» (evita bloqueos del navegador y guarda caché en el servidor);
// si no está desplegada, se llama directo a la API. Todo se guarda en caché local unas horas.
import { supabase } from './client.js';

const HOURS = 3600000;
function cached(key, ttl) {
  try { const raw = JSON.parse(localStorage.getItem('gvq:api:' + key) || 'null'); if (raw && Date.now() - raw.at < ttl) return raw.data; } catch { /* nada */ }
  return null;
}
function store(key, data) { try { localStorage.setItem('gvq:api:' + key, JSON.stringify({ at: Date.now(), data })); } catch { /* lleno */ } }
async function viaFunction(body) {
  if (!supabase) return null;
  try { const { data, error } = await supabase.functions.invoke('game-feed', { body }); return error ? null : data; } catch { return null; }
}
async function getJson(url) { const r = await fetch(url); if (!r.ok) throw new Error(String(r.status)); return r.json(); }

// ───────────── Música ─────────────
export function normalizeTracks(results = []) {
  return results.filter(r => r && r.trackName && r.artistName).slice(0, 8).map(r => ({
    title: String(r.trackName).slice(0, 120), artist: String(r.artistName).slice(0, 120),
    artwork: /^https:\/\//.test(r.artworkUrl100 || '') ? r.artworkUrl100.replace('100x100bb', '300x300bb') : null,
    preview: /^https:\/\//.test(r.previewUrl || '') ? r.previewUrl : null,
    link: /^https:\/\//.test(r.trackViewUrl || '') ? r.trackViewUrl : null,
    album: r.collectionName || ''
  }));
}
export async function searchMusic(q) {
  const term = String(q || '').trim().slice(0, 80); if (term.length < 2) return [];
  const key = 'music:' + term.toLowerCase(), hit = cached(key, 24 * HOURS); if (hit) return hit;
  let out = (await viaFunction({ kind: 'music', q: term }))?.tracks;
  if (!out) {
    try { out = normalizeTracks((await getJson(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=8`)).results); }
    catch { out = normalizeTracks((await jsonp(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=8`))?.results || []); }
  }
  store(key, out || []); return out || [];
}
/** Respaldo para navegadores que bloquean la respuesta: iTunes también responde en formato JSONP. */
function jsonp(url) {
  return new Promise(resolve => {
    const name = 'gvqCb' + Math.random().toString(36).slice(2), s = document.createElement('script');
    const done = v => { delete window[name]; s.remove(); resolve(v); };
    window[name] = done; s.src = `${url}&callback=${name}`; s.onerror = () => done(null);
    setTimeout(() => done(null), 6000); document.head.append(s);
  });
}
/** Enlaces para escuchar la canción completa donde cada quien prefiera. */
export function listenLinks(t) {
  const q = encodeURIComponent(`${t.title} ${t.artist}`);
  return { spotify: `https://open.spotify.com/search/${q}`, youtube: `https://music.youtube.com/search?q=${q}`, apple: t.link_url || t.link || `https://music.apple.com/search?term=${q}` };
}

// ───────────── Ofertas y juegos gratis ─────────────
export function normalizeDeals(list = []) {
  return list.filter(x => x && x.title && x.dealID).slice(0, 8).map(x => ({
    title: String(x.title), price: Number(x.salePrice), normal: Number(x.normalPrice), savings: Math.round(Number(x.savings) || 0),
    thumb: /^https:\/\//.test(x.thumb || '') ? x.thumb : null, link: `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(x.dealID)}`,
    steamAppID: x.steamAppID || null, rating: x.steamRatingPercent ? Number(x.steamRatingPercent) : null
  }));
}
export function normalizeGiveaways(list = []) {
  return (Array.isArray(list) ? list : []).filter(x => x && x.title && x.open_giveaway_url).slice(0, 8).map(x => ({
    title: String(x.title).replace(/\s*\((Steam|Epic Games|GOG|Itch\.io)\)\s*Giveaway$/i, '').replace(/\s*Giveaway$/i, ''),
    worth: x.worth && x.worth !== 'N/A' ? x.worth : '', image: /^https:\/\//.test(x.thumbnail || '') ? x.thumbnail : null,
    link: x.open_giveaway_url, platforms: String(x.platforms || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 3),
    ends: x.end_date && x.end_date !== 'N/A' ? x.end_date : ''
  }));
}
export async function gameRadar() {
  const hit = cached('radar', 3 * HOURS); if (hit) return hit;
  let out = await viaFunction({ kind: 'radar' });
  if (!out?.deals && !out?.free) {
    const [deals, free] = await Promise.all([
      getJson('https://www.cheapshark.com/api/1.0/deals?pageSize=12&sortBy=Deal%20Rating&onSale=1&AAA=1').then(normalizeDeals).catch(() => []),
      getJson('https://www.gamerpower.com/api/giveaways?type=game&sort-by=popularity').then(normalizeGiveaways).catch(() => [])
    ]);
    out = { deals, free };
  }
  if (out.deals?.length || out.free?.length) store('radar', out);
  return out;
}
