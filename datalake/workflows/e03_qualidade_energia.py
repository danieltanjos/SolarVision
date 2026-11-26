"""Etapa 03 do workflow previsao_energia: portão de qualidade da energia: sai com código 1 se faltar dado para treinar.

Roda pipeline/qualidade_energia.py. Depende de: e02_silver_energia.
"""

from _etapa import rodar

rodar("qualidade_energia")
