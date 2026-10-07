import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baldesComMedia, calendarioAno, comparacaoClima, erroPrevisao } from '../src/lib/historico.js';

const x = (dia) => `2026-${dia}T03:00:00+00:00`; // meia-noite em SP, como o banco devolve
const historico = ['01-01', '02-01', '03-01'].map((dia) => ({ x: x(dia), mediaWh: 100, anos: 4 }));

test('FE-HIS: clima x média só nos baldes comuns, sem o último pela metade', () => {
  // fevereiro está pela metade (a previsão acaba nele) e o período continua: só janeiro conta
  assert.equal(comparacaoClima([{ x: x('01-01'), estimadaWh: 88 }, { x: x('02-01'), estimadaWh: 40 }], historico), 'Clima 12% abaixo da média de 4 anos');
  assert.deepEqual(baldesComMedia([{ x: x('01-01'), estimadaWh: '88' }, { x: x('02-01'), estimadaWh: 40 }], historico), [{ x: x('01-01'), wh: 88, media: 100 }]);
  const completo = historico.map((h) => ({ x: h.x, estimadaWh: 100.4 }));
  assert.equal(comparacaoClima(completo, historico), 'Clima na média de 4 anos');
  assert.equal(comparacaoClima(completo, [{ ...historico[0], anos: 1 }]), 'Clima na média de 1 ano');
  assert.equal(comparacaoClima(completo, []), null);
});

test('FE-HIS: erro da previsão ponderado pela energia', () => {
  assert.equal(erroPrevisao([{ previstoWh: 9600, ocorridoWh: 8000 }]), 0.2);
  assert.equal(erroPrevisao([{ previstoWh: 1100, ocorridoWh: 1000 }, { previstoWh: 500, ocorridoWh: 0 }, { previstoWh: 2700, ocorridoWh: 3000 }]), 0.1);
  assert.equal(erroPrevisao([]), null);
});

test('FE-HIS: calendário mês × dia no fuso de SP', () => {
  const grade = calendarioAno([{ x: x('02-28'), estimadaWh: '1500.5' }, { x: x('12-31'), estimadaWh: 10 }]);
  assert.equal(grade[1][27], 1500.5);
  assert.equal(grade[11][30], 10);
  assert.equal(grade[1][28], null);
});
