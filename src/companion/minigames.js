// Mini-juegos de VORA: lógica pura (sin DOM) para poder probarla. El azar se inyecta con `rng`.

// ---- Trivia gamer ----
export const TRIVIA = [
  { q: '¿En qué videojuego aparece la famosa frase «el pastel es una mentira»?', a: ['Portal', 'Half-Life', 'Fallout', 'BioShock'], c: 0 },
  { q: '¿Cómo se llama la princesa que Link suele rescatar en la saga The Legend of Zelda?', a: ['Peach', 'Zelda', 'Samus', 'Daisy'], c: 1 },
  { q: '¿Qué criatura de Minecraft explota cuando se acerca demasiado al jugador?', a: ['Enderman', 'Zombi', 'Creeper', 'Esqueleto'], c: 2 },
  { q: '¿Qué compañía creó a Sonic, el erizo azul?', a: ['Nintendo', 'Sega', 'Sony', 'Atari'], c: 1 },
  { q: 'En el chat de un juego, «GG» significa…', a: ['Gran gol', 'Good game (buen juego)', 'Go grind', 'Gana gratis'], c: 1 },
  { q: '¿Cuál de estos títulos es un battle royale?', a: ['Fortnite', 'Stardew Valley', 'Tetris', 'Rocket League'], c: 0 },
  { q: '¿Qué significa NPC?', a: ['Nuevo punto de control', 'Personaje no jugable', 'Nivel pro completo', 'Nodo de progreso'], c: 1 },
  { q: '¿En qué año se lanzó Minecraft en su versión completa 1.0?', a: ['2009', '2011', '2014', '2017'], c: 1 },
  { q: '¿Qué juego de Riot Games es un shooter táctico en primera persona?', a: ['League of Legends', 'Teamfight Tactics', 'Valorant', 'Legends of Runeterra'], c: 2 },
  { q: '¿Quién creó el clásico Tetris en 1984?', a: ['Shigeru Miyamoto', 'Alexey Pajitnov', 'Hideo Kojima', 'Satoru Iwata'], c: 1 },
  { q: '¿Cómo se llama el mundo principal del fontanero Mario?', a: ['Reino Champiñón', 'Hyrule', 'Isla Delfino', 'Zebes'], c: 0 },
  { q: '¿Qué consola lanzó Sony por primera vez en 1994 en Japón?', a: ['PlayStation', 'Dreamcast', 'Saturn', 'Xbox'], c: 0 },
  { q: '¿Cómo se llama el protagonista de la saga Halo?', a: ['Marcus Fenix', 'Master Chief', 'Doomguy', 'Samus Aran'], c: 1 },
  { q: '¿Cómo se llama el hermano de Mario?', a: ['Wario', 'Toad', 'Luigi', 'Yoshi'], c: 2 },
  { q: '¿Qué empresa fabrica las consolas Xbox?', a: ['Sony', 'Microsoft', 'Nintendo', 'Valve'], c: 1 },
  { q: '¿Qué Pokémon tiene el número 25 en la Pokédex nacional?', a: ['Pikachu', 'Bulbasaur', 'Eevee', 'Charmander'], c: 0 },
  { q: '¿Cuántos jugadores tiene cada equipo en una partida estándar de Valorant?', a: ['4', '5', '6', '3'], c: 1 },
  { q: 'En Rocket League, ¿qué controla cada jugador?', a: ['Un robot', 'Un coche', 'Una nave', 'Un caballo'], c: 1 },
  { q: '¿En qué saga es protagonista Kratos?', a: ['Devil May Cry', 'God of War', 'Dark Souls', 'Bayonetta'], c: 1 },
  { q: '¿Qué videojuego presentó a Lara Croft?', a: ['Uncharted', 'Tomb Raider', 'Metroid', 'Resident Evil'], c: 1 },
  { q: '¿En qué juego los jugadores saltan de un autobús volador al inicio de la partida?', a: ['Apex Legends', 'PUBG', 'Fortnite', 'Warzone'], c: 2 },
  { q: 'En Stardew Valley, ¿qué heredas al comenzar?', a: ['Una tienda', 'La granja de tu abuelo', 'Un barco', 'Una mina'], c: 1 },
  { q: '¿Qué significa «AFK»?', a: ['Always fight kills', 'Away from keyboard (lejos del teclado)', 'Attack first, kid', 'Auto free kill'], c: 1 },
  { q: '¿Qué compañía creó originalmente la saga Final Fantasy?', a: ['Square', 'Capcom', 'Konami', 'Bandai'], c: 0 },
  { q: '¿Qué consola portátil lanzó Nintendo en 1989?', a: ['Game Boy', 'Nintendo DS', 'Game Gear', 'Virtual Boy'], c: 0 },
  { q: '¿Qué estudio desarrolló The Witcher 3: Wild Hunt?', a: ['Bethesda', 'BioWare', 'CD Projekt Red', 'Ubisoft'], c: 2 },
  { q: '¿De qué color es Kirby?', a: ['Azul', 'Amarillo', 'Rosa', 'Verde'], c: 2 },
  { q: 'En Among Us, ¿cómo se llama a quien sabotea a la tripulación?', a: ['Traidor', 'Impostor', 'Espía', 'Infiltrado'], c: 1 },
  { q: '¿Cómo se llaman los personajes por defecto de Minecraft?', a: ['Steve y Alex', 'Max y Leo', 'Tom y Ana', 'Sam y Kim'], c: 0 },
  { q: '¿Qué significa «FPS» como género de videojuegos?', a: ['Fast Play System', 'First-person shooter (disparos en primera persona)', 'Free player squad', 'Final point score'], c: 1 }
];
export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** Elige `n` preguntas y baraja las respuestas conservando cuál es la correcta. */
export function buildTrivia(n = 5, rng = Math.random) {
  return shuffle(TRIVIA, rng).slice(0, n).map(item => {
    const order = shuffle(item.a.map((text, i) => ({ text, ok: i === item.c })), rng);
    return { q: item.q, options: order.map(o => o.text), correct: order.findIndex(o => o.ok) };
  });
}

// ---- Adivina el juego por emojis (v9) ----
export const EMOJI_GAMES = [
  { e: '🍄👨‍🔧👸🏰', a: 'Super Mario Bros.' }, { e: '⛏️🟫🧟🌙', a: 'Minecraft' }, { e: '🗡️🛡️🧝🔺', a: 'The Legend of Zelda' },
  { e: '🦔💨💍', a: 'Sonic the Hedgehog' }, { e: '🚌🪂🔨🌪️', a: 'Fortnite' }, { e: '🐦😠🐷🏗️', a: 'Angry Birds' },
  { e: '🧱⬇️🟦🟥', a: 'Tetris' }, { e: '👻🟡🍒', a: 'Pac-Man' }, { e: '🚗⚽🥅🚀', a: 'Rocket League' },
  { e: '🧑‍🚀🔪🚨🗳️', a: 'Among Us' }, { e: '🌾🐔🏡🎣', a: 'Stardew Valley' }, { e: '⚡🐭🔴⚪', a: 'Pokémon' },
  { e: '🏎️🍌🐢💥', a: 'Mario Kart' }, { e: '🪓👦❄️⚔️', a: 'God of War' }, { e: '🦴🔥🪦💀', a: 'Hades' },
  { e: '🐞🗡️🕳️🦋', a: 'Hollow Knight' }, { e: '🏝️🦝🍑🏠', a: 'Animal Crossing' }, { e: '🔫🎯🧠💥', a: 'Valorant' }
];
/** `n` rondas con 4 opciones barajadas. */
export function buildEmojiQuiz(n = 5, rng = Math.random) {
  return shuffle(EMOJI_GAMES, rng).slice(0, n).map(item => {
    const wrong = shuffle(EMOJI_GAMES.filter(x => x.a !== item.a), rng).slice(0, 3).map(x => x.a);
    const options = shuffle([item.a, ...wrong], rng);
    return { q: item.e, options, correct: options.indexOf(item.a) };
  });
}

// ---- Memoria (pares) ----
export const MEMORY_ICONS = ['gamepad-2', 'trophy', 'flame', 'heart', 'star', 'zap', 'crown', 'rocket'];
export function buildMemoryDeck(pairs = 6, rng = Math.random) {
  const icons = MEMORY_ICONS.slice(0, Math.max(2, Math.min(8, pairs)));
  return { cards: shuffle([...icons, ...icons], rng).map((icon, id) => ({ id, icon, open: false, matched: false })), moves: 0, matches: 0, pairs: icons.length, done: false };
}
/** Voltea una carta. Si había dos abiertas sin pareja, primero se cierran. Devuelve el evento. */
export function flipCard(state, i) {
  const c = state.cards[i]; if (!c || c.matched || c.open || state.done) return 'ignore';
  const open = state.cards.filter(x => x.open && !x.matched);
  if (open.length >= 2) open.forEach(x => { x.open = false; });
  c.open = true;
  const now = state.cards.filter(x => x.open && !x.matched);
  if (now.length < 2) return 'open';
  state.moves++;
  if (now[0].icon === now[1].icon) { now.forEach(x => { x.matched = true; }); state.matches++; if (state.matches === state.pairs) state.done = true; return state.done ? 'done' : 'match'; }
  return 'miss';
}
export const memoryXp = (moves, pairs) => Math.max(5, 30 - Math.max(0, moves - pairs) * 2);

// ---- Reflejos ----
export const reactionDelay = (rng = Math.random) => 1500 + Math.floor(rng() * 2500);
export function reactionGrade(ms) {
  if (ms < 200) return { label: 'Reflejos de pro', xp: 15 };
  if (ms < 260) return { label: 'Muy rápido', xp: 10 };
  if (ms < 340) return { label: 'Buen tiempo', xp: 6 };
  return { label: 'Sigue practicando', xp: 3 };
}

// ---- Piedra, papel o tijera (al mejor de 5: gana quien llegue a 3) ----
export const RPS = [['rock', 'Piedra', '✊'], ['paper', 'Papel', '✋'], ['scissors', 'Tijera', '✌️']];
export function rpsResult(me, bot) {
  if (me === bot) return 'draw';
  return (me === 'rock' && bot === 'scissors') || (me === 'paper' && bot === 'rock') || (me === 'scissors' && bot === 'paper') ? 'win' : 'lose';
}
export const rpsBot = (rng = Math.random) => RPS[Math.floor(rng() * 3)][0];
