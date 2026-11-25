# Modelo de déficit energético: Spark MLlib

Gerado em 24/11/2026 21:18. Treino: 11,671 horas de sol
(01/2018 a 12/2021); teste, nunca visto no treino: 1,582 horas
e 155 dias (01/2022 a 03/2023). Fora dos dois: 2022-03-01 a 2022-12-01 (falha conhecida).

**Modelo:** `GBTRegressor` do Spark MLlib em modo local (perda absoluta, 200 árvores de profundidade 4, taxa 0,1). Prevê o rendimento da hora relativo à estimativa física do app, a partir de irradiância no
plano da placa, hora e mês. Exportável como tabela `modelo_deficit` (12 meses × 15 horas × 12 faixas de 100 W/m²).

**Tempo:** validação cruzada (limite de queda) 331.4 s; treino final 76.4 s; previsão do teste 36.11 s.

## Previsão da energia por hora (teste)

| Modelo | nMAE horário |
|---|---|
| Físico do app × mediana dos 7 dias (antes) | 25,2% |
| Físico × ML × mediana dos 7 dias (agora) | 22,4% |

## Detecção (dias de teste; quedas injetadas em 2 a 3 horas seguidas)

| Situação | ML (limite aprendido) | Regra fixa (70 %) |
|---|---|---|
| Dia normal com alerta (falso alarme) | 5,8% | 59,4% |
| Objeto/sombra: placa a 50 % | 14,8% detectados | 92,3% |
| Objeto/sombra: placa a 70 % | 11,6% detectados | 70,3% |
| Falha: placa a 0 % | 100,0% detectados | 100,0% |

Sistema de uma placa só (sem vizinhas): no app, a comparação com as outras placas do grupo ainda descarta a queda que
o grupo inteiro sentiu (tempo), o que reduz o falso alarme abaixo do daqui.

## Limite de queda aprendido (quantil 2,0% do desvio normal)

| Irradiância (W/m²) | 0–99 | 100–199 | 200–299 | 300–399 | 400–499 | 500–599 | 600–699 | 700–799 | 800–899 | 900–999 | 1000–1099 | ≥ 1100 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Alerta abaixo de | 27% | 21% | 22% | 23% | 26% | 28% | 31% | 34% | 41% | 56% | 27% | 27% |

## Limitações

- Treinado com um único sistema (CdTe, 20° Norte, Florianópolis): hora e mês também carregam as sombras e o
  horizonte desse local. Re-treinar com as leituras das próprias placas quando houver histórico.
- Sem exemplos rotulados de falha, o modelo aprende o normal; quedas e falhas da avaliação são injetadas.
- Clima horário de reanálise (grade de dezenas de km): a nuvem local continua sendo o maior erro.
