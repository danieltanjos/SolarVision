# Validação do modelo de geração estimada

Compara a energia **diária medida** de um sistema real com a energia diária **estimada pelo mesmo modelo do app** (`public.potencia_estimada`: GTI e temperatura do arquivo do Open-Meteo, NOCT 45 °C, γ = −0,40 %/°C), ajustando um único fator de escala por mínimos quadrados, `k = Wp × PR`. Assim não é preciso saber a potência exata: o que se testa é se o clima explica a geração dia a dia e mês a mês.

## Como rodar

Na raiz do repositório (Node 24, sem dependências; ~10 min na primeira vez por causa do limite do Open-Meteo, depois usa o cache em `<tmp>/solarvision-validacao`):

```bash
node docs/validacao/validar-modelo.mjs
GAMA=-0.30 node docs/validacao/validar-modelo.mjs   # outro coeficiente de temperatura
```

## Dados e suposições

- **Medido:** `supabase/seed/Dados_Tratados_CDTE-PSI.csv`, potência média de 5 em 5 min de 01/01/2018 a 20/03/2023. Pelo histórico do Git (commit `b355a51`, "Dados enviados pelo Ricardo Ruther do Fotovoltaica-UFSC"), é um sistema do laboratório Fotovoltaica-UFSC, provavelmente de módulos CdTe (pelo nome). Potência, inclinação e orientação não estão no repositório.
- **Local suposto:** laboratório da Fotovoltaica-UFSC no Sapiens Parque, Florianópolis (−27,43; −48,44). A grade do Open-Meteo/ERA5 é mais grossa que a distância até o campus da Trindade, então a escolha entre os dois quase não muda o clima.
- **Horário:** São Paulo padrão (UTC−3) sem horário de verão. O centro de massa diário da potência fica entre 11h50 e 12h30 em todos os meses, inclusive nos verões de 2018/19 com horário de verão, então o datalogger não mudou o relógio. É a mesma suposição da importação de CSV do app.
- **Dia completo:** primeira leitura até 9h, última depois das 16h e nenhum buraco maior que 15 min. Entram 1267 dos 1732 dias.
- **Orientação:** desconhecida, por isso o script testa uma grade: plana e 10°, 20°, 27° e 35° voltadas para Norte, Nordeste, Noroeste, Leste e Oeste.

## Resultados (γ = −0,40 %/°C)

| Inclinação / orientação | r diário | nMAE diário | MAPE mensal | k = Wp × PR |
|---|---|---|---|---|
| **20° Norte (melhor)** | **0,893** | **15,0%** | **7,6%** | 1923 W |
| 27° Noroeste | 0,892 | 15,0% | 7,8% | 1985 W |
| 27° Norte (inclinação = latitude) | 0,890 | 15,6% | 9,2% | 1927 W |
| 20° Nordeste | 0,877 | 15,7% | 7,3% | 1964 W |
| Plana (0°) | 0,839 | 18,0% | 10,4% | 1994 W |
| 27° Leste / Oeste | 0,819 / 0,839 | 19,0% / 18,0% | 10,1% / 10,5% | ~2120 W |

- **Orientação:** o melhor ajuste é **Norte com 20° a 27°**, como os sistemas fixos em solo (inclinação ≈ latitude) do laboratório. Leste, Oeste e plana ficam claramente piores, então o modelo distingue orientações.
- **Falha detectada nos dados:** de março a novembro de 2022 a energia diária cai à metade, há 78 leituras acima de 3 kW (até 5,4 kW, contra picos normais de ~2,5 kW) e só 27 dos 230 dias estão completos. É falha do sistema ou do datalogger, não clima. O script marca sozinho 2022-03, 2022-05 e 2022-10 (k do mês < 75% da mediana). Sem esses meses, com 1257 dias: **r diário 0,895, nMAE diário 14,8% e MAPE mensal 6,0%**, k = 1927 W.
- **k por ano:** 1974 → 1908 → 1881 → 1863 → 1814 W de 2018 a 2022, uma queda de ~8% em 4 anos (~2%/ano), que soma degradação, sujeira acumulada e o resto da falha de 2022. Os 1858 W de 2023 são só de jan. a mar., meses de k mais alto.
- **k por mês do ano:** fica entre 1802 W (set.) e 1986 W (abr.), cerca de ±5%. É mais baixo no inverno (sol baixo, sombras no fim da tarde: em dias limpos de junho a potência cai de ~1,1 kW às 15h para ~0,1 kW às 16h).
- **γ = −0,30 %/°C (típico de CdTe):** quase não muda (nMAE diário 14,6%, MAPE mensal 5,8%).

## O que isso diz sobre o PR 0,82 fixo

1. **A forma está certa:** com um único fator por placa, o clima do Open-Meteo explica ~80% da variância diária (r² ≈ 0,80) e o erro mensal fica em ~6%. O erro diário de ~15% é o piso da irradiância de reanálise (grade de dezenas de km, que não vê a nuvem local). Por isso o ranking compara cada placa com a **mediana do grupo** (mesmo clima, o erro do clima se cancela) em vez de alarmar por desempenho absoluto.
2. **O valor absoluto não dá para validar sem a Wp:** k ≈ 1,93 kW é `Wp × PR`. Com PR 0,82 o sistema teria 2,35 kWp. Os picos de 5 min em dias limpos (~2,5 kW) sugerem algo como 2,5 a 2,7 kWp, o que daria **PR real ≈ 0,71 a 0,77**, abaixo do 0,82 fixo. Quando houver leituras, a calibração natural é por placa: `desempenho` (real ÷ estimado) do `ranking_placas` é exatamente o PR medido ÷ 0,82.
3. **Um PR constante não captura deriva nem estação:** ~−2%/ano neste sistema e ±5% entre os meses. Melhorias, em ordem de ganho: PR calibrado por placa a partir das leituras importadas, degradação anual a partir de `instalada_em` (~0,5 a 1%/ano), e só depois um ajuste sazonal.
