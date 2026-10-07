import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quando } from '../src/lib/alertas.js';

test('FE-ALE: quando conta dias do calendário de SP', () => {
  const agora = new Date('2026-10-08T12:00:00Z'); // 09:00 em SP
  assert.equal(quando('2026-10-08T10:00:00Z', agora), 'hoje');
  assert.equal(quando('2026-10-08T02:00:00Z', agora), 'ontem'); // 23:00 de 07/10 em SP
  assert.equal(quando('2026-10-05T10:00:00Z', agora), 'há 3 dias');
});
