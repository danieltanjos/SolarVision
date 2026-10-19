import { useEffect, useState } from "react";
import Chart from "react-apexcharts";
import { useAuth } from "../context/AuthContext";
import { TODOS, buscasSemResultado, carregarBi, duracao, funilTotal, pct, retencaoPorCanal } from "../lib/bi";
import { eventosEmJsonl } from "../lib/tracking";

const ETAPAS = {
  sign_up: "Criou a conta",
  create_group: "Cadastrou a usina",
  create_panel: "Cadastrou uma placa (ativou)",
  view_monitoring: "Viu o monitoramento",
  import_readings: "Importou leituras",
  register_cleaning: "Registrou limpeza",
  generate_report: "Abriu o relatório"
};
const PERFIL = {
  media_sessoes: "sessões", media_dias_ativos: "dias ativos", media_monitoramentos: "monitoramentos",
  media_relatorios: "relatórios", media_importacoes: "importações", media_limpezas: "limpezas", media_placas_criadas: "placas"
};
const numero = (valor, casas = 0) => (valor == null ? "—" : Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: casas }));
const dataHora = (iso) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function Kpi({ titulo, icone, valor, children }) {
  return (
    <div className="card sv-kpi">
      <span className="sv-kpi-titulo"><i className={`bi ${icone}`} />{titulo}</span>
      <div className="sv-kpi-valor"><strong>{valor}</strong></div>
      <small>{children}</small>
    </div>
  );
}

function Cartao({ titulo, descricao, children }) {
  return (
    <section className="card">
      <div className="sv-card-head">
        <div>
          <h2>{titulo}</h2>
          {descricao ? <p>{descricao}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function barras({ categorias, valores, formato, cor = "#3b7197", horizontal = false }) {
  return {
    series: [{ name: "", data: valores }],
    options: {
      chart: { type: "bar", toolbar: { show: false }, fontFamily: "inherit", background: "transparent", animations: { enabled: false } },
      colors: [cor],
      plotOptions: { bar: { horizontal, borderRadius: 3, barHeight: "70%", columnWidth: "60%" } },
      dataLabels: { enabled: true, formatter: formato, style: { fontSize: "11px" } },
      xaxis: { categories: categorias, labels: horizontal ? { formatter: formato } : {} },
      yaxis: horizontal ? {} : { labels: { formatter: formato } },
      grid: { borderColor: "rgba(127, 145, 163, 0.18)", strokeDashArray: 4 },
      tooltip: { y: { formatter: formato } },
      legend: { show: false }
    }
  };
}

// Exporta os eventos desta sessão no formato da landing (gerador/importar_site.py do datalake).
function exportarJsonl() {
  const blob = new Blob([eventosEmJsonl()], { type: "application/x-ndjson" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `eventos_${new Date().toISOString().slice(0, 10)}.jsonl`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// Business intelligence do uso da plataforma: o que o datalake de uso exporta (só ADMIN).
export default function UsoPlataformaPage() {
  const { user } = useAuth();
  const [bi, setBi] = useState(undefined); // undefined = carregando; null = o datalake ainda não exportou

  useEffect(() => {
    carregarBi().then(setBi);
  }, []);

  if (user?.role !== "ADMIN") {
    return (
      <div className="sv-page">
        <section className="card sv-empty">
          <i className="bi bi-shield-lock" />
          <p>Página restrita a administradores.</p>
        </section>
      </div>
    );
  }

  const funil = funilTotal(bi);
  const topo = funil[0]?.pessoas || 1;
  const modelo = bi?.metricas_modelo?.[0];
  const ativacaoPorCanal = (bi?.cadastro_para_ativacao ?? []).filter((linha) => linha.canal !== TODOS);
  const abandono = Object.fromEntries((bi?.taxa_abandono ?? []).map((linha) => [linha.canal, linha]));
  const funilGrafico = barras({
    categorias: funil.map((linha) => ETAPAS[linha.etapa] ?? linha.etapa),
    valores: funil.map((linha) => linha.pessoas),
    formato: (valor) => `${numero(valor)} (${pct(valor / topo)})`,
    horizontal: true
  });
  const faixas = bi?.propensao_por_faixa ?? [];
  const propensaoGrafico = barras({
    categorias: faixas.map((linha) => `${Math.round(linha.faixa * 100)}–${Math.round(linha.faixa * 100) + 10}%`),
    valores: faixas.map((linha) => linha.taxa_real),
    formato: (valor) => pct(valor),
    cor: "#e8a317"
  });

  return (
    <div className="sv-page">
      <header className="sv-page-head">
        <div>
          <h1>Uso da plataforma</h1>
          <p>
            {bi ? `Datalake de uso · atualizado em ${dataHora(bi.gerado_em)}` : "Business intelligence do uso do SolarVision."}
          </p>
        </div>
        <button type="button" className="btn btn-outline-primary text-nowrap" onClick={exportarJsonl}
          title="Os eventos desta sessão, para o gerador/importar_site.py do datalake">
          <i className="bi bi-download me-2" />
          Exportar JSONL
        </button>
      </header>

      {bi === undefined ? (
        <section className="card sv-empty"><div className="spinner-border text-primary" role="status" /></section>
      ) : bi === null ? (
        <section className="card sv-empty">
          <i className="bi bi-database-x" />
          <p>O datalake ainda não exportou o BI.</p>
          <span>
            Em <code>datalake/</code>: <code>docker compose run --rm app python pipeline/rodar_tudo.py</code> grava
            {" "}<code>frontend/public/bi/bi.js</code>.
          </span>
        </section>
      ) : (
        <>
          <div className="sv-kpis">
            <Kpi titulo="Sessões" icone="bi-window-stack" valor={numero(bi.kpis.sessoes)}>
              {numero(bi.kpis.pessoas)} pessoas · {numero(bi.kpis.telas_por_sessao, 1)} telas por sessão
            </Kpi>
            <Kpi titulo="Duração média" icone="bi-stopwatch" valor={duracao(bi.kpis.duracao_media_seg)}>por sessão</Kpi>
            <Kpi titulo="Novos usuários" icone="bi-person-plus" valor={numero(bi.kpis.novos_usuarios)}>
              criaram a conta no período
            </Kpi>
            <Kpi titulo="Ativação" icone="bi-lightning-charge" valor={pct(bi.kpis.taxa_ativacao)}>
              {numero(bi.kpis.ativados)} cadastraram uma placa · mediana de {numero(bi.kpis.mediana_dias_ativar, 1)} dias
            </Kpi>
          </div>

          <div className="sv-relatorio-linha sv-relatorio-graficos">
            <Cartao titulo="Funil de ativação" descricao="Pessoas que criaram a conta e chegaram a cada etapa (% do topo).">
              <Chart options={funilGrafico.options} series={funilGrafico.series} type="bar" height={300} />
            </Cartao>
            <Cartao titulo="Modelo de propensão" descricao="Regressão logística (Spark ML): chance de a sessão ativar.">
              {modelo ? (
                <dl className="sv-mini">
                  <div><dt>AUC</dt><dd>{numero(modelo.auc, 3)}</dd></div>
                  <div><dt>F1</dt><dd>{numero(modelo.f1, 3)}</dd></div>
                  <div><dt>Precisão</dt><dd>{pct(modelo.precisao)}</dd></div>
                  <div><dt>Recall</dt><dd>{pct(modelo.recall)}</dd></div>
                </dl>
              ) : null}
              <small className="sv-muted d-block mb-2">Taxa real de ativação por faixa de probabilidade (teste)</small>
              <Chart options={propensaoGrafico.options} series={propensaoGrafico.series} type="bar" height={210} />
            </Cartao>
          </div>

          <div className="sv-relatorio-linha">
            <Cartao titulo="Aquisição por canal" descricao="Ativação, retenção e abandono de quem criou a conta.">
              <div className="table-responsive">
                <table className="table sv-table mb-0">
                  <thead>
                    <tr><th>Canal</th><th>Novos</th><th>Ativação</th><th>D1</th><th>D7</th><th>D14</th><th>Abandono</th></tr>
                  </thead>
                  <tbody>
                    {retencaoPorCanal(bi).map((linha) => {
                      const ativacao = ativacaoPorCanal.find((a) => a.canal === linha.canal)
                        ?? (linha.canal === TODOS ? { pessoas: bi.kpis.novos_usuarios, taxa_ativacao: bi.kpis.taxa_ativacao } : {});
                      return (
                        <tr key={linha.canal} className={linha.canal === TODOS ? "fw-semibold" : ""}>
                          <td>{linha.canal === TODOS ? "Todos" : linha.canal}</td>
                          <td>{numero(ativacao.pessoas)}</td>
                          <td>{pct(ativacao.taxa_ativacao)}</td>
                          <td>{pct(linha.d1)}</td>
                          <td>{pct(linha.d7)}</td>
                          <td>{pct(linha.d14)}</td>
                          <td>{pct(abandono[linha.canal]?.taxa_abandono)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Cartao>
          </div>

          <div className="sv-relatorio-linha">
            <Cartao titulo="Uso das telas" descricao="Visualizações, tempo médio e rolagem média.">
              <ul className="sv-itens">
                {(bi.uso_telas ?? []).map((tela) => (
                  <li key={tela.pagina}>
                    <div><span>{tela.pagina}</span><small>{duracao(tela.tempo_medio_seg)} · rolagem {numero(tela.scroll_medio)}%</small></div>
                    <strong>{numero(tela.visualizacoes)}</strong>
                  </li>
                ))}
              </ul>
            </Cartao>
            <Cartao titulo="Buscas sem resultado" descricao="O que se procura no seletor de usinas e não existe.">
              <ul className="sv-itens">
                {buscasSemResultado(bi).map((busca) => (
                  <li key={busca.termo}>
                    <div><span>{busca.termo}</span><small>{numero(busca.pessoas)} pessoas</small></div>
                    <span className="sv-badge sv-badge-warning">{numero(busca.buscas_sem_resultado)}</span>
                  </li>
                ))}
              </ul>
            </Cartao>
            <Cartao titulo="Perfis de uso" descricao={`K-Means (K = ${bi.segmentos?.[0]?.k ?? "—"}, silhueta ${numero(bi.segmentos?.[0]?.silhueta, 2)}).`}>
              <ul className="sv-itens">
                {(bi.segmentos ?? []).map((segmento) => (
                  <li key={segmento.segmento}>
                    <div>
                      <span>Segmento {segmento.segmento + 1}</span>
                      <small>
                        {Object.entries(PERFIL).map(([chave, nome]) => `${numero(segmento[chave], 1)} ${nome}`).join(" · ")}
                      </small>
                    </div>
                    <strong>{numero(segmento.pessoas_no_segmento)}</strong>
                  </li>
                ))}
              </ul>
            </Cartao>
          </div>
        </>
      )}
    </div>
  );
}
