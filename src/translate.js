// Traducción automática de mensajes.
// - Cada cuenta tiene un idioma principal (profiles.language). Los mensajes RECIBIDOS se muestran en ese idioma.
// - Siempre se conserva el original: «Ver original» / «Ver traducción».
// - La traducción real la hace la Edge Function «translate» (el proveedor y su clave viven solo en el servidor).
// - Caché en memoria + localStorage por cuenta, lotes de hasta 40 mensajes y detección local para no pedir
//   traducciones de mensajes que ya están en tu idioma.
// Este módulo no toca el DOM: las vistas piden `view(...)` y main.js vuelve a pintar con `onUpdate`.

export const LANGUAGES = [
  ['es', 'Español'], ['en', 'English'], ['pt', 'Português'], ['fr', 'Français'], ['it', 'Italiano'],
  ['de', 'Deutsch'], ['ja', '日本語'], ['ko', '한국어'], ['zh', '中文']
];
export const LANG_CODES = LANGUAGES.map(([c]) => c);
/** Nombre del idioma en español, para «Traducido del inglés». */
export const LANG_NAME = { es: 'español', en: 'inglés', pt: 'portugués', fr: 'francés', it: 'italiano', de: 'alemán', ja: 'japonés', ko: 'coreano', zh: 'chino' };
export const fromLabel = code => (code && LANG_NAME[code] ? `del ${LANG_NAME[code]}` : 'de otro idioma');

/** Idioma sugerido a partir del navegador (es-MX → es). */
export function browserLang(nav = globalThis.navigator) {
  const list = [...(nav?.languages || []), nav?.language].filter(Boolean);
  for (const l of list) { const c = String(l).slice(0, 2).toLowerCase(); if (LANG_CODES.includes(c)) return c; }
  return 'es';
}

// ───────────────────────── Detección local (aproximada) ─────────────────────────
// Solo sirve para EVITAR pedir traducciones innecesarias. Si no está segura devuelve null y decide el servidor.
const WORDS = {
  es: 'el la los las que de y en un una es por para con no te lo mi tu se como pero muy hola gracias quien quién vamos jugar juego partida esta está estoy hoy noche bien también ya donde dónde cuando cuándo porque qué sí equipo ganamos',
  en: 'the and you to is are of in it for on with this that we i my your have be just game play tonight thanks hello who what anyone join team let lets good great want can will',
  pt: 'o a os as que de e em um uma é para com não você vocês eu meu minha se como mas muito olá obrigado obrigada quem vamos jogar jogo partida hoje noite bem também já onde quando porque time está estou',
  fr: 'le la les des et en un une est pour avec pas vous je mon ma ce que qui sur comme mais très bonjour merci jouer jeu partie ce soir bien aussi où quand parce équipe',
  it: 'il lo la gli le che di e in un una è per con non tu io mio mia come ma molto ciao grazie chi andiamo giocare gioco partita stasera bene anche dove quando perché squadra',
  de: 'der die das und ist nicht ich du wir mit für auf ein eine zu von heute abend spiel spielen danke hallo wer wie aber sehr auch wo wann weil team gut'
};
const SETS = Object.fromEntries(Object.entries(WORDS).map(([k, v]) => [k, new Set(v.split(' '))]));
const MARKS = [[/[ñ¿¡]/, 'es', 3], [/(ção|ções|ã|õ)/, 'pt', 3], [/[ß]|[äöü]/, 'de', 2], [/(è|ê|à la|ç(?!ão))/, 'fr', 1], [/[ìò]/, 'it', 1]];

export function detectLang(text) {
  const t = String(text || '');
  if (/[぀-ヿ]/.test(t)) return 'ja';
  if (/[가-힯]/.test(t)) return 'ko';
  if (/[一-鿿]/.test(t)) return 'zh';
  const words = t.toLowerCase().normalize('NFC').match(/[\p{L}']+/gu) || [];
  if (words.length < 2) return null;
  const score = Object.fromEntries(Object.keys(SETS).map(k => [k, 0]));
  for (const w of words) for (const k of Object.keys(SETS)) if (SETS[k].has(w)) score[k]++;
  for (const [rx, k, pts] of MARKS) if (rx.test(t.toLowerCase())) score[k] += pts;
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const [best, second] = ranked;
  if (best[1] < 2 || best[1] - second[1] < 1) return null;
  return best[0];
}
/** ¿Vale la pena traducir? Mensajes vacíos, de solo emojis, números o «GG» no se traducen. */
export function translatable(text) {
  const letters = (String(text || '').match(/\p{L}/gu) || []).length;
  return letters >= 3;
}

// ───────────────────────── Motor de traducción ─────────────────────────
const MAX_CACHE = 600;
export function createTranslator({ invoke, storage = globalThis.localStorage, demoTable = null, onUpdate = () => {}, delay = 120, free = null } = {}) {
  let lang = 'es', auto = true, userKey = '', demo = false;
  let cache = new Map();                       // `${source}:${id}:${lang}` → { text, from, same }
  const pending = new Map(), inflight = new Set(), failed = new Set(), showOriginal = new Set();
  let timer = null, disabled = '', notice = '';

  const keyOf = (source, id, l = lang) => `${source}:${id}:${l}`;
  const persist = () => {
    if (!storage || !userKey || demo) return;
    try { storage.setItem(`gvq:tr:${userKey}`, JSON.stringify([...cache].slice(-MAX_CACHE))); } catch { /* almacenamiento lleno */ }
  };
  const restore = () => {
    cache = new Map();
    if (!storage || !userKey || demo) return;
    try { cache = new Map(JSON.parse(storage.getItem(`gvq:tr:${userKey}`) || '[]')); } catch { cache = new Map(); }
  };

  async function flush() {
    timer = null;
    const batch = [...pending.values()].slice(0, 40);
    batch.forEach(it => { pending.delete(keyOf(it.source, it.id)); inflight.add(keyOf(it.source, it.id)); });
    if (!batch.length) return;
    const target = lang;
    try {
      let results;
      if (demo) {
        await new Promise(r => setTimeout(r, 380));
        results = batch.map(it => {
          const row = demoTable?.[it.id];
          if (row?.[target]) return { source: it.source, id: it.id, text: row[target], source_lang: row.from, same: row.from === target };
          if (row?.from === target) return { source: it.source, id: it.id, text: it.body, source_lang: target, same: true };
          return { source: it.source, id: it.id, text: it.body, source_lang: null, same: false, unavailable: true };
        });
        // En la demostración, lo que no tiene traducción de ejemplo se intenta con el traductor gratuito.
        const missing = results.map((r, i) => r.unavailable ? i : -1).filter(i => i >= 0);
        if (missing.length && free) {
          try {
            const got = await free(missing.map(i => batch[i].body), target);
            missing.forEach((i, j) => { const g = got[j]; if (g) results[i] = { source: batch[i].source, id: batch[i].id, text: g.text, source_lang: g.source, same: g.source === target }; });
          } catch { /* sin conexión: se queda como ejemplo no disponible */ }
        }
      } else {
        const { data, error, status } = await invoke({ items: batch.map(({ source, id }) => ({ source, id })), target }, batch);
        if (error) {
          if (status === 503) { disabled = 'El traductor aún no está configurado en el servidor.'; }
          else if (status === 429) { disabled = 'Llegaste al límite diario de traducción. Vuelve mañana.'; }
          else notice = 'No se pudo traducir ahora. Lo intentaremos de nuevo.';
          results = data?.translations || [];
          if (!results.length) batch.forEach(it => failed.add(keyOf(it.source, it.id, target)));
        } else results = data?.translations || [];
      }
      for (const r of results) {
        if (r.unavailable) { cache.set(keyOf(r.source, r.id, target), { text: r.text, from: null, same: false, unavailable: true }); continue; }
        cache.set(keyOf(r.source, r.id, target), { text: r.text, from: r.source_lang || null, same: Boolean(r.same) });
      }
      batch.forEach(it => { const k = keyOf(it.source, it.id, target); if (!cache.has(k) && !failed.has(k)) failed.add(k); });
      persist();
    } catch (err) {
      console.warn('traducción', err);
      notice = 'No se pudo traducir ahora. Lo intentaremos de nuevo.';
      batch.forEach(it => failed.add(keyOf(it.source, it.id, target)));
    } finally {
      batch.forEach(it => inflight.delete(keyOf(it.source, it.id, target)));
      onUpdate();
      if (pending.size) timer = setTimeout(flush, delay);
    }
  }
  function request(item) {
    const k = keyOf(item.source, item.id);
    if (cache.has(k) || inflight.has(k) || pending.has(k) || failed.has(k) || disabled) return;
    pending.set(k, item);
    if (!timer) timer = setTimeout(flush, delay);
  }

  return {
    /** Configura la cuenta: idioma principal, si traduce solo, y modo demostración. */
    configure({ user, language, autoTranslate = true, isDemo = false }) {
      const changedUser = user !== userKey || isDemo !== demo;
      userKey = user || ''; demo = isDemo;
      lang = LANG_CODES.includes(language) ? language : 'es'; auto = autoTranslate !== false;
      if (changedUser) { restore(); showOriginal.clear(); failed.clear(); disabled = ''; notice = ''; }
    },
    get lang() { return lang; }, get auto() { return auto; }, get disabled() { return disabled; },
    takeNotice() { const n = notice; notice = ''; return n; },
    /**
     * Cómo mostrar un mensaje. item = { source, id, body, mine }.
     * Devuelve { mode, text, original, from, key } donde mode es:
     *   'plain' (no aplica) · 'translated' · 'original' (la persona eligió ver el original)
     *   'pending' · 'offer' (traducción manual disponible) · 'unavailable'
     */
    view(item, { request: ask = true } = {}) {
      const plain = { mode: 'plain', text: item.body, original: item.body, from: null, key: '' };
      if (item.mine || !item.id || item.pending || !translatable(item.body)) return plain;
      const guess = detectLang(item.body);
      if (guess === lang) return plain;
      const k = keyOf(item.source, item.id);
      const hit = cache.get(k);
      if (hit) {
        if (hit.same) return plain;
        if (hit.unavailable) return { ...plain, mode: 'unavailable', from: guess, key: k };
        if (showOriginal.has(k)) return { mode: 'original', text: item.body, original: item.body, from: hit.from || guess, key: k };
        return { mode: 'translated', text: hit.text, original: item.body, from: hit.from || guess, key: k };
      }
      if (inflight.has(k) || pending.has(k)) return { ...plain, mode: 'pending', from: guess, key: k };
      if (disabled || failed.has(k)) return { ...plain, mode: 'offer', from: guess, key: k, retry: true };
      if (!auto) return { ...plain, mode: 'offer', from: guess, key: k };
      if (ask) request(item);
      return { ...plain, mode: 'pending', from: guess, key: k };
    },
    /** Traducción manual (cuando la automática está apagada o falló). */
    translateNow(item) { const k = keyOf(item.source, item.id); failed.delete(k); showOriginal.delete(k); request(item); onUpdate(); },
    toggle(key) { if (showOriginal.has(key)) showOriginal.delete(key); else showOriginal.add(key); onUpdate(); },
    clear() { cache.clear(); showOriginal.clear(); failed.clear(); if (storage && userKey) { try { storage.removeItem(`gvq:tr:${userKey}`); } catch { /* nada */ } } },
    signOut() { userKey = ''; cache = new Map(); pending.clear(); inflight.clear(); failed.clear(); showOriginal.clear(); disabled = ''; },
    stats() { return { cached: cache.size, pending: pending.size, inflight: inflight.size }; }
  };
}
