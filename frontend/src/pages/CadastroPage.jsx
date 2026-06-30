import { useDeferredValue, useEffect, useMemo, useState } from "react";
import api, { extractErrorMessage } from "../lib/api";

const EMPTY_GROUP = { id: null, nome: "", status: "ATIVO", latitude: "", longitude: "" };
const EMPTY_PANEL = {
  id: null,
  grupoId: "",
  modelo: "",
  status: "ATIVA",
  potenciaWp: "",
  inclinacao: "",
  azimute: "",
  coefTemperatura: "",
  dataInstalacao: ""
};

function numOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  return Number(value);
}

function statusBadgeClass(status) {
  if (status === "ATIVO" || status === "ATIVA") return "badge text-bg-success";
  if (status === "MANUTENCAO") return "badge text-bg-warning";
  return "badge text-bg-secondary";
}

export default function CadastroPage() {
  const [groups, setGroups] = useState([]);
  const [panels, setPanels] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [groupForm, setGroupForm] = useState(EMPTY_GROUP);
  const [panelForm, setPanelForm] = useState(EMPTY_PANEL);

  async function loadData() {
    try {
      const [groupsResponse, panelsResponse] = await Promise.all([
        api.get("/api/groups"),
        api.get("/api/panels")
      ]);
      setGroups(groupsResponse.data);
      setPanels(panelsResponse.data);
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
    const payload = {
      nome: groupForm.nome,
      status: groupForm.status,
      latitude: numOrNull(groupForm.latitude),
      longitude: numOrNull(groupForm.longitude)
    };
    try {
      if (groupForm.id) {
        await api.put(`/api/groups/${groupForm.id}`, payload);
      } else {
        await api.post("/api/groups", payload);
      }
      setGroupForm(EMPTY_GROUP);
      await loadData();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handlePanelSubmit(event) {
    event.preventDefault();
    const payload = {
      grupoId: Number(panelForm.grupoId),
      modelo: panelForm.modelo,
      status: panelForm.status,
      potenciaWp: numOrNull(panelForm.potenciaWp),
      inclinacao: numOrNull(panelForm.inclinacao),
      azimute: numOrNull(panelForm.azimute),
      coefTemperatura: numOrNull(panelForm.coefTemperatura),
      dataInstalacao: panelForm.dataInstalacao || null
    };
    try {
      if (panelForm.id) {
        await api.put(`/api/panels/${panelForm.id}`, payload);
      } else {
        await api.post("/api/panels", payload);
      }
      setPanelForm(EMPTY_PANEL);
      await loadData();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  function editGroup(group) {
    setGroupForm({
      id: group.id,
      nome: group.nome,
      status: group.status,
      latitude: group.latitude ?? "",
      longitude: group.longitude ?? ""
    });
  }

  function editPanel(panel) {
    setPanelForm({
      id: panel.id,
      grupoId: String(panel.grupoId),
      modelo: panel.modelo,
      status: panel.status,
      potenciaWp: panel.potenciaWp ?? "",
      inclinacao: panel.inclinacao ?? "",
      azimute: panel.azimute ?? "",
      coefTemperatura: panel.coefTemperatura ?? "",
      dataInstalacao: panel.dataInstalacao ?? ""
    });
  }

  async function deleteGroup(group) {
    if (!window.confirm(`Excluir o grupo "${group.nome}" e todas as suas placas?`)) return;
    try {
      await api.delete(`/api/groups/${group.id}`);
      if (groupForm.id === group.id) setGroupForm(EMPTY_GROUP);
      await loadData();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function deletePanel(panel) {
    if (!window.confirm(`Excluir a placa "${panel.modelo}"?`)) return;
    try {
      await api.delete(`/api/panels/${panel.id}`);
      if (panelForm.id === panel.id) setPanelForm(EMPTY_PANEL);
      await loadData();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  const term = deferredSearch.trim().toLowerCase();
  const filteredPanels = useMemo(() => {
    if (!term) return panels;
    return panels.filter((panel) =>
      `${panel.modelo} ${panel.grupoNome} ${panel.status}`.toLowerCase().includes(term)
    );
  }, [term, panels]);

  function panelSpecs(panel) {
    const parts = [];
    if (panel.potenciaWp != null) parts.push(`${panel.potenciaWp} Wp`);
    if (panel.inclinacao != null) parts.push(`tilt ${panel.inclinacao}°`);
    if (panel.azimute != null) parts.push(`azimute ${panel.azimute}°`);
    if (panel.coefTemperatura != null) parts.push(`γ ${panel.coefTemperatura}%/°C`);
    return parts.join(" · ");
  }

  return (
    <div className="sv-page-stack">
      <div>
        <h1 className="mb-2">Cadastro</h1>
        <p className="text-muted mb-0">Gestão de grupos solares e placas, agrupadas por grupo.</p>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="row g-4">
        <div className="col-xl-4">
          <div className="card mb-4">
            <h2 className="h5 mb-3">{groupForm.id ? "Editar grupo" : "Novo grupo (site)"}</h2>
            <form onSubmit={handleGroupSubmit} className="d-grid gap-3">
              <input
                className="form-control"
                placeholder="Nome do grupo"
                value={groupForm.nome}
                onChange={(e) => setGroupForm((c) => ({ ...c, nome: e.target.value }))}
                required
              />
              <select
                className="form-select"
                value={groupForm.status}
                onChange={(e) => setGroupForm((c) => ({ ...c, status: e.target.value }))}
              >
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
                <option value="MANUTENCAO">Manutenção</option>
              </select>
              <div className="row g-2">
                <div className="col-6">
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    placeholder="Latitude"
                    value={groupForm.latitude}
                    onChange={(e) => setGroupForm((c) => ({ ...c, latitude: e.target.value }))}
                  />
                </div>
                <div className="col-6">
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    placeholder="Longitude"
                    value={groupForm.longitude}
                    onChange={(e) => setGroupForm((c) => ({ ...c, longitude: e.target.value }))}
                  />
                </div>
              </div>
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary flex-grow-1">
                  {groupForm.id ? "Salvar grupo" : "Criar grupo"}
                </button>
                {groupForm.id ? (
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setGroupForm(EMPTY_GROUP)}>
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          </div>

          <div className="card">
            <h2 className="h5 mb-3">{panelForm.id ? "Editar placa" : "Nova placa"}</h2>
            <form onSubmit={handlePanelSubmit} className="d-grid gap-3">
              <select
                className="form-select"
                value={panelForm.grupoId}
                onChange={(e) => setPanelForm((c) => ({ ...c, grupoId: e.target.value }))}
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
                value={panelForm.modelo}
                onChange={(e) => setPanelForm((c) => ({ ...c, modelo: e.target.value }))}
                required
              />
              <select
                className="form-select"
                value={panelForm.status}
                onChange={(e) => setPanelForm((c) => ({ ...c, status: e.target.value }))}
              >
                <option value="ATIVA">Ativa</option>
                <option value="INATIVA">Inativa</option>
                <option value="MANUTENCAO">Manutenção</option>
              </select>

              <div className="d-flex align-items-center gap-2">
                <span className="badge text-bg-primary">Performance Ratio</span>
                <span className="text-muted small">opcional</span>
              </div>
              <div className="row g-2">
                <div className="col-6">
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    placeholder="Potência (Wp)"
                    value={panelForm.potenciaWp}
                    onChange={(e) => setPanelForm((c) => ({ ...c, potenciaWp: e.target.value }))}
                  />
                </div>
                <div className="col-6">
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    placeholder="Inclinação (°)"
                    value={panelForm.inclinacao}
                    onChange={(e) => setPanelForm((c) => ({ ...c, inclinacao: e.target.value }))}
                  />
                </div>
                <div className="col-6">
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    placeholder="Azimute (°)"
                    value={panelForm.azimute}
                    onChange={(e) => setPanelForm((c) => ({ ...c, azimute: e.target.value }))}
                  />
                </div>
                <div className="col-6">
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    placeholder="Coef. temp. (%/°C)"
                    value={panelForm.coefTemperatura}
                    onChange={(e) => setPanelForm((c) => ({ ...c, coefTemperatura: e.target.value }))}
                  />
                </div>
              </div>
              <input
                type="date"
                className="form-control"
                value={panelForm.dataInstalacao}
                onChange={(e) => setPanelForm((c) => ({ ...c, dataInstalacao: e.target.value }))}
              />
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary flex-grow-1">
                  {panelForm.id ? "Salvar placa" : "Criar placa"}
                </button>
                {panelForm.id ? (
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setPanelForm(EMPTY_PANEL)}>
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>

        <div className="col-xl-8">
          <div className="card">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3">
              <div>
                <h2 className="h5 mb-1">Grupos e placas</h2>
                <p className="text-muted mb-0">Placas organizadas pelo grupo a que pertencem.</p>
              </div>
              <input
                className="form-control sv-search"
                placeholder="Filtrar por grupo, modelo ou status"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="d-grid gap-3">
              {groups.map((group) => {
                const groupPanels = filteredPanels.filter((panel) => panel.grupoId === group.id);
                if (term && groupPanels.length === 0) return null;
                return (
                  <div className="sv-group-block" key={group.id}>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center gap-2">
                          <strong>{group.nome}</strong>
                          <span className={statusBadgeClass(group.status)}>{group.status}</span>
                        </div>
                        <div className="text-muted small">
                          {group.latitude != null && group.longitude != null
                            ? `lat ${group.latitude}, long ${group.longitude} · `
                            : ""}
                          {group.totalPlacas} placa(s)
                        </div>
                      </div>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => editGroup(group)} aria-label="Editar grupo">
                        <i className="bi bi-pencil" />
                      </button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => deleteGroup(group)} aria-label="Excluir grupo">
                        <i className="bi bi-trash" />
                      </button>
                    </div>

                    {groupPanels.map((panel) => (
                      <div className="placa-item" key={panel.id}>
                        <div className="flex-grow-1">
                          <strong>{panel.modelo}</strong>
                          <div className="text-muted small">{panelSpecs(panel) || "Sem dados de Performance Ratio"}</div>
                        </div>
                        <span className={statusBadgeClass(panel.status)}>{panel.status}</span>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => editPanel(panel)} aria-label="Editar placa">
                          <i className="bi bi-pencil" />
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => deletePanel(panel)} aria-label="Excluir placa">
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    ))}
                    {groupPanels.length === 0 ? (
                      <div className="text-muted small py-1">Nenhuma placa neste grupo.</div>
                    ) : null}
                  </div>
                );
              })}
              {groups.length === 0 ? (
                <div className="text-muted py-2">Nenhum grupo cadastrado.</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
