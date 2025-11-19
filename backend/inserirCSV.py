import pandas as pd
import psycopg2
from psycopg2 import sql

# ============================
# CONFIGURAÇÕES DO BANCO
# ============================
conn = psycopg2.connect(
    host="localhost:5432",
    database="solarvision_db",
    user="solarvision_user",
    password="your_strong_password"
)

cursor = conn.cursor()

# ============================
# CARREGAR CSV
# ============================
csv_path = "Dados_Tratados_CDTE-PSI.csv"
df = pd.read_csv(csv_path)


data = row['dia']        # já vem pronto
hora = row['hora']       # já vem pronto
wats5min = row['wats5min']


# ============================
# ID DO USUÁRIO A SER VINCULADO
# ============================
ID_USUARIO = 1   # ajuste conforme necessário

# ============================
# INSERIR NO BANCO
# ============================
query = """
    INSERT INTO leituras_energia (id_usuario, data, hora, wats5min)
    VALUES (%s, %s, %s, %s)
"""

for index, row in df.iterrows():

    # Somatório das três colunas ou escolha 1?
    # Aqui soma total de energia (ajuste se quiser outra lógica)
    wats5min = float(row['INV_CDTE_240'] + row['INV_CDTE_340'] + row['INV_PSI_440'])

    cursor.execute(query, (
        ID_USUARIO,
        row['data'],
        row['hora'],
        wats5min
    ))

conn.commit()
cursor.close()
conn.close()

print("✔ Inserção concluída com sucesso!")
