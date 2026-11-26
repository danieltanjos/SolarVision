"""Etapa 10 do workflow medalhão: exportação do mapa de calor para o app (mapa_calor.js, R11).

Roda pipeline/exportar_mapa_calor.py. Depende só de 08_gold_mapa_calor, como o exportar_mapa_calor do
projeto-modelo: o mapa de calor chega ao app sem esperar as outras Golds.
"""

from _etapa import rodar

rodar("exportar_mapa_calor")
