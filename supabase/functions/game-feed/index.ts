// GAMVORAQ · Edge Function «game-feed»
// Puente con caché hacia APIs públicas gratuitas (sin claves):
//   kind=music → búsqueda de canciones (iTunes Search API de Apple) para la música del squad.
//   kind=radar → ofertas de juegos (CheapShark) y juegos gratis por tiempo limitado (GamerPower).
//   kind=ui → traduce textos de la interfaz (lotes) con el traductor gratuito, con caché.
//   kind=yt     → video de YouTube de una canción para escucharla completa (YOUTUBE_API_KEY).
//   kind=covers → portada oficial de Steam de cada juego (por número de Steam o buscando por nombre);
//                si no está en Steam y configuraste RAWG_API_KEY (gratis en rawg.io/apidocs), la de RAWG.
// La app funciona sin esta función (llama directo a las APIs), pero con ella es más rápida y estable.
import { cors, json } from '../_shared/http.js';
import { normalizeTracks, normalizeDeals, normalizeGiveaways, bestMatch } from './normalize.js';

const env = Deno.env.toObject();
const cache = new Map<string, { at: number; data: unknown }>();
async function cachedFetch(key: string, ttl: number, load: () => Promise<unknown>) {
  const hit = cache.get(key); if (hit && Date.now() - hit.at < ttl) return hit.data;
  const data = await load(); cache.set(key, { at: Date.now(), data }); if (cache.size > 300) cache.delete(cache.keys().next().value!);
  return data;
}
const get = async (url: string) => { const r = await fetch(url, { headers: { 'User-Agent': 'GAMVORAQ/12' } }); if (!r.ok) throw new Error(`${r.status}`); return r.json(); };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req, env) });
  if (req.method !== 'POST') return json(req, env, 405, { error: 'Usa POST' });
  let body: { kind?: string; q?: string; texts?: string[]; target?: string; source?: string; games?: { id: number; name: string; appid?: number | null }[] } = {};
  try { body = await req.json(); } catch { return json(req, env, 400, { error: 'JSON inválido' }); }
  try {
    if (body.kind === 'music') {
      const q = String(body.q || '').trim().slice(0, 80);
      if (q.length < 2) return json(req, env, 400, { error: 'Escribe al menos 2 letras' });
      const tracks = await cachedFetch('m:' + q.toLowerCase(), 86400000, async () =>
        normalizeTracks((await get(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=8`)).results));
      return json(req, env, 200, { tracks });
    }
    // Canción completa: video de YouTube de «canción artista» (necesita YOUTUBE_API_KEY; gratis en Google Cloud).
    if (body.kind === 'yt') {
      if (!env.YOUTUBE_API_KEY) return json(req, env, 200, { video: null, reason: 'Falta YOUTUBE_API_KEY en el servidor' });
      const q = String(body.q || '').trim().slice(0, 120);
      if (q.length < 2) return json(req, env, 400, { error: 'Escribe la canción' });
      const video = await cachedFetch('yt:' + q.toLowerCase(), 30 * 86400000, async () => {
        const d = await get(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&videoCategoryId=10&maxResults=5&q=${encodeURIComponent(q)}&key=${env.YOUTUBE_API_KEY}`);
        const items = (d?.items || []).map((it: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string } }) => ({ id: it.id?.videoId || '', title: it.snippet?.title || '', channel: it.snippet?.channelTitle || '' })).filter((x: { id: string }) => /^[A-Za-z0-9_-]{11}$/.test(x.id));
        // Prefiere el audio oficial o el canal «- Topic» (la canción tal cual, sin videoclip).
        const score = (x: { title: string; channel: string }) => (/ - topic$/i.test(x.channel) ? 3 : 0) + (/official audio|audio oficial/i.test(x.title) ? 2 : 0) + (/official|oficial/i.test(x.title) ? 1 : 0) - (/live|en vivo|cover|karaoke|8d|remix|sped up|slowed/i.test(x.title) ? 2 : 0);
        return items.sort((a: { title: string; channel: string }, b: { title: string; channel: string }) => score(b) - score(a))[0] || null;
      });
      return json(req, env, 200, { video });
    }
    if (body.kind === 'ui') {
      const LANGS = ['es', 'en', 'pt', 'fr', 'it', 'de', 'ja', 'ko', 'zh'];
      const target = String(body.target || ''), source = String(body.source || 'es');
      if (!LANGS.includes(target) || !LANGS.includes(source)) return json(req, env, 400, { error: 'Idioma no válido' });
      const texts = (Array.isArray(body.texts) ? body.texts : []).slice(0, 80).map(t => String(t).replace(/\s*\n\s*/g, ' ').trim().slice(0, 500));
      const out: (string | null)[] = [];
      for (let i = 0; i < texts.length; i += 25) {
        const group = texts.slice(i, i + 25), key = `ui:${source}:${target}:${group.join('\u0001')}`;
        try {
          const lines = await cachedFetch(key, 30 * 86400000, async () => {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target === 'zh' ? 'zh-CN' : target}&dt=t&q=${encodeURIComponent(group.join('\n'))}`;
            const data = await get(url);
            const ls = (data?.[0] || []).map((p: unknown[]) => (p?.[0] as string) || '').join('').split('\n').map((x: string) => x.trim());
            if (ls.length !== group.length) throw new Error('líneas');
            return ls;
          }) as string[];
          out.push(...lines);
        } catch { out.push(...group.map(() => null)); }
      }
      return json(req, env, 200, { texts: out });
    }
    if (body.kind === 'covers') {
      const list = (Array.isArray(body.games) ? body.games : []).slice(0, 30);
      const header = async (appid: number) => cachedFetch('h:' + appid, 7 * 86400000, async () => {
        const d = await get(`https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic`);
        return d?.[appid]?.success ? (d[appid].data?.header_image || null) : null;
      });
      const covers = [];
      for (const g of list) {
        try {
          let appid = Number(g.appid) || 0;
          if (!appid && g.name) {
            const found = await cachedFetch('s:' + String(g.name).toLowerCase(), 7 * 86400000, async () =>
              (await get(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(String(g.name).slice(0, 80))}&l=english&cc=US`))?.items || []);
            appid = bestMatch(String(g.name), found as { id: number; name: string }[]) || 0;
          }
          const url = appid ? await header(appid) : null;
          if (url && /^https:\/\/[a-z.]*steamstatic\.com\//.test(String(url))) { covers.push({ id: g.id, appid, url: String(url) }); continue; }
          // No está en Steam (Fortnite, Valorant, Nintendo, móviles…): RAWG, si configuraste RAWG_API_KEY.
          if (env.RAWG_API_KEY && g.name) {
            const hits = await cachedFetch('r:' + String(g.name).toLowerCase(), 7 * 86400000, async () =>
              ((await get(`https://api.rawg.io/api/games?key=${env.RAWG_API_KEY}&search=${encodeURIComponent(String(g.name).slice(0, 80))}&page_size=6&search_precise=true`))?.results || [])
                .map((r: { id: number; name: string; background_image?: string }) => ({ id: r.id, name: r.name, img: r.background_image || '' })));
            const list2 = hits as { id: number; name: string; img: string }[];
            const pick = list2.find(h => h.id === bestMatch(String(g.name), list2));
            // Versión recortada de RAWG (más liviana): /media/crop/600/400/...
            const img = pick?.img ? pick.img.replace('/media/games/', '/media/crop/600/400/games/') : '';
            if (/^https:\/\/media\.rawg\.io\/media\//.test(img)) covers.push({ id: g.id, appid: null, url: img });
          }
        } catch { /* sigue con el siguiente juego */ }
      }
      return json(req, env, 200, { covers });
    }
    if (body.kind === 'radar') {
      const data = await cachedFetch('radar', 3 * 3600000, async () => {
        const [deals, free] = await Promise.all([
          get('https://www.cheapshark.com/api/1.0/deals?pageSize=12&sortBy=Deal%20Rating&onSale=1&AAA=1').then(normalizeDeals).catch(() => []),
          get('https://www.gamerpower.com/api/giveaways?type=game&sort-by=popularity').then(normalizeGiveaways).catch(() => [])
        ]);
        return { deals, free };
      });
      return json(req, env, 200, data);
    }
    return json(req, env, 400, { error: 'Tipo no válido' });
  } catch (err) {
    return json(req, env, 502, { error: 'La API externa no respondió', detail: String((err as Error).message).slice(0, 80) });
  }
});
