import { test } from "node:test";
import assert from "node:assert/strict";
import { comModelo, diaDe, somarPorDia } from "../src/lib/previsaoMl.js";

test("previsão do modelo soma as placas por dia", () => {
  const dias = somarPorDia([
    { dia: "2026-11-24", previstaWh: 900, p10Wh: 810, p90Wh: 1080, estimadaWh: 1000, modelo: "GBT" },
    { dia: "2026-11-24", previstaWh: 450, p10Wh: null, p90Wh: null, estimadaWh: 500, modelo: "GBT" },
    { dia: "2026-11-25", previstaWh: 700, p10Wh: 600, p90Wh: 800, estimadaWh: 750, modelo: "GBT" }
  ]);
  assert.deepEqual(dias["2026-11-24"], { previstaWh: 1350, p10Wh: 1260, p90Wh: 1530, estimadaWh: 1500, modelo: "GBT" });
  assert.equal(dias["2026-11-25"].previstaWh, 700);
  assert.deepEqual(somarPorDia(null), {});
});

test("dia do card no fuso de São Paulo e junção com o modelo", () => {
  assert.equal(diaDe("2026-11-25T02:00:00Z"), "2026-11-24");
  const dias = [{ x: "2026-11-24T03:00:00Z", estimadaWh: 1000 }, { x: "2026-11-26T03:00:00Z", estimadaWh: 800 }];
  const juntos = comModelo(dias, somarPorDia([{ dia: "2026-11-24", previstaWh: 900, estimadaWh: 1000 }]));
  assert.equal(juntos[0].modelo.previstaWh, 900);
  assert.equal(juntos[1].modelo, null);
});
