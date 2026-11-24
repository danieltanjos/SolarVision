import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simular } from '../src/lib/simulacao.js';

test('FE-SIM: ao meio-dia, placas limpas geram perto do pico (4 x 550 Wp x PR 0,82)', () => {
  const { watts, dia, perda } = simular(12, 0);
  assert.equal(dia, true);
  assert.equal(perda, 0);
  assert.ok(watts > 1700 && watts < 1804, `watts = ${watts}`);
});

test('FE-SIM: sem sol não há geração', () => {
  for (const hora of [5, 6, 18, 19]) assert.equal(simular(hora, 0).watts, 0);
});

test('FE-SIM: a sujeira tira 0,2% ao dia, até 20%', () => {
  const limpa = simular(12, 0).watts;
  assert.ok(Math.abs(simular(12, 45).watts / limpa - 0.91) < 1e-9);
  assert.equal(simular(12, 100).perda, 0.2);
  assert.equal(simular(12, 500).perda, 0.2);
});

test('FE-SIM: manhã e tarde são simétricas em torno do meio-dia', () => {
  assert.ok(Math.abs(simular(9, 0).watts - simular(15, 0).watts) < 1e-6);
});
