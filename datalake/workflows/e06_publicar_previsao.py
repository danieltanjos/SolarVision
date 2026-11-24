"""Etapa 06 do workflow previsao_energia: publica a previsão em previsoes_ml no Supabase.

Roda pipeline/publicar_previsao.py. Depende de: e05_prever_energia.
"""

from _etapa import rodar

rodar("publicar_previsao")
