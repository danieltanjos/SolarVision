"""Etapa 02 do workflow medalhão: Silver: deduplicação, validação com motivo, sessões, identidade e itens.

Roda pipeline/silver.py. Depende de: 01_bronze_eventos.
"""

from _etapa import rodar

rodar("silver")
