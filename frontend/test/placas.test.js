import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPerda, orientacao, perdaMedia } from '../src/lib/placas.js';

test('FE-SUJ: perda média ponderada pela potência', () => {
  const placas = [{ potenciaWp: 3000, perdaSujeira: 0.2 }, { potenciaWp: 1000, perdaSujeira: 0 }];
  assert.equal(perdaMedia(placas), 0.15);
});
test('FE-SUJ: placas sem potência ou sem perda ficam de fora', () => {
  assert.equal(perdaMedia([{ potenciaWp: null, perdaSujeira: 0.2 }, { potenciaWp: 500, perdaSujeira: 0.1 }]), 0.1);
  assert.equal(perdaMedia([]), null);
});
test('FE-SUJ: formatação em %', () => {
  assert.equal(formatPerda(0.123), '12%');
  assert.equal(formatPerda(null), '—');
});
test('FE-ORI: orientação pelo azimute', () => {
  assert.equal(orientacao(45), 'Nordeste');
  assert.equal(orientacao(10), '10°');
});
