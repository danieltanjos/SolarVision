"""Parte comum aos dois treinos do modelo de déficit (scikit-learn e Spark MLlib).

Os dois usam exatamente os mesmos dados, a mesma divisão treino/teste, o mesmo cálculo do limite de queda e a mesma
avaliação (com as mesmas quedas injetadas, semente fixa): só o algoritmo de gradient boosting muda. Assim a comparação
em ml/COMPARACAO.md é justa.

O que o modelo aprende, hora a hora:
  razao = energia medida ÷ estimativa física (a mesma de public.potencia_estimada, sem Wp e PR),
  normalizada pela mediana do ano (tira a potência instalada, desconhecida, e a degradação).
  Entradas: irradiância no plano da placa (GTI), hora de São Paulo e mês: o quanto a placa rende além/aquém da
  física em cada situação (ângulo do sol, reflexão em sol baixo, espectro, calor etc.).
E o limite de queda: o quantil (padrão 2 %) do desvio real ÷ previsto em horas normais, por faixa de irradiância,
  calculado fora da amostra (validação cruzada por ano). Substitui os 70 % fixos para placa sem vizinhas.

O Postgres não roda o modelo: ele vira uma tabela de consulta public.modelo_deficit (mês × hora × faixa de
100 W/m²) gravada numa migration nova, aplicada pelo CI como as demais.

Dados: supabase/seed/Dados_Tratados_CDTE-PSI.csv (Fotovoltaica-UFSC, 5 min, 2018-2023) e o arquivo histórico do
Open-Meteo para 20° Norte em Florianópolis (melhor ajuste de docs/validacao), em cache em ml/.cache.
"""

import argparse
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import truststore

# Verifica o HTTPS pelo repositório de certificados do sistema (o do Python pode ter raiz vencida no Windows).
truststore.inject_into_ssl()
sys.stdout.reconfigure(encoding="utf-8")  # o console do Windows não é UTF-8 por padrão

PASTA = Path(__file__).resolve().parent
RAIZ = PASTA.parent
CACHE = PASTA / ".cache"
RESULTADOS = PASTA / "resultados"
GAMA = -0.40  # %/°C, o padrão do app
PR = 0.82  # o do app: hora de sol = estimada ≥ 10 % da Wp, como no SQL
FAIXAS = range(12)  # irradiância em faixas de 100 W/m²; a última é ≥ 1100
HORAS = range(5, 20)  # 05h a 19h de São Paulo
MESES = range(1, 13)
FALHA_LIMITE = 0.05  # real ≤ 5 % do estimado com sol = FALHA (regra física, igual ao SQL)
LIMIAR_FIXO = 0.70  # a regra anterior, para comparar
X = ["gti", "hora", "mes"]


def parser(descricao: str) -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=descricao, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--csv", type=Path, default=RAIZ / "supabase/seed/Dados_Tratados_CDTE-PSI.csv",
                   help="colunas dia,hora,wats5min (potência média de 5 min, horário de São Paulo)")
    p.add_argument("--latitude", type=float, default=-27.43)
    p.add_argument("--longitude", type=float, default=-48.44)
    p.add_argument("--inclinacao", type=float, default=20)
    p.add_argument("--azimute", type=float, default=0, help="0 = Norte, 90 = Leste (como no app)")
    p.add_argument("--quantil", type=float, default=0.02, help="limite de queda = este quantil do desvio normal")
    p.add_argument("--teste-desde", default="2022-01-01", help="horas a partir daqui só avaliam (não treinam)")
    p.add_argument("--excluir", nargs=2, action="append", metavar=("INICIO", "FIM"),
                   default=[["2022-03-01", "2022-12-01"]],
                   help="períodos com falha conhecida (docs/validacao): fora do treino e da avaliação")
    return p


def _horas_medidas(csv: Path) -> pd.DataFrame:
    """Energia por hora (início da hora, São Paulo). Só horas cobertas: o datalogger só grava com geração."""
    leituras = pd.read_csv(csv)
    leituras["inicio"] = pd.to_datetime(leituras["dia"] + " " + leituras["hora"]).dt.floor("h")
    horas = leituras.groupby("inicio")["wats5min"].agg(wh=lambda w: w.sum() * 5 / 60, n="count").reset_index()
    return horas[horas["n"] >= 11].drop(columns="n")


def _clima(args, inicio: str, fim: str) -> pd.DataFrame:
    """GTI e temperatura do Open-Meteo (mesma URL do app). A hora vem marcada pelo fim: início = 1 h antes."""
    CACHE.mkdir(exist_ok=True)
    arquivo = CACHE / f"{args.latitude}_{args.longitude}_{args.inclinacao}_{args.azimute}_{inicio}_{fim}.json"
    if not arquivo.exists():
        url = (f"https://archive-api.open-meteo.com/v1/archive?latitude={args.latitude}&longitude={args.longitude}"
               f"&tilt={args.inclinacao}&azimuth={args.azimute - 180}"
               f"&hourly=global_tilted_irradiance,temperature_2m&timezone=UTC&start_date={inicio}&end_date={fim}")
        print("Baixando o clima horário do Open-Meteo (uma vez; fica em ml/.cache)...")
        with urllib.request.urlopen(url, timeout=300) as resposta:
            arquivo.write_bytes(resposta.read())
    hourly = json.loads(arquivo.read_text())["hourly"]
    df = pd.DataFrame({"t": pd.to_datetime(hourly["time"]), "gti": hourly["global_tilted_irradiance"],
                       "temp": hourly["temperature_2m"]}).dropna()
    df["inicio"] = df["t"] - pd.Timedelta(hours=1) - pd.Timedelta(hours=3)  # UTC−3 fixo, como a importação do app
    return df.drop(columns="t")


def carregar(args) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Medido + clima, só horas de sol e fora dos períodos de falha; devolve (treino, teste)."""
    medido = _horas_medidas(args.csv)
    dados = medido.merge(_clima(args, str(medido["inicio"].min().date()), str(medido["inicio"].max().date())),
                         on="inicio")
    # public.potencia_estimada com Wp = 1 e sem o PR
    dados["est"] = np.maximum(0, dados["gti"] / 1000 * (1 + GAMA / 100 * (dados["temp"] + dados["gti"] * 25 / 800 - 25)))
    dados = dados[dados["est"] * PR >= 0.10].copy()
    for inicio, fim in args.excluir:
        dados = dados[(dados["inicio"] < inicio) | (dados["inicio"] >= fim)]
    dados["ano"] = dados["inicio"].dt.year
    dados["hora"] = dados["inicio"].dt.hour
    dados["mes"] = dados["inicio"].dt.month
    dados["razao_bruta"] = dados["wh"] / dados["est"]
    # normaliza pelo ano: tira a Wp × PR desconhecida e a degradação (~2 %/ano neste sistema)
    dados["razao"] = dados["razao_bruta"] / dados.groupby("ano")["razao_bruta"].transform("median")
    dados = dados[dados["razao"] < 3].reset_index(drop=True)  # leitura incoerente com o clima (datalogger)
    treino = dados[dados["inicio"] < args.teste_desde].reset_index(drop=True)
    teste = dados[dados["inicio"] >= args.teste_desde].reset_index(drop=True)
    return treino, teste


def escala_movel(df: pd.DataFrame, coluna: str) -> pd.Series:
    """Mediana dos 7 dias anteriores (como o 'habitual' do SQL), sem as horas de falha."""
    normais = df[df[coluna] > FALHA_LIMITE]
    diaria = normais.groupby(normais["inicio"].dt.normalize())[coluna].median().asfreq("D")
    movel = diaria.rolling(7, min_periods=3).median().shift(1)
    return df["inicio"].dt.normalize().map(movel)


def faixa(gti) -> np.ndarray:
    return np.minimum(np.floor(np.asarray(gti) / 100), max(FAIXAS)).astype(int)


def limiares(treino: pd.DataFrame, previsto_fora_da_amostra: np.ndarray, quantil: float) -> dict[int, float]:
    """Limite de queda por faixa = quantil do desvio normal, com previsões de modelos que não viram aquele ano."""
    t = treino.copy()
    t["desvio"] = t["razao"] / previsto_fora_da_amostra
    t["z"] = t["desvio"] / escala_movel(t, "desvio")
    normais = t.dropna(subset=["z"])
    normais = normais[normais["razao"] > FALHA_LIMITE]
    global_q = normais["z"].quantile(quantil)
    resultado = {}
    for f in FAIXAS:
        da_faixa = normais.loc[faixa(normais["gti"]) == f, "z"]
        q = da_faixa.quantile(quantil) if len(da_faixa) >= 300 else global_q
        resultado[f] = float(np.clip(q, 0.20, 0.85))  # abaixo dos 85 % que o SQL considera "vizinha normal"
    return resultado


def avaliar(teste: pd.DataFrame, previsto: np.ndarray, lim: dict[int, float]) -> dict:
    """Erro da previsão de energia e detecção (falso alarme e quedas injetadas) no período de teste."""
    df = teste.copy()
    df["prev"] = previsto
    # previsão de energia: escala da placa = mediana dos 7 dias anteriores (como no SQL)
    df["ml_desvio"] = df["razao_bruta"] / df["prev"]
    df["ml_esc"] = escala_movel(df, "ml_desvio")
    df["fis_esc"] = escala_movel(df, "razao_bruta")
    ok = df.dropna(subset=["ml_esc", "fis_esc"]).copy()
    nmae = lambda prev: float(np.abs(prev - ok["wh"]).sum() / ok["wh"].sum())
    resultado = {
        "horas_teste": len(ok),
        "nmae_fisico": nmae(ok["est"] * ok["fis_esc"]),
        "nmae_ml": nmae(ok["est"] * ok["prev"] * ok["ml_esc"]),
    }

    rng = np.random.default_rng(0)  # as mesmas quedas injetadas para qualquer modelo
    ok["dia"] = ok["inicio"].dt.normalize()
    dias = [g for _, g in ok.groupby("dia") if len(g) >= 4]

    def alertas(g: pd.DataFrame, fator: np.ndarray) -> tuple[str | None, str | None]:
        bruta = g["razao_bruta"].to_numpy() * fator
        # real ≤ 5 % do estimado (a Wp deste sistema é desconhecida: usa a razão normalizada, ~1 numa hora normal)
        falha = g["razao"].to_numpy() * fator <= FALHA_LIMITE
        z_ml = bruta / g["prev"].to_numpy() / g["ml_esc"].to_numpy()
        z_fix = bruta / g["fis_esc"].to_numpy()
        lim_horas = np.array([lim[f] for f in faixa(g["gti"])])

        def tipo(abaixo):
            if falha.sum() >= 2:
                return "FALHA"
            return "QUEDA" if (abaixo & ~falha).sum() >= 2 else None

        return tipo(z_ml < lim_horas), tipo(z_fix < LIMIAR_FIXO)

    contagem = {k: [0, 0] for k in ("normal", "queda50", "queda30", "falha")}
    for g in dias:
        n = len(g)
        ml, fix = alertas(g, np.ones(n))
        contagem["normal"][0] += ml is not None
        contagem["normal"][1] += fix is not None
        for nome, fator_queda in (("queda50", 0.5), ("queda30", 0.7), ("falha", 0.0)):
            fator = np.ones(n)
            dur = int(rng.integers(2, 4))
            ini = int(rng.integers(0, n - dur + 1))
            fator[ini:ini + dur] = fator_queda
            ml, fix = alertas(g, fator)
            esperado = "FALHA" if nome == "falha" else "QUEDA"
            contagem[nome][0] += ml == esperado
            contagem[nome][1] += fix == esperado
    resultado["dias_teste"] = len(dias)
    resultado["deteccao"] = {k: (v[0] / len(dias), v[1] / len(dias)) for k, v in contagem.items()}
    return resultado


def pct(x: float) -> str:
    return f"{x * 100:.1f}%".replace(".", ",")


def seg(x: float) -> str:
    return f"{x:.1f} s".replace(".", ",")


def relatorio(titulo: str, modelo: str, args, treino, teste, r: dict, lim: dict, tempos: dict) -> str:
    det = r["deteccao"]
    faixas = " | ".join(f"{f * 100}–{f * 100 + 99}" if f < max(FAIXAS) else f"≥ {f * 100}" for f in FAIXAS)
    return f"""# {titulo}

Gerado em {datetime.now().strftime('%d/%m/%Y %H:%M')}. Treino: {len(treino):,} horas de sol
({treino['inicio'].min():%m/%Y} a {treino['inicio'].max():%m/%Y}); teste, nunca visto no treino: {r['horas_teste']:,} horas
e {r['dias_teste']} dias ({teste['inicio'].min():%m/%Y} a {teste['inicio'].max():%m/%Y}). Fora dos dois: {', '.join(f'{a} a {b}' for a, b in args.excluir)} (falha conhecida).

**Modelo:** {modelo} Prevê o rendimento da hora relativo à estimativa física do app, a partir de irradiância no
plano da placa, hora e mês. Exportável como tabela `modelo_deficit` (12 meses × {len(HORAS)} horas × {len(FAIXAS)} faixas de 100 W/m²).

**Tempo:** validação cruzada (limite de queda) {seg(tempos['validacao'])}; treino final {seg(tempos['treino'])}; previsão do teste {seg(tempos['previsao'])}.

## Previsão da energia por hora (teste)

| Modelo | nMAE horário |
|---|---|
| Físico do app × mediana dos 7 dias (antes) | {pct(r['nmae_fisico'])} |
| Físico × ML × mediana dos 7 dias (agora) | {pct(r['nmae_ml'])} |

## Detecção (dias de teste; quedas injetadas em 2 a 3 horas seguidas)

| Situação | ML (limite aprendido) | Regra fixa (70 %) |
|---|---|---|
| Dia normal com alerta (falso alarme) | {pct(det['normal'][0])} | {pct(det['normal'][1])} |
| Objeto/sombra: placa a 50 % | {pct(det['queda50'][0])} detectados | {pct(det['queda50'][1])} |
| Objeto/sombra: placa a 70 % | {pct(det['queda30'][0])} detectados | {pct(det['queda30'][1])} |
| Falha: placa a 0 % | {pct(det['falha'][0])} detectados | {pct(det['falha'][1])} |

Sistema de uma placa só (sem vizinhas): no app, a comparação com as outras placas do grupo ainda descarta a queda que
o grupo inteiro sentiu (tempo), o que reduz o falso alarme abaixo do daqui.

## Limite de queda aprendido (quantil {pct(args.quantil)} do desvio normal)

| Irradiância (W/m²) | {faixas} |
|---|{'---|' * len(FAIXAS)}
| Alerta abaixo de | {' | '.join(f'{lim[f] * 100:.0f}%' for f in FAIXAS)} |

## Limitações

- Treinado com um único sistema (CdTe, 20° Norte, Florianópolis): hora e mês também carregam as sombras e o
  horizonte desse local. Re-treinar com as leituras das próprias placas quando houver histórico.
- Sem exemplos rotulados de falha, o modelo aprende o normal; quedas e falhas da avaliação são injetadas.
- Clima horário de reanálise (grade de dezenas de km): a nuvem local continua sendo o maior erro.
"""


def grade() -> pd.DataFrame:
    """Pontos da tabela modelo_deficit: o centro de cada faixa de irradiância."""
    g = pd.DataFrame([(m, h, f) for m in MESES for h in HORAS for f in FAIXAS], columns=["mes", "hora", "faixa"])
    g["gti"] = g["faixa"] * 100 + 50.0
    return g


def salvar(nome: str, texto: str, r: dict, lim: dict, tempos: dict, razao_grade: np.ndarray) -> None:
    """Grava o relatório e o resumo em JSON (usado pela comparação) e, se os dois treinos já rodaram, compara."""
    RESULTADOS.mkdir(exist_ok=True)
    (RESULTADOS / f"{nome}.md").write_text(texto, encoding="utf-8")
    (RESULTADOS / f"{nome}.json").write_text(json.dumps(
        {"metricas": r, "limiares": lim, "tempos": tempos, "razao_grade": [round(float(v), 4) for v in razao_grade]},
        indent=1), encoding="utf-8")
    print(f"Gravado: ml/resultados/{nome}.md")
    comparar()


def exportar(razao_grade: np.ndarray, lim: dict, r: dict, origem: str) -> Path:
    """Migration nova com a tabela modelo_deficit (apaga a anterior)."""
    g = grade()
    g["razao"] = np.clip(razao_grade, 0.05, 3)
    g["limiar"] = g["faixa"].map(lim)
    valores = ",\n".join(f"({m},{h},{f},{z:.4f},{l:.4f})"
                         for m, h, f, z, l in g[["mes", "hora", "faixa", "razao", "limiar"]].itertuples(index=False))
    agora = datetime.now(timezone.utc)
    det = r["deteccao"]
    migration = RAIZ / f"supabase/migrations/{agora:%Y%m%d%H%M%S}_modelo_deficit_dados.sql"
    migration.write_text(
        f"-- Gerado por ml/{origem} (não editar à mão; re-treinar gera outra migration). Métricas: ml/resultados/\n"
        f"-- nMAE horário {pct(r['nmae_ml'])} (físico {pct(r['nmae_fisico'])}); falso alarme {pct(det['normal'][0])}/dia; "
        f"queda a 50 % detectada {pct(det['queda50'][0])}.\n"
        "delete from public.modelo_deficit;\n"
        "insert into public.modelo_deficit (mes, hora, faixa, razao, limiar) values\n"
        f"{valores};\n"
        f"comment on table public.modelo_deficit is 'Modelo de déficit treinado em {agora:%Y-%m-%d} por ml/{origem}';\n",
        encoding="utf-8")
    print(f"Gravado: {migration.relative_to(RAIZ)}")
    return migration


def comparar() -> None:
    """ml/COMPARACAO.md com scikit-learn x Spark MLlib, quando os dois resultados existem."""
    arquivos = {nome: RESULTADOS / f"{nome}.json" for nome in ("sklearn", "spark")}
    if not all(a.exists() for a in arquivos.values()):
        return
    sk, sp = (json.loads(a.read_text(encoding="utf-8")) for a in arquivos.values())
    ms, mp = sk["metricas"], sp["metricas"]
    linha = lambda nome, a, b: f"| {nome} | {a} | {b} |"
    det = lambda m, k: pct(m["deteccao"][k][0])
    diferenca = np.abs(np.array(sk["razao_grade"]) - np.array(sp["razao_grade"]))
    linhas = [
        linha("nMAE horário (físico: " + pct(ms["nmae_fisico"]) + ")", pct(ms["nmae_ml"]), pct(mp["nmae_ml"])),
        linha("Falso alarme (dia normal)", det(ms, "normal"), det(mp, "normal")),
        linha("Queda a 50 % detectada", det(ms, "queda50"), det(mp, "queda50")),
        linha("Queda a 70 % detectada", det(ms, "queda30"), det(mp, "queda30")),
        linha("Falha (0 %) detectada", det(ms, "falha"), det(mp, "falha")),
        linha("Tempo: validação cruzada (5 modelos)", seg(sk["tempos"]["validacao"]), seg(sp["tempos"]["validacao"])),
        linha("Tempo: treino final", seg(sk["tempos"]["treino"]), seg(sp["tempos"]["treino"])),
        linha("Tempo: total do script", seg(sk["tempos"]["total"]), seg(sp["tempos"]["total"])),
    ]
    limiares = " | ".join(f"{sk['limiares'][str(f)] * 100:.0f}/{sp['limiares'][str(f)] * 100:.0f}" for f in FAIXAS)
    texto = f"""# scikit-learn x Spark MLlib (modelo de déficit)

Mesmos dados, mesma divisão treino/teste, mesmo cálculo do limite e mesmas quedas injetadas (ver `ml/comum.py`):
só o gradient boosting muda. Detalhes de cada um em `ml/resultados/sklearn.md` e `ml/resultados/spark.md`.
Gerado em {datetime.now().strftime('%d/%m/%Y %H:%M')}; {ms['horas_teste']:,} horas e {ms['dias_teste']} dias de teste.

| | scikit-learn (`HistGradientBoostingRegressor`) | Spark MLlib (`GBTRegressor`, local) |
|---|---|---|
{chr(10).join(linhas)}

Diferença entre as duas tabelas `modelo_deficit` (razão prevista, ≈ 1 em média; {len(diferenca)} células): média
{f'{diferenca.mean():.3f}'.replace('.', ',')}, máxima {f'{diferenca.max():.3f}'.replace('.', ',')}. As maiores ficam em combinações raras ou ausentes nos dados (ex.: 950 W/m²
às 18h de maio), onde cada algoritmo extrapola do seu jeito; nas combinações que aparecem nos dados a diferença é menor.

Limite de queda por faixa de irradiância (scikit-learn/Spark, %): {limiares}

## Conclusão

- **Qualidade:** os dois aprendem praticamente o mesmo modelo; as diferenças de detecção ficam no ruído de ~150 dias
  de teste. O limite do clima horário (nuvem local) pesa muito mais que o algoritmo.
- **Tempo:** com ~13 mil horas de treino, o Spark leva {sp['tempos']['total'] / sk['tempos']['total']:.0f}× mais que o scikit-learn: sobe a JVM, divide os dados e roda cada
  árvore como um job. Ele compensa quando os dados não cabem numa máquina (milhares de placas com leituras de 5 min
  por anos, centenas de milhões de linhas) ou para processar leituras em fluxo (Structured Streaming).
- **Uso no app:** os dois exportam a mesma tabela; a migration atual vem do scikit-learn (`ml/treinar_deficit.py`).
"""
    (PASTA / "COMPARACAO.md").write_text(texto, encoding="utf-8")
    print("Gravado: ml/COMPARACAO.md")
