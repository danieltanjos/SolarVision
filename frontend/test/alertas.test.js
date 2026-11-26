import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periodoDeficit, quando } from '../src/lib/alertas.js';

test('FE-ALE: quando conta dias do calendário de SP', () => {
  const agora = new Date('2026-10-08T12:00:00Z'); // 09:00 em SP
  assert.equal(quando('2026-10-08T10:00:00Z', agora), 'hoje');
  assert.equal(quando('2026-10-08T02:00:00Z', agora), 'ontem'); // 23:00 de 07/10 em SP
  assert.equal(quando('2026-10-05T10:00:00Z', agora), 'há 3 dias');
});

test('FE-ALE: periodoDeficit cobre as horas importadas, no máximo os últimos 7 dias', () => {
  assert.equal(periodoDeficit([]), null);
  // fora de ordem, como pode vir do CSV
  assert.deepEqual(periodoDeficit([{ dataHora: '2026-10-08T14:35:00.000Z' }, { dataHora: '2026-10-08T12:05:00.000Z' }]), {
    dataInicio: '2026-10-08T12:00:00.000Z',
    dataFim: '2026-10-08T15:00:00.000Z'
  });
  assert.deepEqual(periodoDeficit([{ dataHora: '2021-01-01T10:00:00.000Z' }, { dataHora: '2026-10-08T14:00:00.000Z' }]), {
    dataInicio: '2026-10-01T15:00:00.000Z',
    dataFim: '2026-10-08T15:00:00.000Z'
  });
});
