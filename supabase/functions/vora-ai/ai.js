// Lógica de la IA de VORA: instrucciones, limpieza del historial y proveedores (Anthropic u OpenAI-compatible).
const LANG = { es: 'español', en: 'inglés', pt: 'portugués', fr: 'francés', it: 'italiano', de: 'alemán', ja: 'japonés', ko: 'coreano', zh: 'chino' };

export function systemPrompt({ name = 'VORA', nick = '', language = 'es', minor = false, mode = 'chat' } = {}) {
  const lang = LANG[language] || 'español';
  return [
    `Eres ${name}, el compañero virtual de GAMVORAQ, una red social gamer que cuida a su comunidad.`,
    `Responde SIEMPRE en ${lang}, con calidez, en 1 a 4 frases cortas. Usa como mucho un emoji.`,
    nick ? `La persona se llama ${nick}.` : '',
    'Ayudas con videojuegos, a encontrar equipo, a organizar partidas, a manejar la frustración (tilt) y a convivir con respeto.',
    'Nunca pidas datos personales (dirección, teléfono, escuela, fotos). Si te los dan, recomienda no compartirlos en línea.',
    'No das consejos médicos, legales ni financieros. No generas contenido sexual, violento explícito ni de odio.',
    'Si la persona habla de hacerse daño, de suicidio o de estar en peligro: responde con empatía, anímala a hablar con alguien de confianza y comparte la Línea de la Vida (800 911 2000, México) o el 911.',
    minor ? 'La persona es menor de edad: sé especialmente cuidadoso, recomiéndale hablar con un adulto de confianza ante cualquier problema y no hables de temas para adultos.' : '',
    mode === 'coach' ? 'Ahora actúas como COACH de partida: con lo que te cuenten, da exactamente 3 consejos concretos y accionables en una lista numerada, y termina con una frase de ánimo. No inventes estadísticas.' : ''
  ].filter(Boolean).join('\n');
}

/** Historial seguro para el modelo: roles válidos, alternados, empieza por el usuario, tamaño acotado. */
export function cleanHistory(history = [], text = '', maxTurns = 8, maxLen = 500) {
  const items = [...(Array.isArray(history) ? history : []), { role: 'user', content: text }]
    .map(m => ({ role: m.role === 'assistant' || m.role === 'vora' ? 'assistant' : 'user', content: String(m.content ?? m.text ?? '').trim().slice(0, maxLen) }))
    .filter(m => m.content);
  const merged = [];
  for (const m of items) { const last = merged.at(-1); if (last && last.role === m.role) last.content = `${last.content}\n${m.content}`.slice(-maxLen * 2); else merged.push({ ...m }); }
  let out = merged.slice(-maxTurns * 2);
  while (out.length && out[0].role !== 'user') out = out.slice(1);
  return out;
}

export function coachText({ game = '', result = '', notes = '' } = {}) {
  const r = { win: 'ganamos', loss: 'perdimos', draw: 'empatamos' }[result] || 'sin resultado';
  return `Juego: ${String(game).slice(0, 60) || 'no indicado'}. Resultado: ${r}. Lo que pasó: ${String(notes).slice(0, 700) || 'sin detalles'}`;
}

export function anthropic({ key, model, fetch: f = fetch }) {
  return {
    name: 'anthropic',
    async complete(system, messages, maxTokens = 350) {
      const res = await f('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages })
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
      const data = await res.json();
      return (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
    }
  };
}
export function openaiCompatible({ key, model, baseUrl = 'https://api.openai.com/v1', fetch: f = fetch }) {
  return {
    name: 'openai',
    async complete(system, messages, maxTokens = 350) {
      const res = await f(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, ...messages] })
      });
      if (!res.ok) throw new Error(`IA ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
      const data = await res.json();
      return String(data.choices?.[0]?.message?.content || '').trim();
    }
  };
}
export function pickAi(env, f = fetch) {
  if (env.ANTHROPIC_API_KEY) return anthropic({ key: env.ANTHROPIC_API_KEY, model: env.VORA_MODEL || 'claude-haiku-5-5', fetch: f });
  if (env.AI_API_KEY && env.AI_MODEL) return openaiCompatible({ key: env.AI_API_KEY, model: env.AI_MODEL, baseUrl: env.AI_BASE_URL || undefined, fetch: f });
  return null;
}
