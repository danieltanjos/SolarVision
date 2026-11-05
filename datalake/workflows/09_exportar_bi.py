"""Etapa 09 do workflow medalhão: exportação para o app (frontend/public/bi/mapa_calor.js e bi.js).

Roda pipeline/exportar_bi.py. Depende das cinco Golds: 04_gold_funil, 05_gold_receita_aquisicao,
06_gold_engajamento, 07_gold_ml e 08_gold_mapa_calor.
"""

from _etapa import rodar

rodar("exportar_bi")
