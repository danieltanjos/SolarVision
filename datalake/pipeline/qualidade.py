"""Job de qualidade do dado: o portão do workflow entre a Silver e as Golds.

    docker compose run --rm app python pipeline/qualidade.py

Confere a Silver contra a Bronze antes de qualquer métrica ser calculada:

- reconciliação: cada evento único da Bronze está na Silver ou nos rejeitados, nenhum some;
- event_id único e pessoa/sessão preenchidas na Silver (as chaves de todas as Golds);
- taxa de rejeição e de duplicatas dentro do esperado para o coletor.

Grava gold/qualidade_dados em append: uma linha por regra a cada execução, o histórico da saúde do
dado. Se uma regra bloqueante falha, sai com código 1: o rodar_tudo e o workflow param ali e nenhuma
Gold é recalculada em cima de dado ruim (as do último dia bom continuam valendo). Regra de alerta só
avisa.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from comum import caminho, criar_sessao, exigir_camada, glob_eventos, ler_eventos, titulo
from silver import deduplicar

TAXA_REJEICAO_MAXIMA = 0.10     # a sujeira esperada do coletor fica em ~3 %
TAXA_DUPLICATAS_MAXIMA = 0.05   # o coletor reenvia ~1 % dos lotes
SCHEMA = ("executado_em timestamp, regra string, valor double, limite string, ok boolean, "
          "bloqueante boolean")


@dataclass(frozen=True)
class Regra:
    regra: str
    valor: float
    limite: str
    ok: bool
    bloqueante: bool


def medir(bronze: DataFrame, validos: DataFrame, rejeitados: DataFrame) -> dict[str, int]:
    """As contagens que as regras comparam."""
    s = validos.agg(F.count("*").alias("validos"),
                    F.countDistinct("event_id").alias("ids_distintos"),
                    F.count(F.when(F.col("pessoa").isNull() | F.col("sessao_id").isNull(), True))
                    .alias("chaves_nulas")).first()
    return {"linhas_bronze": bronze.count(), "unicos_bronze": deduplicar(bronze).count(),
            "validos": s.validos, "ids_repetidos": s.validos - s.ids_distintos,
            "chaves_nulas": s.chaves_nulas, "rejeitados": rejeitados.count()}


def _taxa(parte: int, todo: int) -> float:
    return round(parte / todo, 4) if todo else 0.0


def regras(m: dict[str, int]) -> list[Regra]:
    sumidos = m["unicos_bronze"] - m["validos"] - m["rejeitados"]
    rejeicao = _taxa(m["rejeitados"], m["unicos_bronze"])
    duplicatas = _taxa(m["linhas_bronze"] - m["unicos_bronze"], m["linhas_bronze"])
    return [
        Regra("silver tem eventos válidos", m["validos"], "> 0", m["validos"] > 0, True),
        Regra("reconciliação: bronze única = silver + rejeitados", sumidos, "= 0", sumidos == 0, True),
        Regra("event_id único na silver", m["ids_repetidos"], "= 0", m["ids_repetidos"] == 0, True),
        Regra("pessoa e sessão preenchidas", m["chaves_nulas"], "= 0", m["chaves_nulas"] == 0, True),
        Regra("taxa de rejeição", rejeicao, f"<= {TAXA_REJEICAO_MAXIMA}", rejeicao <= TAXA_REJEICAO_MAXIMA, True),
        Regra("taxa de duplicatas", duplicatas, f"<= {TAXA_DUPLICATAS_MAXIMA}",
              duplicatas <= TAXA_DUPLICATAS_MAXIMA, False),
    ]


def falhas_bloqueantes(resultado: list[Regra]) -> list[Regra]:
    return [r for r in resultado if r.bloqueante and not r.ok]


def tabela(spark, resultado: list[Regra], executado_em: datetime) -> DataFrame:
    linhas = [(executado_em, r.regra, float(r.valor), r.limite, r.ok, r.bloqueante) for r in resultado]
    return spark.createDataFrame(linhas, SCHEMA)


def main() -> None:
    spark = criar_sessao("qualidade")
    exigir_camada(spark, glob_eventos("silver"), "python pipeline/silver.py")
    exigir_camada(spark, "silver/eventos_rejeitados", "python pipeline/silver.py")
    medidas = medir(ler_eventos(spark, "bronze"), ler_eventos(spark, "silver"),
                    spark.read.parquet(caminho("silver/eventos_rejeitados")))
    resultado = regras(medidas)
    executado_em = datetime.now(timezone.utc).replace(microsecond=0)
    tabela(spark, resultado, executado_em).write.mode("append").parquet(caminho("gold/qualidade_dados"))

    titulo("Qualidade do dado")
    for r in resultado:
        marca = "ok" if r.ok else ("FALHOU" if r.bloqueante else "alerta")
        print(f"[{marca:^6}] {r.regra:<52}{r.valor:>12g}  (limite {r.limite})")
    spark.stop()
    falhas = falhas_bloqueantes(resultado)
    if falhas:
        raise SystemExit(f"{len(falhas)} regra(s) bloqueante(s) falharam: as Golds não foram recalculadas.")


if __name__ == "__main__":
    main()
