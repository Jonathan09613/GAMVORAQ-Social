// Herramientas de VORA (v9): dados, moneda, ruleta, equipos, recordatorios, plan de la noche,
// consejos por juego, calculadora, agua y comandos rápidos. Lógica pura y probable: el azar y el reloj se inyectan.

const pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];
export const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// ── Dados y moneda ──────────────────────────────────────────
/** «2d6», «d20», «3 dados», «dado de 12». Máximo 10 dados de 2 a 100 caras. */
export function parseDice(text = '') {
  const t = norm(text);
  let m = t.match(/(\d{1,2})?\s*d\s*(\d{1,3})/);
  if (m) return { count: clamp(Number(m[1] || 1), 1, 10), sides: clamp(Number(m[2]), 2, 100) };
  const count = Number((t.match(/(\d{1,2})\s*dados?/) || [])[1] || 1);
  const sides = Number((t.match(/de\s*(\d{1,3})\s*(caras|lados)?/) || [])[1] || 6);
  return { count: clamp(count, 1, 10), sides: clamp(sides, 2, 100) };
}
const clamp = (n, a, b) => Math.max(a, Math.min(b, Number.isFinite(n) ? n : a));
export function rollDice({ count = 1, sides = 6 } = {}, rng = Math.random) {
  const rolls = Array.from({ length: count }, () => 1 + Math.floor(rng() * sides));
  const total = rolls.reduce((a, b) => a + b, 0);
  return { rolls, total, label: `${count}d${sides}`, crit: sides === 20 && count === 1 ? (rolls[0] === 20 ? 'max' : rolls[0] === 1 ? 'min' : '') : '' };
}
export const flipCoin = (rng = Math.random) => (rng() < 0.5 ? 'Cara' : 'Cruz');

// ── Listas, ruleta y equipos ────────────────────────────────
/** Separa «a, b y c», «a o b», saltos de línea o punto y coma. Sin duplicados ni vacíos. */
export function parseList(text = '') {
  const parts = String(text).split(/\n|,|;|\s+y\s+|\s+o\s+|\s+vs\.?\s+|\|/i).map(s => s.trim().replace(/^[-•*]\s*/, '').replace(/[.?!¿¡]+$/g, '').trim()).filter(Boolean);
  const seen = new Set();
  return parts.filter(p => { const k = norm(p); if (seen.has(k) || k.length > 40) return false; seen.add(k); return true; }).slice(0, 24);
}
export function pickOne(options, rng = Math.random) { return options.length ? pick(options, rng) : null; }
/** Reparte nombres en `n` equipos lo más parejos posible (barajado justo). */
export function makeTeams(names, n = 2, rng = Math.random) {
  const list = [...names];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  const teams = Array.from({ length: clamp(n, 2, Math.max(2, Math.min(8, list.length))) }, () => []);
  list.forEach((name, i) => teams[i % teams.length].push(name));
  return teams;
}
export const TEAM_NAMES = ['Equipo Carmesí', 'Equipo Fénix', 'Equipo Rubí', 'Equipo Volcán', 'Equipo Dragón', 'Equipo Brasa', 'Equipo Cometa', 'Equipo Titán'];

// ── Recordatorios ───────────────────────────────────────────
/**
 * «recuérdame en 10 minutos tomar agua», «avísame en 1 hora que empieza la partida»,
 * «recuérdame a las 21:30 jugar con mi squad», «/recordar 15m estirar».
 * Devuelve { at, text, label } o null.
 */
export function parseReminder(raw = '', now = Date.now()) {
  const t = norm(raw).replace(/^\/recordar\s*/, 'recuerdame ');
  if (!/(recuerd|avisa|avisame|recordatorio|alarma|recuerdame)/.test(t) && !/^\s*\d+\s*(m|min|h)\b/.test(t)) return null;
  let at = null, rest = t;
  const rel = t.match(/(?:en|dentro de)?\s*(\d{1,3}|un|una|media)\s*(segundos?|s|minutos?|mins?|m|horas?|h)\b/);
  const abs = t.match(/a las?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|de la noche|de la tarde|de la manana)?/);
  if (rel) {
    const n = rel[1] === 'media' ? 0.5 : /^un/.test(rel[1]) ? 1 : Number(rel[1]);
    const unit = rel[2].startsWith('h') ? 3600000 : rel[2].startsWith('s') ? 1000 : 60000;
    const ms = n * (rel[1] === 'media' && !rel[2].startsWith('h') ? 3600000 : unit);
    if (ms < 5000 || ms > 24 * 3600000) return null;
    at = now + ms; rest = t.replace(rel[0], ' ');
  } else if (abs) {
    let h = Number(abs[1]); const m = Number(abs[2] || 0), suf = abs[3] || '';
    if (h > 23 || m > 59) return null;
    if ((/pm|noche|tarde/.test(suf)) && h < 12) h += 12;
    if (/am|manana/.test(suf) && h === 12) h = 0;
    const d = new Date(now); d.setHours(h, m, 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    at = d.getTime(); rest = t.replace(abs[0], ' ');
  }
  if (!at) return null;
  let text = rest.replace(/\b(por favor|porfa)\b/g, ' ').replace(/\s+/g, ' ').trim();
  // Quita solo las palabras de relleno del principio: «recuérdame que…», «ponme una alarma para…».
  const FILL = /^(recuerdamelo|recuerdame|recordarme|recuerda|avisame|avisa|ponme|pon|un|una|el|la|recordatorio|alarma|que|de|para|a)\s+/;
  for (let i = 0; i < 8 && FILL.test(text + ' '); i++) text = (text + ' ').replace(FILL, '').trim();
  if (/^(recuerdame|recordatorio|alarma|avisame)$/.test(text)) text = '';
  const clean = text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Tu recordatorio';
  return { at, text: clean.slice(0, 80), label: reminderWhen(at, now) };
}
export function reminderWhen(at, now = Date.now()) {
  const mins = Math.round((at - now) / 60000);
  if (mins < 1) return 'en menos de un minuto';
  if (mins < 60) return `en ${mins} min`;
  const d = new Date(at), hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
  return `a las ${hh}:${mm}`;
}
/** Separa recordatorios vencidos de los pendientes. */
export function dueReminders(list = [], now = Date.now()) {
  return { due: list.filter(r => r.at <= now), pending: list.filter(r => r.at > now).sort((a, b) => a.at - b.at) };
}

// ── Plan de la noche ────────────────────────────────────────
/**
 * Arma un plan con calentamiento, bloque principal, pausas y hora de dormir.
 * { hours: 1-4, mood: 'chill'|'competir'|'social', hour (0-23), nextSession?, favGame? }
 */
export function planNight({ hours = 2, mood = 'chill', hour = 20, minute = 0, nextSession = null, favGame = '', school = true } = {}) {
  const total = clamp(Number(hours), 1, 4) * 60;
  let t = hour * 60 + minute;
  const fmt = m => { const x = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
  const main = { chill: favGame || 'algo relajado (Stardew Valley, Minecraft…)', competir: favGame ? `${favGame} en ranked` : 'tus rankeds', social: nextSession ? `«${nextSession.title}» con tu squad` : 'partidas con tu squad' }[mood] || favGame || 'tu juego favorito';
  const steps = [];
  const add = (mins, icon, text) => { steps.push({ at: fmt(t), mins, icon, text }); t += mins; };
  add(5, 'droplet', 'Agua a la mano, luz cómoda y postura lista');
  if (mood === 'competir') add(15, 'crosshair', 'Calentamiento: modo práctica o deathmatch, sin presión');
  else add(10, 'message-circle', 'Saluda a tu squad y avisa que estás disponible');
  let left = total - steps.reduce((a, s) => a + s.mins, 0);
  while (left > 15) {
    const block = Math.min(left > 70 ? 50 : left - 10, 50);
    add(block, mood === 'competir' ? 'swords' : 'gamepad-2', `Bloque principal: ${main}`);
    left -= block;
    if (left > 15) { add(10, 'coffee', 'Pausa: estira, mira lejos 20 s y toma agua'); left -= 10; }
  }
  add(Math.max(5, left), 'heart-handshake', mood === 'competir' ? 'Cierre: un GG a tus compañeros y revisa qué mejorar' : 'Cierre: califica la química o guarda un recuerdo');
  const end = t;
  const endHour = Math.floor((((end % 1440) + 1440) % 1440) / 60);
  const late = school && (endHour >= 23 || endHour < 5);
  return { steps, ends: fmt(end), warning: late ? 'Terminarías tarde. Si mañana madrugas, quita un bloque: dormir también sube de nivel.' : '' };
}

// ── Consejos por juego (originales, generales y verificables) ─
export const GAME_TIPS = {
  valorant: ['Mira a la altura de la cabeza todo el tiempo (crosshair placement); ahorra más rondas que apuntar rápido.', 'Detente antes de disparar: en Valorant moverse arruina la precisión.', 'Comunica lo justo: posición, número de enemigos y vida. «Dos en B, uno bajo».'],
  minecraft: ['La primera noche: madera, mesa de crafteo, herramientas de piedra y una cama o un refugio iluminado.', 'Las antorchas evitan que aparezcan monstruos cerca de tu base.', 'Nunca caves directamente hacia abajo: puedes caer en lava o en una cueva.'],
  fortnite: ['Construye o busca cobertura antes de curarte.', 'Aterriza lejos de la ruta del autobús si quieres botín tranquilo.', 'Juega con el borde de la tormenta para que nadie te sorprenda por la espalda.'],
  'league of legends': ['Revisa el minimapa cada pocos segundos: evita la mayoría de emboscadas.', 'Farmear bien (last hit) vale tanto como una kill.', 'Coloca guardianes en la jungla enemiga cuando vayas ganando.'],
  'rocket league': ['Prioriza la rotación: no persigas el balón los tres a la vez.', 'Recoge los pads pequeños de turbo en lugar de cruzar el campo por los grandes.', 'Practica el control en entrenamiento libre 10 minutos antes de rankear.'],
  'counter-strike 2': ['Aprende 2 o 3 granadas de humo por mapa; cambian rondas enteras.', 'Economía: compra o ahorra en equipo, no cada quien por su lado.', 'Juega ángulos que te den ventaja de información, no duelos abiertos.'],
  'apex legends': ['Combina leyendas: una de movilidad, una de soporte y una de reconocimiento.', 'Marca botín y enemigos con el ping; es comunicación sin micrófono.', 'Cura y recarga escudos detrás de cobertura antes de volver a empujar.'],
  overwatch: ['Juega alrededor de tu tanque y no te alejes del grupo.', 'Guarda tu definitiva para combinarla con la de alguien más.', 'Si pierdes una pelea, reagrúpense todos antes de volver.'],
  'stardew valley': ['La primera primavera: planta chirivías y vende para ahorrar en semillas mejores.', 'Revisa el pronóstico en la TV cada mañana.', 'Habla con los aldeanos y regálales lo que les gusta para subir amistad.'],
  'among us': ['Haz tareas visuales cuando haya testigos para ganar confianza.', 'Recuerda quién estaba dónde: esa información decide las votaciones.', 'Si eres impostor, sabotea para separar al grupo.'],
  'genshin impact': ['Combina elementos (por ejemplo, hidro + piro = vaporizar) para mucho más daño.', 'Gasta la resina original a diario en materiales de ascensión.', 'Sube primero a uno o dos personajes principales en lugar de a todos.'],
  'ea sports fc': ['Usa el pase al hueco con moderación; el pase corto conserva el balón.', 'Defiende cubriendo líneas de pase en vez de entrar al tackle siempre.', 'Entrena los regates básicos antes de los trucos complejos.'],
  hollow: ['Muere sin miedo: recuperas tu Geo derrotando a tu sombra.', 'Compra el mapa a Cornifer y la pluma en Sucio Pueblo para anotar zonas.', 'Explora con calma; muchas mejoras están en caminos ocultos.']
};
const GAME_ALIASES = [['valo', 'valorant'], ['mine', 'minecraft'], ['fort', 'fortnite'], ['lol', 'league of legends'], ['league', 'league of legends'], ['rocket', 'rocket league'], ['cs2', 'counter-strike 2'], ['counter', 'counter-strike 2'], ['csgo', 'counter-strike 2'], ['apex', 'apex legends'], ['overwatch', 'overwatch'], ['stardew', 'stardew valley'], ['among', 'among us'], ['genshin', 'genshin impact'], ['fifa', 'ea sports fc'], ['fc 2', 'ea sports fc'], ['ea fc', 'ea sports fc'], ['hollow', 'hollow']];
export function findGame(text = '') {
  const t = norm(text);
  for (const k of Object.keys(GAME_TIPS)) if (t.includes(k)) return k;
  for (const [a, k] of GAME_ALIASES) if (new RegExp(`\\b${a}`).test(t)) return k;
  return null;
}
export const GAME_LABEL = { valorant: 'Valorant', minecraft: 'Minecraft', fortnite: 'Fortnite', 'league of legends': 'League of Legends', 'rocket league': 'Rocket League', 'counter-strike 2': 'Counter-Strike 2', 'apex legends': 'Apex Legends', overwatch: 'Overwatch 2', 'stardew valley': 'Stardew Valley', 'among us': 'Among Us', 'genshin impact': 'Genshin Impact', 'ea sports fc': 'EA Sports FC', hollow: 'Hollow Knight' };

// ── Motivación (frases propias) ─────────────────────────────
export const MOTIVATION = [
  'Cada partida perdida es un replay con información gratis.',
  'No necesitas ser el MVP para ser el compañero que todos quieren.',
  'Constancia > talento: 20 minutos diarios ganan a 5 horas un domingo.',
  'Un buen «GG» cambia el día de alguien más de lo que crees.',
  'Si hoy no sale, mañana tienes una nueva racha por empezar.',
  'Juega para divertirte; las victorias llegan más rápido cuando no hay tilt.',
  'Tu valor no se mide en rango. Se mide en cómo tratas a tu equipo.'
];

// ── Calculadora segura (solo números y + - * / % ^ paréntesis) ─
export function calc(expr = '') {
  const s = String(expr).replace(/,/g, '.').replace(/x|×/gi, '*').replace(/÷/g, '/').replace(/\s+/g, '');
  if (!/^[\d.+\-*/%^()]+$/.test(s) || s.length > 60) return null;
  let i = 0;
  const peek = () => s[i], eat = c => (s[i] === c ? (i++, true) : false);
  const num = () => { const m = s.slice(i).match(/^\d+(\.\d+)?/); if (!m) throw new Error('n'); i += m[0].length; return Number(m[0]); };
  const factor = () => { if (eat('-')) return -factor(); if (eat('(')) { const v = expr2(); if (!eat(')')) throw new Error('p'); return v; } return num(); };
  const power = () => { const b = factor(); return eat('^') ? b ** power() : b; };
  const term = () => { let v = power(); for (;;) { if (eat('*')) v *= power(); else if (eat('/')) { const d = power(); if (d === 0) throw new Error('0'); v /= d; } else if (eat('%')) v %= power(); else return v; } };
  function expr2() { let v = term(); for (;;) { if (eat('+')) v += term(); else if (eat('-')) v -= term(); else return v; } }
  try { const v = expr2(); if (i !== s.length || !Number.isFinite(v)) return null; void peek; return Math.round(v * 1e8) / 1e8; } catch { return null; }
}

// ── Agua ────────────────────────────────────────────────────
export const WATER_GOAL = 8;
export function addWater(mem, dayKey, n = 1) {
  if (!mem.water || mem.water.day !== dayKey) mem.water = { day: dayKey, count: 0 };
  mem.water.count = clamp(mem.water.count + n, 0, 20);
  return mem.water.count;
}
export const waterToday = (mem, dayKey) => (mem.water?.day === dayKey ? mem.water.count : 0);

// ── Resumen del día ─────────────────────────────────────────
export function dailyBrief(c = {}) {
  const lines = [];
  if (c.nextSession) lines.push(`Tu próxima partida es «${c.nextSession.title}» ${c.nextSession.when}${c.nextSession.going ? ' y ya confirmaste' : ''}.`);
  else lines.push('No tienes partidas agendadas; puedes proponer una a tu squad.');
  if (c.availableNow?.length) lines.push(`${c.availableNow.length === 1 ? 'Está disponible' : 'Están disponibles'} ahora: ${c.availableNow.slice(0, 3).join(', ')}${c.availableNow.length > 3 ? ` y ${c.availableNow.length - 3} más` : ''}.`);
  if (c.unread) lines.push(`Tienes ${c.unread} aviso${c.unread === 1 ? '' : 's'} sin leer.`);
  if (c.missionsTotal) lines.push(`Misiones: ${c.missionsDone}/${c.missionsTotal}.`);
  if (c.water != null) lines.push(`Agua hoy: ${c.water}/${WATER_GOAL} vasos.`);
  return lines.join(' ');
}

// ── Comandos rápidos «/» ───────────────────────────────────
export const COMMANDS = [
  ['/dado 2d6', 'Lanza dados (d6, d20, 3d8…)'],
  ['/moneda', 'Cara o cruz'],
  ['/elige pizza, tacos o sushi', 'VORA elige por ti'],
  ['/equipos 2: Ana, Leo, Sofi, Max', 'Arma equipos parejos'],
  ['/recordar 15m estirar', 'Recordatorio en minutos u horas'],
  ['/plan', 'Plan de juego para esta noche'],
  ['/resumen', 'Tu día en GAMVORAQ'],
  ['/tips valorant', 'Consejos para un juego'],
  ['/calc 25*4+10', 'Calculadora'],
  ['/agua', 'Suma un vaso de agua'],
  ['/frase', 'Frase para animarte']
];
/** Convierte «/comando args» en texto natural que entiende el cerebro de VORA. */
export function expandCommand(text = '') {
  const m = String(text).trim().match(/^\/(\w+)\s*([\s\S]*)$/); if (!m) return null;
  const [, cmd, args] = m, c = norm(cmd);
  const map = { dado: `lanza ${args || '1d6'} dados`, dados: `lanza ${args || '1d6'} dados`, roll: `lanza ${args || '1d6'} dados`, moneda: 'lanza una moneda', coin: 'lanza una moneda', elige: `elige entre ${args}`, equipos: `arma equipos ${args}`, teams: `arma equipos ${args}`, recordar: `recuérdame ${args}`, plan: 'planea mi noche', resumen: 'resumen de mi día', tips: `consejos de ${args}`, calc: `calcula ${args}`, agua: 'tomé agua', frase: 'dame una frase motivadora', comandos: 'comandos', ayuda: 'comandos', help: 'comandos' };
  return map[c] ?? null;
}
