# Modelo de déficit energético: scikit-learn

Gerado em 24/11/2026 21:18. Treino: 11,671 horas de sol
(01/2018 a 12/2021); teste, nunca visto no treino: 1,582 horas
e 155 dias (01/2022 a 03/2023). Fora dos dois: 2022-03-01 a 2022-12-01 (falha conhecida).

**Modelo:** `HistGradientBoostingRegressor` (perda absoluta, 400 árvores de até 15 folhas, taxa 0,05). Prevê o rendimento da hora relativo à estimativa física do app, a partir de irradiância no
plano da placa, hora e mês. Exportável como tabela `modelo_deficit` (12 meses × 15 horas × 12 faixas de 100 W/m²).

**Tempo:** validação cruzada (limite de queda) 2,5 s; treino final 0,2 s; previsão do teste 0,0 s.

## Previsão da energia por hora (teste)

| Modelo | nMAE horário |
|---|---|
| Físico do app × mediana dos 7 dias (antes) | 25,2% |
| Físico × ML × mediana dos 7 dias (agora) | 22,0% |

## Detecção (dias de teste; quedas injetadas em 2 a 3 horas seguidas)

| Situação | ML (limite aprendido) | Regra fixa (70 %) |
|---|---|---|
| Dia normal com alerta (falso alarme) | 5,2% | 59,4% |
| Objeto/sombra: placa a 50 % | 15,5% detectados | 92,3% |
| Objeto/sombra: placa a 70 % | 10,3% detectados | 70,3% |
| Falha: placa a 0 % | 100,0% detectados | 100,0% |

Sistema de uma placa só (sem vizinhas): no app, a comparação com as outras placas do grupo ainda descarta a queda que
o grupo inteiro sentiu (tempo), o que reduz o falso alarme abaixo do daqui.

## Limite de queda aprendido (quantil 2,0% do desvio normal)

| Irradiância (W/m²) | 0–99 | 100–199 | 200–299 | 300–399 | 400–499 | 500–599 | 600–699 | 700–799 | 800–899 | 900–999 | 1000–1099 | ≥ 1100 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Alerta abaixo de | 27% | 21% | 22% | 24% | 25% | 28% | 30% | 35% | 42% | 55% | 27% | 27% |

## Limitações

- Treinado com um único sistema (CdTe, 20° Norte, Florianópolis): hora e mês também carregam as sombras e o
  horizonte desse local. Re-treinar com as leituras das próprias placas quando houver histórico.
- Sem exemplos rotulados de falha, o modelo aprende o normal; quedas e falhas da avaliação são injetadas.
- Clima horário de reanálise (grade de dezenas de km): a nuvem local continua sendo o maior erro.
