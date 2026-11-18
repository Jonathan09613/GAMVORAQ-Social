// Plantillas HTML del panel de VORA (puras: reciben datos y devuelven texto). La lógica vive en vora.js.
import { e, icon, progress } from '../ui.js';
import { PALETTES, VIBES, ACCESSORIES, EYES, MOUTHS, EARS, SHELLS } from './memory.js';
import { avatarSvg } from './avatar.js';
import { bondLevel, levelFromXp, ACHIEVEMENTS } from './gamification.js';
import { SESSION_KINDS, SESSION_MINUTES, formatClock, remainingMs, sessionProgress, BREATH_PHASES } from './session.js';
import { AMBIENT_OPTIONS } from './ambient.js';
import { RPS } from './minigames.js';
import { WATER_GOAL, reminderWhen, COMMANDS } from './tools.js';

export const TABS = [
  ['chat', 'message-circle', 'Chat'],
  ['together', 'timer', 'Juntos'],
  ['games', 'dices', 'Juegos'],
  ['tools', 'wand-sparkles', 'Útiles'],
  ['me', 'sparkles', 'Yo']
];

export function tabsHtml(active) {
  return TABS.map(([id, ic, label]) => `<button type="button" role="tab" class="vp-tab ${active === id ? 'on' : ''}" aria-selected="${active === id}" data-v="tab" data-id="${id}">${icon(ic, 16)}<span>${label}</span></button>`).join('');
}

export function chatHtml(history, name) {
  if (!history.some(m => m.who === 'me')) {
    return `<div class="vp-msg bot"><div class="vp-bub">Hola, soy ${e(name)}. Charlo contigo, te pongo al día, planeo tu noche, armo equipos, te recuerdo cosas y juego contigo. Toca una opción o escribe <b>/</b> para ver comandos.</div></div>
    ${history.map(m => `<div class="vp-msg bot"><div class="vp-bub">${e(m.text).replace(/\n/g, '<br>')}</div></div>`).join('')}
    <div class="vp-quick">${QUICK.map(([a, ic, l]) => `<button type="button" data-v="chip" data-a="${e(a)}">${icon(ic, 18)}<span>${l}</span></button>`).join('')}</div>`;
  }
  return history.map(m => `<div class="vp-msg ${m.who === 'me' ? 'me' : 'bot'}"><div class="vp-bub">${e(m.text).replace(/\n/g, '<br>')}</div></div>`).join('');
}
const QUICK = [['say:/resumen', 'newspaper', 'Ponme al día'], ['say:/plan', 'calendar-clock', 'Planear mi noche'], ['panel:tools', 'users', 'Armar equipos'], ['say:/dado', 'dices', 'Lanzar dado'], ['panel:games', 'gamepad-2', 'Mini-juegos'], ['session:start', 'timer', 'Sesión de foco']];
/** Sugerencias de comandos mientras se escribe «/». */
export function commandHints(q = '') {
  const t = q.toLowerCase();
  return COMMANDS.filter(([c]) => c.startsWith(t.split(' ')[0]) || t === '/').slice(0, 6).map(([c, d]) => ({ l: c.split(' ')[0], a: 'fill:' + c, title: d }));
}
export const typingHtml = () => '<div class="vp-msg bot" data-typing><div class="vp-bub vp-typing" aria-label="VORA está escribiendo"><i></i><i></i><i></i></div></div>';
export function chipsHtml(chips = []) {
  return chips.slice(0, 6).map(c => `<button type="button" class="vp-chip" data-v="chip" data-a="${e(c.a)}" ${c.title ? `title="${e(c.title)}"` : ''}>${e(c.l)}</button>`).join('');
}

const seg = (items, current, v) => `<div class="vp-seg" role="group">${items.map(([id, label, ic]) => `<button type="button" class="${current === id ? 'on' : ''}" data-v="${v}" data-id="${e(id)}" aria-pressed="${current === id}">${ic ? icon(ic, 15) : ''}${e(label)}</button>`).join('')}</div>`;

export function togetherHtml({ session, breath, setup, finished, now = Date.now() }) {
  if (breath) {
    return `<div class="vp-card vp-center"><h4>Respiremos juntos</h4><div class="vp-breath" data-phase="in" id="vp-breath"><div class="vp-breath-orb"></div><div class="vp-breath-text"><b id="vp-breath-label">Inhala</b><span id="vp-breath-left">4</span></div></div><p class="vp-muted">Respiración en caja: 4 segundos por fase. Sigue el círculo.</p><button type="button" class="btn btn-soft btn-sm" data-v="breath-stop">Terminar</button></div>`;
  }
  if (session) {
    const k = SESSION_KINDS[session.kind], left = remainingMs(session, now), pct = sessionProgress(session, now) * 100;
    const C = 2 * Math.PI * 54;
    return `<div class="vp-card vp-center"><div class="eyebrow">${e(k.label)} · ${session.minutes} min</div>
      <div class="vp-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" class="bg"/><circle cx="60" cy="60" r="54" class="fg" id="vp-ring-fg" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct / 100)).toFixed(1)}"/></svg><div class="vp-ring-t"><b id="vp-time">${formatClock(left)}</b><span>restante</span></div></div>
      <p class="vp-muted" id="vp-session-note">VORA está contigo. Si necesitas parar, no pasa nada.</p>
      <button type="button" class="btn btn-soft btn-sm" data-v="session-stop">Terminar sesión</button></div>`;
  }
  const done = finished ? `<div class="vp-card vp-win">${icon('party-popper', 20)}<div><b>¡Sesión completada!</b><span>+${finished.xp} XP · vínculo +${finished.bond}</span></div></div>` : '';
  return `${done}<div class="vp-card"><h4>Sesión «Juntos»</h4><p class="vp-muted">Elige qué harás y cuánto tiempo. VORA se queda contigo, te anima y celebra al final.</p>
    <label class="vp-lab">¿Qué haremos?</label>${seg(Object.entries(SESSION_KINDS).map(([id, k]) => [id, k.label, k.icon]), setup.kind, 'session-kind')}
    <label class="vp-lab">Duración</label>${seg(SESSION_MINUTES.map(m => [String(m), `${m} min`]), String(setup.minutes), 'session-min')}
    <label class="vp-lab">Sonido ambiente <small>(opcional)</small></label>${seg(AMBIENT_OPTIONS.map(a => [a.id, a.label, a.icon]), setup.ambient, 'session-amb')}
    <button type="button" class="btn btn-primary" style="width:100%;margin-top:14px" data-v="session-start">${icon('play', 16)} Empezar sesión</button></div>
    <div class="vp-card"><h4>Pausa de respiración</h4><p class="vp-muted">Un minuto de respiración en caja para bajar el ritmo.</p><button type="button" class="btn btn-soft btn-sm" data-v="breath-start">${icon('wind', 15)} Respirar juntos</button></div>`;
}

const GAMES = [
  ['trivia', 'brain', 'Trivia gamer', '5 preguntas de videojuegos.', sc => `Mejor: ${sc.trivia || 0}/5`],
  ['emoji', 'smile', 'Adivina el juego', 'Reconoce el juego por sus emojis.', sc => `Mejor: ${sc.emoji || 0}/5`],
  ['reflex', 'zap', 'Reflejos', 'Toca cuando se ponga verde.', sc => sc.reflex ? `Récord: ${sc.reflex} ms` : 'Sin récord'],
  ['memory', 'layers', 'Memoria', 'Encuentra las 6 parejas.', sc => sc.memory ? `Récord: ${sc.memory} mov.` : 'Sin récord'],
  ['rps', 'hand', 'Piedra, papel o tijera', 'Al mejor de 5 contra VORA.', sc => `Victorias: ${sc.rps || 0}`]
];
export function gamesHtml({ game, scores }) {
  if (!game) {
    return `<div class="vp-games">${GAMES.map(([id, ic, t, d, s]) => `<button type="button" class="vp-gcard" data-v="game" data-id="${id}"><span class="vp-gi">${icon(ic, 22)}</span><span><b>${t}</b><small>${d}</small></span><em>${s(scores)}</em></button>`).join('')}</div><p class="vp-muted" style="padding:0 4px">Cada partida suma XP, avanza tus misiones y fortalece el vínculo con VORA.</p>`;
  }
  const label = (GAMES.find(g => g[0] === game.type) || GAMES[0])[2];
  const back = `<button type="button" class="vp-back" data-v="game-exit">${icon('arrow-left', 15)} ${label}</button>`;
  const again = `<button class="btn btn-primary btn-sm" data-v="game" data-id="${game.type}">Jugar otra vez</button>`;
  if (game.type === 'trivia' || game.type === 'emoji') {
    if (game.done) return `${back}<div class="vp-card vp-center"><div class="vp-big">${game.score}/${game.questions.length}</div><p>${game.score >= 5 ? '¡Perfecto! 🏆' : game.score >= 3 ? '¡Muy buen resultado!' : 'Buen intento. ¡La revancha te espera!'}</p><p class="vp-muted">+${game.xp} XP</p>${again}</div>`;
    const q = game.questions[game.i];
    return `${back}<div class="vp-card"><div class="vp-q-meta"><span>Ronda ${game.i + 1}/${game.questions.length}</span><span>Aciertos: ${game.score}</span></div>${game.type === 'emoji' ? `<div class="vp-emoji" aria-label="Pista en emojis">${e(q.q)}</div><h4>¿Qué juego es?</h4>` : `<h4>${e(q.q)}</h4>`}<div class="vp-opts">${q.options.map((o, i) => {
      const cls = game.picked == null ? '' : i === q.correct ? 'ok' : i === game.picked ? 'bad' : 'dim';
      return `<button type="button" class="vp-opt ${cls}" data-v="trivia-pick" data-id="${i}" ${game.picked == null ? '' : 'disabled'}>${e(o)}</button>`;
    }).join('')}</div>${game.picked != null ? `<div class="vp-feedback ${game.picked === q.correct ? 'ok' : 'bad'}">${game.picked === q.correct ? '¡Correcto! +3 XP' : 'Casi. Era «' + e(q.options[q.correct]) + '».'}</div><button class="btn btn-primary btn-sm" data-v="trivia-next">${game.i + 1 >= game.questions.length ? 'Ver resultado' : 'Siguiente'}</button>` : ''}</div>`;
  }
  if (game.type === 'reflex') {
    const st = game.state;
    const pad = `<button type="button" class="vp-reflex ${st}" data-v="reflex-tap" aria-live="polite">${st === 'ready' ? `${icon('zap', 30)}<b>Toca para empezar</b><small>Cuando se ponga verde, toca lo más rápido que puedas.</small>` : st === 'wait' ? '<b>Espera…</b><small>No toques todavía.</small>' : st === 'go' ? '<b>¡AHORA!</b>' : st === 'early' ? `<b>¡Muy pronto!</b><small>Toca para intentarlo otra vez.</small>` : `<b>${game.ms} ms</b><small>${e(game.grade)} · +${game.xp} XP · toca para repetir</small>`}</button>`;
    return `${back}<div class="vp-card">${pad}<div class="vp-q-meta" style="margin-top:10px"><span>Intentos: ${game.tries}</span><span>Récord: ${scores.reflex ? scores.reflex + ' ms' : '—'}</span></div></div>`;
  }
  if (game.type === 'memory') {
    const m = game.mem;
    return `${back}<div class="vp-card"><div class="vp-q-meta"><span>Movimientos: ${m.moves}</span><span>Parejas: ${m.matches}/${m.pairs}</span></div><div class="vp-mem">${m.cards.map((c, i) => `<button type="button" class="vp-mcard ${c.open || c.matched ? 'open' : ''} ${c.matched ? 'matched' : ''}" data-v="mem-flip" data-id="${i}" aria-label="${c.open || c.matched ? c.icon : 'Carta oculta'}" ${c.matched ? 'disabled' : ''}><span class="f">${icon('sparkles', 16)}</span><span class="b" data-i="${e(c.icon)}">${icon(c.icon, 22)}</span></button>`).join('')}</div>${m.done ? `<div class="vp-feedback ok">¡Completado en ${m.moves} movimientos! +${game.xp} XP</div>${again}` : ''}</div>`;
  }
  if (game.type === 'rps') {
    const last = game.last;
    return `${back}<div class="vp-card vp-center"><div class="vp-score"><span><small>Tú</small><b>${game.me}</b></span><em>vs</em><span><small>VORA</small><b>${game.bot}</b></span></div>
      ${last ? `<div class="vp-rps-show"><span>${RPS.find(r => r[0] === last.me)[2]}</span><i>${last.res === 'win' ? 'Ganas' : last.res === 'lose' ? 'Pierdes' : 'Empate'}</i><span>${RPS.find(r => r[0] === last.bot)[2]}</span></div>` : '<p class="vp-muted">Gana quien llegue primero a 3.</p>'}
      ${game.done ? `<div class="vp-feedback ${game.me > game.bot ? 'ok' : 'bad'}">${game.me > game.bot ? '¡Me ganaste! +12 XP 🏆' : 'Gané yo esta vez. +4 XP por jugar'}</div>${again}` : `<div class="vp-rps">${RPS.map(([id, l, em]) => `<button type="button" data-v="rps" data-id="${id}"><span>${em}</span><small>${l}</small></button>`).join('')}</div>`}</div>`;
  }
  return back;
}

/** Pestaña «Útiles»: herramientas rápidas para jugar mejor con tu gente. */
export function toolsHtml({ t, mem, today, libraryHint = [], now = Date.now() }) {
  const water = mem.water?.day === today ? mem.water.count : 0;
  const reminders = (mem.reminders || []).filter(r => r.at > now).sort((a, b) => a.at - b.at);
  const segBtns = (items, cur, v) => `<div class="vp-seg">${items.map(([id, l]) => `<button type="button" class="${String(cur) === String(id) ? 'on' : ''}" data-v="${v}" data-id="${id}">${l}</button>`).join('')}</div>`;
  return `
  <div class="vp-card vp-tool"><h4>${icon('dices', 17)} Dados y moneda</h4>
    <div class="vp-dice-row">${['d6', '2d6', 'd20', 'd100'].map(d => `<button type="button" class="vp-pill" data-v="tool-dice" data-id="${d}">${d}</button>`).join('')}<button type="button" class="vp-pill" data-v="tool-coin">${icon('circle-dot', 14)} Moneda</button></div>
    ${t.dice ? `<div class="vp-result ${t.diceAnim ? 'pop' : ''}" aria-live="polite">${e(t.dice)}</div>` : ''}</div>

  <div class="vp-card vp-tool"><h4>${icon('target', 17)} Ruleta: ¿a qué jugamos?</h4>
    <textarea class="input vp-ta" data-v-input="wheel" rows="2" maxlength="400" placeholder="Opciones separadas por coma">${e(t.wheelText || libraryHint.slice(0, 6).join(', '))}</textarea>
    <button type="button" class="btn btn-primary btn-sm btn-block" data-v="tool-wheel">${icon('refresh-cw', 15)} Girar</button>
    ${t.wheel ? `<div class="vp-result ${t.wheelAnim ? 'spin' : ''}" aria-live="polite">${icon('trophy', 16)} ${e(t.wheel)}</div>` : ''}</div>

  <div class="vp-card vp-tool"><h4>${icon('users', 17)} Armar equipos parejos</h4>
    <textarea class="input vp-ta" data-v-input="teams" rows="2" maxlength="600" placeholder="Nombres separados por coma: Ana, Leo, Sofi, Max">${e(t.teamsText || '')}</textarea>
    ${segBtns([[2, '2 equipos'], [3, '3'], [4, '4']], t.teamsN || 2, 'tool-teams-n')}
    <button type="button" class="btn btn-primary btn-sm btn-block" data-v="tool-teams">${icon('shuffle', 15)} Repartir</button>
    ${t.teams ? `<div class="vp-teams">${t.teams.map((tm, i) => `<div><b>${e(tm.name)}</b><span>${tm.list.map(e).join(' · ')}</span></div>`).join('')}</div>` : ''}</div>

  <div class="vp-card vp-tool"><h4>${icon('calendar-clock', 17)} Planear mi noche</h4>
    ${segBtns([[1, '1 h'], [2, '2 h'], [3, '3 h'], [4, '4 h']], t.planH || 2, 'tool-plan-h')}
    ${segBtns([['chill', 'Tranquila'], ['social', 'Con mi squad'], ['competir', 'Competitiva']], t.planMood || 'chill', 'tool-plan-mood')}
    <button type="button" class="btn btn-primary btn-sm btn-block" data-v="tool-plan">${icon('wand-sparkles', 15)} Crear plan</button>
    ${t.plan ? `<ol class="vp-plan">${t.plan.steps.map(st => `<li><time>${st.at}</time><span>${icon(st.icon, 14)} ${e(st.text)}</span><em>${st.mins} min</em></li>`).join('')}</ol><p class="vp-muted">Terminas a las <b>${t.plan.ends}</b>.${t.plan.warning ? ' ' + e(t.plan.warning) : ''}</p>` : ''}</div>

  <div class="vp-card vp-tool"><h4>${icon('bell-ring', 17)} Recordatorios</h4>
    <form class="vp-rem-form" data-v-form="reminder"><input class="input" name="text" maxlength="80" placeholder="¿Qué te recuerdo? (tomar agua, partida…)" required>
    ${segBtns([[5, '5 min'], [15, '15'], [30, '30'], [60, '1 h']], t.remMin || 15, 'tool-rem-min')}
    <button class="btn btn-soft btn-sm btn-block" type="submit">${icon('plus', 15)} Crear recordatorio</button></form>
    ${reminders.length ? `<ul class="vp-rems">${reminders.map(r => `<li>${icon('clock', 14)}<span><b>${e(r.text)}</b><small>${reminderWhen(r.at, now)}</small></span><button type="button" class="vp-icon" data-v="rem-del" data-id="${e(r.id)}" aria-label="Quitar recordatorio">${icon('x', 14)}</button></li>`).join('')}</ul>` : '<p class="vp-muted">Sin recordatorios. También puedes escribir «recuérdame en 20 minutos estirar».</p>'}</div>

  <div class="vp-card vp-tool"><h4>${icon('droplet', 17)} Agua de hoy</h4>
    <div class="vp-water" aria-label="${water} de ${WATER_GOAL} vasos">${Array.from({ length: WATER_GOAL }, (_, i) => `<i class="${i < water ? 'on' : ''}"></i>`).join('')}</div>
    <div class="row"><button type="button" class="btn btn-soft btn-sm" data-v="water" data-id="-1" ${water ? '' : 'disabled'} aria-label="Quitar un vaso">−</button><b class="grow" style="text-align:center">${water}/${WATER_GOAL} vasos</b><button type="button" class="btn btn-primary btn-sm" data-v="water" data-id="1">${icon('plus', 15)} Vaso</button></div></div>`;
}

/** Selector visual: cada opción muestra a tu compañero con ese rasgo. */
function lookPicker(mem, key, title, list) {
  const pal = PALETTES[mem.color] || PALETTES.crimson;
  const base = { eyes: mem.eyes, mouth: mem.mouth, ears: mem.ears, shell: mem.shell };
  return `<h4 style="margin-top:14px">${title}</h4><div class="vp-looks" role="radiogroup" aria-label="${title}">${list.map(o => { const a = { ...base, [key]: o.id };
    return `<button type="button" role="radio" aria-checked="${mem[key] === o.id}" class="vp-look ${mem[key] === o.id ? 'on' : ''}" data-v="${key}" data-id="${o.id}"><span class="vp-look-art" data-mood="happy" data-acc="none" data-eyes="${a.eyes}" data-mouth="${a.mouth}" data-ears="${a.ears}" data-shell="${a.shell}" style="--vora-a:${pal.a};--vora-b:${pal.b};--vora-rgb:${pal.rgb}">${avatarSvg('lk-' + key + '-' + o.id)}</span><small>${o.label}</small></button>`; }).join('')}</div>`;
}

export function meHtml({ mem, achievements }) {
  const bl = bondLevel(mem.bond), lv = levelFromXp(mem.xp);
  const nextAcc = ACCESSORIES.find(a => a.bond === bl.level + 1);
  return `<div class="vp-card"><div class="vp-stats"><div><b>${bl.level}</b><span>Vínculo</span></div><div><b>${lv.level}</b><span>Nivel</span></div><div><b>${mem.streak}</b><span>Racha</span></div><div><b>${mem.days}</b><span>Días juntos</span></div></div>${progress(bl.pct, 'Progreso del vínculo')}<small class="vp-muted">${nextAcc ? `Próximo desbloqueo: ${nextAcc.label} (vínculo ${nextAcc.bond}). Charla, juega y haz sesiones juntos.` : 'Vínculo máximo. ¡Gracias por tanta compañía!'}</small></div>
  <form class="vp-card vp-form-me" data-v-form="me"><h4>Personaliza</h4>
    <label class="field">Nombre de tu compañero<input class="input" name="name" maxlength="12" value="${e(mem.name)}" required></label>
    <label class="field">¿Cómo te llama?<input class="input" name="nickname" maxlength="20" value="${e(mem.nickname)}" placeholder="Tu apodo"></label>
    <label class="field">Juego favorito<input class="input" name="favGame" maxlength="30" value="${e(mem.favGame)}" placeholder="Opcional"></label>
    <button class="btn btn-soft btn-sm" type="submit">Guardar</button></form>
  <div class="vp-card"><h4>Personalidad</h4><div class="vp-vibes">${VIBES.map(v => `<button type="button" class="${mem.vibe === v.id ? 'on' : ''}" data-v="vibe" data-id="${v.id}"><b>${v.label}</b><small>${v.desc}</small></button>`).join('')}</div>
    <h4 style="margin-top:14px">Color</h4><div class="vp-swatches">${Object.entries(PALETTES).map(([id, p]) => `<button type="button" class="${mem.color === id ? 'on' : ''}" style="--c1:${p.a};--c2:${p.b}" data-v="color" data-id="${id}" aria-label="${p.label}" title="${p.label}"></button>`).join('')}</div>
    ${lookPicker(mem, 'eyes', 'Ojos', EYES)}${lookPicker(mem, 'mouth', 'Boca', MOUTHS)}${lookPicker(mem, 'ears', 'Cabeza', EARS)}${lookPicker(mem, 'shell', 'Forma', SHELLS)}
    <button type="button" class="btn btn-soft btn-sm vp-random" data-v="look-random">${icon('shuffle', 15)} Sorpréndeme</button>
    <h4 style="margin-top:14px">Accesorios</h4><div class="vp-accs">${ACCESSORIES.map(a => { const locked = a.bond > bl.level; return `<button type="button" class="${mem.accessory === a.id ? 'on' : ''}" ${locked ? 'disabled' : ''} data-v="acc" data-id="${a.id}">${locked ? icon('lock', 13) : ''}<span>${a.label}</span>${locked ? `<small>vínculo ${a.bond}</small>` : ''}</button>`; }).join('')}</div></div>
  <div class="vp-card"><h4>Comportamiento</h4>
    <label class="vp-switch"><input type="checkbox" data-v="toggle" data-id="quiet" ${mem.quiet ? 'checked' : ''}><span class="sw"></span><span><b>Modo silencioso</b><small>VORA solo habla cuando tú le hablas.</small></span></label>
    <label class="vp-switch"><input type="checkbox" data-v="toggle" data-id="hidden"><span class="sw"></span><span><b>Ocultar a VORA</b><small>Podrás llamarlo desde el menú lateral.</small></span></label></div>
  <div class="vp-card"><h4>Logros</h4><div class="vp-ach">${ACHIEVEMENTS.map(a => `<div class="${mem.achievements.includes(a.id) ? 'on' : ''}" title="${e(a.desc)}">${icon(mem.achievements.includes(a.id) ? 'award' : 'lock', 15)}<span><b>${e(a.label)}</b><small>${e(a.desc)}</small></span></div>`).join('')}</div></div>
  <div class="vp-card"><h4>Privacidad</h4><p class="vp-muted">Lo que VORA recuerda (apodo, racha, charlas) vive solo en este dispositivo. No se envía a ningún servidor.</p><button type="button" class="btn btn-danger btn-sm" data-v="forget">${icon('trash-2', 15)} Olvidar todo</button></div>`;
}

export function introHtml(step, mem, userName) {
  const dots = `<div class="vi-dots">${[0, 1, 2].map(i => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>`;
  if (step === 0) return `${dots}<h2>¡Hola! Soy ${e(mem.name)}</h2><p>Seré tu compañero en GAMVORAQ: te ayudo a moverte por la app, te acompaño mientras juegas o estudias y celebro tus logros.</p><label class="field">¿Cómo te gusta que te llame?<input class="input" id="vi-nick" maxlength="20" value="${e(mem.nickname || userName || '')}" placeholder="Tu apodo" autocomplete="nickname"></label><div class="vi-actions"><button class="btn btn-primary" data-v="intro-next">Continuar ${icon('arrow-right', 16)}</button></div>`;
  if (step === 1) return `${dots}<h2>¿Cómo prefieres que sea?</h2><div class="vp-vibes">${VIBES.map(v => `<button type="button" class="${mem.vibe === v.id ? 'on' : ''}" data-v="vibe" data-id="${v.id}"><b>${v.label}</b><small>${v.desc}</small></button>`).join('')}</div><h3>Elige su color</h3><div class="vp-swatches">${Object.entries(PALETTES).map(([id, p]) => `<button type="button" class="${mem.color === id ? 'on' : ''}" style="--c1:${p.a};--c2:${p.b}" data-v="color" data-id="${id}" aria-label="${p.label}"></button>`).join('')}</div><div class="vi-actions"><button class="btn btn-ghost" data-v="intro-prev">Atrás</button><button class="btn btn-primary" data-v="intro-next">Continuar ${icon('arrow-right', 16)}</button></div>`;
  return `${dots}<h2>Todo listo${mem.nickname ? ', ' + e(mem.nickname) : ''}</h2><ul class="vi-list"><li>${icon('hand', 16)}<span><b>Arrástrame</b> a donde no estorbe; me pego al borde.</span></li><li>${icon('message-circle', 16)}<span><b>Tócame</b> para chatear, jugar o hacer una sesión juntos.</span></li><li>${icon('flame', 16)}<span><b>Misiones y racha</b> en Inicio: cada día un reto nuevo.</span></li><li>${icon('shield-check', 16)}<span><b>Privado</b>: mi memoria vive solo en tu dispositivo.</span></li></ul><label class="vp-switch"><input type="checkbox" id="vi-quiet" ${mem.quiet ? 'checked' : ''}><span class="sw"></span><span><b>Modo silencioso</b><small>Solo hablo cuando me hables.</small></span></label><div class="vi-actions"><button class="btn btn-ghost" data-v="intro-prev">Atrás</button><button class="btn btn-primary" data-v="intro-done">${icon('rocket', 16)} Empezar</button></div>`;
}

export { BREATH_PHASES };
