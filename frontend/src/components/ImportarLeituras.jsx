import { useMemo, useState } from "react";
import { extractErrorMessage, salvarLeituras } from "../lib/api";
import { adivinharColunas, lerCsv, montarLeituras } from "../lib/leituras";
import { TIME_ZONE } from "../lib/periodo";
import { formatPower } from "../lib/power";

const LOTE = 5000; // leituras por requisição (upsert)
const dataHoraSp = (iso) => new Date(iso).toLocaleString("pt-BR", { timeZone: TIME_ZONE });

// Importa um CSV de leituras de potência (W) de uma placa: escolher as colunas, conferir a prévia e gravar em lotes.
// Nas horas com leitura, o real do gráfico passa a ser o medido.
export default function ImportarLeituras({ placaId, onImportado }) {
  const [arquivo, setArquivo] = useState(null); // { nome, separador, virgulaDecimal, colunas, linhas }
  const [colunas, setColunas] = useState(null);
  const [progresso, setProgresso] = useState(null); // 0 a 1 enquanto grava
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const { leituras, invalidas } = useMemo(
    () => (arquivo ? montarLeituras(arquivo.linhas, colunas) : { leituras: [], invalidas: 0 }),
    [arquivo, colunas]
  );

  async function abrir(event) {
    const file = event.target.files[0];
    setArquivo(null);
    setErro("");
    setSucesso("");
    if (!file) return;
    try {
      const lido = lerCsv(await file.text());
      setColunas(adivinharColunas(lido.colunas));
      setArquivo({ nome: file.name, ...lido });
    } catch (err) {
      setErro(err.message);
    }
  }

  async function importar() {
    setErro("");
    let inicio = 0;
    try {
      for (; inicio < leituras.length; inicio += LOTE) {
        setProgresso(inicio / leituras.length);
        await salvarLeituras(placaId, leituras.slice(inicio, inicio + LOTE));
      }
      setSucesso(`${leituras.length.toLocaleString("pt-BR")} leituras importadas de ${arquivo.nome}.`);
      setArquivo(null);
      onImportado();
    } catch (err) {
      setErro(
        `${extractErrorMessage(err)} Parou no lote ${inicio / LOTE + 1} de ${Math.ceil(leituras.length / LOTE)}: ` +
          "os anteriores já foram gravados e importar de novo não duplica."
      );
    } finally {
      setProgresso(null);
    }
  }

  const escolher = (campo) => (event) => setColunas((atual) => ({ ...atual, [campo]: Number(event.target.value) }));
  const opcoes = arquivo?.colunas.map((nome, i) => <option key={i} value={i}>{nome || `Coluna ${i + 1}`}</option>);
  const gravando = progresso != null;

  return (
    <div className="sv-form mt-3">
      <div>
        <label className="form-label" htmlFor="leituras-arquivo">Arquivo CSV de leituras</label>
        <input id="leituras-arquivo" type="file" accept=".csv,text/csv" className="form-control" onChange={abrir} disabled={gravando} />
        <div className="form-text">
          Uma linha por leitura com data, hora e potência média (W) do intervalo, no horário de São Paulo. Separador "," ou ";".
        </div>
      </div>

      {arquivo ? (
        <>
          <p className="sv-muted small mb-0">
            {arquivo.linhas.length.toLocaleString("pt-BR")} linhas · separador "{arquivo.separador}"
            {arquivo.virgulaDecimal ? " · vírgula decimal" : ""}
          </p>
          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label" htmlFor="leituras-data">Data (ou data e hora)</label>
              <select id="leituras-data" className="form-select" value={colunas.data} onChange={escolher("data")}>{opcoes}</select>
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="leituras-hora">Hora</label>
              <select id="leituras-hora" className="form-select" value={colunas.hora} onChange={escolher("hora")}>
                <option value={-1}>Na mesma coluna da data</option>
                {opcoes}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="leituras-potencia">Potência (W)</label>
              <select id="leituras-potencia" className="form-select" value={colunas.potencia} onChange={escolher("potencia")}>{opcoes}</select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table sv-table mb-0">
              <thead>
                <tr><th>Data e hora (São Paulo)</th><th>Potência</th></tr>
              </thead>
              <tbody>
                {leituras.slice(0, 5).map((leitura) => (
                  <tr key={leitura.dataHora}><td>{dataHoraSp(leitura.dataHora)}</td><td>{formatPower(leitura.watts)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small mb-0">
            {leituras.length.toLocaleString("pt-BR")} leituras válidas
            {leituras.length ? ` (${dataHoraSp(leituras[0].dataHora)} a ${dataHoraSp(leituras.at(-1).dataHora)})` : ""}
            {invalidas ? ` · ${invalidas.toLocaleString("pt-BR")} linhas ignoradas (data/hora ou potência inválida)` : ""}
          </p>

          {gravando ? (
            <div className="progress" role="progressbar" aria-label="Importando" aria-valuenow={Math.round(progresso * 100)}>
              <div className="progress-bar" style={{ width: `${Math.max(progresso * 100, 3)}%` }} />
            </div>
          ) : null}

          <div>
            <button type="button" className="btn btn-primary" onClick={importar} disabled={gravando || leituras.length === 0}>
              {gravando ? `Gravando… ${Math.round(progresso * 100)}%` : `Importar ${leituras.length.toLocaleString("pt-BR")} leituras`}
            </button>
          </div>
        </>
      ) : null}

      {erro ? <div className="alert alert-danger mb-0">{erro}</div> : null}
      {sucesso ? <div className="alert alert-success mb-0">{sucesso}</div> : null}
    </div>
  );
}
