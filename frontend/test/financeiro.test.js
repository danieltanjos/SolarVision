import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCo2, formatReais } from '../src/lib/financeiro.js';

test('FE-FIN: reais no padrão pt-BR', () => {
  assert.equal(formatReais(1234.5).replace(/\s/g, ' '), 'R$ 1.234,50');
  assert.equal(formatReais(null).replace(/\s/g, ' '), 'R$ 0,00');
});
test('FE-CO2: kg até 1 t, depois toneladas', () => {
  assert.equal(formatCo2(110.43), '110,4 kg CO₂');
  assert.equal(formatCo2(2500), '2,5 t CO₂');
  assert.equal(formatCo2('x'), '0 kg CO₂');
});
