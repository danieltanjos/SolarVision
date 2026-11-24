import qualidade_energia as qe


def _medidas(**mudancas):
    base = {"horas": 45000, "horas_medidas": 16000, "dias_completos": 1266, "rejeitados": 57,
            "placas_app": 2, "placas_app_sem_previsao": 0}
    return {**base, **mudancas}


def test_tudo_ok_com_a_referencia_da_ufsc():
    assert all(r.ok for r in qe.regras(_medidas()))


def test_pouco_historico_bloqueia_o_treino():
    falhas = qe.falhas_bloqueantes(qe.regras(_medidas(dias_completos=30)))
    assert [r.regra for r in falhas] == ["dias medidos por inteiro para treinar"]


def test_medidor_ruim_bloqueia_e_placa_sem_previsao_so_avisa():
    resultado = {r.regra: r for r in qe.regras(_medidas(rejeitados=5000, placas_app_sem_previsao=1))}
    assert not resultado["taxa de leituras rejeitadas"].ok and resultado["taxa de leituras rejeitadas"].bloqueante
    sem_previsao = resultado["placas do app sem a previsão do tempo da semana"]
    assert not sem_previsao.ok and not sem_previsao.bloqueante
