"""Ponte entre as etapas numeradas desta pasta e os jobs de pipeline/. Não é um job: começa com "_",
então o explorador não o lista (mas o Sincronizar leva junto, e as etapas o importam do floci).

Cada etapa é um arquivo de três linhas que chama rodar("<job>", ...). A lógica continua nos jobs de
pipeline/, com os testes deles; aqui fica só a ordem e o nome que o workflow usa.
"""

import runpy
import sys
from pathlib import Path


def rodar(*jobs: str) -> None:
    """Roda pipeline/<job>.py como `python pipeline/<job>.py`, um depois do outro.

    As etapas rodam sempre da pasta do projeto (no terminal e no explorador, mesmo quando o script vem
    do floci), por isso o pipeline/ é achado pelo diretório atual, como em comum.arquivo_do_projeto.
    Um job que para (o portão de qualidade, um exigir_camada) encerra a etapa com o código dele."""
    pipeline = Path.cwd() / "pipeline"
    if not pipeline.is_dir():
        raise SystemExit(f"{pipeline} não existe: rode as etapas a partir da pasta datalake/.")
    sys.path.insert(0, str(pipeline))
    for job in jobs:
        runpy.run_path(str(pipeline / f"{job}.py"), run_name="__main__")
