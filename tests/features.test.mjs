// Reglas de las funciones nuevas de la v6.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  availabilityActive, remainingLabel, sessionState, rateableMates, sessionIcs, passportLevel, topTags, chemistryBonus,
  awaySummary, isFrustrated, tiltCheck, ageBand, cleanTags, whenLabel
} from '../src/features.js';

const MIN = 60000, H = 3600000, D = 86400000, now = Date.parse('2026-11-11T20:00:00Z');
const iso = t => new Date(t).toISOString();

test('disponibilidad: activa solo hasta su hora y etiqueta de tiempo restante', () => {
  assert.equal(availabilityActive({ until: iso(now + MIN) }, now), true);
  assert.equal(availabilityActive({ until: iso(now - MIN) }, now), false);
  assert.equal(remainingLabel(iso(now + 45 * MIN), now), 'quedan 45 min');
  assert.equal(remainingLabel(iso(now + 2 * H + 20 * MIN), now), 'quedan 2 h 20 min');
  assert.equal(remainingLabel(iso(now + H + 59.7 * MIN), now), 'quedan 2 h', 'no muestra «1 h 60 min»');
  assert.equal(remainingLabel(iso(now - 1), now), 'terminó');
});

test('estado de una partida en el tiempo', () => {
  const s = { starts_at: iso(now + 2 * H), duration_min: 60, status: 'scheduled' };
  assert.equal(sessionState(s, now), 'upcoming');
  assert.equal(sessionState(s, now + 90 * MIN), 'soon');
  assert.equal(sessionState(s, now + 2.5 * H), 'live');
  assert.equal(sessionState(s, now + 4 * H), 'ended');
  assert.equal(sessionState({ ...s, status: 'cancelled' }, now), 'cancelled');
});

test('solo se califica a quienes confirmaron, después de empezar y por 14 días', () => {
  const s = { id: 's', starts_at: iso(now - H), duration_min: 60, status: 'scheduled' };
  const rs = [{ session_id: 's', user_id: 'yo', status: 'going' }, { session_id: 's', user_id: 'a', status: 'going' }, { session_id: 's', user_id: 'b', status: 'maybe' }];
  assert.deepEqual(rateableMates(s, rs, 'yo', now), ['a']);
  assert.deepEqual(rateableMates(s, rs, 'b', now), [], 'quien dijo «tal vez» no califica');
  assert.deepEqual(rateableMates({ ...s, starts_at: iso(now + H) }, rs, 'yo', now), [], 'antes de empezar no');
  assert.deepEqual(rateableMates({ ...s, starts_at: iso(now - 15 * D) }, rs, 'yo', now), [], 'después de 14 días no');
});

test('el archivo de calendario es válido y escapa el texto', () => {
  const ics = sessionIcs({ id: 'abc', title: 'Noche, rankeds; y más', starts_at: '2026-11-12T03:00:00Z', duration_min: 90 }, { game: 'Valorant', squad: 'Crimson' });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20261112T030000Z/);
  assert.match(ics, /DTEND:20261112T043000Z/);
  assert.match(ics, /SUMMARY:Noche\\, rankeds\\; y más/);
  assert.match(ics, /TRIGGER:-PT15M/);
  assert.ok(ics.split('\r\n').every(l => l.length <= 75), 'líneas plegadas a 75 caracteres');
});

test('Pasaporte GG: niveles, progreso y etiquetas destacadas', () => {
  assert.equal(passportLevel({}).id, 'nuevo');
  assert.equal(passportLevel({ sessions: 1 }).id, 'camino');
  assert.equal(passportLevel({ sessions: 5, raters: 2 }).id, 'camino', 'hacen falta personas que califiquen, no solo partidas');
  assert.equal(passportLevel({ sessions: 12, raters: 9 }).id, 'gg');
  assert.equal(passportLevel({ sessions: 40, raters: 25 }).next, null);
  const lv = passportLevel({ sessions: 2, raters: 1 });
  assert.ok(lv.pct > 0 && lv.pct < 100);
  assert.deepEqual(topTags({ amable: 3, inventada: 9, puntual: 5 }).map(t => t.id), ['puntual', 'amable']);
  assert.deepEqual(cleanTags(['amable', 'toxico', 'amable', 'puntual']), ['amable', 'puntual']);
});

test('la química suma a la afinidad con tope', () => {
  assert.equal(chemistryBonus(null), null);
  assert.equal(chemistryBonus({ points: 2, sessions: 1 }).bonus, 6);
  assert.equal(chemistryBonus({ points: 40, sessions: 9 }).bonus, 25);
  assert.match(chemistryBonus({ points: 3, sessions: 1 }).why, /1 partida$/);
});

test('«Mientras no estabas» cuenta solo lo nuevo de mi gente', () => {
  const since = now - H;
  const data = {
    squads: [{ id: 's1', name: 'Crimson' }], squad_members: [{ squad_id: 's1', user_id: 'yo' }],
    squad_messages: [{ squad_id: 's1', sender_id: 'a', created_at: iso(now - 10 * MIN) }, { squad_id: 's1', sender_id: 'yo', created_at: iso(now - 5 * MIN) }, { squad_id: 's1', sender_id: 'a', created_at: iso(now - 2 * H) }],
    conversations: [{ id: 'c', user_low: 'a', user_high: 'yo' }], direct_messages: [{ conversation_id: 'c', sender_id: 'a', created_at: iso(now - MIN) }],
    community_members: [], posts: [],
    play_sessions: [{ id: 'p', starts_at: iso(now + 3 * H), status: 'scheduled' }], session_rsvps: [{ session_id: 'p', user_id: 'yo', status: 'going' }]
  };
  const s = awaySummary(data, 'yo', since, now);
  assert.deepEqual(s.lines.map(l => l.kind), ['squad', 'dm', 'sessions']);
  assert.equal(s.lines[0].text, '1 mensaje nuevo en Crimson');
  assert.equal(awaySummary(data, 'yo', 0, now).total, 0);
});

test('modo tilt: dos señales en 10 minutos y luego descanso de 30', () => {
  assert.ok(isFrustrated('perdimos otra vez, me rindo'));
  assert.ok(isFrustrated('I hate this game'));
  assert.ok(!isFrustrated('buena partida, gg'));
  const sig = [{ at: now - 2 * MIN }, { at: now - MIN }];
  assert.equal(tiltCheck(sig, 0, now), true);
  assert.equal(tiltCheck([{ at: now - 20 * MIN }, { at: now - MIN }], 0, now), false);
  assert.equal(tiltCheck(sig, now - 10 * MIN, now), false, 'no insiste durante 30 minutos');
});

test('rango de edad igual que en la base de datos (18+)', () => {
  const ref = new Date('2026-06-01');
  assert.equal(ageBand(null, ref), 'unknown');
  assert.equal(ageBand(2007, ref), 'adult');
  assert.equal(ageBand(2008, ref), 'adult', 'v13: quien cumple 18 este año ya cuenta como adulto');
  assert.equal(ageBand(2009, ref), 'minor');
  assert.equal(ageBand(2012, ref), 'minor');
});

test('etiqueta de día relativa', () => {
  const base = new Date(2026, 10, 11, 12, 0).getTime();
  assert.match(whenLabel(new Date(2026, 10, 11, 21, 0), base), /^Hoy /);
  assert.match(whenLabel(new Date(2026, 10, 12, 9, 0), base), /^Mañana /);
});
