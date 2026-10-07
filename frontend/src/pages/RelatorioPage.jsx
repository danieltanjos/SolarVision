import { useEffect, useState } from "react";
import Chart from "react-apexcharts";
import { Link, useSearchParams } from "react-router-dom";
import {
  extractErrorMessage,
  getDashboardHistorico,
  getDashboardMetrics,
  getFinanceiro,
  getRankingPlacas,
  getRecomendacoesLimpeza,
  listCleanings,
  listGroups,
  listPanels
} from "../lib/api";
import { formatCo2, formatReais } from "../lib/financeiro";
import { baldesComMedia, comparacaoClima, textoAnos } from "../lib/historico";
import { TIME_ZONE, formatRangeLabel, janelasRelatorio, mesRelatorio, rangeFor } from "../lib/periodo";
import { LIMPAR_A_PARTIR, formatPerda, orientacao, perdaMedia, potenciaInstalada } from "../lib/placas";
import { formatEnergy, formatPower, powerUnit } from "../lib/power";
import logo from "../../img/logo.png";

const soma = (linhas, key) => linhas.reduce((total, linha) => total + (Number(linha[key]) || 0), 0);
const plural = (n, singular, pluralForm) => `${n} ${n === 1 ? singular : pluralForm}`;
const pct = (fracao) => (fracao == null ? "—" : `${Math.round(fracao * 100)}%`);
const numero = (valor, casas = 0) => valor.toLocaleString("pt-BR", { maximumFractionDigits: casas });
const dataHora = (valor) => new Date(valor).toLocaleString("pt-BR", { timeZone: TIME_ZONE, dateStyle: "short", timeStyle: "short" });
const diaMes = (valor) => new Date(valor).toLocaleDateString("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" });
const dias = ({ dataInicio, dataFim }) => (Date.parse(dataFim) - Date.parse(dataInicio)) / 864e5;
const trecho = ({ dataInicio, dataFim }) => `${diaMes(dataInicio)}–${diaMes(dataFim)}`;
// dashboard_financeiro conta só as horas com real: lá, estimado = real + perdido com sujeira.
const estimado = (valores) => Number(valores.realWh) + Number(valores.perdaSujeiraWh);
const desempenhoDe = (valores) => (estimado(valores) ? valores.realWh / estimado(valores) : null);
// De antes para depois: fração (0,12 = +12%) ou, em pp, a diferença em pontos percentuais; null sem base.
const variacao = (antes, depois, pp = false) =>
  antes == null || depois == null ? null : pp ? (depois - antes) * 100 : Number(antes) ? depois / antes - 1 : null;

const COR = { real: "#3b7197", estimada: "#e8a317", media: "#7f91a3" };

// Selo de variação: seta e % (ou p.p.); verde quando melhora (inverter: subir é ruim, como a perda).
function Variacao({ valor, pp = false, inverter = false }) {
  if (valor == null || !Number.isFinite(valor)) return <span className="sv-delta">—</span>;
  const sinal = Math.sign(pp ? Math.round(valor * 10) : Math.round(valor * 100));
  const tom = sinal === 0 ? "" : sinal > 0 !== inverter ? "is-bom" : "is-ruim";
  return (
    <span className={`sv-delta ${tom}`}>
      <i className={`bi ${sinal > 0 ? "bi-arrow-up-short" : sinal < 0 ? "bi-arrow-down-short" : "bi-dash"}`} />
      {pp ? `${numero(Math.abs(valor), 1)} p.p.` : `${Math.round(Math.abs(valor) * 100)}%`}
    </span>
  );
}

// Sparkline: uma barra por dia, só a forma (do menor ao maior dia, senão o desempenho ~95% vira um bloco).
// Dia sem dado fica sem barra.
function Barrinhas({ valores }) {
  const comDado = valores.filter((valor) => valor != null).map(Number);
  const [menor, maior] = [Math.min(...comDado), Math.max(...comDado)];
  const altura = (valor) => (valor == null ? 0 : maior > menor ? 4 + ((valor - menor) / (maior - menor)) * 28 : 32);
  return (
    <svg className="sv-barrinhas" viewBox={`0 0 ${valores.length * 4} 32`} preserveAspectRatio="none" aria-hidden="true">
      {valores.map((valor, i) => (
        <rect key={i} x={i * 4} y={32 - altura(valor)} width="3" height={altura(valor)} />
      ))}
    </svg>
  );
}

function Kpi({ titulo, icone, valor, serie, delta, pp, comparacao, children }) {
  return (
    <div className="card sv-kpi">
      <span className="sv-kpi-titulo"><i className={`bi ${icone}`} />{titulo}</span>
      <div className="sv-kpi-valor">
        <strong>{valor}</strong>
        <Variacao valor={delta} pp={pp} />
        {serie ? <Barrinhas valores={serie} /> : null}
      </div>
      <small>{comparacao}</small>
      <small>{children}</small>
    </div>
  );
}

// Energia por dia: barras + linha tracejada. Eixo por categoria (o dia), sem o corte das barras das pontas do datetime.
function GraficoDia({ categorias, series }) {
  const unit = powerUnit(Math.max(0, ...series.flatMap((serie) => serie.data.map(Number))));
  const energia = (valor) => (valor == null ? "—" : `${formatPower(valor, unit)}h`);
  const options = {
    chart: { type: "line", toolbar: { show: false }, zoom: { enabled: false }, fontFamily: "inherit", background: "transparent", animations: { enabled: false } },
    colors: series.map((serie) => serie.color),
    stroke: { curve: "smooth", width: series.map((serie) => (serie.type === "line" ? 2 : 0)), dashArray: 4 },
    plotOptions: { bar: { columnWidth: "70%", borderRadius: 2 } },
    markers: { size: 0 },
    dataLabels: { enabled: false },
    legend: { position: "top", horizontalAlign: "right", fontSize: "12px", markers: { size: 5 } },
    xaxis: {
      categories: categorias,
      // só o dia 1 e os múltiplos de 5: 30 rótulos não cabem
      labels: { rotate: 0, formatter: (diaMesTexto) => {
        const dia = parseInt(diaMesTexto, 10);
        return dia === 1 || dia % 5 === 0 ? String(dia) : "";
      } },
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false }
    },
    yaxis: { min: 0, forceNiceScale: true, labels: { formatter: energia } },
    grid: { borderColor: "rgba(127, 145, 163, 0.18)", strokeDashArray: 4 },
    tooltip: { shared: true, intersect: false, x: { formatter: (_, { dataPointIndex }) => categorias[dataPointIndex] }, y: { formatter: energia } }
  };
  return <Chart options={options} series={series} type="line" height={230} />;
}

// Barras horizontais finas: largura relativa ao maior item, % do total.
function Quebra({ itens }) {
  const total = itens.reduce((t, item) => t + item.wh, 0) || 1;
  const maior = Math.max(...itens.map((item) => item.wh)) || 1;
  return (
    <ul className="sv-quebra">
      {itens.map((item) => (
        <li key={item.nome}>
          <div className="sv-quebra-linha">
            <strong title={item.nome}>{item.nome}</strong>
            {item.selo}
            <span>{formatEnergy(item.wh)}</span>
            <small>{pct(item.wh / total)}</small>
          </div>
          <div className="sv-quebra-barra"><div style={{ width: `${(item.wh / maior) * 100}%` }} /></div>
          <small>{item.detalhe}</small>
        </li>
      ))}
    </ul>
  );
}

// Soma o ranking das placas por grupo ou orientação.
function agrupar(placas, doRanking, chave) {
  const grupos = new Map();
  for (const placa of placas) {
    const linha = doRanking(placa.id);
    const grupo = grupos.get(chave(placa)) ?? { nome: chave(placa), wh: 0, estimadaWh: 0, wp: 0, placas: 0 };
    grupo.wh += Number(linha?.realWh) || 0;
    grupo.estimadaWh += Number(linha?.estimadaWh) || 0;
    grupo.wp += Number(placa.potenciaWp) || 0;
    grupo.placas += 1;
    grupos.set(grupo.nome, grupo);
  }
  return [...grupos.values()]
    .map((grupo) => ({
      ...grupo,
      detalhe: `${plural(grupo.placas, "placa", "placas")} · ${grupo.wp ? numero(grupo.wh / grupo.wp, 1) : "—"} kWh/kWp · desempenho ${pct(grupo.estimadaWh ? grupo.wh / grupo.estimadaWh : null)}`
    }))
    .sort((a, b) => b.wh - a.wh);
}

// Painel de um mês da seleção comparado ao mês anterior, para ver na tela ou imprimir/salvar em PDF pelo navegador
// (estilos de impressão no app.css). Filtros na URL: ?mes=AAAA-MM&grupo=G&placa=P.
export default function RelatorioPage() {
  const [params, setParams] = useSearchParams();
  const mes = mesRelatorio(params.get("mes"));
  const grupoParam = Number(params.get("grupo")) || null;
  const placaId = Number(params.get("placa")) || null;
  // Relógio de SP guardado como UTC, como em lib/periodo.js.
  const referencia = new Date(`${mes}-01T00:00:00Z`);
  const periodo = rangeFor("mes", referencia);
  const { atual, anterior } = janelasRelatorio(mes);

  const [listas, setListas] = useState(null);
  const [dados, setDados] = useState(null);
  const [error, setError] = useState("");
  const [imprimindo, setImprimindo] = useState(false);

  useEffect(() => {
    Promise.all([listGroups(), listPanels(), listCleanings(), getRecomendacoesLimpeza().catch(() => [])]).then(
      ([groups, panels, cleanings, recomendacoes]) => setListas({ groups, panels, cleanings, recomendacoes }),
      (err) => setError(extractErrorMessage(err))
    );
  }, []);

  useEffect(() => {
    let ativo = true; // descarta a resposta se o mês ou a seleção mudar antes dela chegar
    setDados(null);
    setError("");
    const selecao = { grupoId: placaId ? null : grupoParam, placaId };
    const filtro = { granularidade: "dia", ...periodo, ...selecao };
    Promise.all([
      getDashboardMetrics(filtro),
      getDashboardHistorico(filtro).catch(() => []), // a média de 5 anos é extra: sem ela, o relatório sai mesmo assim
      getRankingPlacas({ ...periodo, grupoId: grupoParam }),
      getFinanceiro({ ...atual, ...selecao }),
      getFinanceiro({ ...anterior, ...selecao })
    ]).then(
      ([points, historico, ranking, valores, valoresAntes]) => ativo && setDados({ points, historico, ranking, valores, valoresAntes }),
      (err) => ativo && setError(extractErrorMessage(err))
    );
    return () => {
      ativo = false;
    };
  }, [mes, grupoParam, placaId]); // periodo e janelas vêm do mes

  // O ApexCharts desenha em px e não redesenha ao imprimir: o botão estreita a página para a largura útil do A4,
  // espera os gráficos redesenharem (redrawOnParentResize) e só então abre a impressão.
  useEffect(() => {
    const voltar = () => setImprimindo(false);
    window.addEventListener("afterprint", voltar);
    return () => window.removeEventListener("afterprint", voltar);
  }, []);
  const imprimir = () => {
    setImprimindo(true);
    setTimeout(() => window.print(), 500);
  };

  const { groups = [], panels = [], cleanings = [], recomendacoes = [] } = listas ?? {};
  const { points = [], historico = [], ranking = [], valores = {}, valoresAntes = {} } = dados ?? {};
  const panel = panels.find((item) => item.id === placaId);
  const grupoId = panel?.grupoId ?? grupoParam;
  const selecionadas = panel ? [panel] : panels.filter((item) => !grupoId || item.grupoId === grupoId);
  const titulo = panel ? `${panel.modelo} · ${panel.grupoNome}` : groups.find((item) => item.id === grupoId)?.nome ?? "Todas as usinas";
  const mesLabel = formatRangeLabel("mes", referencia);

  // O título da aba vira o nome sugerido do PDF.
  useEffect(() => {
    const anteriorTitulo = document.title;
    document.title = `Relatório ${mes} - ${titulo} - SolarVision`;
    return () => {
      document.title = anteriorTitulo;
    };
  }, [mes, titulo]);

  const selecao = panel ? `grupo=${panel.grupoId}&placa=${panel.id}` : grupoId ? `grupo=${grupoId}` : "";
  const ir = (novoMes, novaSelecao) => setParams(`mes=${novoMes}${novaSelecao && `&${novaSelecao}`}`);

  const ids = new Set(selecionadas.map((item) => item.id));
  const doRanking = (id) => ranking.find((linha) => linha.placaId === id);
  const comparacao = `${trecho(atual)} · vs. ${trecho(anterior)}`;
  const semTarifa = valores.placasSemTarifa ?? 0;
  const nenhumaTarifa = semTarifa > 0 && semTarifa >= selecionadas.length;

  const realWh = Number(valores.realWh) || 0;
  const perdaWh = Number(valores.perdaSujeiraWh) || 0;
  // Parte do real que veio de leituras importadas (o resto é simulado).
  const sensorWh = soma(points, "medidaSensorWh");
  const fracaoSensor = sensorWh / (realWh || 1);
  const origemReal = fracaoSensor >= 0.99
    ? "Energia real medida: leituras importadas do sensor/inversor."
    : `Energia real ${fracaoSensor > 0 ? `${pct(fracaoSensor)} medida (leituras importadas do sensor/inversor), o resto ` : ""}simulada: o estimado menos a perda por sujeira desde a última limpeza ou chuva forte.`;

  const variacoes = [
    { nome: "Energia real", antes: valoresAntes.realWh, depois: valores.realWh, formato: formatEnergy },
    { nome: "Energia estimada", antes: estimado(valoresAntes), depois: estimado(valores), formato: formatEnergy },
    { nome: "Desempenho", antes: desempenhoDe(valoresAntes), depois: desempenhoDe(valores), formato: pct, pp: true },
    { nome: "Perdido com sujeira", antes: valoresAntes.perdaSujeiraWh, depois: valores.perdaSujeiraWh, formato: formatEnergy, inverter: true },
    { nome: "Economia", antes: valoresAntes.economia, depois: valores.economia, formato: formatReais },
    { nome: "Média por dia", antes: valoresAntes.realWh / dias(anterior), depois: realWh / dias(atual), formato: formatEnergy }
  ]
    .filter((item) => Number(item.antes) || Number(item.depois))
    .map((item) => ({ ...item, delta: variacao(item.antes, item.depois, item.pp) }))
    .sort((a, b) => Math.abs((b.delta ?? 0) / (b.pp ? 100 : 1)) - Math.abs((a.delta ?? 0) / (a.pp ? 100 : 1)));

  // Estimado = real + perdido com sujeira (o real separado em medido e simulado).
  const partes = [
    { nome: "Real medido (sensor)", wh: sensorWh, cor: "var(--sv-primary)" },
    { nome: "Real simulado", wh: realWh - sensorWh, cor: "var(--sv-primary-light)" },
    { nome: "Perdido com sujeira", wh: perdaWh, cor: "var(--sv-accent)" }
  ].filter((parte) => parte.wh > 0);
  const totalPartes = partes.reduce((total, parte) => total + parte.wh, 0) || 1;
  const recomendadas = recomendacoes.filter(
    (item) => ids.has(item.placaId) && (item.limpar || (item.perda >= LIMPAR_A_PARTIR && item.chuvaPrevistaEm))
  );

  const baldes = baldesComMedia(points, historico);
  const climaWh = baldes.reduce((total, b) => total + b.wh, 0);
  const mediaWh = baldes.reduce((total, b) => total + b.media, 0);
  const acima = baldes.filter((b) => b.wh > b.media).length;
  const porEnergia = [...baldes].sort((a, b) => b.wh - a.wh);
  const [melhor, pior] = [porEnergia[0], porEnergia.at(-1)];
  const media = historico.length ? `Média de ${textoAnos(historico[0].anos)}` : "Média dos anos anteriores";

  const categorias = points.map((point) => diaMes(point.x));
  const mediaPorDia = new Map(historico.map((h) => [Date.parse(h.x), h.mediaWh]));
  const [inicio, fim] = [Date.parse(periodo.dataInicio), Date.parse(periodo.dataFim)];
  const limpezas = cleanings
    .filter((item) => ids.has(item.placaId) && Date.parse(item.dataLimpeza) >= inicio && Date.parse(item.dataLimpeza) <= fim)
    .reverse(); // listCleanings vem da mais recente para a mais antiga
  const varias = new Set(selecionadas.map((item) => item.grupoId)).size > 1;

  return (
    <div className={`sv-page sv-relatorio${imprimindo ? " is-imprimindo" : ""}`}>
      <header className="sv-page-head sv-relatorio-head">
        <div>
          <span className="sv-relatorio-marca d-none d-print-flex"><img src={logo} alt="" />SolarVision</span>
          <h1>Relatório · {mesLabel}</h1>
          <p>
            {listas ? `${titulo} · ${plural(selecionadas.length, "placa", "placas")} · ${formatPower(potenciaInstalada(selecionadas))}p · ` : ""}
            emitido em {dataHora(new Date())}
          </p>
        </div>
        <div className="sv-relatorio-filtros d-print-none">
          <input
            type="month"
            className="form-control"
            aria-label="Mês"
            value={mes}
            onChange={(event) => event.target.value && ir(event.target.value, selecao)}
          />
          <select className="form-select" aria-label="Seleção" value={selecao} onChange={(event) => ir(mes, event.target.value)}>
            <option value="">Todas as usinas</option>
            {groups.map((item) => (
              <optgroup key={item.id} label={item.nome}>
                <option value={`grupo=${item.id}`}>{item.nome} (todas as placas)</option>
                {panels.filter((p) => p.grupoId === item.id).map((p) => (
                  <option key={p.id} value={`grupo=${item.id}&placa=${p.id}`}>{p.modelo}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <button type="button" className="btn btn-primary text-nowrap" onClick={imprimir} disabled={!listas || !dados}>
            <i className="bi bi-printer me-2" />
            Imprimir / PDF
          </button>
        </div>
      </header>

      {error ? <div className="alert alert-danger mb-0">{error}</div> : null}

      {!listas || !dados ? (
        <section className="card sv-empty">
          {error ? null : <div className="spinner-border text-primary" role="status" />}
        </section>
      ) : selecionadas.length === 0 ? (
        <section className="card sv-empty">
          <i className="bi bi-grid-3x2" />
          <p>Nenhuma placa nesta seleção.</p>
          <Link to="/app/cadastro">Cadastrar placas</Link>
        </section>
      ) : points.length === 0 ? (
        <section className="card sv-empty">
          <i className="bi bi-calendar-x" />
          <p>Sem dados em {mesLabel}.</p>
          <span>A geração é estimada pelo clima dos últimos 5 anos e pela previsão dos próximos 7 dias.</span>
        </section>
      ) : (
        <>
          <div className="sv-kpis">
            <Kpi
              titulo="Energia real"
              icone="bi-lightning-charge"
              valor={formatEnergy(realWh)}
              serie={points.map((p) => p.medidaWh)}
              delta={variacao(valoresAntes.realWh, realWh)}
              comparacao={comparacao}
            >
              {fracaoSensor >= 0.99 ? "Medida (sensor)" : fracaoSensor > 0 ? `${pct(fracaoSensor)} medida (sensor)` : "Simulada"}
            </Kpi>
            <Kpi
              titulo="Energia estimada"
              icone="bi-sun"
              valor={formatEnergy(estimado(valores))}
              serie={points.map((p) => p.estimadaWh)}
              delta={variacao(estimado(valoresAntes), estimado(valores))}
              comparacao={comparacao}
            >
              {comparacaoClima(points, historico) ?? "Pelo clima do mês"}
            </Kpi>
            <Kpi
              titulo="Desempenho"
              icone="bi-speedometer2"
              valor={pct(desempenhoDe(valores))}
              serie={points.map((p) => (p.medidaWh != null && Number(p.estimadaWh) ? p.medidaWh / p.estimadaWh : null))}
              delta={variacao(desempenhoDe(valoresAntes), desempenhoDe(valores), true)}
              pp
              comparacao={comparacao}
            >
              Real ÷ estimado
            </Kpi>
            <Kpi
              titulo="Economia"
              icone="bi-cash-coin"
              valor={nenhumaTarifa ? "—" : formatReais(valores.economia)}
              delta={nenhumaTarifa ? null : variacao(valoresAntes.economia, valores.economia)}
              comparacao={comparacao}
            >
              <span title="Fator médio do SIN (MCTI)">{formatCo2(valores.co2EvitadoKg)} evitados</span>
              {" · "}
              {nenhumaTarifa ? <>sem tarifa: <Link to="/app/cadastro">informe no cadastro</Link></>
                : semTarifa ? `${plural(semTarifa, "placa", "placas")} sem tarifa` : "energia real × tarifa"}
            </Kpi>
          </div>

          <div className="sv-relatorio-linha">
            <section className="card">
              <div className="sv-card-head">
                <div>
                  <h2>Maiores variações</h2>
                  <p>{trecho(atual)} x {trecho(anterior)}, da maior para a menor.</p>
                </div>
              </div>
              <ul className="sv-itens">
                {variacoes.map((item) => (
                  <li key={item.nome}>
                    <div>
                      <span>{item.nome}</span>
                      <small>{item.formato(item.antes)} → {item.formato(item.depois)}</small>
                    </div>
                    <Variacao valor={item.delta} pp={item.pp} inverter={item.inverter} />
                  </li>
                ))}
              </ul>
            </section>

            <section className="card">
              <div className="sv-card-head">
                <div>
                  <h2>Para onde foi a energia</h2>
                  <p>Estimado pelo clima = real + perdido com sujeira.</p>
                </div>
              </div>
              <div className="sv-empilhada" aria-hidden="true">
                {partes.map((parte) => (
                  <span key={parte.nome} style={{ width: `${(parte.wh / totalPartes) * 100}%`, background: parte.cor }} />
                ))}
              </div>
              <ul className="sv-itens">
                {partes.map((parte) => (
                  <li key={parte.nome}>
                    <span className="sv-dot" style={{ background: parte.cor }} />
                    <div><span>{parte.nome}</span></div>
                    <small>{pct(parte.wh / totalPartes)}</small>
                    <strong>{formatEnergy(parte.wh)}</strong>
                  </li>
                ))}
                <li>
                  <span className="sv-dot" style={{ background: "transparent" }} />
                  <div><span>Estimado pelo clima</span></div>
                  <strong>{formatEnergy(estimado(valores))}</strong>
                </li>
              </ul>
              <div className="sv-perda-dia">
                <small>Perdido com sujeira por dia (cai depois de limpeza ou chuva forte)</small>
                <Barrinhas valores={points.map((p) => (p.medidaWh != null ? p.estimadaWh - p.medidaWh : null))} />
              </div>
              <dl className="sv-mini">
                <div>
                  <dt>Perda em R$</dt>
                  <dd>{nenhumaTarifa ? "—" : formatReais(valores.perdaSujeira)}</dd>
                </div>
                <div>
                  <dt>Sujeira hoje</dt>
                  <dd>{formatPerda(perdaMedia(selecionadas))}</dd>
                </div>
                <div>
                  <dt>Limpar hoje</dt>
                  <dd>{recomendadas.filter((item) => item.limpar).length} de {selecionadas.length}</dd>
                </div>
              </dl>
            </section>

            <section className="card">
              <div className="sv-card-head">
                <div>
                  <h2>Clima do mês</h2>
                  <p>Estimado pelo clima x {media.toLowerCase()}, dia a dia.</p>
                </div>
              </div>
              {baldes.length ? (
                <ul className="sv-itens">
                  <li>
                    <span className="sv-dot" style={{ background: COR.estimada }} />
                    <div><span>Estimado pelo clima</span></div>
                    <Variacao valor={variacao(mediaWh, climaWh)} />
                    <strong>{formatEnergy(climaWh)}</strong>
                  </li>
                  <li>
                    <span className="sv-dot" style={{ background: COR.media }} />
                    <div><span>{media}</span></div>
                    <strong>{formatEnergy(mediaWh)}</strong>
                  </li>
                  <li>
                    <span className="sv-dot" style={{ background: "var(--sv-success)" }} />
                    <div><span>Dias acima da média</span></div>
                    <strong>{acima} de {baldes.length}</strong>
                  </li>
                  <li>
                    <span className="sv-dot" style={{ background: "var(--sv-warning)" }} />
                    <div><span>Dias abaixo da média</span></div>
                    <strong>{baldes.length - acima} de {baldes.length}</strong>
                  </li>
                  <li>
                    <span className="sv-dot" style={{ background: COR.estimada }} />
                    <div><span>Melhor dia</span><small>{diaMes(melhor.x)}</small></div>
                    <Variacao valor={variacao(melhor.media, melhor.wh)} />
                    <strong>{formatEnergy(melhor.wh)}</strong>
                  </li>
                  <li>
                    <span className="sv-dot" style={{ background: COR.media }} />
                    <div><span>Pior dia</span><small>{diaMes(pior.x)}</small></div>
                    <Variacao valor={variacao(pior.media, pior.wh)} />
                    <strong>{formatEnergy(pior.wh)}</strong>
                  </li>
                </ul>
              ) : (
                <div className="sv-empty sv-empty-sm">
                  <i className="bi bi-cloud-sun" />
                  <p>Sem a média dos anos anteriores.</p>
                </div>
              )}
            </section>
          </div>

          <div className="sv-relatorio-linha sv-relatorio-graficos">
            <section className="card">
              <div className="sv-card-head">
                <div>
                  <h2>Real x estimado por dia</h2>
                  <p>A diferença é a perda por sujeira (ou o que a leitura do sensor mostrou).</p>
                </div>
              </div>
              <GraficoDia
                categorias={categorias}
                series={[
                  { name: "Real", type: "bar", color: COR.real, data: points.map((p) => p.medidaWh) },
                  { name: "Estimado", type: "line", color: COR.estimada, data: points.map((p) => p.estimadaWh) }
                ]}
              />
            </section>
            <section className="card">
              <div className="sv-card-head">
                <div>
                  <h2>Clima x {media.toLowerCase()}</h2>
                  <p>Estimado pelo clima de cada dia e o dos anos anteriores, no mesmo dia.</p>
                </div>
              </div>
              <GraficoDia
                categorias={categorias}
                series={[
                  { name: "Estimado", type: "bar", color: COR.estimada, data: points.map((p) => p.estimadaWh) },
                  ...(historico.length
                    ? [{ name: media, type: "line", color: COR.media, data: points.map((p) => mediaPorDia.get(Date.parse(p.x)) ?? null) }]
                    : [])
                ]}
              />
            </section>
          </div>

          <div className="sv-relatorio-linha">
            <section className="card">
              <div className="sv-card-head">
                <div>
                  <h2>Por placa</h2>
                  <p>Energia real; "abaixo do grupo" = mais de 10 p.p. abaixo da mediana do grupo.</p>
                </div>
              </div>
              <Quebra
                itens={selecionadas
                  .map((p) => {
                    const linha = doRanking(p.id);
                    return {
                      nome: varias ? `${p.modelo} · ${p.grupoNome}` : p.modelo,
                      wh: Number(linha?.realWh) || 0,
                      selo: linha?.anomalia ? <span className="sv-badge sv-badge-warning">abaixo do grupo</span> : null,
                      detalhe: `${linha?.kwhKwp != null ? numero(Number(linha.kwhKwp), 1) : "—"} kWh/kWp · desempenho ${pct(linha?.desempenho)} · sujeira hoje ${formatPerda(p.perdaSujeira)}`
                    };
                  })
                  .sort((a, b) => b.wh - a.wh)}
              />
            </section>

            <section className="card">
              <div className="sv-card-head">
                <div>
                  <h2>{varias ? "Por grupo" : "Por orientação"}</h2>
                  <p>{varias ? "Energia real de cada usina." : "Energia real pela direção para onde as placas olham."}</p>
                </div>
              </div>
              <Quebra
                itens={agrupar(selecionadas, doRanking, (p) =>
                  varias ? p.grupoNome : p.azimute == null ? "Sem orientação" : orientacao(p.azimute))}
              />
            </section>

            <section className="card">
              <div className="sv-card-head">
                <div>
                  <h2>Limpezas</h2>
                  <p>{plural(limpezas.length, "registrada", "registradas")} no mês · recomendações de hoje</p>
                </div>
              </div>
              {limpezas.length || recomendadas.length ? (
                <ul className="sv-itens">
                  {limpezas.map((item) => (
                    <li key={`limpeza-${item.id}`}>
                      <span className="sv-dot" style={{ background: "var(--sv-success)" }} />
                      <div><span>{item.placaModelo}</span><small>{item.observacao || "Limpeza registrada"}</small></div>
                      <time>{diaMes(item.dataLimpeza)}</time>
                    </li>
                  ))}
                  {recomendadas.map((item) => (
                    <li key={`recomendacao-${item.placaId}`}>
                      <span className="sv-dot" style={{ background: "var(--sv-accent)" }} />
                      <div>
                        <span>{panels.find((p) => p.id === item.placaId)?.modelo}</span>
                        <small title={item.motivo}>{item.motivo}</small>
                      </div>
                      <span className={`sv-badge ${item.limpar ? "sv-badge-warning" : "sv-badge-muted"}`}>{item.limpar ? "limpar" : "esperar"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="sv-empty sv-empty-sm">
                  <i className="bi bi-check2-circle" />
                  <p>Nenhuma limpeza no mês nem recomendada hoje.</p>
                </div>
              )}
            </section>
          </div>

          <p className="sv-relatorio-nota">
            {origemReal} Energia estimada pelo clima horário do local de cada placa (potência, inclinação e
            orientação). Sujeira e recomendações de limpeza são as do dia da emissão.
          </p>
        </>
      )}
    </div>
  );
}
