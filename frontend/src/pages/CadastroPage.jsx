import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ConfirmarExclusao, { AcoesLinha } from "../components/ConfirmarExclusao";
import StatusBadge from "../components/StatusBadge";
import {
  createGroup,
  createPanel,
  deleteGroup,
  deletePanel,
  extractErrorMessage,
  listGroups,
  listPanels,
  updateGroup,
  updatePanel
} from "../lib/api";
import { parseCoordenadas } from "../lib/coordenadas";
import { ORIENTACOES, climaStatus, orientacao } from "../lib/placas";

const EMPTY_GROUP = { id: null, nome: "", status: "ATIVO", coordenadas: "", tarifaKwh: "", custoLimpeza: "" };
const EMPTY_PANEL = {
  id: null,
  grupoId: "",
  modelo: "",
  status: "ATIVA",
  potenciaWp: "",
  inclinacao: "",
  azimute: "0",
  instaladaEm: ""
};

const numOrNull = (value) => (value === "" ? null : Number(value));
const campo = (value) => (value == null ? "" : String(value)); // null do banco -> input vazio
const reais = (value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 4 });

// Leva o formulário de edição para a tela (a lista pode estar bem abaixo dele).
const mostrar = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });

export default function CadastroPage() {
  const [groups, setGroups] = useState([]);
  const [panels, setPanels] = useState([]);
  const [error, setError] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [excluir, setExcluir] = useState(null); // { texto, acao, mensagem } do modal de confirmação
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

  // Salva/exclui, recarrega as listas e mostra o resultado.
  async function executar(acao, mensagem) {
    setSucesso("");
    try {
      await acao();
      await loadData();
      setSucesso(mensagem);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  const coordenadas = groupForm.coordenadas.trim() ? parseCoordenadas(groupForm.coordenadas) : null;

  async function handleGroupSubmit(event) {
    event.preventDefault();
    if (groupForm.coordenadas.trim() && !coordenadas) {
      setSucesso("");
      setError("Coordenadas não reconhecidas. Use, por exemplo, -27.548, -48.4988.");
      return;
    }
    const dados = {
      nome: groupForm.nome,
      status: groupForm.status,
      latitude: coordenadas?.latitude ?? null,
      longitude: coordenadas?.longitude ?? null,
      tarifaKwh: numOrNull(groupForm.tarifaKwh),
      custoLimpeza: numOrNull(groupForm.custoLimpeza)
    };
    await executar(async () => {
      await (groupForm.id ? updateGroup(groupForm.id, dados) : createGroup(dados));
      setGroupForm(EMPTY_GROUP);
    }, `Grupo "${dados.nome.trim()}" ${groupForm.id ? "atualizado" : "criado"}.`);
  }

  async function handlePanelSubmit(event) {
    event.preventDefault();
    const dados = {
      grupoId: Number(panelForm.grupoId),
      modelo: panelForm.modelo,
      status: panelForm.status,
      potenciaWp: numOrNull(panelForm.potenciaWp),
      inclinacao: numOrNull(panelForm.inclinacao),
      azimute: numOrNull(panelForm.azimute),
      instaladaEm: panelForm.instaladaEm || null
    };
    await executar(async () => {
      await (panelForm.id ? updatePanel(panelForm.id, dados) : createPanel(dados));
      setPanelForm(EMPTY_PANEL);
    }, `Placa "${dados.modelo.trim()}" ${panelForm.id ? "atualizada" : "criada"}.`);
  }

  function editGroup(group) {
    setGroupForm({
      id: group.id,
      nome: group.nome,
      status: group.status,
      coordenadas: group.latitude != null ? `${group.latitude}, ${group.longitude}` : "",
      tarifaKwh: campo(group.tarifaKwh),
      custoLimpeza: campo(group.custoLimpeza)
    });
    mostrar("form-grupo");
  }

  function editPanel(panel) {
    setPanelForm({
      id: panel.id,
      grupoId: String(panel.grupoId),
      modelo: panel.modelo,
      status: panel.status,
      potenciaWp: campo(panel.potenciaWp),
      inclinacao: campo(panel.inclinacao),
      azimute: campo(panel.azimute ?? 0),
      instaladaEm: campo(panel.instaladaEm)
    });
    mostrar("form-placa");
  }

  function excluirGrupo(group) {
    setExcluir({
      texto: `Excluir o grupo "${group.nome}"?${
        group.totalPlacas ? ` Isso também exclui as placas dele (${group.totalPlacas}), as limpezas e o clima carregado.` : ""
      }`,
      acao: async () => {
        await deleteGroup(group.id);
        setGroupForm((form) => (form.id === group.id ? EMPTY_GROUP : form));
        setPanelForm((form) => (Number(form.grupoId) === group.id ? EMPTY_PANEL : form));
      },
      mensagem: `Grupo "${group.nome}" excluído.`
    });
  }

  function excluirPlaca(panel) {
    setExcluir({
      texto: `Excluir a placa "${panel.modelo}" (${panel.grupoNome})? Isso também exclui as limpezas e o clima carregado dela.`,
      acao: async () => {
        await deletePanel(panel.id);
        setPanelForm((form) => (form.id === panel.id ? EMPTY_PANEL : form));
      },
      mensagem: `Placa "${panel.modelo}" excluída.`
    });
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
      {sucesso ? <div className="alert alert-success mb-0" role="status">{sucesso}</div> : null}

      {excluir ? (
        <ConfirmarExclusao
          texto={excluir.texto}
          onCancelar={() => setExcluir(null)}
          onConfirmar={() => {
            setExcluir(null);
            executar(excluir.acao, excluir.mensagem);
          }}
        />
      ) : null}

      <div className="sv-split">
        <div className="sv-stack">
          <section className="card" id="form-grupo">
            <div className="sv-card-head">
              <h2><i className="bi bi-collection me-2" />{groupForm.id ? "Editar grupo" : "Novo grupo"}</h2>
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
              <div className="sv-form-row">
                <div>
                  <label className="form-label" htmlFor="grupo-tarifa">Tarifa (R$/kWh)</label>
                  <input
                    id="grupo-tarifa"
                    type="number"
                    step="any"
                    min="0.0001"
                    className="form-control"
                    placeholder="0.95"
                    value={groupForm.tarifaKwh}
                    onChange={setGroupField("tarifaKwh")}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="grupo-custo">Limpeza (R$/placa)</label>
                  <input
                    id="grupo-custo"
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control"
                    placeholder="30"
                    value={groupForm.custoLimpeza}
                    onChange={setGroupField("custoLimpeza")}
                  />
                </div>
              </div>
              <div className="form-text mt-0">
                A tarifa da conta de luz converte a energia gerada em economia (R$); o custo de limpar uma placa entra na
                recomendação de limpeza.
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
          </section>

          <section className="card" id="form-placa">
            <div className="sv-card-head">
              <h2><i className="bi bi-grid-3x2 me-2" />{panelForm.id ? "Editar placa" : "Nova placa"}</h2>
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
              <div>
                <label className="form-label" htmlFor="placa-instalada">Instalada em</label>
                <input
                  id="placa-instalada"
                  type="date"
                  className="form-control"
                  value={panelForm.instaladaEm}
                  onChange={setPanelField("instaladaEm")}
                />
                <div className="form-text">Sem limpeza registrada, a sujeira da placa passa a contar a partir desta data.</div>
              </div>
              <div className="form-text mt-0">
                Com o local no grupo, a potência e a inclinação, o sistema carrega 5 anos de clima e a previsão em ~1 min
                (e recarrega se o local, a inclinação ou a orientação mudarem).
              </div>
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
                    <th><span className="visually-hidden">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <tr key={group.id}>
                      <td>
                        <Link to={`/app/monitoramento?grupo=${group.id}`} className="fw-semibold">{group.nome}</Link>
                        <div className="sv-muted small">
                          {group.tarifaKwh != null ? `${reais(group.tarifaKwh)}/kWh` : "Sem tarifa"}
                          {group.custoLimpeza != null ? ` · limpeza ${reais(group.custoLimpeza)}` : ""}
                        </div>
                      </td>
                      <td className="sv-muted">{group.latitude != null ? `${group.latitude}, ${group.longitude}` : "Sem local"}</td>
                      <td>{group.totalPlacas}</td>
                      <td><StatusBadge status={group.status} /></td>
                      <AcoesLinha nome={group.nome} onEditar={() => editGroup(group)} onExcluir={() => excluirGrupo(group)} />
                    </tr>
                  ))}
                  {groups.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="sv-muted">Nenhum grupo cadastrado.</td>
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
                    <th><span className="visually-hidden">Ações</span></th>
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
                          {panel.instaladaEm ? (
                            <div className="small">Instalada em {panel.instaladaEm.split("-").reverse().join("/")}</div>
                          ) : null}
                        </td>
                        <td>
                          <span className={`sv-dot ${clima.ok ? "is-ok" : clima.sincronizando ? "is-wait" : ""}`} />
                          <span className="sv-muted small">{clima.texto}</span>
                        </td>
                        <td><StatusBadge status={panel.status} /></td>
                        <AcoesLinha nome={panel.modelo} onEditar={() => editPanel(panel)} onExcluir={() => excluirPlaca(panel)} />
                      </tr>
                    );
                  })}
                  {filteredPanels.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="sv-muted">Nenhuma placa encontrada.</td>
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
