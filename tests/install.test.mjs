import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPlatform, parseShare, shouldOfferInstall, GUIDES, GUIDE_ORDER } from '../src/install.js';

const UA = {
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1',
  ipadOS: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  winChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  macFirefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:131.0) Gecko/20100101 Firefox/131.0',
  chromebook: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
};

test('detecta cada plataforma y navegador', () => {
  assert.equal(detectPlatform(UA.androidChrome).id, 'android-chrome');
  assert.equal(detectPlatform(UA.samsung).id, 'android-samsung');
  assert.equal(detectPlatform(UA.androidFirefox).id, 'android-firefox');
  assert.equal(detectPlatform(UA.iphoneSafari).id, 'ios-safari');
  assert.equal(detectPlatform(UA.iphoneChrome).id, 'ios-other');
  assert.equal(detectPlatform(UA.winChrome).id, 'desktop-chrome');
  assert.equal(detectPlatform(UA.winEdge).id, 'desktop-edge');
  assert.equal(detectPlatform(UA.macFirefox).id, 'desktop-firefox');
  assert.equal(detectPlatform(UA.chromebook).id, 'desktop-chrome');
  assert.equal(detectPlatform('').id, 'other');
});

test('el iPad que se presenta como Mac se reconoce por la pantalla táctil', () => {
  assert.equal(detectPlatform(UA.ipadOS, { maxTouchPoints: 5 }).id, 'ios-safari');
  assert.equal(detectPlatform(UA.ipadOS, { maxTouchPoints: 0 }).id, 'mac-safari');
  assert.equal(detectPlatform(UA.ipadOS, { maxTouchPoints: 5 }).mobile, true);
});

test('todas las guías tienen pasos y etiqueta', () => {
  for (const id of [...GUIDE_ORDER, 'other']) { assert.ok(GUIDES[id].label); assert.ok(GUIDES[id].steps.length >= 2, id); }
  assert.equal(new Set(GUIDE_ORDER).size, GUIDE_ORDER.length);
});

test('contenido compartido desde otra app', () => {
  assert.equal(parseShare('?title=Clip&text=Mira%20esto&url=https%3A%2F%2Fyoutu.be%2Fx'), 'Clip\nMira esto\nhttps://youtu.be/x');
  assert.equal(parseShare('?text=Mira%20https%3A%2F%2Fa.b&url=https%3A%2F%2Fa.b'), 'Mira https://a.b', 'no repite el enlace');
  assert.equal(parseShare('?url=javascript%3Aalert(1)'), null, 'ignora enlaces que no son http');
  assert.equal(parseShare('?tab=play'), null);
  assert.equal(parseShare('?title=Hola&text=Hola'), 'Hola');
  assert.equal(parseShare('?text=' + 'a'.repeat(6000)).length, 5000);
});

test('cuándo sugerir instalar', () => {
  const now = 1_000_000_000_000;
  assert.equal(shouldOfferInstall({ standalone: true, installable: true, platformId: 'android-chrome', now }), false);
  assert.equal(shouldOfferInstall({ standalone: false, installable: true, platformId: 'android-chrome', now }), true);
  assert.equal(shouldOfferInstall({ standalone: false, installable: false, platformId: 'ios-safari', now }), true);
  assert.equal(shouldOfferInstall({ standalone: false, installable: false, platformId: 'desktop-firefox', now }), false);
  assert.equal(shouldOfferInstall({ standalone: false, installable: true, platformId: 'android-chrome', dismissedAt: now - 3 * 864e5, now }), false);
  assert.equal(shouldOfferInstall({ standalone: false, installable: true, platformId: 'android-chrome', dismissedAt: now - 15 * 864e5, now }), true);
});
