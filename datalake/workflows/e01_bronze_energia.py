"""Etapa 01 do workflow previsao_energia: Bronze de energia: landing_energia/ (UFSC e app) -> bronze_energia/, append-only, com proveniência.

Roda pipeline/bronze_energia.py. Depende de: nada (a landing vem de gerador/importar_ufsc.py e coletor/coletar_energia.py).
"""

from _etapa import rodar

rodar("bronze_energia")
