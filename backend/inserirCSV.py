import pandas as pd
import psycopg2
from psycopg2 import sql

# ============================================
# CONFIGURAÇÃO DO BANCO DE DADOS
# ============================================
conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="solarvision_db",
    user="solarvision_user",
    password="your_strong_password"
)

cursor = conn.cursor()

# ============================================
# LER O CSV
# ============================================
csv_path = "seuarquivo.csv"   # coloque aqui o nome do arquivo CSV
df = pd.read_csv(csv_path)

# --------------------------------------------
# VERIFICAR SE AS COLUNAS NECESSÁRIAS EXISTEM
# --------------------------------------------
colunas_necessarias = ['dia', 'hora', 'wats5min']

for col in colunas_necessarias:
    if col not in df.columns:
        raise Exception(f"ERRO: a coluna '{col}' não foi encontrada no CSV.")

# ============================================
# ID DO USUÁRIO PARA INSERÇÃO NO BANCO
# ============================================
ID_USUARIO = 1   # Troque conforme necessário

# ============================================
# QUERY DE INSERÇÃO
# ============================================
query = """
    INSERT INTO leituras_energia (id_usuario, data, hora, wats5min)
    VALUES (%s, %s, %s, %s)
"""

# ============================================
# INSERÇÃO DOS DADOS
# ============================================
total = 0

for index, row in df.iterrows():

    data = row['dia']
    hora = row['hora']
    wats = float(row['wats5min'])   # garante número com ponto

    cursor.execute(query, (
        ID_USUARIO,
        data,
        hora,
        wats
    ))

    total += 1

# ============================================
# FINALIZAÇÃO
# ============================================
conn.commit()
cursor.close()
conn.close()

print(f"✔ Inserção concluída com sucesso! {total} linhas inseridas.")
