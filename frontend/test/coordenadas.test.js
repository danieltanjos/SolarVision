import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCoordenadas } from '../src/lib/coordenadas.js';

const floripa = { latitude: -27.548, longitude: -48.498778 };

for (const [entrada, esperado] of [
  ['-27.548, -48.498778', floripa],
  ['  -27.548 -48.498778 ', floripa],
  [`27°32'52.8"S 48°29'55.6"W`, floripa],
  [`27°32'52.8"S 48°29'55.6"O`, floripa],
  [`27° 32' 52,8" S, 48° 29' 55,6" W`, floripa],
  [`23°33'S 46°38'W`, { latitude: -23.55, longitude: -46.633333 }],
  [`1°30'N 30°E`, { latitude: 1.5, longitude: 30 }]
]) {
  test(`FE-COO: lê "${entrada}"`, () => assert.deepEqual(parseCoordenadas(entrada), esperado));
}

for (const entrada of ['273252.8', '273252.8, 482955.6', '-27.5', 'abc', '', `48°29'55.6"W 27°32'52.8"S`]) {
  test(`FE-COO: rejeita "${entrada}"`, () => assert.equal(parseCoordenadas(entrada), null));
}
