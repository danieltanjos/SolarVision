import pandas as pd
import psycopg2

# --- CONFIGURAÇÃO ---
# Certifique-se que o banco está rodando (docker-compose up)
conn = psycopg2.connect(
    host="127.0.0.1",
    port=5432,
    database="solarvision_db",
    user="solarvision_user",
    password="your_strong_password"
)
cursor = conn.cursor()

# Nome do arquivo (garanta que ele está na mesma pasta do script)
csv_path = "Dados_Tratados_CDTE-PSI.csv"

try:
    print("Lendo CSV...")
    # Tenta ler com vírgula (padrão do seu exemplo)
    df = pd.read_csv(csv_path)
    
    # Garante que os nomes das colunas estão limpos
    df.columns = df.columns.str.strip().str.lower()
    print(f"Colunas encontradas: {df.columns.tolist()}")

    # Query de inserção
    insert_query = """
        INSERT INTO leituras_energia (id_usuario, data, hora, wats5min)
        VALUES (%s, %s, %s, %s)
    """

    print("Inserindo dados no Banco...")
    count = 0
    for index, row in df.iterrows():
        cursor.execute(insert_query, (
            1,              # ID fixo do usuário
            row['dia'],     # Coluna 'dia' do CSV
            row['hora'],    # Coluna 'hora' do CSV
            row['wats5min'] # Coluna 'wats5min' do CSV
        ))
        count += 1
        if count % 100 == 0: print(f"{count}...", end="\r")

    conn.commit()
    print(f"\n✅ Sucesso! {count} registros inseridos.")

except Exception as e:
    conn.rollback()
    print(f"\n❌ Erro: {e}")

finally:
    cursor.close()
    conn.close()