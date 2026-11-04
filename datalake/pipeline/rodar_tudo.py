"""Script de sequência (R3): roda os jobs do datalake na ordem do workflow. Não gera dados.

    docker compose run --rm app python pipeline/rodar_tudo.py                       # tudo, a partir da landing
    docker compose run --rm app python pipeline/rodar_tudo.py --limpar              # apaga bronze/silver/gold antes
    docker compose run --rm app python pipeline/rodar_tudo.py --a-partir-de gold_funil   # só ele e quem depende dele

A ordem vem do grafo em pipeline/workflows/medalhao.json, o mesmo que o explorador roda na tela
Workflows: um job só entra depois de todas as dependências dele. Assim o script e o console nunca
divergem. Se um job falha (o portão de qualidade, por exemplo), nada que depende dele roda.

A Bronze é append-only: rodar de novo sem --limpar acrescenta a landing outra vez, e a Silver
descarta as cópias na deduplicação (R5). Para reconstruir do zero, use --limpar. Mudou só uma Gold?
--a-partir-de reprocessa aquele job e os que dependem dele, sem refazer Bronze e Silver.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

PASTA = Path(__file__).resolve().parent
WORKFLOW = PASTA / "workflows" / "medalhao.json"
CAMADAS = ("bronze", "silver", "gold")


class GrafoInvalido(ValueError):
    pass


def carregar_grafo(arquivo: Path = WORKFLOW) -> dict[str, set[str]]:
    """job -> jobs de que ele depende, como está no workflow."""
    etapas = json.loads(arquivo.read_text(encoding="utf-8"))["etapas"]
    return {e["job"]: set(e.get("depende_de", [])) for e in etapas}


def ordem_topologica(grafo: dict[str, set[str]]) -> tuple[str, ...]:
    """Os jobs em níveis: cada nível só tem jobs cujas dependências já vieram antes. Dentro do nível,
    a ordem do arquivo. Dependência desconhecida ou ciclo é erro, não um job esquecido."""
    desconhecidas = sorted({d for deps in grafo.values() for d in deps} - grafo.keys())
    if desconhecidas:
        raise GrafoInvalido(f"dependência que não é etapa do workflow: {', '.join(desconhecidas)}")
    ordem: list[str] = []
    while len(ordem) < len(grafo):
        prontos = [job for job, deps in grafo.items() if job not in ordem and deps <= set(ordem)]
        if not prontos:
            raise GrafoInvalido(f"ciclo entre: {', '.join(j for j in grafo if j not in ordem)}")
        ordem.extend(prontos)
    return tuple(ordem)


def a_partir_de(grafo: dict[str, set[str]], inicio: str) -> tuple[str, ...]:
    """O job `inicio` e todos os que dependem dele, direta ou indiretamente, na ordem do grafo."""
    if inicio not in grafo:
        raise GrafoInvalido(f"{inicio} não é etapa do workflow")
    afetados = {inicio}
    for job in ordem_topologica(grafo):
        if grafo[job] & afetados:
            afetados.add(job)
    return tuple(j for j in ordem_topologica(grafo) if j in afetados)


GRAFO = carregar_grafo()
JOBS = ordem_topologica(GRAFO)


def limpar() -> None:
    from comum import apagar_camada, criar_sessao, titulo

    spark = criar_sessao("limpar")
    for camada in CAMADAS:
        print(f"{camada}/: {'apagada' if apagar_camada(spark, camada) else 'já estava vazia'}")
    spark.stop()
    titulo("Camadas apagadas")


def rodar(job: str) -> int:
    inicio = time.monotonic()
    codigo = subprocess.run([sys.executable, "-u", str(PASTA / f"{job}.py")]).returncode
    print(f"[{'ok' if codigo == 0 else 'FALHOU'}] {job} ({time.monotonic() - inicio:.0f} s)")
    return codigo


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--limpar", action="store_true", help="apaga bronze/, silver/ e gold/ antes de rodar")
    ap.add_argument("--a-partir-de", metavar="JOB", choices=JOBS,
                    help="roda só este job e os que dependem dele (reprocessamento parcial)")
    a = ap.parse_args(argv)
    if a.limpar and a.a_partir_de:
        ap.error("--limpar apaga as camadas de que --a-partir-de depende: use um ou outro")
    if a.limpar:
        limpar()
    jobs = a_partir_de(GRAFO, a.a_partir_de) if a.a_partir_de else JOBS
    for job in jobs:
        codigo = rodar(job)
        if codigo != 0:
            pulados = jobs[jobs.index(job) + 1:]
            print(f"Parou em {job}: não rodaram {', '.join(pulados) or 'nenhum'}.", file=sys.stderr)
            return codigo
    print(f"\n{len(jobs)} jobs concluídos: {', '.join(jobs)}.")
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(PASTA))
    raise SystemExit(main())
