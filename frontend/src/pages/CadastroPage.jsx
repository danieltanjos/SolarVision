import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { createGroup, createPanel, extractErrorMessage, listGroups, listPanels } from "../lib/api";
import { parseCoordenadas } from "../lib/coordenadas";

const EMPTY_GROUP = { nome: "", status: "ATIVO", coordenadas: "" };
const EMPTY_PANEL = { grupoId: "", modelo: "", status: "ATIVA", potenciaWp: "", inclinacao: "", azimute: "0" };

// Azimute em graus a partir do Norte, no sentido horário (no Brasil, placas costumam olhar para o Norte).
const ORIENTACOES = [
  ["0", "Norte"],
  ["45", "Nordeste"],
  ["90", "Leste"],
  ["135", "Sudeste"],
  ["180", "Sul"],
  ["225", "Sudoeste"],
  ["270", "Oeste"],
  ["315", "Noroeste"]
];

const numOrNull = (value) => (value === "" ? null : Number(value));

function climaStatus(panel) {
  if (panel.latitude == null || panel.potenciaWp == null || panel.inclinacao == null || panel.azimute == null) {
    return { texto: "Sem local/especificações: sem estimativa", sincronizando: false };
  }
  return panel.climaHistoricoEm
    ? { texto: "Clima: 5 anos + previsão", sincronizando: false }
    : { texto: "Clima: sincronizando (~1 min)", sincronizando: true };
}

function especificacoes(panel) {
  if (panel.potenciaWp == null) return panel.grupoNome;
  const orientacao = ORIENTACOES.find(([graus]) => Number(graus) === panel.azimute)?.[1] ?? `${panel.azimute}°`;
  return `${panel.grupoNome} · ${panel.potenciaWp} Wp · ${panel.inclinacao}° · ${orientacao}`;
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
              <input
                className={`form-control ${groupForm.coordenadas.trim() ? (coordenadas ? "is-valid" : "is-invalid") : ""}`}
                placeholder="Coordenadas (ex.: -27.548, -48.4988)"
                aria-label="Coordenadas do local"
                value={groupForm.coordenadas}
                onChange={(event) => setGroupForm((current) => ({ ...current, coordenadas: event.target.value }))}
              />
              <div className="form-text mt-n2">
                {coordenadas
                  ? `Latitude ${coordenadas.latitude}, longitude ${coordenadas.longitude}.`
                  : "Local da usina: no Google Maps, clique com o botão direito no ponto e depois nas coordenadas para copiar (aceita também 27°32'52.8\"S 48°29'55.6\"W). Necessário para a geração estimada pelo clima."}
              </div>
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
              <div className="d-flex gap-2">
                <input
                  type="number"
                  step="any"
                  min="1"
                  className="form-control"
                  placeholder="Potência (Wp)"
                  aria-label="Potência em Wp"
                  value={panelForm.potenciaWp}
                  onChange={(event) => setPanelForm((current) => ({ ...current, potenciaWp: event.target.value }))}
                />
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="90"
                  className="form-control"
                  placeholder="Inclinação (°)"
                  aria-label="Inclinação em graus"
                  value={panelForm.inclinacao}
                  onChange={(event) => setPanelForm((current) => ({ ...current, inclinacao: event.target.value }))}
                />
              </div>
              <select
                aria-label="Orientação da placa"
                className="form-select"
                value={panelForm.azimute}
                onChange={(event) => setPanelForm((current) => ({ ...current, azimute: event.target.value }))}
              >
                {ORIENTACOES.map(([graus, nome]) => (
                  <option key={graus} value={graus}>Voltada para o {nome} ({graus}°)</option>
                ))}
              </select>
              <div className="form-text mt-n2">
                Com o local no grupo, a potência e a inclinação, o sistema carrega 5 anos de clima e a previsão em ~1 min.
              </div>
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
                    <div className="text-muted small">{especificacoes(panel)}</div>
                    <div className="text-muted small">{climaStatus(panel).texto}</div>
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
