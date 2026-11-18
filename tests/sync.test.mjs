import test from 'node:test';import assert from 'node:assert/strict';
import {compatibility} from '../src/sync.js';
import {guardianCheck,normalizeMessage} from '../src/guardian.js';
test('SYNC rewards genuinely shared games and preferences',()=>{
 const a={play_style:'Casual',platform:'PC',mic_preference:'Con micrófono',schedule:'Noche'};
 const b={...a};
 const high=compatibility(a,b,[1,2],[2,3]);
 const low=compatibility(a,{play_style:'Competitivo',platform:'Xbox',mic_preference:'Sin micrófono',schedule:'Tarde'},[1,2],[4]);
 assert.ok(high.score>low.score);assert.ok(high.why.some(x=>x === '1 juego en común'));
});
test('SYNC never exceeds 100%',()=>assert.equal(compatibility({play_style:'Casual',platform:'PC',mic_preference:'Indistinto',schedule:'Noche'},{play_style:'Casual',platform:'PC',mic_preference:'Indistinto',schedule:'Noche'},[1,2,3,4,5,6,7,8],[1,2,3,4,5,6,7,8]).score,100));
test('GUARDIAN gives repeatable hints without banning users',()=>{
 const text='No seas idiota';assert.equal(guardianCheck(text).length,1);assert.equal(guardianCheck(text).length,1);assert.deepEqual(guardianCheck('¡GG! Buen equipo.'),[]);
});
test('Text normalization trims message length',()=>assert.equal(normalizeMessage('  hola mundo  ',7),'hola mu'));
