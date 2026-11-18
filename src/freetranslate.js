// Traducción gratuita de respaldo (sin claves): se usa cuando la Edge Function «translate» no está
// desplegada o no tiene proveedor configurado. Primero Google (servicio web público, detecta el idioma
// solo) y si falla, MyMemory (API pública gratuita). Todo se guarda en caché para no repetir pedidos.
import { detectLang } from './translate.js';

const GOOGLE = 'https://translate.googleapis.com/translate_a/single';
const MYMEMORY = 'https://api.mymemory.translated.net/get';
const short = c => String(c || '').slice(0, 2).toLowerCase() || null;

async function viaGoogle(text, target, f) {
  const url = `${GOOGLE}?client=gtx&sl=auto&tl=${encodeURIComponent(target === 'zh' ? 'zh-CN' : target)}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await f(url);
  if (!res.ok) throw new Error('google ' + res.status);
  const data = await res.json();
  const out = (data?.[0] || []).map(part => part?.[0] || '').join('');
  if (!out) throw new Error('google vacío');
  return { text: out, source: short(data?.[2]) };
}
async function viaMyMemory(text, target, f) {
  const guess = detectLang(text);
  // Si no estamos seguros del idioma, MyMemory lo detecta solo («autodetect»).
  const from = guess && guess !== target ? guess : 'autodetect';
  const res = await f(`${MYMEMORY}?q=${encodeURIComponent(text.slice(0, 480))}&langpair=${from}|${target}`);
  if (!res.ok) throw new Error('mymemory ' + res.status);
  const data = await res.json();
  const out = data?.responseData?.translatedText;
  if (!out || Number(data?.responseStatus) >= 400 || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out)) throw new Error('mymemory sin traducción');
  return { text: out, source: from === 'autodetect' ? short(data?.responseData?.detectedLanguage) : from };
}

/** Traduce una lista de textos al idioma `target`. Devuelve [{ text, source }] o null en cada posición que falló. */
export async function translateFree(texts, target, f = globalThis.fetch?.bind(globalThis)) {
  const out = [];
  for (const t of texts) {
    let r = null;
    for (const fn of [viaGoogle, viaMyMemory]) {
      try { r = await fn(String(t || ''), target, f); break; } catch { /* siguiente servicio */ }
    }
    out.push(r);
  }
  return out;
}

/** Parte una lista de textos en grupos que caben en una dirección web (GET funciona en todos los navegadores). */
export function chunkForUrl(texts, max = 1800) {
  const groups = []; let cur = [], size = 0;
  for (const t of texts) {
    const len = encodeURIComponent(t).length + 3;
    if (cur.length && (size + len > max || cur.length >= 40)) { groups.push(cur); cur = []; size = 0; }
    cur.push(t); size += len;
  }
  if (cur.length) groups.push(cur);
  return groups;
}
async function gtxLines(lines, target, source, f) {
  const url = `${GOOGLE}?client=gtx&sl=${encodeURIComponent(source)}&tl=${encodeURIComponent(target === 'zh' ? 'zh-CN' : target)}&dt=t&q=${encodeURIComponent(lines.join('\n'))}`;
  const res = await f(url); if (!res.ok) throw new Error('gtx ' + res.status);
  const data = await res.json();
  const out = (data?.[0] || []).map(p => p?.[0] || '').join('').split('\n').map(x => x.trim());
  if (out.length !== lines.length) throw new Error('líneas distintas');
  return out;
}
/**
 * Traduce muchos textos cortos de la interfaz en pocas peticiones.
 * 1) La Edge Function «game-feed» (desde el servidor, sin bloqueos del navegador), si se pasa `viaServer`.
 * 2) Google directo en grupos por GET. 3) MyMemory uno por uno (máx. 10) para lo que aún falte.
 */
export async function translateUiBatch(texts, target, source = 'es', f = globalThis.fetch?.bind(globalThis), viaServer = null) {
  const clean = texts.map(t => String(t).replace(/\s*\n\s*/g, ' ').trim());
  if (viaServer) {
    try { const r = await viaServer(clean, target, source); if (Array.isArray(r) && r.length === clean.length && r.some(Boolean)) return r; } catch { /* siguiente */ }
  }
  const out = new Array(clean.length).fill(null);
  let pos = 0;
  for (const group of chunkForUrl(clean)) {
    try { (await gtxLines(group, target, source, f)).forEach((t, j) => { out[pos + j] = t; }); }
    catch { /* se intenta abajo */ }
    pos += group.length;
  }
  let tries = 0;
  for (let i = 0; i < clean.length && tries < 10; i++) {
    if (out[i]) continue; tries++;
    try {
      const res = await f(`${MYMEMORY}?q=${encodeURIComponent(clean[i].slice(0, 480))}&langpair=${source}|${target === 'zh' ? 'zh-CN' : target}`);
      const data = await res.json(); const t = data?.responseData?.translatedText;
      if (t && Number(data?.responseStatus) < 400 && !/MYMEMORY WARNING/i.test(t)) out[i] = t;
    } catch { /* sin conexión */ }
  }
  return out;
}
