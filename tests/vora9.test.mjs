import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDice, rollDice, flipCoin, parseList, makeTeams, parseReminder, dueReminders, planNight, findGame, calc, addWater, waterToday, dailyBrief, expandCommand, COMMANDS } from '../src/companion/tools.js';
import { buildEmojiQuiz, EMOJI_GAMES, buildMemoryDeck, flipCard, memoryXp, reactionGrade, rpsResult, TRIVIA, buildTrivia } from '../src/companion/minigames.js';
import { reply } from '../src/companion/brain.js';
import { defaultMemory, loadMemory, PALETTES } from '../src/companion/memory.js';

const seq = vals => { let i = 0; return () => vals[i++ % vals.length]; };

test('dados: notación y límites', () => {
  assert.deepEqual(parseDice('2d6'), { count: 2, sides: 6 });
  assert.deepEqual(parseDice('lanza un d20'), { count: 1, sides: 20 });
  assert.deepEqual(parseDice('3 dados de 8 caras'), { count: 3, sides: 8 });
  assert.deepEqual(parseDice('99d999'), { count: 10, sides: 100 });
  const r = rollDice({ count: 3, sides: 6 }, seq([0, 0.5, 0.99]));
  assert.deepEqual(r.rolls, [1, 4, 6]); assert.equal(r.total, 11);
  assert.equal(rollDice({ count: 1, sides: 20 }, () => 0.999).crit, 'max');
  assert.equal(rollDice({ count: 1, sides: 20 }, () => 0).crit, 'min');
  assert.equal(flipCoin(() => 0.1), 'Cara'); assert.equal(flipCoin(() => 0.9), 'Cruz');
});

test('listas, ruleta y equipos parejos', () => {
  assert.deepEqual(parseList('Valorant, Minecraft o Fortnite'), ['Valorant', 'Minecraft', 'Fortnite']);
  assert.deepEqual(parseList('a\nb; b, c y d'), ['a', 'b', 'c', 'd']);
  const teams = makeTeams(['A', 'B', 'C', 'D', 'E'], 2, () => 0.3);
  assert.equal(teams.length, 2); assert.equal(teams.flat().length, 5); assert.ok(Math.abs(teams[0].length - teams[1].length) <= 1);
  assert.equal(makeTeams(['A', 'B'], 8).length, 2, 'no más equipos que personas');
});

test('recordatorios relativos y a una hora', () => {
  const now = new Date(2026, 10, 11, 20, 0, 0).getTime();
  const a = parseReminder('recuérdame en 10 minutos tomar agua', now);
  assert.equal(a.at - now, 600000); assert.equal(a.text, 'Tomar agua'); assert.equal(a.label, 'en 10 min');
  const b = parseReminder('avísame en 1 hora que empieza la partida', now);
  assert.equal(b.at - now, 3600000); assert.equal(b.text, 'Empieza la partida');
  const c = parseReminder('recuérdame a las 21:30 jugar con mi squad', now);
  assert.equal(new Date(c.at).getHours(), 21); assert.equal(new Date(c.at).getMinutes(), 30);
  const d = parseReminder('recuérdame a las 7 de la mañana estudiar', now);
  assert.equal(new Date(d.at).getDate(), 12, 'si la hora ya pasó, es mañana');
  assert.equal(parseReminder('/recordar 15m estirar', now).at - now, 900000);
  assert.equal(parseReminder('recuérdame algo', now), null);
  assert.equal(parseReminder('recuérdame en 3 segundos x', now), null, 'muy corto');
  const { due, pending } = dueReminders([{ at: now - 1 }, { at: now + 5 }, { at: now + 2 }], now);
  assert.equal(due.length, 1); assert.deepEqual(pending.map(x => x.at), [now + 2, now + 5]);
});

test('plan de la noche', () => {
  const p = planNight({ hours: 2, mood: 'competir', hour: 20, minute: 0 });
  const mins = p.steps.reduce((a, s) => a + s.mins, 0);
  assert.equal(mins, 120); assert.equal(p.ends, '22:00'); assert.equal(p.steps[0].at, '20:00');
  assert.ok(p.steps.some(s => /Calentamiento/.test(s.text)));
  assert.ok(p.steps.some(s => /Pausa/.test(s.text)));
  assert.match(planNight({ hours: 3, hour: 22 }).warning, /tarde/);
  assert.equal(planNight({ hours: 1, hour: 18 }).warning, '');
  assert.match(planNight({ mood: 'social', nextSession: { title: 'Rankeds' } }).steps.map(s => s.text).join(), /Rankeds/);
});

test('consejos por juego y calculadora segura', () => {
  assert.equal(findGame('tips de valo'), 'valorant');
  assert.equal(findGame('consejos para lol'), 'league of legends');
  assert.equal(findGame('cs2'), 'counter-strike 2');
  assert.equal(findGame('ajedrez'), null);
  assert.equal(calc('(25*4)+10'), 110); assert.equal(calc('2^10'), 1024); assert.equal(calc('7 x 8'), 56);
  assert.equal(calc('10/4'), 2.5); assert.equal(calc('-3+5'), 2); assert.equal(calc('1,5*2'), 3);
  assert.equal(calc('1/0'), null); assert.equal(calc('alert(1)'), null); assert.equal(calc('2+'), null);
});

test('agua y resumen del día', () => {
  const m = defaultMemory();
  assert.equal(addWater(m, '2026-11-11'), 1); assert.equal(addWater(m, '2026-11-11', 2), 3);
  assert.equal(waterToday(m, '2026-11-11'), 3); assert.equal(waterToday(m, '2026-11-12'), 0);
  assert.equal(addWater(m, '2026-11-12'), 1, 'el contador se reinicia cada día');
  assert.equal(addWater(m, '2026-11-12', -5), 0);
  const brief = dailyBrief({ nextSession: { title: 'Rankeds', when: 'hoy 21:00' }, availableNow: ['Kai', 'Luna', 'Max', 'Ana'], unread: 1, missionsDone: 1, missionsTotal: 3, water: 2 });
  assert.match(brief, /Rankeds/); assert.match(brief, /Kai, Luna, Max y 1 más/); assert.match(brief, /1 aviso sin leer/); assert.match(brief, /2\/8/);
});

test('comandos «/» de VORA', () => {
  assert.equal(expandCommand('/moneda'), 'lanza una moneda');
  assert.equal(expandCommand('/elige a, b'), 'elige entre a, b');
  assert.equal(expandCommand('/nada'), null);
  assert.equal(expandCommand('hola'), null);
  for (const [c] of COMMANDS) assert.notEqual(expandCommand(c), null, c);
});

test('VORA responde a herramientas y comandos', () => {
  const ctx = { hour: 20, minute: 0, availableNow: ['Kai'], nextSession: { title: 'Rankeds', when: 'hoy 21:00', inMin: 60 }, water: 0, now: Date.now() };
  const r = (q) => reply(q, ctx, () => 0.4);
  assert.match(r('/dado 2d6').text, /🎲 2d6/);
  assert.match(r('/moneda').text, /Cara|Cruz/);
  assert.match(r('Elige entre Pizza, Tacos o Sushi').text, /Pizza|Tacos|Sushi/, 'respeta mayúsculas');
  assert.match(r('/equipos 2: Ana, Leo, Sofi, Max').text, /Equipo Carmesí: .*\nEquipo Fénix:/);
  const rem = r('recuérdame en 20 minutos estirar'); assert.ok(rem.reminder); assert.equal(rem.reminder.text, 'Estirar');
  assert.match(r('/plan').text, /Plan de 2 h/);
  assert.match(r('/resumen').text, /Rankeds/);
  assert.match(r('quién está disponible').text, /Kai/);
  assert.match(r('mi próxima partida').text, /Rankeds/);
  assert.match(r('consejos de minecraft').text, /Minecraft/);
  assert.equal(r('calcula (2+3)*4').text, '🧮 20');
  const w = r('tomé agua'); assert.equal(w.water, 1); assert.match(w.text, /1\/8/);
  assert.match(r('/comandos').text, /\/plan/);
  assert.match(r('/inventado').text, /No conozco ese comando/);
  assert.match(r('quiero morir').text, /800 911 2000/, 'la crisis sigue teniendo prioridad sobre todo');
});

test('mini-juegos nuevos', () => {
  const q = buildEmojiQuiz(5, () => 0.3);
  assert.equal(q.length, 5);
  for (const x of q) { assert.equal(x.options.length, 4); assert.equal(new Set(x.options).size, 4); assert.ok(EMOJI_GAMES.some(g => g.e === x.q && g.a === x.options[x.correct])); }
  const deck = buildMemoryDeck(2, () => 0.5);
  assert.equal(deck.cards.length, 4);
  const b = deck.cards.findIndex((c, i) => i > 0 && c.icon === deck.cards[0].icon);
  const other = deck.cards.findIndex(c => c.icon !== deck.cards[0].icon);
  assert.equal(flipCard(deck, 0), 'open'); assert.equal(flipCard(deck, other), 'miss'); assert.equal(deck.moves, 1);
  assert.equal(flipCard(deck, b), 'open', 'al abrir una tercera, se cierran las dos fallidas');
  assert.equal(deck.cards[0].open, false);
  assert.equal(flipCard(deck, 0), 'match');
  const rest = deck.cards.map((c, i) => i).filter(i => !deck.cards[i].matched);
  flipCard(deck, rest[0]); assert.equal(flipCard(deck, rest[1]), 'done'); assert.ok(deck.done);
  assert.equal(flipCard(deck, 0), 'ignore');
  assert.equal(memoryXp(6, 6), 30); assert.equal(memoryXp(40, 6), 5);
  assert.equal(reactionGrade(180).xp, 15); assert.equal(reactionGrade(400).xp, 3);
  assert.equal(rpsResult('rock', 'scissors'), 'win'); assert.equal(rpsResult('rock', 'paper'), 'lose'); assert.equal(rpsResult('paper', 'paper'), 'draw');
  assert.ok(TRIVIA.length >= 30);
  for (const t of TRIVIA) { assert.equal(t.a.length, 4); assert.ok(t.c >= 0 && t.c < 4); }
  assert.equal(buildTrivia(5).length, 5);
});

test('memoria v10: rojo por defecto y migración de los tonos verdes de la v9', () => {
  assert.equal(defaultMemory().color, 'crimson');
  assert.ok(['crimson', 'cyan', 'violet', 'amber', 'mint'].every(k => PALETTES[k]) && !PALETTES.emerald);
  const store = { data: { 'gvq:vora:u1': JSON.stringify({ color: 'emerald', reminders: [{ at: 5, text: 'x', id: 'a' }, { bad: 1 }], water: { day: 'd', count: 3 } }) }, getItem(k) { return this.data[k] ?? null; } };
  const m = loadMemory('u1', store);
  assert.equal(m.color, 'crimson'); assert.equal(m.reminders.length, 1); assert.equal(m.water.count, 3);
});

test('v12: apariencia de VORA (ojos, boca, cabeza, forma) validada y sincronizable', async () => {
  const { EYES, MOUTHS, EARS, SHELLS, lookOf, applyLookTo } = await import('../src/companion/memory.js');
  const m = defaultMemory();
  assert.equal(m.eyes, 'classic'); assert.ok(EYES.length >= 3 && MOUTHS.length >= 3 && EARS.length >= 3 && SHELLS.length >= 3);
  applyLookTo(m, { eyes: 'pixel', ears: 'cat', shell: 'orb', mouth: 'nope', color: 'rose', name: '  Nova  ' });
  assert.deepEqual([m.eyes, m.ears, m.shell, m.mouth, m.color, m.name], ['pixel', 'cat', 'orb', 'smile', 'rose', 'Nova']);
  assert.equal(lookOf(m).eyes, 'pixel');
  const store = { data: { 'gvq:vora:u2': JSON.stringify({ eyes: 'laser', shell: 'cube' }) }, getItem(k) { return this.data[k] ?? null; } };
  const l = loadMemory('u2', store); assert.equal(l.eyes, 'classic'); assert.equal(l.shell, 'cube');
});
