import { useEffect, useState } from "react";
import { createCleaning, extractErrorMessage, listCleanings, listPanels } from "../lib/api";

function toDatetimeLocal(value) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
}

export default function CleaningPage() {
  const [cleanings, setCleanings] = useState([]);
  const [panels, setPanels] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    placaId: "",
    dataLimpeza: new Date().toISOString().slice(0, 16),
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
    try {
      await createCleaning({
        placaId: Number(form.placaId),
        dataLimpeza: new Date(form.dataLimpeza).toISOString(),
        observacao: form.observacao
      });
      setForm((current) => ({
        ...current,
        observacao: "",
        dataLimpeza: new Date().toISOString().slice(0, 16)
      }));
      await loadData();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div className="sv-page-stack">
      <div>
        <h1 className="mb-2">Limpeza</h1>
        <p className="text-muted mb-0">Registro operacional e histórico das limpezas das placas.</p>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="row g-4">
        <div className="col-xl-4">
          <div className="card">
            <h2 className="h5 mb-3">Registrar limpeza</h2>
            <form onSubmit={handleSubmit} className="d-grid gap-3">
              <select
                className="form-select"
                value={form.placaId}
                onChange={(event) => setForm((current) => ({ ...current, placaId: event.target.value }))}
                required
              >
                <option value="">Selecione a placa</option>
                {panels.map((panel) => (
                  <option key={panel.id} value={panel.id}>
                    {panel.modelo} · {panel.grupoNome}
                  </option>
                ))}
              </select>

              <input
                type="datetime-local"
                className="form-control"
                value={form.dataLimpeza}
                onChange={(event) =>
                  setForm((current) => ({ ...current, dataLimpeza: event.target.value }))
                }
                required
              />

              <textarea
                className="form-control"
                rows="4"
                placeholder="Observação"
                value={form.observacao}
                onChange={(event) => setForm((current) => ({ ...current, observacao: event.target.value }))}
              />

              <button type="submit" className="btn btn-primary">Salvar limpeza</button>
            </form>
          </div>
        </div>

        <div className="col-xl-8">
          <div className="card">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">Histórico</h2>
              <span className="badge text-bg-light">{cleanings.length} registros</span>
            </div>

            {loading ? (
              <div className="sv-state-block">
                <div className="spinner-border text-primary" role="status" />
              </div>
            ) : (
              <div className="sv-table-wrap">
                <table className="table align-middle">
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
                        <td>{cleaning.placaModelo}</td>
                        <td>{new Date(cleaning.dataLimpeza).toLocaleString("pt-BR")}</td>
                        <td>{cleaning.observacao || "Sem observação"}</td>
                      </tr>
                    ))}
                    {cleanings.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="text-muted">Nenhuma limpeza registrada.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
