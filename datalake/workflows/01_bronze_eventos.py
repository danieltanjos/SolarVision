"""Etapa 01 do workflow medalhão: Bronze: landing JSON -> bronze Parquet, append-only, com proveniência.

Roda pipeline/bronze.py. Depende de: nada (é a primeira).
"""

from _etapa import rodar

rodar("bronze")
