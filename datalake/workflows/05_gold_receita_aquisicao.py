"""Etapa 05 do workflow medalhão: Gold receita e aquisição.

Roda pipeline/gold_aquisicao.py (ativação, retenção e abandono) e pipeline/gold_receita.py (assinatura Pro).
Depende só de 02_silver_eventos: não passa pelo portão de qualidade.
"""

from _etapa import rodar

rodar("gold_aquisicao", "gold_receita")
