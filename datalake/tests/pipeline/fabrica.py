"""Monta DataFrames pequenos no formato da Bronze, para testar os jobs sem o S3."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from bronze import SCHEMA
from pyspark.sql import functions as F
from pyspark.sql.types import StringType, StructField, StructType, TimestampType

BASE = "https://solarvision-senai.vercel.app"
T0 = datetime(2026, 9, 1, 12, 0, tzinfo=timezone.utc)
INGESTAO = datetime(2026, 10, 1, tzinfo=timezone.utc)


def evento(event_id: str, nome: str | None, minutos: float | None = 0, pseudo: str = "anon-1",
           user_id: str | None = None, tela: str = "/app/home", params: dict | None = None,
           items: list | None = None, source: str = "google", medium: str = "organic",
           device: str = "desktop") -> dict:
    """Um evento do contrato; `minutos` conta a partir de T0 (None = timestamp ausente)."""
    return {
        "event_id": event_id, "event_name": nome,
        "event_ts": None if minutos is None else T0 + timedelta(minutes=minutos),
        "user_pseudo_id": pseudo, "user_id": user_id, "session_hint": "s-x",
        "page": {"location": BASE + tela, "referrer": None},
        "traffic": {"source": source, "medium": medium, "campaign": None},
        "device": {"category": device, "os": "Windows", "browser": "Chrome"},
        "params": {k: None if v is None else str(v).lower() if isinstance(v, bool) else str(v)
                   for k, v in (params or {}).items()},
        "items": items or [],
    }


PROVENIENCIA = StructType([
    StructField("arquivo_origem", StringType()),
    StructField("ingerido_em", TimestampType()),
    StructField("year", StringType()),
    StructField("month", StringType()),
    StructField("day", StringType()),
])


def bronze(spark, eventos: list[dict], arquivo: str = "s3a://b/landing/x.jsonl", ingerido_em=INGESTAO):
    """DataFrame com as colunas da Bronze: o schema do contrato, a proveniência e as partições."""
    df = spark.createDataFrame(eventos, SCHEMA)
    return (df.withColumn("arquivo_origem", F.lit(arquivo))
              .withColumn("ingerido_em", F.lit(ingerido_em).cast("timestamp"))
              .withColumn("year", F.lit("2026")).withColumn("month", F.lit("09")).withColumn("day", F.lit("01")))
