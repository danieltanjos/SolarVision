"""Etapa 09 do workflow medalhão: exportação do BI para o app (frontend/public/bi/bi.js).

Roda pipeline/exportar_bi.py. Depende das Golds que o painel "Uso da plataforma" lê: 04_gold_funil,
05_gold_receita_aquisicao, 06_gold_engajamento e 07_gold_ml. O mapa de calor é a etapa 10.
"""

from _etapa import rodar

rodar("exportar_bi")
