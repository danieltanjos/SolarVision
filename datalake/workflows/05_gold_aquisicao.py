"""Etapa 05 do workflow medalhão: Gold de aquisição e retenção.

Roda pipeline/gold_aquisicao.py (ativação por dia, retenção D1/D7/D14, abandono e tempo até ativar).
Depende de 03_qualidade_dados, como as outras Golds.
"""

from _etapa import rodar

rodar("gold_aquisicao")
