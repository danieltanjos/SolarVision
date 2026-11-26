"""Treina o modelo de déficit energético com scikit-learn e exporta para o Postgres (o modelo em uso no app).

Dados, avaliação e exportação: ml/comum.py (os mesmos da versão Spark, ml/treinar_deficit_spark.py).

Uso, na raiz do repositório (Python 3.14; o 3.15 ainda não tem scikit-learn):
  py -3.14 -m venv ml/.venv
  ml/.venv/Scripts/python -m pip install -r ml/requirements.txt
  ml/.venv/Scripts/python ml/treinar_deficit.py                  # treina, avalia e grava a migration
  ml/.venv/Scripts/python ml/treinar_deficit.py --sem-migration  # só treina e avalia
Outro sistema: --csv, --latitude, --longitude, --inclinacao e --azimute.
"""

import time

from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import GroupKFold, cross_val_predict

import comum

inicio_script = time.perf_counter()
parser = comum.parser(__doc__)
parser.add_argument("--sem-migration", action="store_true", help="não grava a migration")
args = parser.parse_args()
treino, teste = comum.carregar(args)


def novo_modelo():
    # absolute_error: a mediana condicional; robusto às horas em que a nuvem local derruba o medido
    return HistGradientBoostingRegressor(loss="absolute_error", max_iter=400, learning_rate=0.05,
                                         max_leaf_nodes=15, min_samples_leaf=40, random_state=0)


# Limite de queda fora da amostra: cada ano previsto por um modelo treinado sem ele.
t = time.perf_counter()
fora_da_amostra = cross_val_predict(novo_modelo(), treino[comum.X], treino["razao"],
                                    groups=treino["ano"], cv=GroupKFold(n_splits=treino["ano"].nunique()))
lim = comum.limiares(treino, fora_da_amostra, args.quantil)
tempos = {"validacao": time.perf_counter() - t}

t = time.perf_counter()
modelo = novo_modelo().fit(treino[comum.X], treino["razao"])
tempos["treino"] = time.perf_counter() - t

t = time.perf_counter()
previsto = modelo.predict(teste[comum.X])
tempos["previsao"] = time.perf_counter() - t

r = comum.avaliar(teste, previsto, lim)
razao_grade = modelo.predict(comum.grade()[comum.X])
tempos["total"] = time.perf_counter() - inicio_script
texto = comum.relatorio("Modelo de déficit energético: scikit-learn", "`HistGradientBoostingRegressor` (perda absoluta, "
                        "400 árvores de até 15 folhas, taxa 0,05).", args, treino, teste, r, lim, tempos)
print(texto)
comum.salvar("sklearn", texto, r, lim, tempos, razao_grade)
if not args.sem_migration:
    comum.exportar(razao_grade, lim, r, "treinar_deficit.py")
