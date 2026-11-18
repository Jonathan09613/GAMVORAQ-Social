// Sesión «Juntos»: tiempo compartido con VORA (foco, calma o juego) y respiración guiada.
// Funciones puras: el reloj se inyecta para poder probarlas.

export const SESSION_KINDS = {
  focus:  { label: 'Concentrarme', icon: 'brain',     mood: 'focus' },
  relax:  { label: 'Relajarme',    icon: 'coffee',    mood: 'calm' },
  play:   { label: 'Jugar juntos', icon: 'gamepad-2', mood: 'excited' }
};
export const SESSION_MINUTES = [10, 25, 45];

export function startSession(kind, minutes, now = Date.now()) {
  if (!SESSION_KINDS[kind]) kind = 'focus';
  const m = SESSION_MINUTES.includes(minutes) ? minutes : 25;
  return { kind, minutes: m, startedAt: now, durationMs: m * 60000, nudges: 0 };
}
export function remainingMs(session, now = Date.now()) {
  return Math.max(0, session.startedAt + session.durationMs - now);
}
export function sessionProgress(session, now = Date.now()) {
  return Math.min(1, (now - session.startedAt) / session.durationMs);
}
export function formatClock(ms) {
  const s = Math.ceil(ms / 1000), m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
/** ¿Toca un mensaje de ánimo? Se emite uno cada ~25 % del tiempo (máx. 3). */
export function nextNudge(session, now = Date.now()) {
  const p = sessionProgress(session, now);
  const due = p >= 0.75 ? 3 : p >= 0.5 ? 2 : p >= 0.25 ? 1 : 0;
  return due > session.nudges ? due : 0;
}
export const NUDGES = {
  focus: [
    ['Buen ritmo. Un paso a la vez, yo vigilo el reloj.', 'Vas por un cuarto del camino. Respira y sigue.', 'Ya llevas buena parte. Tu futuro yo te lo agradece.'],
    ['Mitad de la sesión. Recuerda sentarte derecho y soltar los hombros.', 'Vas a la mitad. Un sorbo de agua y seguimos.', 'Mitad lista. Lo más difícil ya pasó.'],
    ['Último tramo. Ya casi lo logramos juntos.', 'Falta poquito. Cierra fuerte.', 'Recta final. Yo estoy contigo.']
  ],
  relax: [
    ['Suelta los hombros. No hay prisa.', 'Respira lento. Aquí estoy.', 'Nada que resolver ahora mismo. Solo estar.'],
    ['Mitad de la pausa. Mira algo lejano 20 segundos para descansar los ojos.', 'Vas muy bien. Estira el cuello con calma.', 'Buen momento para un sorbo de agua.'],
    ['Casi terminamos esta pausa. Qué bien se siente parar, ¿no?', 'Un poco más de calma y listo.', 'Último tramo de tranquilidad.']
  ],
  play: [
    ['¡Vamos con todo! Recuerda: juego limpio y buenas vibras.', 'Que no falte el GG al final.', 'Buen arranque. A disfrutar.'],
    ['Mitad de sesión. Estira las manos un momento si hace falta.', '¿Cómo va la partida? Cuéntame después.', 'Hidratación rápida y seguimos.'],
    ['Último tramo de sesión. Cierra con un buen GG.', 'Ya casi. Guarda tu mejor momento para MEMORIES.', 'Final a la vista. ¡Tú puedes!']
  ]
};

// ---- Respiración en caja 4‑4‑4‑4 ----
export const BREATH_PHASES = [
  { id: 'in',   label: 'Inhala',   seconds: 4 },
  { id: 'hold', label: 'Sostén',   seconds: 4 },
  { id: 'out',  label: 'Exhala',   seconds: 4 },
  { id: 'rest', label: 'Pausa',    seconds: 4 }
];
export const BREATH_CYCLE_SECONDS = BREATH_PHASES.reduce((s, p) => s + p.seconds, 0);
export function breathAt(elapsedSeconds) {
  const t = ((elapsedSeconds % BREATH_CYCLE_SECONDS) + BREATH_CYCLE_SECONDS) % BREATH_CYCLE_SECONDS;
  let acc = 0;
  for (const p of BREATH_PHASES) {
    if (t < acc + p.seconds) return { phase: p.id, label: p.label, left: Math.ceil(acc + p.seconds - t), cycle: Math.floor(elapsedSeconds / BREATH_CYCLE_SECONDS) };
    acc += p.seconds;
  }
  return { phase: 'in', label: 'Inhala', left: 4, cycle: 0 };
}
