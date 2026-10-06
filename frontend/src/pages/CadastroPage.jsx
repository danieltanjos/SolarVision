import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { createGroup, createPanel, extractErrorMessage, listGroups, listPanels } from "../lib/api";

export default function CadastroPage() {
  const [groups, setGroups] = useState([]);
  const [panels, setPanels] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [groupForm, setGroupForm] = useState({ nome: "", status: "ATIVO" });
  const [panelForm, setPanelForm] = useState({ grupoId: "", modelo: "", status: "ATIVA" });

  async function loadData() {
    try {
      const [groupsData, panelsData] = await Promise.all([listGroups(), listPanels()]);
      setGroups(groupsData);
      setPanels(panelsData);
      setError("");
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleGroupSubmit(event) {
    event.preventDefault();
    try {
      await createGroup(groupForm);
      setGroupForm({ nome: "", status: "ATIVO" });
      await loadData();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handlePanelSubmit(event) {
    event.preventDefault();
    try {
      await createPanel({
        grupoId: Number(panelForm.grupoId),
        modelo: panelForm.modelo,
        status: panelForm.status
      });
      setPanelForm({ grupoId: "", modelo: "", status: "ATIVA" });
      await loadData();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  const filteredPanels = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    if (!term) return panels;
    return panels.filter((panel) =>
      `${panel.modelo} ${panel.grupoNome} ${panel.status}`.toLowerCase().includes(term)
    );
  }, [deferredSearch, panels]);

  return (
    <div className="sv-page-stack">
      <div>
        <h1 className="mb-2">Cadastro</h1>
        <p className="text-muted mb-0">Gestão de grupos solares e placas individuais.</p>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="row g-4">
        <div className="col-xl-4">
          <div className="card mb-4">
            <h2 className="h5 mb-3">Novo grupo</h2>
            <form onSubmit={handleGroupSubmit} className="d-grid gap-3">
              <input
                className="form-control"
                placeholder="Nome do grupo"
                aria-label="Nome do grupo"
                maxLength={120}
                value={groupForm.nome}
                onChange={(event) => setGroupForm((current) => ({ ...current, nome: event.target.value }))}
                required
              />
              <select
                aria-label="Status do grupo"
                className="form-select"
                value={groupForm.status}
                onChange={(event) => setGroupForm((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
                <option value="MANUTENCAO">Manutenção</option>
              </select>
              <button type="submit" className="btn btn-primary">Criar grupo</button>
            </form>
          </div>

          <div className="card">
            <h2 className="h5 mb-3">Nova placa</h2>
            <form onSubmit={handlePanelSubmit} className="d-grid gap-3">
              <select
                aria-label="Grupo da placa"
                className="form-select"
                value={panelForm.grupoId}
                onChange={(event) => setPanelForm((current) => ({ ...current, grupoId: event.target.value }))}
                required
              >
                <option value="">Selecione o grupo</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.nome}</option>
                ))}
              </select>
              <input
                className="form-control"
                placeholder="Modelo da placa"
                aria-label="Modelo da placa"
                maxLength={120}
                value={panelForm.modelo}
                onChange={(event) => setPanelForm((current) => ({ ...current, modelo: event.target.value }))}
                required
              />
              <select
                aria-label="Status da placa"
                className="form-select"
                value={panelForm.status}
                onChange={(event) => setPanelForm((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="ATIVA">Ativa</option>
                <option value="INATIVA">Inativa</option>
                <option value="MANUTENCAO">Manutenção</option>
              </select>
              <button type="submit" className="btn btn-primary">Criar placa</button>
            </form>
          </div>
        </div>

        <div className="col-xl-8">
          <div className="card">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3">
              <div>
                <h2 className="h5 mb-1">Placas cadastradas</h2>
                <p className="text-muted mb-0">Busca rápida mantendo a ideia da listagem anterior.</p>
              </div>
              <input
                className="form-control sv-search"
                placeholder="Filtrar por grupo, modelo ou status"
                aria-label="Filtrar por grupo, modelo ou status"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="scroll-box">
              {filteredPanels.map((panel) => (
                <div className="placa-item" key={panel.id}>
                  <div>
                    <strong>{panel.modelo}</strong>
                    <div className="text-muted small">{panel.grupoNome}</div>
                  </div>
                  <span className="badge text-bg-light">{panel.status}</span>
                </div>
              ))}
              {filteredPanels.length === 0 ? (
                <div className="text-muted py-2">Nenhuma placa encontrada.</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
