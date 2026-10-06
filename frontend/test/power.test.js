import { test } from 'node:test';
import assert from 'node:assert/strict';
import { powerUnit, formatPower, formatEnergy } from '../src/lib/power.js';

for (const [value, suffix, divisor] of [[0,'W',1],[999,'W',1],[1000,'kW',1000],[999999,'kW',1000],[1000000,'MW',1e6],[1e9,'GW',1e9],[-1500,'kW',1000]]) {
  test(`FE-POT: unidade no limite ${value}`, () => {
    assert.deepEqual(powerUnit(value), { divisor, suffix });
  });
}
for (const [value, expected] of [[0,'0 W'],[1500,'1,50 kW'],[12500,'12,5 kW'],[125000,'125 kW'],['2500','2,50 kW'],[null,'0 W'],['inválido','0 W']]) {
  test(`FE-FMT: formatação ${String(value)}`, () => assert.equal(formatPower(value), expected));
}
test('FE-FMT: série mantém unidade comum do gráfico', () => {
  assert.equal(formatPower(500, {divisor: 1000, suffix: 'kW'}), '0,50 kW');
});
test('FE-ENE: energia usa a mesma escala com sufixo h', () => {
  assert.equal(formatEnergy(14360), '14,4 kWh');
  assert.equal(formatEnergy(0), '0 Wh');
});
