// GAMVORAQ GUARDIAN: reglas visibles y explicables. NO es moderación automática ni IA: solo ofrece
// una «pausa empática» antes de enviar y deja la decisión a la persona.
/** Un mensaje «grita» si casi todo va en mayúsculas o si encadena varias palabras en mayúsculas.
 *  Una sigla o marca suelta (GAMVORAQ, VALORANT, GG) NO cuenta. */
export function isShouting(text) {
  const t = String(text || '');
  const letters = t.match(/\p{L}/gu) || [];
  if (letters.length >= 12 && letters.filter(c => c !== c.toLowerCase()).length / letters.length >= 0.7) return true;
  return /(?:^|[^\p{L}])(?:\p{Lu}{3,}[^\p{L}]+){2,}\p{Lu}{3,}(?![\p{L}])/u.test(t);
}

const patterns = [
  { code: 'insulto', rx: /\b(?:idiota|imb[eé]cil|est[uú]pido|pendej[oa]|in[uú]til|basura)\b/i, message: 'El texto podría sonar como un ataque personal.' },
  { code: 'hostigamiento', rx: /\b(?:c[aá]llate|nadie te quiere|vete de aqu[ií]|te odio)\b/i, message: 'El mensaje podría resultar hostil.' },
  { code: 'amenaza', rx: /\b(?:te voy a (?:matar|golpear|encontrar|destruir)|voy a ir por ti)\b/i, message: 'Las amenazas (incluso en broma) asustan a otras personas y pueden ser reportadas.' },
  { code: 'privacidad', rx: /(?:\b\d{10}\b|\b\+?\d{1,3}[ -]?\(?\d{2,3}\)?[ -]\d{3,4}[ -]\d{4}\b|[\w.+-]+@[\w-]+\.[\w.-]+)/, message: 'Parece que incluyes un teléfono o correo. Evita compartir datos personales en público.' },
  { code: 'gritos', test: isShouting, message: 'Un mensaje en mayúsculas puede parecer un grito.' }
];

export function guardianCheck(text) {
  if (!text || text.trim().length < 3) return [];
  return patterns.filter(p => (p.test ? p.test(text) : p.rx.test(text))).map(({ code, message }) => ({ code, message }));
}
export function normalizeMessage(text, max = 1200) { return String(text || '').trim().slice(0, max); }

const SOFT = [
  [/\b(?:idiota|imb[eé]cil|est[uú]pido|pendej[oa])\b/gi, 'equivocado'],
  [/\b(?:in[uú]til|basura)\b/gi, 'con margen para mejorar'],
  [/\bc[aá]llate\b/gi, 'prefiero parar esta discusión'],
  [/\b(?:nadie te quiere|vete de aqu[ií]|te odio)\b/gi, 'no estoy de acuerdo contigo']
];
/** Propone una versión más amable (solo una sugerencia; la persona decide). */
export function softenMessage(text) {
  let out = String(text || '');
  for (const [rx, rep] of SOFT) out = out.replace(rx, rep);
  if (isShouting(out)) out = out.toLowerCase().replace(/(^|[.!?¡¿]\s*)(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
  return out;
}
