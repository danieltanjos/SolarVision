import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StatusBadge from "../components/StatusBadge";
import { createGroup, createPanel, extractErrorMessage, listGroups, listPanels } from "../lib/api";
import { parseCoordenadas } from "../lib/coordenadas";
import { ORIENTACOES, climaStatus, orientacao } from "../lib/placas";

const EMPTY_GROUP = { nome: "", status: "ATIVO", coordenadas: "" };
const EMPTY_PANEL = { grupoId: "", modelo: "", status: "ATIVA", potenciaWp: "", inclinacao: "", azimute: "0" };

const numOrNull = (value) => (value === "" ? null : Number(value));

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

  // Enquanto alguma placa carrega o clima (pg_cron, ~1 min), recarrega a lista a cada 15 s.
  const sincronizando = panels.some((panel) => climaStatus(panel).sincronizando);
  useEffect(() => {
    if (!sincronizando) return undefined;
    const id = setInterval(loadData, 15000);
    return () => clearInterval(id);
  }, [sincronizando]);

  const coordenadas = groupForm.coordenadas.trim() ? parseCoordenadas(groupForm.coordenadas) : null;

  async function handleGroupSubmit(event) {
    event.preventDefault();
    if (groupForm.coordenadas.trim() && !coordenadas) {
      setError("Coordenadas não reconhecidas. Use, por exemplo, -27.548, -48.4988.");
      return;
    }
    try {
      await createGroup({
        nome: groupForm.nome,
        status: groupForm.status,
        latitude: coordenadas?.latitude ?? null,
        longitude: coordenadas?.longitude ?? null
      });
      setGroupForm(EMPTY_GROUP);
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
        status: panelForm.status,
        potenciaWp: numOrNull(panelForm.potenciaWp),
        inclinacao: numOrNull(panelForm.inclinacao),
        azimute: numOrNull(panelForm.azimute)
      });
      setPanelForm(EMPTY_PANEL);
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

  const setGroupField = (field) => (event) => setGroupForm((current) => ({ ...current, [field]: event.target.value }));
  const setPanelField = (field) => (event) => setPanelForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <div className="sv-page">
      <header className="sv-page-head">
        <div>
          <h1>Cadastro</h1>
          <p>Grupos solares (usinas) e as placas de cada um.</p>
        </div>
      </header>

      {error ? <div className="alert alert-danger mb-0">{error}</div> : null}

      <div className="sv-split">
        <div className="sv-stack">
          <section className="card">
            <div className="sv-card-head">
              <h2><i className="bi bi-collection me-2" />Novo grupo</h2>
            </div>
            <form onSubmit={handleGroupSubmit} className="sv-form">
              <div>
                <label className="form-label" htmlFor="grupo-nome">Nome</label>
                <input
                  id="grupo-nome"
                  className="form-control"
                  placeholder="Ex.: SENAI Florianópolis"
                  maxLength={120}
                  value={groupForm.nome}
                  onChange={setGroupField("nome")}
                  required
                />
              </div>
              <div>
                <label className="form-label" htmlFor="grupo-status">Status</label>
                <select id="grupo-status" className="form-select" value={groupForm.status} onChange={setGroupField("status")}>
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                  <option value="MANUTENCAO">Manutenção</option>
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="grupo-coordenadas">Coordenadas do local</label>
                <input
                  id="grupo-coordenadas"
                  className={`form-control ${groupForm.coordenadas.trim() ? (coordenadas ? "is-valid" : "is-invalid") : ""}`}
                  placeholder="-27.548, -48.4988"
                  value={groupForm.coordenadas}
                  onChange={setGroupField("coordenadas")}
                />
                <div className="form-text">
                  {coordenadas
                    ? `Latitude ${coordenadas.latitude}, longitude ${coordenadas.longitude}.`
                    : "No Google Maps, clique com o botão direito no local e copie as coordenadas (aceita também 27°32'52.8\"S 48°29'55.6\"W). Necessário para a geração estimada."}
                </div>
              </div>
              <button type="submit" className="btn btn-primary">Criar grupo</button>
            </form>
          </section>

          <section className="card">
            <div className="sv-card-head">
              <h2><i className="bi bi-grid-3x2 me-2" />Nova placa</h2>
            </div>
            <form onSubmit={handlePanelSubmit} className="sv-form">
              <div>
                <label className="form-label" htmlFor="placa-grupo">Grupo</label>
                <select id="placa-grupo" className="form-select" value={panelForm.grupoId} onChange={setPanelField("grupoId")} required>
                  <option value="">Selecione o grupo</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>{group.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="placa-modelo">Modelo / identificação</label>
                <input
                  id="placa-modelo"
                  className="form-control"
                  placeholder="Ex.: Bloco A - Telhado Norte"
                  maxLength={120}
                  value={panelForm.modelo}
                  onChange={setPanelField("modelo")}
                  required
                />
              </div>
              <div className="sv-form-row">
                <div>
                  <label className="form-label" htmlFor="placa-potencia">Potência (Wp)</label>
                  <input
                    id="placa-potencia"
                    type="number"
                    step="any"
                    min="1"
                    className="form-control"
                    placeholder="5000"
                    value={panelForm.potenciaWp}
                    onChange={setPanelField("potenciaWp")}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="placa-inclinacao">Inclinação (°)</label>
                  <input
                    id="placa-inclinacao"
                    type="number"
                    step="any"
                    min="0"
                    max="90"
                    className="form-control"
                    placeholder="27"
                    value={panelForm.inclinacao}
                    onChange={setPanelField("inclinacao")}
                  />
                </div>
              </div>
              <div className="sv-form-row">
                <div>
                  <label className="form-label" htmlFor="placa-orientacao">Orientação</label>
                  <select id="placa-orientacao" className="form-select" value={panelForm.azimute} onChange={setPanelField("azimute")}>
                    {ORIENTACOES.map(([graus, nome]) => (
                      <option key={graus} value={graus}>{nome} ({graus}°)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="placa-status">Status</label>
                  <select id="placa-status" className="form-select" value={panelForm.status} onChange={setPanelField("status")}>
                    <option value="ATIVA">Ativa</option>
                    <option value="INATIVA">Inativa</option>
                    <option value="MANUTENCAO">Manutenção</option>
                  </select>
                </div>
              </div>
              <div className="form-text mt-0">
                Com o local no grupo, a potência e a inclinação, o sistema carrega 5 anos de clima e a previsão em ~1 min.
              </div>
              <button type="submit" className="btn btn-primary">Criar placa</button>
            </form>
          </section>
        </div>

        <div className="sv-stack">
          <section className="card">
            <div className="sv-card-head">
              <h2>Grupos</h2>
              <span className="sv-chip">{groups.length}</span>
            </div>
            <div className="table-responsive">
              <table className="table sv-table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Grupo</th>
                    <th>Local</th>
                    <th>Placas</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <tr key={group.id}>
                      <td><Link to={`/app/monitoramento?grupo=${group.id}`} className="fw-semibold">{group.nome}</Link></td>
                      <td className="sv-muted">{group.latitude != null ? `${group.latitude}, ${group.longitude}` : "Sem local"}</td>
                      <td>{group.totalPlacas}</td>
                      <td><StatusBadge status={group.status} /></td>
                    </tr>
                  ))}
                  {groups.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="sv-muted">Nenhum grupo cadastrado.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="sv-card-head">
              <h2>Placas</h2>
              <div className="sv-search">
                <i className="bi bi-search" />
                <input
                  type="search"
                  className="form-control"
                  placeholder="Filtrar por grupo, modelo ou status"
                  aria-label="Filtrar por grupo, modelo ou status"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
            <div className="table-responsive">
              <table className="table sv-table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Placa</th>
                    <th>Especificações</th>
                    <th>Clima</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPanels.map((panel) => {
                    const clima = climaStatus(panel);
                    return (
                      <tr key={panel.id}>
                        <td>
                          <Link to={`/app/monitoramento?grupo=${panel.grupoId}&placa=${panel.id}`} className="fw-semibold">
                            {panel.modelo}
                          </Link>
                          <div className="sv-muted small">{panel.grupoNome}</div>
                        </td>
                        <td className="sv-muted">
                          {panel.potenciaWp != null
                            ? `${panel.potenciaWp} Wp · ${panel.inclinacao}° · ${orientacao(panel.azimute)}`
                            : "—"}
                        </td>
                        <td>
                          <span className={`sv-dot ${clima.ok ? "is-ok" : clima.sincronizando ? "is-wait" : ""}`} />
                          <span className="sv-muted small">{clima.texto}</span>
                        </td>
                        <td><StatusBadge status={panel.status} /></td>
                      </tr>
                    );
                  })}
                  {filteredPanels.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="sv-muted">Nenhuma placa encontrada.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
