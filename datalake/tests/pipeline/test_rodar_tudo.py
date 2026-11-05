import ast
import json

import pytest

import rodar_tudo

ETAPAS = rodar_tudo.ETAPAS
PIPELINE = rodar_tudo.PASTA


def _jobs_da_etapa(etapa: str) -> list[str]:
    """Os jobs de pipeline/ que a etapa chama em rodar("…", …)."""
    arvore = ast.parse((ETAPAS / f"{etapa}.py").read_text(encoding="utf-8"))
    [chamada] = [n for n in ast.walk(arvore) if isinstance(n, ast.Call) and getattr(n.func, "id", "") == "rodar"]
    return [a.value for a in chamada.args]


def test_a_ordem_vem_do_workflow_e_respeita_as_dependencias():
    ordem = rodar_tudo.JOBS
    assert ordem[:3] == ("01_bronze_eventos", "02_silver_eventos", "03_qualidade_dados")
    assert ordem[-1] == "09_exportar_bi"
    for job, deps in rodar_tudo.GRAFO.items():
        assert all(ordem.index(d) < ordem.index(job) for d in deps), job
        assert (ETAPAS / f"{job}.py").is_file(), job


def test_cada_etapa_chama_jobs_que_existem_no_pipeline():
    chamados = [j for etapa in rodar_tudo.JOBS for j in _jobs_da_etapa(etapa)]
    assert all((PIPELINE / f"{j}.py").is_file() for j in chamados), chamados
    assert len(chamados) == len(set(chamados))                         # nenhum job roda duas vezes
    assert _jobs_da_etapa("05_gold_receita_aquisicao") == ["gold_aquisicao", "gold_receita"]


def test_receita_e_aquisicao_depende_so_da_silver_e_as_outras_golds_do_portao():
    grafo = rodar_tudo.GRAFO
    assert grafo["05_gold_receita_aquisicao"] == {"02_silver_eventos"}
    golds = [j for j in rodar_tudo.JOBS if "_gold_" in j]
    assert len(golds) == 5
    assert all(grafo[g] == {"03_qualidade_dados"} for g in golds if g != "05_gold_receita_aquisicao")
    assert grafo["09_exportar_bi"] == set(golds)


def test_os_workflows_ficam_todos_na_pasta_workflows():
    nomes = {p.stem for p in ETAPAS.glob("*.json")}
    assert nomes == {"medalhao", "receita_aquisicao"}
    for arquivo in ETAPAS.glob("*.json"):
        wf = json.loads(arquivo.read_text(encoding="utf-8"))
        assert wf["nome"] == arquivo.stem
        assert {e["job"] for e in wf["etapas"]} <= set(rodar_tudo.JOBS)
        rodar_tudo.ordem_topologica({e["job"]: set(e["depende_de"]) for e in wf["etapas"]})
    assert not (PIPELINE / "workflows").exists()


def test_ordem_topologica_detecta_ciclo_e_dependencia_desconhecida():
    with pytest.raises(rodar_tudo.GrafoInvalido, match="ciclo"):
        rodar_tudo.ordem_topologica({"a": {"b"}, "b": {"a"}})
    with pytest.raises(rodar_tudo.GrafoInvalido, match="fantasma"):
        rodar_tudo.ordem_topologica({"a": {"fantasma"}})


def test_a_partir_de_pega_a_etapa_e_todas_as_que_dependem_dela():
    grafo = rodar_tudo.GRAFO
    assert rodar_tudo.a_partir_de(grafo, "04_gold_funil") == ("04_gold_funil", "09_exportar_bi")
    assert rodar_tudo.a_partir_de(grafo, "02_silver_eventos") == rodar_tudo.JOBS[1:]
    assert rodar_tudo.a_partir_de(grafo, "03_qualidade_dados") == (
        "03_qualidade_dados", "04_gold_funil", "06_gold_engajamento", "07_gold_ml", "08_gold_mapa_calor",
        "09_exportar_bi")


def test_para_na_primeira_etapa_que_falha(monkeypatch):
    rodados = []
    monkeypatch.setattr(rodar_tudo, "rodar",
                        lambda job: rodados.append(job) or (1 if job == "03_qualidade_dados" else 0))
    assert rodar_tudo.main([]) == 1
    assert rodados == ["01_bronze_eventos", "02_silver_eventos", "03_qualidade_dados"]   # nenhuma Gold depois


def test_roda_todas_quando_nada_falha(monkeypatch):
    rodados = []
    monkeypatch.setattr(rodar_tudo, "rodar", lambda job: rodados.append(job) or 0)
    assert rodar_tudo.main([]) == 0
    assert tuple(rodados) == rodar_tudo.JOBS


def test_reprocessamento_parcial_pelo_terminal(monkeypatch):
    rodados = []
    monkeypatch.setattr(rodar_tudo, "rodar", lambda job: rodados.append(job) or 0)
    assert rodar_tudo.main(["--a-partir-de", "05_gold_receita_aquisicao"]) == 0
    assert rodados == ["05_gold_receita_aquisicao", "09_exportar_bi"]
    with pytest.raises(SystemExit):
        rodar_tudo.main(["--a-partir-de", "04_gold_funil", "--limpar"])
