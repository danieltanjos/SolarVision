import json
from pathlib import Path

import pytest

import rodar_tudo

PIPELINE = Path(rodar_tudo.__file__).parent


def test_a_ordem_vem_do_workflow_e_respeita_as_dependencias():
    ordem = rodar_tudo.JOBS
    assert ordem[:3] == ("bronze", "silver", "qualidade") and ordem[-1] == "exportar_bi"
    for job, deps in rodar_tudo.GRAFO.items():
        assert all(ordem.index(d) < ordem.index(job) for d in deps), job
        assert (PIPELINE / f"{job}.py").is_file(), job


def test_portao_de_qualidade_fica_entre_a_silver_e_as_golds():
    golds = [j for j in rodar_tudo.JOBS if j.startswith("gold_")]
    assert len(golds) == 5
    assert all(rodar_tudo.GRAFO[g] == {"qualidade"} for g in golds)
    assert rodar_tudo.GRAFO["exportar_bi"] == set(golds)


def test_o_workflow_do_explorador_e_o_mesmo_arquivo():
    wf = json.loads((PIPELINE / "workflows" / "medalhao.json").read_text(encoding="utf-8"))
    assert {e["job"] for e in wf["etapas"]} == set(rodar_tudo.JOBS)


def test_ordem_topologica_detecta_ciclo_e_dependencia_desconhecida():
    with pytest.raises(rodar_tudo.GrafoInvalido, match="ciclo"):
        rodar_tudo.ordem_topologica({"a": {"b"}, "b": {"a"}})
    with pytest.raises(rodar_tudo.GrafoInvalido, match="fantasma"):
        rodar_tudo.ordem_topologica({"a": {"fantasma"}})


def test_a_partir_de_pega_o_job_e_todos_os_que_dependem_dele():
    grafo = rodar_tudo.GRAFO
    assert rodar_tudo.a_partir_de(grafo, "gold_funil") == ("gold_funil", "exportar_bi")
    assert rodar_tudo.a_partir_de(grafo, "silver") == rodar_tudo.JOBS[1:]
    assert rodar_tudo.a_partir_de(grafo, "exportar_bi") == ("exportar_bi",)


def test_para_no_primeiro_job_que_falha(monkeypatch):
    rodados = []
    monkeypatch.setattr(rodar_tudo, "rodar", lambda job: rodados.append(job) or (1 if job == "qualidade" else 0))
    assert rodar_tudo.main([]) == 1
    assert rodados == ["bronze", "silver", "qualidade"]              # nenhuma Gold em cima de dado ruim


def test_roda_todos_quando_nada_falha(monkeypatch):
    rodados = []
    monkeypatch.setattr(rodar_tudo, "rodar", lambda job: rodados.append(job) or 0)
    assert rodar_tudo.main([]) == 0
    assert tuple(rodados) == rodar_tudo.JOBS


def test_reprocessamento_parcial_pelo_terminal(monkeypatch):
    rodados = []
    monkeypatch.setattr(rodar_tudo, "rodar", lambda job: rodados.append(job) or 0)
    assert rodar_tudo.main(["--a-partir-de", "gold_engajamento"]) == 0
    assert rodados == ["gold_engajamento", "exportar_bi"]
    with pytest.raises(SystemExit):
        rodar_tudo.main(["--a-partir-de", "gold_funil", "--limpar"])
