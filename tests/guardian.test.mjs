import test from 'node:test';
import assert from 'node:assert/strict';
import { guardianCheck, softenMessage, isShouting } from '../src/guardian.js';

test('GUARDIAN: una marca o sigla suelta no cuenta como grito', () => {
  for (const t of ['Probando mi primera publicación en GAMVORAQ v5', '¡GG! Buen equipo.', 'Juega VALORANT conmigo', 'Hola, juguemos MINECRAFT esta noche']) {
    assert.deepEqual(guardianCheck(t), [], t);
  }
});

test('GUARDIAN: un mensaje casi todo en mayúsculas sí se detecta y se suaviza a minúsculas', () => {
  for (const t of ['NO ME GUSTA NADA ESTE JUEGO', 'QUE MALO ERES SIEMPRE']) {
    assert.ok(isShouting(t), t);
    assert.equal(guardianCheck(t)[0].code, 'gritos');
  }
  assert.equal(softenMessage('NO ME GUSTA NADA ESTE JUEGO'), 'No me gusta nada este juego');
});

test('GUARDIAN: insultos, hostilidad, amenazas y datos personales', () => {
  assert.equal(guardianCheck('No seas idiota')[0].code, 'insulto');
  assert.equal(guardianCheck('cállate ya')[0].code, 'hostigamiento');
  assert.equal(guardianCheck('te voy a matar')[0].code, 'amenaza');
  assert.equal(guardianCheck('escríbeme a nova@ejemplo.com')[0].code, 'privacidad');
  assert.equal(guardianCheck('5512345678')[0].code, 'privacidad');
});

test('GUARDIAN: la versión amable reemplaza insultos pero respeta el resto', () => {
  assert.equal(softenMessage('No seas idiota'), 'No seas equivocado');
  assert.equal(softenMessage('Buena partida, GG'), 'Buena partida, GG');
});
