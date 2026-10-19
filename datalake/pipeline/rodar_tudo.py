"""Script de sequência (R3): roda os oito jobs do datalake em ordem. Não gera dados.

    docker compose run --rm app python pipeline/rodar_tudo.py            # a partir da landing que já existe
    docker compose run --rm app python pipeline/rodar_tudo.py --limpar   # apaga bronze/silver/gold antes

A Bronze é append-only: rodar de novo sem --limpar acrescenta a landing outra vez, e a Silver
descarta as cópias na deduplicação (R5). Para reconstruir do zero, use --limpar.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

PASTA = Path(__file__).resolve().parent
JOBS = (
    "bronze", "silver",
    "gold_funil", "gold_engajamento", "gold_aquisicao", "gold_ml", "gold_mapa_calor",
    "exportar_bi",
)
CAMADAS = ("bronze", "silver", "gold")


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
    a = ap.parse_args(argv)
    if a.limpar:
        limpar()
    for job in JOBS:
        codigo = rodar(job)
        if codigo != 0:
            print(f"Parou em {job}: os jobs seguintes dependem dele.", file=sys.stderr)
            return codigo
    print(f"\nDatalake reconstruído: {len(JOBS)} jobs.")
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(PASTA))
    raise SystemExit(main())
