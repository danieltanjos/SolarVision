# evidencias/ — a entrega final

Trabalho individual: **Luiz Gustavo**. Uma evidência por job, no formato do `evidencias/bronze_evidencias.pdf` do projeto-modelo do professor: a primeira página diz quais requisitos o job atende, o resultado e os CSVs; depois vem um print por página, numerado, do console do datalake (Jobs ETL, execução, script, S3, Parquet, partições, Data Catalog e Athena). Cada CSV é o resultado da consulta do print, baixado pelo botão **Baixar resultados (CSV)** do Athena.

Execução: Docker, 12/11/2026. A landing veio do gerador padrão (seed 42, 3.000 usuários, 28 dias), e o pipeline rodou do zero pelo workflow `medalhao` do console: as 10 etapas com sucesso, em 854,7 s.

| Job (etapa do workflow) | PDF | CSVs |
| --- | --- | --- |
| Workflow `medalhao` (as 10 etapas) | `workflow_evidencias.pdf` | — |
| `bronze` (01_bronze_eventos) | `bronze_evidencias.pdf` | `bronze_landing_x_bronze.csv` |
| `silver` (02_silver_eventos) | `silver_evidencias.pdf` | `silver_bronze_x_silver.csv`, `silver_rejeitados_por_motivo.csv`, `silver_sessoes_e_stitching.csv` |
| `qualidade` (03_qualidade_dados) | `qualidade_evidencias.pdf` | `qualidade_dados.csv` |
| `gold_funil` (04_gold_funil) | `gold_funil_evidencias.pdf` | `gold_funil_ativacao.csv`, `gold_funil_ordenado.csv` |
| `gold_aquisicao` e `gold_receita` (05_gold_receita_aquisicao) | `gold_receita_aquisicao_evidencias.pdf` | `gold_retencao.csv`, `gold_taxa_reembolso.csv` |
| `gold_engajamento` (06_gold_engajamento) | `gold_engajamento_evidencias.pdf` | `gold_uso_telas.csv`, `gold_adocao_recursos.csv` |
| `gold_ml` (07_gold_ml) | `gold_ml_evidencias.pdf` | `gold_metricas_modelo.csv`, `gold_segmentos.csv` |
| `gold_mapa_calor` (08_gold_mapa_calor) | `gold_mapa_calor_evidencias.pdf` | `gold_mapa_calor_cliques.csv`, `gold_mapa_calor_rolagem.csv` |
| `exportar_bi` (09_exportar_bi) | `exportar_bi_evidencias.pdf` | — (o app lê o `bi.js`) |
| `exportar_mapa_calor` (10_exportar_mapa_calor, R11) | `exportar_mapa_calor_evidencias.pdf` | — (o app lê o `mapa_calor.js`) |

As evidências de cada etapa ao longo do trabalho (datalake de uso; funil, engajamento e workflow; Gold receita; mapa de calor) ficaram em [`entregas-anteriores/`](entregas-anteriores/).
