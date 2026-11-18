// Idioma de la interfaz (español, inglés, portugués).
// La app se escribe en español; esta capa traduce en vivo los textos de la interfaz (no lo que escriben las personas,
// que tiene su propia traducción automática). Funciona con un diccionario revisado y plantillas con números.
import d1 from './dict1.js';
import d2 from './dict2.js';
import d3 from './dict3.js';
import d4 from './dict4.js';
import d5 from './dict5.js';
import d6 from './dict6.js';

export const UI_LANGS = [['es', 'Español'], ['en', 'English'], ['pt', 'Português']];
const IDX = { en: 0, pt: 1 };
const LOCALE = { es: 'es-MX', en: 'en-US', pt: 'pt-BR' };
const KEY = 'gvq:ui';

const exact = new Map(), templates = [];
for (const dict of [d1, d2, d3, d4, d5, d6]) for (const [es, tr] of Object.entries(dict)) {
  if (es.includes('{n}')) {
    const rx = new RegExp('^' + es.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{n\\\}/g, '(\\d+(?:[.,]\\d+)?)') + '$');
    templates.push([rx, tr]);
  } else exact.set(es, tr);
}

export function detectUiLang(nav = globalThis.navigator) {
  const l = String(nav?.language || 'es').toLowerCase();
  return l.startsWith('pt') ? 'pt' : l.startsWith('en') ? 'en' : 'es';
}
let lang = 'es';
export function initUiLang() {
  let saved = '';
  try { saved = localStorage.getItem(KEY) || ''; } catch { /* sin almacenamiento */ }
  lang = saved ? uiLangFor(saved) : detectUiLang();
  return lang;
}
export const uiLang = () => lang;
export const uiLocale = () => LOCALE[lang] || 'es-MX';
export const uiLangSaved = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; } };
export function setUiLang(value) {
  try { if (value === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, value); } catch { /* nada */ }
  lang = value === 'auto' ? detectUiLang() : uiLangFor(value);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    if (document.body) translateTree(document.body);   // vuelve a traducir TODA la página
  }
  return lang;
}
/** Toda la interfaz se muestra en cualquiera de los 9 idiomas (es/en/pt con diccionario; el resto, traducción automática). */
export const ALL_LANGS = ['es', 'en', 'pt', 'fr', 'it', 'de', 'ja', 'ko', 'zh'];
export const uiLangFor = code => ALL_LANGS.includes(code) ? code : 'en';

// Textos con un nombre o dato variable alrededor de una frase fija.
const WRAPS = [
  [/^(Buenos días|Buenas tardes|Buenas noches), (.+)$/, m => [{ 'Buenos días': ['Good morning', 'Bom dia'], 'Buenas tardes': ['Good afternoon', 'Boa tarde'], 'Buenas noches': ['Good evening', 'Boa noite'] }[m[1]], m[2], (g, n) => `${g}, ${n}`]],
  [/^La compartió (.+)$/, m => [['Shared by', 'Compartilhada por'], m[1], (g, n) => `${g} ${n}`]],
  [/^Escribe a (.+)…$/, m => [['Message', 'Escreva para'], m[1], (g, n) => `${g} ${n}…`]],
  [/^Todo listo, (.+)$/, m => [['All set', 'Tudo pronto'], m[1], (g, n) => `${g}, ${n}`]],
  [/^Agregar (.+)$/, m => [['Add', 'Adicionar'], m[1], (g, n) => `${g} ${n}`]],
  [/^Quitar (.+)$/, m => [['Remove', 'Remover'], m[1], (g, n) => `${g} ${n}`]],
  [/^Cambiar portada de (.+)$/, m => [['Change cover of', 'Mudar capa de'], m[1], (g, n) => `${g} ${n}`]],
  [/^Enviar mensaje a (.+)$/, m => [['Message', 'Mensagem para'], m[1], (g, n) => `${g} ${n}`]],
  [/^Escribir a (.+)$/, m => [['Message', 'Escrever para'], m[1], (g, n) => `${g} ${n}`]],
  [/^Saludar a (.+) sin mensaje$/, m => [['Wave at', 'Acenar para'], m[1], (g, n) => `${g} ${n}`]],
  [/^Publicación de (.+)$/, m => [['Post by', 'Publicação de'], m[1], (g, n) => `${g} ${n}`]],
  [/^Seguidores de (.+)$/, m => [['Followers of', 'Seguidores de'], m[1], (g, n) => `${g} ${n}`]],
  [/^Sigue a (.+)$/, m => [['Followed by', 'Seguidos por'], m[1], (g, n) => `${g} ${n}`]],
  [/^Organiza: (.+)$/, m => [['Organizer:', 'Organiza:'], m[1], (g, n) => `${g} ${n}`]],
  [/^Invitar a (.+)$/, m => [['Invite to', 'Convidar para'], m[1], (g, n) => `${g} ${n}`]],
  [/^Portada de (.+)$/, m => [['Cover of', 'Capa de'], m[1], (g, n) => `${g} ${n}`]],
  [/^te invitó (.+)$/, m => [['invited by', 'convidou'], m[1], (g, n) => `${g} ${n}`]],
  [/^invitó (.+)$/, m => [['invited by', 'convidado por'], m[1], (g, n) => `${g} ${n}`]],
  [/^Hasta (.+)$/, m => [['Until', 'Até'], m[1], (g, n) => `${g} ${n}`]],
  [/^Cerró (.+)$/, m => [['Closed', 'Encerrou'], m[1], (g, n) => `${g} ${n}`]],
  [/^(.+): (aprobó|rechazó|pendiente)$/, m => [{ aprobó: ['approved', 'aprovou'], rechazó: ['declined', 'recusou'], pendiente: ['pending', 'pendente'] }[m[2]], m[1], (g, n) => `${n}: ${g}`]],
  [/^Visto (.+)$/, m => [['Seen', 'Visto'], translate(m[1]), (g, n) => `${g} ${n}`]],
  [/^próxima: (.+)$/, m => [['next:', 'próxima:'], m[1], (g, n) => `${g} ${n}`]],
  [/^organiza (.+)$/, m => [['hosted by', 'organiza'], m[1], (g, n) => `${g} ${n}`]],
  [/^Squads?: (.+)$/, m => [[m[0].startsWith('Squads') ? 'Squads:' : 'Squad:', m[0].startsWith('Squads') ? 'Squads:' : 'Squad:'], m[1], (g, n) => `${g} ${n}`]],
  [/^Tu próxima partida: «(.+)»\.$/, m => [['Your next match:', 'Sua próxima partida:'], m[1], (g, n) => `${g} “${n}”.`]],
  [/^Te ofreces como guía en: (.+)$/, m => [['You offer to guide in:', 'Você se oferece como guia em:'], m[1], (g, n) => `${g} ${n}`]],
  [/^Dejar de ser guía en (.+)$/, m => [['Stop guiding in', 'Deixar de ser guia em'], m[1], (g, n) => `${g} ${n}`]],
  [/^quiere aprender (.+)$/, m => [['wants to learn', 'quer aprender'], m[1], (g, n) => `${g} ${n}`]],
  [/^¿Cómo te fue en «(.+)»\?$/, m => [['How did it go in', 'Como foi em'], m[1], (g, n) => `${g} “${n}”?`]],
  [/^Tú: (.+)$/, m => [['You:', 'Você:'], m[1], (g, n) => `${g} ${n}`]],
  [/^Hoy se cumple (\d+) (año|años|mes|meses) desde que entraste a (.+)$/, m => [[`Today marks ${m[1]} ${/año/.test(m[2]) ? (m[1] === '1' ? 'year' : 'years') : (m[1] === '1' ? 'month' : 'months')} since you joined`, `Hoje faz ${m[1]} ${/año/.test(m[2]) ? (m[1] === '1' ? 'ano' : 'anos') : (m[1] === '1' ? 'mês' : 'meses')} que você entrou em`], m[3], (g, n) => `${g} ${n}`]],
  [/^(\d+) mensajes? nuevos? en (.+)$/, m => [[`${m[1]} new message${m[1] === '1' ? '' : 's'} in`, `${m[1]} mensage${m[1] === '1' ? 'm nova' : 'ns novas'} em`], m[2], (g, n) => `${g} ${n}`]],
  [/^(Hoy|Mañana|Ayer) (\d.*)$/, m => [{ Hoy: ['Today', 'Hoje'], Mañana: ['Tomorrow', 'Amanhã'], Ayer: ['Yesterday', 'Ontem'] }[m[1]], m[2], (g, n) => `${g} ${n}`]]
];
const AGO = [[/^hace (\d+) minutos?$/, ['{n} min ago', 'há {n} min']], [/^hace (\d+) horas?$/, ['{n} h ago', 'há {n} h']], [/^hace (\d+) días?$/, ['{n} days ago', 'há {n} dias']], [/^dentro de (\d+) minutos?$/, ['in {n} min', 'em {n} min']], [/^dentro de (\d+) horas?$/, ['in {n} h', 'em {n} h']], [/^ahora$/, ['now', 'agora']]];

/**
 * Traduce un texto de la interfaz al idioma elegido.
 * Español, inglés y portugués: diccionario propio (+ traducción automática para lo que falte).
 * Francés, italiano, alemán, japonés, coreano y chino: se toma la versión en inglés del diccionario
 * y se traduce automáticamente (se guarda en el dispositivo); mientras llega, se muestra en inglés.
 */
export function translate(text) {
  if (lang === 'es' || !text) return text;
  if (lang in IDX) return dictTranslate(text, lang);
  const s = text.trim(); if (!s) return text;
  const c = machine.cache[lang] || {};
  const en = dictTranslate(text, 'en', true), es = en.trim();
  if (en !== text || exact.has(s)) { if (c['en|' + es]) return en.replace(es, c['en|' + es]); queueMachine(es, 'en'); return en; }
  if (c[s]) return text.replace(s, c[s]);
  if (looksSpanish(s)) queueMachine(s, 'es');
  return text;
}
function dictTranslate(text, l, noMachine = false) {
  const i = IDX[l], s = text.trim();
  if (!s) return text;
  const hit = exact.get(s);
  if (hit) return text.replace(s, hit[i]);
  if (/\d/.test(s)) {
    for (const [rx, tr] of templates) {
      const m = s.match(rx); if (!m) continue;
      let k = 1; return text.replace(s, tr[i].replace(/\{n\}/g, () => m[k++] ?? ''));
    }
    for (const [rx, tr] of AGO) { const m = s.match(rx); if (m) return text.replace(s, tr[i].replace('{n}', m[1])); }
  } else for (const [rx, tr] of AGO) { const m = s.match(rx); if (m) return text.replace(s, tr[i]); }
  for (const [rx, fn] of WRAPS) {
    const m = s.match(rx); if (!m) continue;
    const [pair, rest, join] = fn(m); return text.replace(s, join(pair[i], rest));
  }
  if (s.startsWith('· ')) { const r = dictTranslate(s.slice(2), l, noMachine); if (r !== s.slice(2)) return text.replace(s, '· ' + r); }
  if (s.includes(' · ')) {
    const parts = s.split(' · '), out = parts.map(p => dictTranslate(p, l, noMachine));
    if (out.some((p, j) => p !== parts[j])) return text.replace(s, out.join(' · '));
  }
  if (noMachine) return text;
  // Lo que no está en el diccionario: traducción automática (se pide una vez y queda guardada en el dispositivo).
  const mt = machine.cache[l]?.[s];
  if (mt) return text.replace(s, mt);
  if (looksSpanish(s)) queueMachine(s, 'es');
  return text;
}

// ───────────── Traducción automática de respaldo para la interfaz ─────────────
// Garantiza que TODA la página cambie de idioma: los textos que el diccionario no conoce
// (géneros de juegos, avisos nuevos, descripciones…) se traducen en lotes y se guardan en caché.
const machine = { fn: null, cache: {}, queue: new Map(), asked: new Set(), timer: null, pauseUntil: 0 };
const ES_WORDS = /\b(el|la|los|las|de|del|que|para|con|por|una|uno|tu|tus|mi|su|sus|en|es|son|y|o|al|se|no|más|muy|ya|sin|hay|como|este|esta|aquí|puedes|tienes|todos|nadie|cada|juego|juegos|videojuego|cualquier|nuevo|nueva)\b/i;
const ES_SUFFIX = /(ción|ciones|dad|dades|mente|ando|iendo|ado|ada|ados|adas|ido|ida|encia|ancia|aje|ismo|orma|juego|ía|iva|ivo|ivas|ivos|osa|oso|ero|era|eros|eras|ista|istas)$/i;
export function looksSpanish(s) {
  if (s.length < 3 || s.length > 600 || !/[a-záéíóúñ]/i.test(s) || /^[\W\d_]+$/.test(s) || /^https?:|@\w+$|^#/.test(s)) return false;
  if (/[áéíóúñ¿¡]/i.test(s)) return true;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length === 1) return ES_SUFFIX.test(s) && /^[a-záéíóúñ]+$/i.test(s);
  const title = words.every(w => /^[A-ZÁÉÍÓÚÑ0-9]/.test(w));   // «Los Pros», «Dragon Ball»: nombres propios, no se traducen
  if (title && words.length < 4) return false;
  // Varias palabras que no son un nombre propio: se traducen (si ya estaban en inglés, vuelven igual).
  return ES_WORDS.test(s) || words.length >= 2;
}
function queueMachine(s, from = 'es') {
  if (!machine.fn || Date.now() < machine.pauseUntil || machine.asked.has(lang + '|' + from + '|' + s)) return;
  machine.asked.add(lang + '|' + from + '|' + s); machine.queue.set(s, from);
  clearTimeout(machine.timer); machine.timer = setTimeout(flushMachine, 250);
}
async function flushMachine() {
  const target = lang, all = [...machine.queue.entries()]; machine.queue.clear();
  if (!all.length || target === 'es') return;
  for (const from of ['en', 'es']) {
    const list = all.filter(([, f]) => f === from).map(([src]) => src);
    for (let i = 0; i < list.length; i += 40) {
      const batch = list.slice(i, i + 40);
      let out = null;
      try { out = await machine.fn(batch, target, from); } catch { out = null; }
      if (!out || !out.some(Boolean)) { machine.pauseUntil = Date.now() + 60000; batch.forEach(src => machine.asked.delete(target + '|' + from + '|' + src)); continue; }
      const c = (machine.cache[target] ||= {});
      // Lo que no llegó se vuelve a pedir más tarde (por ejemplo, si se cortó la conexión).
      batch.forEach((src, j) => { const t = out[j]; if (t && t.trim() && t.trim() !== src) c[from === 'en' ? 'en|' + src : src] = t.trim(); else if (!t) machine.asked.delete(target + '|' + from + '|' + src); });
      try { localStorage.setItem('gvq:mt:' + target, JSON.stringify(c)); } catch { /* sin espacio */ }
      if (lang === target && typeof document !== 'undefined') translateTree(document.body);   // se ve avanzar por partes
    }
  }
}
/** Conecta el traductor automático (lista de textos en español → lista traducida). */
export function useMachineTranslation(fn) {
  machine.fn = fn;
  for (const l of ALL_LANGS) { try { machine.cache[l] = JSON.parse(localStorage.getItem('gvq:mt:' + l) || '{}'); } catch { machine.cache[l] = {}; } }
}

// ───────────── Aplicar a la página ─────────────
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
// Lo que escriben las personas no se toca: tiene su propia traducción automática.
const SKIP = 'script,style,textarea,[data-noi18n],.tr-body,.tr-text,.vp-msg.me,.memory-card p,.report-snap,code,pre';
// Por cada nodo se recuerda el texto original (en español) y la última traducción que pusimos.
// Así se puede cambiar de idioma cuantas veces se quiera (es → en → pt → es) sin perder el original.
const seen = new WeakMap();
function translateTextNode(n) {
  const p = n.parentElement; if (!p || p.closest(SKIP)) return;
  const rec = seen.get(n), now = n.nodeValue;
  const src = rec && now === rec.out ? rec.src : now;   // si la app cambió el texto, ese es el nuevo original
  if (!/[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(src)) return;
  const out = translate(src);
  if (out === src && !rec) return;
  seen.set(n, { src, out });
  if (now !== out) n.nodeValue = out;
}
const SKIP_ATTR = SKIP.replace('textarea,', '');
function translateElement(el) {
  if (el.closest?.(SKIP_ATTR)) return;
  for (const a of ATTRS) {
    const v = el.getAttribute?.(a); if (!v) continue;
    const key = 'data-i18n-' + a, stored = el.getAttribute(key), last = el.getAttribute(key + '-out');
    const src = stored != null && v === last ? stored : v, out = translate(src);
    if (out === src && stored == null) continue;
    if (stored !== src) el.setAttribute(key, src);
    if (last !== out) el.setAttribute(key + '-out', out);
    if (v !== out) el.setAttribute(a, out);
  }
}
export function translateTree(root = document.body) {
  if (!root) return;
  if (root.nodeType === 3) { translateTextNode(root); return; }
  if (root.nodeType !== 1) return;
  translateElement(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n; while ((n = walker.nextNode())) { if (n.nodeType === 3) translateTextNode(n); else translateElement(n); }
}
let observer = null;
/** Observa la página y traduce lo que se dibuja (la app vuelve a pintar las vistas a menudo). */
export function startUiTranslation() {
  document.documentElement.lang = lang;
  if (observer || typeof MutationObserver === 'undefined') { translateTree(); return; }
  observer = new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'characterData') translateTextNode(m.target);
      else if (m.type === 'attributes') translateElement(m.target);
      else m.addedNodes.forEach(node => translateTree(node));
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  translateTree();
  // Diálogos del navegador (confirmar, preguntar).
  const c = window.confirm.bind(window), p = window.prompt.bind(window);
  window.confirm = msg => c(translate(String(msg)));
  window.prompt = (msg, def) => p(translate(String(msg)), def);
}
