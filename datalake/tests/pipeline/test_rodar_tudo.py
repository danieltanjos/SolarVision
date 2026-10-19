import json
from pathlib import Path

import rodar_tudo

PIPELINE = Path(rodar_tudo.__file__).parent


def test_os_oito_jobs_existem_na_ordem_das_dependencias():
    assert len(rodar_tudo.JOBS) == 8
    assert rodar_tudo.JOBS[:2] == ("bronze", "silver") and rodar_tudo.JOBS[-1] == "exportar_bi"
    for job in rodar_tudo.JOBS:
        assert (PIPELINE / f"{job}.py").is_file(), job


def test_para_no_primeiro_job_que_falha(monkeypatch):
    rodados = []
    monkeypatch.setattr(rodar_tudo, "rodar", lambda job: rodados.append(job) or (1 if job == "silver" else 0))
    assert rodar_tudo.main([]) == 1
    assert rodados == ["bronze", "silver"]


def test_roda_todos_quando_nada_falha(monkeypatch):
    rodados = []
    monkeypatch.setattr(rodar_tudo, "rodar", lambda job: rodados.append(job) or 0)
    assert rodar_tudo.main([]) == 0
    assert tuple(rodados) == rodar_tudo.JOBS


def test_workflow_do_explorador_tem_os_mesmos_jobs():
    wf = json.loads((PIPELINE / "workflows" / "medalhao.json").read_text(encoding="utf-8"))
    assert {e["job"] for e in wf["etapas"]} == set(rodar_tudo.JOBS)
    exportar = next(e for e in wf["etapas"] if e["job"] == "exportar_bi")
    assert set(exportar["depende_de"]) == {j for j in rodar_tudo.JOBS if j.startswith("gold_")}
