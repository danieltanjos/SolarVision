import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adivinharColunas, lerCsv, montarLeituras } from '../src/lib/leituras.js';

test('FE-CSV: formato do CSV de referência (dia,hora,wats5min) em horário de São Paulo', () => {
  const csv = lerCsv('dia,hora,wats5min\r\n2018-01-01,06:15:00,1.2533151\r\n2018-01-01,06:20:00,11.1482794\r\n2018-01-01,xx,1\r\n');
  assert.equal(csv.separador, ',');
  const colunas = adivinharColunas(csv.colunas);
  assert.deepEqual(colunas, { data: 0, hora: 1, potencia: 2 });
  assert.deepEqual(montarLeituras(csv.linhas, colunas), {
    leituras: [
      { dataHora: '2018-01-01T09:15:00.000Z', watts: 1.2533151 },
      { dataHora: '2018-01-01T09:20:00.000Z', watts: 11.1482794 }
    ],
    invalidas: 1
  });
});

test('FE-CSV: ";" com vírgula decimal, data e hora na mesma coluna e instante repetido', () => {
  const csv = lerCsv('Data/Hora;Potência (W)\n01/02/2024 12:00;1.234,5\n01/02/2024 12:00;1.300,5\n2024-02-01T12:05:00Z;7');
  assert.equal(csv.virgulaDecimal, true);
  const colunas = adivinharColunas(csv.colunas);
  assert.deepEqual(colunas, { data: 0, hora: -1, potencia: 1 });
  assert.deepEqual(montarLeituras(csv.linhas, colunas).leituras, [
    { dataHora: '2024-02-01T15:00:00.000Z', watts: 1300.5 },
    { dataHora: '2024-02-01T12:05:00.000Z', watts: 7 }
  ]);
});
