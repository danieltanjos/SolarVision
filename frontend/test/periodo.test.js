import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRangeLabel, janelasRelatorio, mesRelatorio, rangeFor, shiftDate, toSaoPaulo } from '../src/lib/periodo.js';

// 06/10/2026 22:30 em SP = 07/10 01:30 UTC: em navegador fora de SP o dia "local" seria outro.
const ref = toSaoPaulo('2026-10-07T01:30:00Z');

for (const [view, inicio, fim, label] of [
  ['dia', '2026-10-06T03:00:00.000Z', '2026-10-07T02:59:59.999Z', '06/10/2026'],
  ['semana', '2026-10-04T03:00:00.000Z', '2026-10-11T02:59:59.999Z', '04/10 - 10/10/2026'],
  ['mes', '2026-10-01T03:00:00.000Z', '2026-11-01T02:59:59.999Z', 'Outubro de 2026'],
  ['ano', '2026-01-01T03:00:00.000Z', '2027-01-01T02:59:59.999Z', '2026']
]) {
  test(`FE-PER: janela "${view}" no calendário de São Paulo`, () => {
    assert.deepEqual(rangeFor(view, ref), { dataInicio: inicio, dataFim: fim });
    assert.equal(formatRangeLabel(view, ref), label);
  });
}

test('FE-PER: navegar volta um período inteiro', () => {
  assert.equal(rangeFor('dia', shiftDate(ref, 'dia', -1)).dataInicio, '2026-10-05T03:00:00.000Z');
  assert.equal(rangeFor('ano', shiftDate(ref, 'ano', 1)).dataInicio, '2027-01-01T03:00:00.000Z');
});

test('FE-PER: mês do relatório: o da URL ou o mês passado em SP', () => {
  assert.equal(mesRelatorio('2026-02', new Date('2026-10-07T12:00:00Z')), '2026-02');
  assert.equal(mesRelatorio('2026-13', new Date('2026-10-07T12:00:00Z')), '2026-09');
  assert.equal(mesRelatorio(null, new Date('2026-03-31T12:00:00Z')), '2026-02'); // não pula fevereiro
  assert.equal(mesRelatorio(null, new Date('2026-01-01T02:00:00Z')), '2025-11'); // ainda 31/12 em SP
});

test('FE-PER: relatório compara com o mês anterior; mês em andamento, com o mesmo trecho dele', () => {
  const agora = new Date('2026-10-07T17:00:00Z'); // 07/10 14:00 em SP
  assert.deepEqual(janelasRelatorio('2026-09', agora), {
    atual: { dataInicio: '2026-09-01T03:00:00.000Z', dataFim: '2026-10-01T02:59:59.999Z' },
    anterior: { dataInicio: '2026-08-01T03:00:00.000Z', dataFim: '2026-09-01T02:59:59.999Z' }
  });
  assert.deepEqual(janelasRelatorio('2026-10', agora), {
    atual: { dataInicio: '2026-10-01T03:00:00.000Z', dataFim: '2026-10-07T17:00:00.000Z' },
    anterior: { dataInicio: '2026-09-01T03:00:00.000Z', dataFim: '2026-09-07T17:00:00.000Z' }
  });
  assert.equal(janelasRelatorio('2026-01', agora).anterior.dataInicio, '2025-12-01T03:00:00.000Z'); // vira o ano
  assert.equal(janelasRelatorio('2027-01', agora).atual.dataFim, '2027-01-01T03:00:00.000Z'); // futuro: janela vazia
});
