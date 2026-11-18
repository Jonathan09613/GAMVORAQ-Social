// Reglas puras de la v7: aniversarios, ligas y coach sin IA.
import test from 'node:test';
import assert from 'node:assert/strict';
import { monthsBetween, togetherLabel, anniversaries, roundRobin, standings, coachTips } from '../src/features.js';

test('meses y etiqueta de tiempo juntos', () => {
  assert.equal(monthsBetween('2026-01-15T12:00:00', '2026-04-14T12:00:00'), 2);
  assert.equal(monthsBetween('2026-01-15T12:00:00', '2026-04-15T12:00:00'), 3);
  assert.equal(togetherLabel(new Date(2026, 0, 1), new Date(2026, 0, 6).getTime()), '5 días juntos');
  assert.equal(togetherLabel(new Date(2025, 10, 1), new Date(2026, 10, 2).getTime()), '1 año juntos');
});

test('aniversarios: hitos de 1, 3, 6 meses y cada año, hasta 3 días después', () => {
  const squads = [{ id: 's1', name: 'Crimson' }, { id: 's2', name: 'Mine' }];
  const now = new Date(2026, 10, 11, 20, 0).getTime();
  const members = [
    { squad_id: 's1', user_id: 'yo', joined_at: new Date(2025, 10, 11, 10, 0).toISOString() },  // 1 año hoy
    { squad_id: 's2', user_id: 'yo', joined_at: new Date(2026, 7, 9, 10, 0).toISOString() },    // 3 meses hace 2 días
    { squad_id: 's1', user_id: 'otro', joined_at: new Date(2025, 10, 11).toISOString() }
  ];
  const a = anniversaries(squads, members, 'yo', now);
  assert.equal(a.length, 2);
  assert.match(a[0].text, /^Hoy se cumple 1 año desde que entraste a Crimson$/);
  assert.match(a[1].text, /Hace 2 días se cumplieron tres meses/);
  assert.equal(anniversaries(squads, [{ squad_id: 's1', user_id: 'yo', joined_at: new Date(2026, 6, 11).toISOString() }], 'yo', now).length, 0, '4 meses no es un hito');
});

test('liga todos contra todos: cada pareja juega una vez, sin repetir equipo por ronda', () => {
  for (const n of [2, 3, 4, 5, 6]) {
    const teams = Array.from({ length: n }, (_, i) => 't' + i);
    const fx = roundRobin(teams);
    assert.equal(fx.length, n * (n - 1) / 2, `${n} equipos`);
    const pairs = new Set(fx.map(m => [m.home, m.away].sort().join('-')));
    assert.equal(pairs.size, fx.length, 'sin parejas repetidas');
    for (const r of new Set(fx.map(m => m.round))) {
      const inRound = fx.filter(m => m.round === r).flatMap(m => [m.home, m.away]);
      assert.equal(new Set(inRound).size, inRound.length, 'nadie juega dos veces en la misma ronda');
    }
  }
  assert.deepEqual(roundRobin(['solo']), []);
});

test('tabla de posiciones con puntos y desempates', () => {
  const m = (h, a, hs, as, status = 'played') => ({ home_squad: h, away_squad: a, home_score: hs, away_score: as, status });
  const t = standings(['A', 'B', 'C'], [m('A', 'B', 13, 9), m('B', 'C', 5, 5), m('C', 'A', 2, 1), m('A', 'C', null, null, 'scheduled')]);
  assert.deepEqual(t.map(r => [r.id, r.pts, r.pj]), [['C', 4, 2], ['A', 3, 2], ['B', 1, 2]]);
  assert.equal(t[1].gf - t[1].gc, 3);
});

test('coach sin IA: consejos según lo que pasó, siempre 3', () => {
  const r = coachTips({ result: 'loss', notes: 'Nadie hablaba y me dio tilt, además había lag' });
  assert.equal(r.tips.length, 3);
  assert.match(r.tips[0], /avisos cortos/); assert.match(r.tips[1], /pausa/); assert.match(r.tips[2], /cable/);
  assert.match(r.cheer, /Perder también enseña/);
  assert.equal(coachTips({}).tips.length, 3);
});
