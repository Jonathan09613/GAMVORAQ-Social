// Bot de Discord por «Interactions» (sin servidor propio): verificación de firma, comandos y respuestas.
export const COMMANDS = [
  { name: 'disponibles', description: 'Quién está disponible para jugar ahora en GAMVORAQ', options: [{ type: 3, name: 'juego', description: 'Filtra por juego (opcional)', required: false }] },
  { name: 'partidas', description: 'Partidas abiertas próximas en GAMVORAQ' },
  { name: 'pasaporte', description: 'Pasaporte GG de un jugador de GAMVORAQ', options: [{ type: 3, name: 'usuario', description: 'Usuario de GAMVORAQ (sin @)', required: true }] }
];
const hex = h => Uint8Array.from(String(h || '').match(/.{1,2}/g) || [], b => parseInt(b, 16));

/** Verifica la firma Ed25519 que Discord envía en cada interacción. */
export async function verifyDiscord(publicKeyHex, signatureHex, timestamp, rawBody) {
  if (!publicKeyHex || !signatureHex || !timestamp) return false;
  try {
    const key = await crypto.subtle.importKey('raw', hex(publicKeyHex), { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, hex(signatureHex), new TextEncoder().encode(timestamp + rawBody));
  } catch { return false; }
}

const LEVELS = [['Recién llegado', 0, 0], ['En camino', 1, 0], ['Confiable', 3, 3], ['Compañero GG', 10, 8], ['Leyenda GG', 30, 20]];
export const level = p => LEVELS.reduce((acc, [l, s, r]) => ((p.sessions || 0) >= s && (p.raters || 0) >= r ? l : acc), LEVELS[0][0]);
const TAG = { entendimos: 'Nos entendimos', comunicacion: 'Buena comunicación', divertido: 'Divertido', amable: 'Amable', puntual: 'Puntual' };
const mins = ms => Math.max(1, Math.round(ms / 60000));
const reply = (content, embeds = []) => ({ type: 4, data: { content, embeds, allowed_mentions: { parse: [] } } });
const appUrl = env => env.APP_URL || 'https://gamvoraq.app';

/**
 * Atiende una interacción. `db` provee: available(game), openSessions(), passport(username).
 * Todos devuelven solo perfiles que activaron «Mostrar en Discord» y que no son de menores.
 */
export async function handleInteraction(body, db, env = {}, now = Date.now()) {
  if (body.type === 1) return { type: 1 };
  if (body.type !== 2) return reply('Interacción no soportada.');
  const name = body.data?.name, opt = n => body.data?.options?.find(o => o.name === n)?.value;
  if (name === 'disponibles') {
    const list = await db.available(opt('juego'));
    if (!list.length) return reply(`Nadie visible está disponible ahora${opt('juego') ? ` para **${opt('juego')}**` : ''}. Márcate en ${appUrl(env)}`);
    return reply(`🎮 **Disponibles ahora en GAMVORAQ**`, [{ color: 0xe11d2e, description: list.slice(0, 10).map(a => `• **${a.name}** — ${a.game || 'cualquier juego'} · ${a.platform || ''} · quedan ${mins(Date.parse(a.until) - now)} min${a.mode === 'silencioso' ? ' · sala tranquila' : ''}`).join('\n'), footer: { text: 'Solo aparecen quienes lo permiten en su perfil' } }]);
  }
  if (name === 'partidas') {
    const list = await db.openSessions();
    if (!list.length) return reply(`No hay partidas abiertas próximas. Crea una en ${appUrl(env)}`);
    return reply('📅 **Partidas abiertas próximas**', [{ color: 0xe11d2e, description: list.slice(0, 8).map(s => `• **${s.title}** — ${s.game || 'Multijuego'} · <t:${Math.floor(Date.parse(s.starts_at) / 1000)}:R> · ${s.going}/${s.capacity} · organiza ${s.host}`).join('\n') }]);
  }
  if (name === 'pasaporte') {
    const p = await db.passport(String(opt('usuario') || '').replace(/^@/, '').toLowerCase());
    if (!p) return reply('No encontré ese usuario, o no permite mostrar su pasaporte en Discord.');
    const tags = Object.entries(p.tags || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, n]) => `${TAG[t] || t} · ${n}`).join(' | ');
    return reply('', [{ color: 0x3ddc97, title: `Pasaporte GG · ${p.name}`, description: `**${level(p)}**\n${p.sessions || 0} partidas jugadas · ${p.raters || 0} personas dieron GG${tags ? `\n${tags}` : ''}`, footer: { text: 'Calificaciones positivas y anónimas · GAMVORAQ' } }]);
  }
  return reply('Comando desconocido.');
}
