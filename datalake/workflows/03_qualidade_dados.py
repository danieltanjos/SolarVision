"""Etapa 03 do workflow medalhão: portão de qualidade do dado.

Roda pipeline/qualidade.py, que grava gold/qualidade_dados e sai com código 1 se uma regra bloqueante
falha: aí as Golds que dependem desta etapa não rodam. Depende de: 02_silver_eventos.
"""

from _etapa import rodar

rodar("qualidade")
