// Proveedores de traducción para la Edge Function «translate».
// JavaScript plano para que funcione igual en Deno (Supabase) y en las pruebas de Node.
// Cada proveedor recibe un arreglo de textos y devuelve [{ text, source }] en el mismo orden.

export const LANGS = ['es', 'en', 'pt', 'fr', 'it', 'de', 'ja', 'ko', 'zh'];
const short = code => String(code || '').slice(0, 2).toLowerCase() || null;

async function asJson(res, name) {
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${name} respondió ${res.status}${detail ? ': ' + detail.slice(0, 200) : ''}`);
  }
  return res.json();
}

// DeepL: las claves del plan gratuito terminan en «:fx» y usan otro dominio.
const DEEPL_TARGET = { en: 'EN-US', pt: 'PT-BR', zh: 'ZH-HANS' };
export function deepl({ key, fetch: f = fetch }) {
  const base = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
  return {
    name: 'deepl',
    async translate(texts, target) {
      const res = await f(`${base}/v2/translate`, {
        method: 'POST',
        headers: { 'Authorization': `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: texts, target_lang: DEEPL_TARGET[target] || target.toUpperCase() })
      });
      const data = await asJson(res, 'DeepL');
      return data.translations.map(t => ({ text: t.text, source: short(t.detected_source_language) }));
    }
  };
}

// Google Cloud Translation (v2, con clave de API).
const GOOGLE_TARGET = { zh: 'zh-CN' };
export function google({ key, fetch: f = fetch }) {
  return {
    name: 'google',
    async translate(texts, target) {
      const res = await f(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: texts, target: GOOGLE_TARGET[target] || target, format: 'text' })
      });
      const data = await asJson(res, 'Google Translate');
      return data.data.translations.map(t => ({ text: t.translatedText, source: short(t.detectedSourceLanguage) }));
    }
  };
}

// LibreTranslate: código abierto, se puede alojar en un servidor propio.
export function libre({ url, key = '', fetch: f = fetch }) {
  const endpoint = url.replace(/\/+$/, '') + '/translate';
  const one = async (q, target) => {
    const res = await f(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, source: 'auto', target, format: 'text', ...(key ? { api_key: key } : {}) })
    });
    return asJson(res, 'LibreTranslate');
  };
  return {
    name: 'libretranslate',
    async translate(texts, target) {
      try {
        const data = await one(texts, target);
        if (Array.isArray(data.translatedText)) {
          return data.translatedText.map((text, i) => ({ text, source: short(data.detectedLanguage?.[i]?.language) }));
        }
      } catch { /* versiones antiguas no aceptan arreglos: se traduce uno por uno */ }
      const out = [];
      for (const t of texts) { const d = await one(t, target); out.push({ text: d.translatedText, source: short(d.detectedLanguage?.language) }); }
      return out;
    }
  };
}

// Gratis y sin clave: servicio web público de Google (detecta el idioma). Ideal para empezar;
// para mucho volumen conviene DeepL o Google con clave.
export function freeGoogle({ fetch: f = fetch } = {}) {
  return {
    name: 'free',
    async translate(texts, target) {
      const out = [];
      for (const t of texts) {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target === 'zh' ? 'zh-CN' : target)}&dt=t&q=${encodeURIComponent(t)}`;
        const data = await asJson(await f(url), 'Traductor gratuito');
        out.push({ text: (data?.[0] || []).map(p => p?.[0] || '').join('') || t, source: short(data?.[2]) });
      }
      return out;
    }
  };
}

/** Elige el proveedor según las variables de entorno. Sin claves usa el traductor gratuito (TRANSLATE_PROVIDER=none lo apaga). */
export function pickProvider(env, f = fetch) {
  const want = (env.TRANSLATE_PROVIDER || '').toLowerCase();
  const options = {
    deepl: env.DEEPL_API_KEY && (() => deepl({ key: env.DEEPL_API_KEY, fetch: f })),
    google: env.GOOGLE_TRANSLATE_API_KEY && (() => google({ key: env.GOOGLE_TRANSLATE_API_KEY, fetch: f })),
    libretranslate: env.LIBRETRANSLATE_URL && (() => libre({ url: env.LIBRETRANSLATE_URL, key: env.LIBRETRANSLATE_API_KEY || '', fetch: f }))
  };
  if (want === 'none') return null;
  if (want && options[want]) return options[want]();
  for (const make of Object.values(options)) if (make) return make();
  return freeGoogle({ fetch: f });
}

/** Traduce en lotes de `size` textos para respetar los límites de cada API. */
export async function translateAll(provider, texts, target, size = 25) {
  const out = [];
  for (let i = 0; i < texts.length; i += size) out.push(...await provider.translate(texts.slice(i, i + size), target));
  if (out.length !== texts.length) throw new Error('El proveedor devolvió un número distinto de traducciones');
  return out;
}

export const SOURCES = ['direct_messages', 'squad_messages', 'channel_messages', 'comments', 'posts'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida el cuerpo de la petición. Devuelve { items, target } o lanza un Error con mensaje para la persona. */
export function parseRequest(body, max = 50) {
  if (!body || !Array.isArray(body.items)) throw new Error('Falta la lista de mensajes');
  const seen = new Set(), items = [];
  for (const it of body.items) {
    if (!it || !SOURCES.includes(it.source) || !UUID.test(String(it.id))) continue;
    const key = `${it.source}:${it.id}`;
    if (!seen.has(key)) { seen.add(key); items.push({ source: it.source, id: String(it.id).toLowerCase() }); }
  }
  if (!items.length) throw new Error('No hay mensajes válidos para traducir');
  if (items.length > max) throw new Error(`Máximo ${max} mensajes por petición`);
  const target = body.target && LANGS.includes(body.target) ? body.target : null;
  return { items, target };
}
