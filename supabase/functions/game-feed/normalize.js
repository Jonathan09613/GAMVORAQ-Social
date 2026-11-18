// Normalización de respuestas de APIs públicas (misma lógica que src/apis.js).
export function normalizeTracks(results = []) {
  return results.filter(r => r && r.trackName && r.artistName).slice(0, 8).map(r => ({
    title: String(r.trackName).slice(0, 120), artist: String(r.artistName).slice(0, 120),
    artwork: /^https:\/\//.test(r.artworkUrl100 || '') ? r.artworkUrl100.replace('100x100bb', '300x300bb') : null,
    preview: /^https:\/\//.test(r.previewUrl || '') ? r.previewUrl : null,
    link: /^https:\/\//.test(r.trackViewUrl || '') ? r.trackViewUrl : null,
    album: r.collectionName || ''
  }));
}

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

/** Elige el resultado de la tienda de Steam cuyo nombre se parece más al del juego (o null). */
export function bestMatch(name, items = []) {
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[™®©:'’\-–—.,!?]/g, ' ').replace(/\s+/g, ' ').trim();
  const n = norm(name); if (!n || !items.length) return null;
  const exact = items.find(i => norm(i.name) === n); if (exact) return exact.id;
  const starts = items.find(i => norm(i.name).startsWith(n) || n.startsWith(norm(i.name))); if (starts) return starts.id;
  const words = new Set(n.split(' ')), score = i => norm(i.name).split(' ').filter(w => words.has(w)).length / Math.max(words.size, 1);
  const best = [...items].sort((a, b) => score(b) - score(a))[0];
  return best && score(best) >= 0.6 ? best.id : null;
}
