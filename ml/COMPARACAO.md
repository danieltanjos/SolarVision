# scikit-learn x Spark MLlib (modelo de déficit)

Mesmos dados, mesma divisão treino/teste, mesmo cálculo do limite e mesmas quedas injetadas (ver `ml/comum.py`):
só o gradient boosting muda. Detalhes de cada um em `ml/resultados/sklearn.md` e `ml/resultados/spark.md`.
Gerado em 24/11/2026 21:19; 1,582 horas e 155 dias de teste.

| | scikit-learn (`HistGradientBoostingRegressor`) | Spark MLlib (`GBTRegressor`, local) |
|---|---|---|
| nMAE horário (físico: 25,2%) | 22,0% | 22,4% |
| Falso alarme (dia normal) | 5,2% | 5,8% |
| Queda a 50 % detectada | 15,5% | 14,8% |
| Queda a 70 % detectada | 10,3% | 11,6% |
| Falha (0 %) detectada | 100,0% | 100,0% |
| Tempo: validação cruzada (5 modelos) | 2,5 s | 331,4 s |
| Tempo: treino final | 0,2 s | 76,4 s |
| Tempo: total do script | 3,3 s | 498,2 s |

Diferença entre as duas tabelas `modelo_deficit` (razão prevista, ≈ 1 em média; 2160 células): média
0,056, máxima 0,249. As maiores ficam em combinações raras ou ausentes nos dados (ex.: 950 W/m²
às 18h de maio), onde cada algoritmo extrapola do seu jeito; nas combinações que aparecem nos dados a diferença é menor.

Limite de queda por faixa de irradiância (scikit-learn/Spark, %): 27/27 | 21/21 | 22/22 | 24/23 | 25/26 | 28/28 | 30/31 | 35/34 | 42/41 | 55/56 | 27/27 | 27/27

## Conclusão

- **Qualidade:** os dois aprendem praticamente o mesmo modelo; as diferenças de detecção ficam no ruído de ~150 dias
  de teste. O limite do clima horário (nuvem local) pesa muito mais que o algoritmo.
- **Tempo:** com ~13 mil horas de treino, o Spark leva 151× mais que o scikit-learn: sobe a JVM, divide os dados e roda cada
  árvore como um job. Ele compensa quando os dados não cabem numa máquina (milhares de placas com leituras de 5 min
  por anos, centenas de milhões de linhas) ou para processar leituras em fluxo (Structured Streaming).
- **Uso no app:** os dois exportam a mesma tabela; a migration atual vem do scikit-learn (`ml/treinar_deficit.py`).
