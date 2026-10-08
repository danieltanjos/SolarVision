import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatReais } from '../src/lib/financeiro.js';

test('FE-FIN: reais no padrão pt-BR', () => {
  assert.equal(formatReais(1234.5).replace(/\s/g, ' '), 'R$ 1.234,50');
  assert.equal(formatReais(null).replace(/\s/g, ' '), 'R$ 0,00');
});
