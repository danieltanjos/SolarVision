import csv
import os
from datetime import date, datetime, timedelta
from decimal import Decimal

import psycopg2
from psycopg2.extras import execute_values

DATABASE_URL = os.environ["DATABASE_URL"]
CSV_PATH = os.environ.get("CSV_PATH", os.path.join(os.path.dirname(__file__), "Dados_Tratados_CDTE-PSI.csv"))
SEED_GROUP_NAME = os.environ.get("SEED_GROUP_NAME", "Grupo Seeder SolarVision")
SEED_PANEL_MODEL = os.environ.get("SEED_PANEL_MODEL", "Painel CSV CDTE-PSI")
SEED_PANEL_STATUS = os.environ.get("SEED_PANEL_STATUS", "ATIVA")
BATCH_SIZE = int(os.environ.get("SEED_BATCH_SIZE", "5000"))
# Desloca as datas do CSV para que a leitura mais recente caia em ~hoje (sensacao de tempo real).
# Mantem hora do dia e espacamento; o deslocamento e' calculado a cada execucao (sempre relativo a hoje).
SEED_SHIFT_TO_TODAY = os.environ.get("SEED_SHIFT_TO_TODAY", "true").lower() in ("1", "true", "yes")


def ensure_seed_panel(cursor):
    cursor.execute(
        """
        SELECT id
        FROM grupos_solares
        WHERE nome = %s
        ORDER BY id
        LIMIT 1
        """,
        (SEED_GROUP_NAME,),
    )
    row = cursor.fetchone()
    if row:
        group_id = row[0]
    else:
        cursor.execute(
            """
            INSERT INTO grupos_solares (nome, status)
            VALUES (%s, 'ATIVO')
            RETURNING id
            """,
            (SEED_GROUP_NAME,),
        )
        group_id = cursor.fetchone()[0]

    cursor.execute(
        """
        SELECT id
        FROM placas
        WHERE grupo_id = %s AND modelo = %s
        ORDER BY id
        LIMIT 1
        """,
        (group_id, SEED_PANEL_MODEL),
    )
    row = cursor.fetchone()
    if row:
        panel_id = row[0]
        cursor.execute(
            "UPDATE placas SET status = %s WHERE id = %s",
            (SEED_PANEL_STATUS, panel_id),
        )
        return panel_id

    cursor.execute(
        """
        INSERT INTO placas (grupo_id, modelo, status)
        VALUES (%s, %s, %s)
        RETURNING id
        """,
        (group_id, SEED_PANEL_MODEL, SEED_PANEL_STATUS),
    )
    return cursor.fetchone()[0]


def compute_shift():
    """Calcula o deslocamento (em dias) para a ultima data do CSV cair em ~hoje.

    Desloca por dias inteiros para preservar a hora do dia (geracao solar e' diurna).
    Retorna timedelta(0) se o shift estiver desligado ou o CSV estiver vazio/no futuro.
    """
    if not SEED_SHIFT_TO_TODAY:
        return timedelta(0)

    max_dia = None
    with open(CSV_PATH, newline="", encoding="utf-8-sig") as csv_file:
        for row in csv.DictReader(csv_file):
            dia = row.get("dia", "").strip()
            if dia and (max_dia is None or dia > max_dia):
                max_dia = dia

    if not max_dia:
        return timedelta(0)

    ultima_data = datetime.strptime(max_dia, "%Y-%m-%d").date()
    delta_dias = (date.today() - ultima_data).days
    if delta_dias <= 0:
        return timedelta(0)

    print(
        f"Shift de datas ativo: ultima data do CSV {ultima_data} -> +{delta_dias} dias "
        f"(termina em ~{date.today()})."
    )
    return timedelta(days=delta_dias)


def load_rows(panel_id, shift):
    with open(CSV_PATH, newline="", encoding="utf-8-sig") as csv_file:
        reader = csv.DictReader(csv_file)
        for line_number, row in enumerate(reader, start=2):
            try:
                timestamp = datetime.strptime(
                    f"{row['dia'].strip()} {row['hora'].strip()}",
                    "%Y-%m-%d %H:%M:%S",
                ) + shift
                watts = Decimal(row["wats5min"].strip())
            except (KeyError, ValueError, ArithmeticError) as error:
                raise ValueError(
                    f"Linha {line_number} invalida no CSV: {error}"
                ) from error

            yield (panel_id, timestamp, watts)


def insert_batches(cursor, rows):
    inserted = 0
    batch = []

    for row in rows:
        batch.append(row)
        if len(batch) >= BATCH_SIZE:
            execute_values(
                cursor,
                """
                INSERT INTO leituras_energia (placa_id, data_hora, wats_gerados)
                VALUES %s
                """,
                batch,
            )
            inserted += len(batch)
            print(f"Lote inserido: {inserted} registros")
            batch.clear()

    if batch:
        execute_values(
            cursor,
            """
            INSERT INTO leituras_energia (placa_id, data_hora, wats_gerados)
            VALUES %s
            """,
            batch,
        )
        inserted += len(batch)
        print(f"Lote final inserido: {inserted} registros")

    return inserted


def main():
    connection = psycopg2.connect(DATABASE_URL)
    try:
        with connection:
            with connection.cursor() as cursor:
                # O CSV esta em horario de Sao Paulo; o Supabase roda em UTC.
                cursor.execute("SET TIME ZONE 'America/Sao_Paulo'")
                print("Preparando grupo e placa padrao para importacao...")
                panel_id = ensure_seed_panel(cursor)
                print(f"Placa selecionada para importacao: {panel_id}")

                print("Removendo leituras antigas da placa do seeder...")
                cursor.execute(
                    "DELETE FROM leituras_energia WHERE placa_id = %s",
                    (panel_id,),
                )

                shift = compute_shift()

                print(f"Lendo CSV em {CSV_PATH}...")
                total = insert_batches(cursor, load_rows(panel_id, shift))
                print(f"Sucesso! {total} leituras importadas para a placa {panel_id}.")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
