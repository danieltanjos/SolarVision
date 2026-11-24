"""Etapa 02 do workflow previsao_energia: Silver de energia: estimativa física por hora, dias medidos e rejeitados.

Roda pipeline/silver_energia.py. Depende de: e01_bronze_energia.
"""

from _etapa import rodar

rodar("silver_energia")
