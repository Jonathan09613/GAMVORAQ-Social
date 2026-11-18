import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultMemory, loadMemory, saveMemory, forgetMemory, pushHistory, ACCESSORIES } from '../src/companion/memory.js';
import {
  dayKey, previousDay, levelFromXp, xpNeeded, award, bondLevel, addBond, touchDay, daysBetween,
  pickMissions, todaysMissions, track, claim, checkAchievements, MISSION_BONUS_XP, MISSION_POOL
} from '../src/companion/gamification.js';
import { buildTrivia, TRIVIA } from '../src/companion/minigames.js';
import { startSession, remainingMs, nextNudge, formatClock, breathAt, BREATH_CYCLE_SECONDS } from '../src/companion/session.js';
import { reply, proactive, norm, extractMemory, tabTip } from '../src/companion/brain.js';

const fakeStorage = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

// ---------- memoria ----------
test('la memoria se guarda por usuario y sobrevive a datos corruptos', () => {
  const st = fakeStorage();
  const mem = defaultMemory(); mem.nickname = 'Nova'; mem.color = 'cyan';
  saveMemory('u1', mem, st);
  assert.equal(loadMemory('u1', st).nickname, 'Nova');
  assert.equal(loadMemory('u2', st).nickname, '');          // otro usuario, otra memoria
  st.setItem('gvq:vora:u3', '{no es json');
  assert.equal(loadMemory('u3', st).name, 'VORA');          // corrupto → valores por defecto
  st.setItem('gvq:vora:u4', JSON.stringify({ color: 'rosa-fucsia', vibe: 'x', accessory: 'y' }));
  const fixed = loadMemory('u4', st);
  assert.equal(fixed.color, 'crimson'); assert.equal(fixed.vibe, 'animo'); assert.equal(fixed.accessory, 'none');
});
test('olvidar borra la memoria y el historial se limita a 40 mensajes', () => {
  const st = fakeStorage(); const mem = defaultMemory();
  for (let i = 0; i < 60; i++) pushHistory(mem, 'me', 'm' + i);
  assert.equal(mem.history.length, 40);
  saveMemory('u1', mem, st); forgetMemory('u1', st);
  assert.equal(st.getItem('gvq:vora:u1'), null);
});

// ---------- gamificación ----------
test('el nivel sube de forma progresiva con la XP', () => {
  assert.equal(levelFromXp(0).level, 1);
  assert.equal(levelFromXp(xpNeeded(1) - 1).level, 1);
  assert.equal(levelFromXp(xpNeeded(1)).level, 2);
  assert.equal(levelFromXp(xpNeeded(1) + xpNeeded(2)).level, 3);
  const lv = levelFromXp(30); assert.ok(lv.pct > 0 && lv.pct < 100);
});
test('award avisa cuando se sube de nivel', () => {
  const mem = defaultMemory();
  assert.equal(award(mem, 10).leveledUp, false);
  assert.equal(award(mem, xpNeeded(1)).leveledUp, true);
});
test('la racha suma días consecutivos y se reinicia si hay un hueco', () => {
  const mem = defaultMemory();
  touchDay(mem, '2026-10-20'); assert.equal(mem.streak, 1);
  const same = touchDay(mem, '2026-10-20'); assert.equal(same.firstOfDay, false); assert.equal(mem.streak, 1);
  touchDay(mem, '2026-10-21'); touchDay(mem, '2026-10-22'); assert.equal(mem.streak, 3); assert.equal(mem.bestStreak, 3);
  const r = touchDay(mem, '2026-10-26'); assert.equal(mem.streak, 1); assert.equal(r.streakBroken, true); assert.equal(r.returningAfter, 4);
  assert.equal(mem.bestStreak, 3); assert.equal(mem.days, 4);
});
test('previousDay y daysBetween funcionan en cambios de mes y año', () => {
  assert.equal(previousDay('2026-03-01'), '2026-02-28');
  assert.equal(previousDay('2027-01-01'), '2026-12-31');
  assert.equal(daysBetween('2026-10-20', '2026-10-26'), 6);
  assert.match(dayKey(new Date(2026, 9, 5)), /^2026-10-05$/);
});
test('las misiones diarias son deterministas por día y distintas entre días', () => {
  const a = pickMissions('2026-10-25').map(m => m.id), b = pickMissions('2026-10-25').map(m => m.id);
  assert.deepEqual(a, b); assert.equal(a.length, 3); assert.equal(new Set(a).size, 3);
  const days = new Set(Array.from({ length: 10 }, (_, i) => pickMissions('2026-10-' + (10 + i)).map(m => m.id).join()));
  assert.ok(days.size > 1);
});
test('seguir una misión: progreso, reclamo único y bono por completar todas', () => {
  const mem = defaultMemory(); touchDay(mem, '2026-10-25');
  const list = todaysMissions(mem); assert.equal(list.length, 3);
  let totalXp = 0;
  for (const m of list) {
    assert.equal(claim(mem, m.id).ok, false);               // no se puede reclamar sin terminar
    const t = track(mem, m.event, m.goal);
    assert.deepEqual(t.completed, [m.id]);
    const c = claim(mem, m.id); assert.equal(c.ok, true); totalXp += m.xp;
    assert.equal(claim(mem, m.id).ok, false);               // no se reclama dos veces
  }
  assert.equal(mem.xp, totalXp + MISSION_BONUS_XP);
  assert.equal(mem.missions.bonus, true);
});
test('track ignora eventos que no pertenecen a las misiones del día', () => {
  const mem = defaultMemory(); touchDay(mem, '2026-10-25');
  const ids = new Set(mem.missions.list);
  const t = track(mem, 'evento-inexistente', 5); assert.deepEqual(t.completed, []);
  assert.ok(ids.size === 3);
});
test('el vínculo sube por nivel y tiene topes diarios por caricias', () => {
  assert.equal(bondLevel(0).level, 1); assert.equal(bondLevel(12).level, 2); assert.equal(bondLevel(500).level, 5);
  const mem = defaultMemory(); touchDay(mem, '2026-10-25');
  for (let i = 0; i < 20; i++) addBond(mem, 'pet');
  assert.equal(mem.bond, 5);                                  // tope de 5 por día
  addBond(mem, 'session', 7); assert.equal(mem.bond, 12);
  assert.equal(bondLevel(mem.bond).level, 2);
  assert.ok(ACCESSORIES.filter(a => a.bond <= 2).length >= 2);
});
test('los logros se desbloquean una sola vez', () => {
  const mem = defaultMemory(); mem.bestStreak = 3; mem.sessionsDone = 1;
  const first = checkAchievements(mem).map(a => a.id); assert.ok(first.includes('streak3') && first.includes('focus'));
  assert.deepEqual(checkAchievements(mem), []);
});

// ---------- mini-juegos ----------
test('la trivia mezcla respuestas pero conserva la correcta', () => {
  const qs = buildTrivia(5, Math.random);
  assert.equal(qs.length, 5);
  for (const q of qs) {
    const original = TRIVIA.find(t => t.q === q.q);
    assert.equal(q.options[q.correct], original.a[original.c]);
    assert.equal(new Set(q.options).size, q.options.length);
  }
  assert.ok(TRIVIA.every(t => t.a.length === 4 && t.c >= 0 && t.c < 4));
});
// ---------- sesión juntos ----------
test('la sesión calcula tiempo restante y mensajes de ánimo', () => {
  const t0 = 1_000_000; const s = startSession('focus', 25, t0);
  assert.equal(remainingMs(s, t0), 25 * 60000);
  assert.equal(remainingMs(s, t0 + 30 * 60000), 0);
  assert.equal(nextNudge(s, t0 + 60000), 0);
  assert.equal(nextNudge(s, t0 + 7 * 60000), 1); s.nudges = 1;
  assert.equal(nextNudge(s, t0 + 8 * 60000), 0);
  assert.equal(nextNudge(s, t0 + 20 * 60000), 3);
  assert.equal(formatClock(61000), '01:01');
  assert.equal(startSession('x', 999, t0).minutes, 25);
});
test('la respiración en caja alterna 4 fases de 4 segundos', () => {
  assert.equal(BREATH_CYCLE_SECONDS, 16);
  assert.equal(breathAt(0).phase, 'in'); assert.equal(breathAt(4).phase, 'hold');
  assert.equal(breathAt(8).phase, 'out'); assert.equal(breathAt(12).phase, 'rest');
  assert.equal(breathAt(16).phase, 'in'); assert.equal(breathAt(16).cycle, 1);
});

// ---------- cerebro (conversación) ----------
test('norm elimina acentos y signos de apertura', () => assert.equal(norm('¡Hola, ¿cómo estás?!'), 'hola, como estas?!'));
test('VORA responde saludos y usa el nombre del usuario', () => {
  const r = reply('¡Hola!', { nick: 'Deivi', greet: 'Buenas noches', vibe: 'animo' }, () => 0);
  assert.match(r.text, /Deivi/); assert.ok(r.chips.length > 0);
});
test('VORA entiende intenciones comunes', () => {
  const ctx = { vibe: 'animo', level: 3, streak: 4, missionsDone: 1, missionsTotal: 3 };
  assert.match(reply('cuéntame un chiste', ctx, () => 0).text, /NPC/);
  assert.match(reply('dato curioso', ctx, () => 0).text, /Dato gamer/);
  assert.match(reply('mis misiones', ctx).text, /nivel 3.*4 día.*1\/3/);
  assert.ok(reply('quiero jugar trivia', ctx).chips.some(c => c.a === 'game:trivia'));
  assert.ok(reply('estoy muy estresado', ctx).chips.some(c => c.a === 'breathe'));
  assert.ok(reply('como creo un squad', ctx).chips.some(c => c.a === 'go:squads'));
  assert.ok(reply('quiero instalar la app', ctx).chips.some(c => c.a === 'install'));
  assert.match(reply('quién eres', ctx).text, /VORA/);
});
test('VORA recomienda gente de SYNC si hay coincidencias', () => {
  const r = reply('busco equipo', { topMatch: { id: 'd4', name: 'Luna', score: 92, why: '2 juegos en común' } });
  assert.match(r.text, /Luna.*92%/); assert.ok(r.chips.some(c => c.a === 'dm:d4'));
  assert.ok(reply('busco equipo', {}).chips.some(c => c.a === 'go:play'));
});
test('VORA recuerda el nombre y el juego favorito', () => {
  assert.equal(extractMemory('me llamo carlos').nickname, 'Carlos');
  assert.equal(extractMemory('mi juego favorito es Hollow Knight').favGame, 'Hollow Knight');
  assert.deepEqual(extractMemory('dime un chiste'), {});
  assert.deepEqual(extractMemory('dime cuál es mi nivel'), {});
  const r = reply('me llamo Ana', {}); assert.equal(r.remember.nickname, 'Ana');
});
test('ante señales de crisis VORA ofrece recursos reales y no bromea', () => {
  const r = reply('ya no quiero vivir', { vibe: 'animo' });
  assert.equal(r.mood, 'caring'); assert.match(r.text, /800 911 2000/); assert.match(r.text, /911/);
  assert.match(r.text, /no puedo sustituir a una persona/);
  assert.ok(!/chiste|jaja/i.test(r.text));
});
test('si no entiende, ofrece alternativas en vez de inventar', () => {
  const r = reply('blablabla zxqv', { vibe: 'calma' });
  assert.equal(r.mood, 'curious'); assert.ok(r.chips.length >= 2);
});
test('las respuestas cambian según la personalidad elegida', () => {
  const lines = new Set(['animo', 'calma', 'estratega'].map(v => proactive('welcome', { vibe: v, nick: 'Nova', greet: 'Hola' }, () => 0).text));
  assert.equal(lines.size, 3);
});
test('los eventos espontáneos rellenan variables y no dejan llaves sin sustituir', () => {
  for (const ev of ['welcome', 'welcome_streak', 'level_up', 'bond_up', 'synced', 'session_end', 'achievement', 'notifications', 'welcome_back']) {
    const p = proactive(ev, { nick: 'Nova', streak: 5, level: 4, bond: 2, count: 3, xp: 25, label: 'Constante', away: 3, greet: 'Hola' }, () => 0);
    assert.ok(p && !/[{}]/.test(p.text), ev + ': ' + (p && p.text));
  }
  assert.equal(proactive('no-existe'), null);
  assert.ok(!/[{}]/.test(proactive('welcome', { greet: 'Hola' }, () => 0).text)); // sin nombre tampoco quedan llaves
});
test('hay consejo para las secciones principales', () => {
  for (const t of ['home', 'play', 'squads', 'communities', 'profile']) assert.ok(tabTip(t).text.length > 10);
  assert.equal(tabTip('universe'), null); // secciones retiradas en la v6
  assert.equal(tabTip('inexistente'), null);
});

test('VORA explica la traducción y las funciones nuevas de la v6', () => {
  assert.ok(reply('cómo funciona la traducción de idiomas', {}).chips.some(c => c.a === 'modal:settings'));
  assert.ok(reply('quiero marcarme disponible', {}).chips.some(c => c.a === 'modal:set-available'));
  assert.ok(reply('cómo agendar una partida', {}).chips.some(c => c.a === 'modal:schedule-session'));
  assert.ok(reply('qué es el pasaporte gg', {}).chips.some(c => c.a === 'go:profile'));
  assert.ok(!/\{/.test(proactive('tilt', { nick: 'Nova' }, () => 0).text));
});
test('las misiones solo apuntan a secciones que existen', () => {
  const tabs = new Set(['home', 'play', 'squads', 'communities', 'profile']);
  for (const m of MISSION_POOL) if (m.tab) assert.ok(tabs.has(m.tab), m.id + ' → ' + m.tab);
});
