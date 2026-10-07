import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createCleaning, extractErrorMessage, listCleanings, listPanels } from "../lib/api";
import { formatPerda } from "../lib/placas";

function toDatetimeLocal(value) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
}

export default function CleaningPage() {
  const [params] = useSearchParams();
  const [cleanings, setCleanings] = useState([]);
  const [panels, setPanels] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    placaId: params.get("placa") ?? "", // vindo de "Registrar limpeza" no Monitoramento
    dataLimpeza: toDatetimeLocal(new Date()),
    observacao: ""
  });

  async function loadData() {
    setLoading(true);
    try {
      const [cleaningsData, panelsData] = await Promise.all([listCleanings(), listPanels()]);
      setCleanings(cleaningsData);
      setPanels(panelsData);
      setError("");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await createCleaning({
        placaId: Number(form.placaId),
        dataLimpeza: new Date(form.dataLimpeza).toISOString(),
        observacao: form.observacao
      });
      setForm((current) => ({
        ...current,
        observacao: "",
        dataLimpeza: toDatetimeLocal(new Date())
      }));
      await loadData();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // Placas agrupadas por grupo no select (<optgroup>).
  const porGrupo = Object.entries(Object.groupBy(panels, (panel) => panel.grupoNome));
  const grupoDaPlaca = Object.fromEntries(panels.map((panel) => [panel.id, panel.grupoNome]));

  return (
    <div className="sv-page">
      <header className="sv-page-head">
        <div>
          <h1>Limpeza</h1>
          <p>Registre as limpezas: a perda por sujeira da placa volta a zero e o real volta a bater com o estimado.</p>
        </div>
      </header>

      {error ? <div className="alert alert-danger mb-0">{error}</div> : null}

      <div className="sv-split">
        <section className="card">
          <div className="sv-card-head">
            <h2>Registrar limpeza</h2>
          </div>
          <form onSubmit={handleSubmit} className="sv-form">
            <div>
              <label className="form-label" htmlFor="limpeza-placa">Placa</label>
              <select
                id="limpeza-placa"
                className="form-select"
                value={form.placaId}
                onChange={(event) => setForm((current) => ({ ...current, placaId: event.target.value }))}
                required
              >
                <option value="">Selecione a placa</option>
                {porGrupo.map(([grupo, placas]) => (
                  <optgroup key={grupo} label={grupo}>
                    {placas.map((panel) => (
                      <option key={panel.id} value={panel.id}>
                        {panel.modelo}{panel.perdaSujeira != null ? ` · sujeira ${formatPerda(panel.perdaSujeira)}` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label" htmlFor="limpeza-data">Data e hora</label>
              <input
                id="limpeza-data"
                type="datetime-local"
                className="form-control"
                value={form.dataLimpeza}
                onChange={(event) => setForm((current) => ({ ...current, dataLimpeza: event.target.value }))}
                required
              />
            </div>

            <div>
              <label className="form-label" htmlFor="limpeza-obs">Observação</label>
              <textarea
                id="limpeza-obs"
                className="form-control"
                rows="4"
                placeholder="Ex.: lavagem com água desmineralizada"
                maxLength={1000}
                value={form.observacao}
                onChange={(event) => setForm((current) => ({ ...current, observacao: event.target.value }))}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar limpeza"}
            </button>
          </form>
        </section>

        <section className="card">
          <div className="sv-card-head">
            <h2>Histórico</h2>
            <span className="sv-chip">{cleanings.length} registros</span>
          </div>

          {loading && cleanings.length === 0 ? (
            <div className="sv-empty">
              <div className="spinner-border text-primary" role="status" />
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table sv-table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Placa</th>
                    <th>Data</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {cleanings.map((cleaning) => (
                    <tr key={cleaning.id}>
                      <td>
                        <div className="fw-semibold">{cleaning.placaModelo}</div>
                        <div className="sv-muted small">{grupoDaPlaca[cleaning.placaId]}</div>
                      </td>
                      <td className="text-nowrap">{new Date(cleaning.dataLimpeza).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td className="sv-muted">{cleaning.observacao || "Sem observação"}</td>
                    </tr>
                  ))}
                  {cleanings.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="sv-muted">Nenhuma limpeza registrada.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
