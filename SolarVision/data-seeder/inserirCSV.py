import os
import pandas as pd
import psycopg2
import psycopg2.extras

# --- CONFIGURAÇÃO ---
DB_HOST = os.environ.get("DB_HOST", "127.0.0.1")
DB_USER = os.environ.get("DB_USER", "solarvision_user")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "your_strong_password")
DB_DATABASE = os.environ.get("DB_DATABASE", "solarvision_db")

conn = psycopg2.connect(
    host=DB_HOST,
    port=5432,
    database=DB_DATABASE,
    user=DB_USER,
    password=DB_PASSWORD
)
cursor = conn.cursor()

# Nome do arquivo (garanta que ele está na mesma pasta do script)
csv_path = "Dados_Tratados_CDTE-PSI.csv"

try:
    print("Lendo CSV...")
    df = pd.read_csv(csv_path)
    
    # Garante que os nomes das colunas estão limpos
    df.columns = df.columns.str.strip().str.lower()
    print(f"Colunas encontradas: {df.columns.tolist()}")

    print("Inserindo dados no Banco...")
    # Convert dataframe to list of tuples
    tuples = [tuple(x) for x in df[['dia', 'hora', 'wats5min']].to_numpy()]

    insert_query = """
        INSERT INTO leituras_energia (dia, hora, wats5min)
        VALUES %s
    """

    psycopg2.extras.execute_values(cursor, insert_query, tuples)
    conn.commit()
    print(f"\n✅ Sucesso! {len(tuples)} registros inseridos.")

except Exception as e:
    conn.rollback()
    print(f"\n❌ Erro: {e}")

finally:
    cursor.close()
    conn.close()