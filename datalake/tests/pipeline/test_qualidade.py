from datetime import datetime, timezone

import qualidade
import silver
from tests.pipeline.fabrica import bronze, evento

BOAS = {"linhas_bronze": 102, "unicos_bronze": 100, "validos": 97, "ids_repetidos": 0,
        "chaves_nulas": 0, "rejeitados": 3}


def _por_nome(resultado):
    return {r.regra: r for r in resultado}


def test_dado_saudavel_passa_em_todas_as_regras():
    resultado = qualidade.regras(BOAS)
    assert all(r.ok for r in resultado)
    assert qualidade.falhas_bloqueantes(resultado) == []
    assert _por_nome(resultado)["taxa de rejeição"].valor == 0.03


def test_evento_que_some_entre_bronze_e_silver_bloqueia():
    resultado = qualidade.regras({**BOAS, "validos": 95})
    falhas = qualidade.falhas_bloqueantes(resultado)
    assert [r.regra for r in falhas] == ["reconciliação: bronze única = silver + rejeitados"]
    assert falhas[0].valor == 2


def test_rejeicao_acima_do_limite_bloqueia_e_duplicata_so_alerta():
    resultado = _por_nome(qualidade.regras({"linhas_bronze": 120, "unicos_bronze": 100, "validos": 80,
                                            "ids_repetidos": 0, "chaves_nulas": 0, "rejeitados": 20}))
    assert not resultado["taxa de rejeição"].ok and resultado["taxa de rejeição"].bloqueante
    assert not resultado["taxa de duplicatas"].ok and not resultado["taxa de duplicatas"].bloqueante


def test_silver_vazia_bloqueia_sem_dividir_por_zero():
    vazia = dict.fromkeys(BOAS, 0)
    falhas = {r.regra for r in qualidade.falhas_bloqueantes(qualidade.regras(vazia))}
    assert falhas == {"silver tem eventos válidos"}


def test_medir_conta_a_partir_das_camadas(spark):
    eventos = [evento("e1", "page_view", 0), evento("e2", "page_view", 1), evento("e3", "nao_existe", 2)]
    b = bronze(spark, eventos + [evento("e1", "page_view", 0)])          # e1 chegou duas vezes
    validos, rejeitados = silver.validar(silver.tipar(silver.deduplicar(b)))
    validos = silver.sessionizar(silver.costurar_identidade(validos))
    medidas = qualidade.medir(b, validos, rejeitados)
    assert medidas == {"linhas_bronze": 4, "unicos_bronze": 3, "validos": 2, "ids_repetidos": 0,
                       "chaves_nulas": 0, "rejeitados": 1}
    falhas = [r.regra for r in qualidade.falhas_bloqueantes(qualidade.regras(medidas))]
    assert falhas == ["taxa de rejeição"]                                 # 1 de 3: amostra suja demais


def test_tabela_tem_uma_linha_por_regra(spark):
    instante = datetime(2026, 10, 1, tzinfo=timezone.utc)
    linhas = qualidade.tabela(spark, qualidade.regras(BOAS), instante).collect()
    assert len(linhas) == 6 and all(r.executado_em is not None for r in linhas)
