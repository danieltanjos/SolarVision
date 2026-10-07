import { useEffect, useState } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { extractErrorMessage, salvarPerfil } from "../lib/api";
import { titleCase } from "../lib/text";

const SECOES = [
  ["perfil", "Perfil"],
  ["seguranca", "Segurança"],
  ["aparencia", "Aparência"],
  ["alertas", "Alertas"],
  ["limpeza", "Limpeza"],
  ["padroes", "Padrões do cadastro"]
];

const PAPEIS = { USER: "Usuário", ADMIN: "Administrador" };
const SENHA_VAZIA = { atual: "", nova: "", confirmar: "" };
const numOrNull = (value) => (value === "" ? null : Number(value));

// Campos da tela a partir do perfil: limiares em % (no banco, fração) e número vazio como "".
const formDoUsuario = (user) => ({
  nome: user.nome,
  alertaLimpeza: user.alertaLimpeza,
  alertaPrevisao: user.alertaPrevisao,
  alertaDesempenho: user.alertaDesempenho,
  limiarLimpeza: Math.round(user.limiarLimpeza * 100),
  limiarPrevisao: Math.round(user.limiarPrevisao * 100),
  tarifaPadrao: user.tarifaPadrao ?? "",
  custoLimpezaPadrao: user.custoLimpezaPadrao ?? ""
});

// Card de uma seção. Com onSubmit, os campos viram um formulário com o botão e o resultado do último envio.
function Secao({ id, icone, titulo, descricao, status, onSubmit, botao = "Salvar", rodape, children }) {
  return (
    <section className="card sv-settings-card" id={id}>
      <div className="sv-card-head">
        <div className="d-flex align-items-center gap-3">
          <span className="sv-list-icon"><i className={`bi ${icone}`} /></span>
          <div>
            <h2>{titulo}</h2>
            <p>{descricao}</p>
          </div>
        </div>
      </div>
      {onSubmit ? (
        <form
          className="sv-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          {children}
          {status?.erro ? <div className="alert alert-danger mb-0">{status.erro}</div> : null}
          <div className="d-flex align-items-center gap-3">
            <button type="submit" className="btn btn-primary" disabled={status?.salvando}>
              {status?.salvando ? "Salvando..." : botao}
            </button>
            {status?.ok ? (
              <span className="sv-settings-ok" role="status">
                <i className="bi bi-check2-circle me-1" />
                {status.ok}
              </span>
            ) : null}
          </div>
        </form>
      ) : children}
      {rodape}
    </section>
  );
}

function Interruptor({ id, label, descricao, checked, onChange }) {
  return (
    <div className="form-check form-switch">
      <input id={id} className="form-check-input" type="checkbox" role="switch" checked={checked} onChange={onChange} />
      <label className="form-check-label" htmlFor={id}>
        {label}
        <span className="form-text d-block mt-0">{descricao}</span>
      </label>
    </div>
  );
}

// O formulário nasce do perfil: ao abrir a página direto pela URL, espera ele chegar.
export default function SettingsPage() {
  const { user } = useAuth();
  if (!user) {
    return (
      <div className="sv-route-fallback">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }
  return <Configuracoes user={user} />;
}

function Configuracoes({ user }) {
  const { recarregarUsuario, trocarSenha, logout } = useAuth();
  const { isDark, setIsDark } = useOutletContext(); // o mesmo estado do botão do cabeçalho
  const { hash } = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState(() => formDoUsuario(user));
  const [senha, setSenha] = useState(SENHA_VAZIA);
  const [status, setStatus] = useState({}); // por seção: { salvando } | { ok } | { erro }

  // "Meu perfil" (menu do usuário) e o índice do topo levam à seção pelo #id.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  const campo = (nome) => (event) => {
    const { type, checked, value } = event.target;
    setForm((current) => ({ ...current, [nome]: type === "checkbox" ? checked : value }));
  };

  async function executar(secao, acao, mensagem) {
    setStatus((current) => ({ ...current, [secao]: { salvando: true } }));
    try {
      await acao();
      setStatus((current) => ({ ...current, [secao]: { ok: mensagem } }));
    } catch (err) {
      setStatus((current) => ({ ...current, [secao]: { erro: extractErrorMessage(err) } }));
    }
  }

  // Grava só os campos da seção e recarrega o usuário (Home e Monitoramento leem o limiar dele).
  const salvar = (secao, campos) =>
    executar(secao, async () => {
      await salvarPerfil(user.id, campos);
      await recarregarUsuario();
    }, "Salvo.");

  // Mesmas regras do cadastro (RegisterPage).
  const salvarSenha = () =>
    executar("seguranca", async () => {
      if (senha.nova.length < 8) throw new Error("A senha deve ter no mínimo 8 caracteres.");
      if (senha.nova !== senha.confirmar) throw new Error("As senhas não coincidem.");
      await trocarSenha(senha.atual, senha.nova);
      setSenha(SENHA_VAZIA);
    }, "Senha alterada.");

  async function sairDeTodos() {
    const { error } = await logout("global");
    if (error) setStatus((current) => ({ ...current, seguranca: { erro: extractErrorMessage(error) } }));
    else navigate("/login", { replace: true });
  }

  const nome = titleCase(user.nome);
  const iniciais = nome.split(" ").map((parte) => parte[0]).slice(0, 2).join("");
  const campoSenha = (chave, label, autoComplete) => (
    <div>
      <label className="form-label" htmlFor={`senha-${chave}`}>{label}</label>
      <input
        id={`senha-${chave}`}
        type="password"
        className="form-control"
        autoComplete={autoComplete}
        minLength={chave === "atual" ? undefined : 8}
        value={senha[chave]}
        onChange={(event) => setSenha((current) => ({ ...current, [chave]: event.target.value }))}
        required
      />
    </div>
  );

  return (
    <div className="sv-page">
      <header className="sv-page-head">
        <div>
          <h1>Configurações</h1>
          <p>Seu perfil, a segurança da conta e como o SolarVision avisa e recomenda.</p>
        </div>
        <nav className="sv-settings-nav" aria-label="Seções">
          {SECOES.map(([id, titulo]) => (
            <a key={id} href={`#${id}`} className="sv-chip">{titulo}</a>
          ))}
        </nav>
      </header>

      <div className="sv-settings">
        <Secao
          id="perfil"
          icone="bi-person"
          titulo="Perfil"
          descricao="O nome aparece no cabeçalho e na saudação da Home."
          status={status.perfil}
          onSubmit={() => salvar("perfil", { nome: form.nome })}
        >
          <div className="sv-profile mb-0">
            <span className="sv-avatar sv-avatar-lg">{iniciais}</span>
            <div className="min-w-0">
              <h3 className="mb-1 text-truncate">{nome}</h3>
              <p className="sv-muted mb-0 text-truncate">{user.email}</p>
            </div>
          </div>
          <div>
            <label className="form-label" htmlFor="perfil-nome">Nome</label>
            <input
              id="perfil-nome"
              className="form-control"
              maxLength={100}
              value={form.nome}
              onChange={campo("nome")}
              required
            />
          </div>
          <dl className="sv-details">
            <div><dt>Papel</dt><dd>{PAPEIS[user.role] ?? user.role}</dd></div>
            <div><dt>Criado em</dt><dd>{new Date(user.criadoEm).toLocaleDateString("pt-BR")}</dd></div>
          </dl>
        </Secao>

        <Secao
          id="seguranca"
          icone="bi-shield-lock"
          titulo="Segurança"
          descricao="Para trocar a senha, confirme a atual."
          status={status.seguranca}
          onSubmit={salvarSenha}
          botao="Trocar senha"
          rodape={(
            <div className="sv-settings-foot">
              <div>
                <strong>Sair de todos os dispositivos</strong>
                <span>Encerra a sessão aqui e em qualquer outro navegador ou celular.</span>
              </div>
              <button type="button" className="btn btn-outline-danger" onClick={sairDeTodos}>
                <i className="bi bi-box-arrow-right me-2" />
                Sair de todos
              </button>
            </div>
          )}
        >
          {campoSenha("atual", "Senha atual", "current-password")}
          <div className="sv-form-row">
            {campoSenha("nova", "Nova senha (mínimo 8)", "new-password")}
            {campoSenha("confirmar", "Confirmar nova senha", "new-password")}
          </div>
        </Secao>

        <Secao id="aparencia" icone="bi-palette" titulo="Aparência" descricao="Vale neste navegador; o botão do cabeçalho faz o mesmo.">
          <div className="sv-segmented" role="group" aria-label="Tema">
            {[[false, "Claro", "bi-sun"], [true, "Escuro", "bi-moon-stars"]].map(([escuro, label, icone]) => (
              <button
                key={label}
                type="button"
                className={isDark === escuro ? "active" : ""}
                aria-pressed={isDark === escuro}
                onClick={() => setIsDark(escuro)}
              >
                <i className={`bi ${icone} me-2`} />
                {label}
              </button>
            ))}
          </div>
        </Secao>

        <Secao
          id="alertas"
          icone="bi-bell"
          titulo="Alertas"
          descricao="Gerados todo dia às 07:00; aparecem no sino do cabeçalho."
          status={status.alertas}
          onSubmit={() =>
            salvar("alertas", {
              alertaLimpeza: form.alertaLimpeza,
              alertaPrevisao: form.alertaPrevisao,
              alertaDesempenho: form.alertaDesempenho,
              limiarPrevisao: form.limiarPrevisao / 100
            })
          }
        >
          <Interruptor
            id="alerta-limpeza"
            label="Limpeza recomendada"
            descricao="Quando a sujeira passa do limiar da seção Limpeza e limpar compensa."
            checked={form.alertaLimpeza}
            onChange={campo("alertaLimpeza")}
          />
          <Interruptor
            id="alerta-desempenho"
            label="Desempenho abaixo do grupo"
            descricao="Placa mais de 10 p.p. abaixo das outras do grupo nos últimos 7 dias."
            checked={form.alertaDesempenho}
            onChange={campo("alertaDesempenho")}
          />
          <Interruptor
            id="alerta-previsao"
            label="Previsão baixa"
            descricao="Quando amanhã deve gerar bem abaixo da média de 5 anos para o dia."
            checked={form.alertaPrevisao}
            onChange={campo("alertaPrevisao")}
          />
          <div>
            <label className="form-label" htmlFor="limiar-previsao">
              Avisar abaixo de <strong>{form.limiarPrevisao}%</strong> da média de 5 anos
            </label>
            <input
              id="limiar-previsao"
              type="range"
              className="form-range"
              min="10"
              max="95"
              step="5"
              value={form.limiarPrevisao}
              onChange={campo("limiarPrevisao")}
              disabled={!form.alertaPrevisao}
            />
          </div>
        </Secao>

        <Secao
          id="limpeza"
          icone="bi-droplet"
          titulo="Limpeza"
          descricao="Quando a perda por sujeira justifica limpar."
          status={status.limpeza}
          onSubmit={() => salvar("limpeza", { limiarLimpeza: form.limiarLimpeza / 100 })}
        >
          <div>
            <label className="form-label" htmlFor="limiar-limpeza">
              Recomendar limpeza a partir de <strong>{form.limiarLimpeza}%</strong> de perda
            </label>
            <input
              id="limiar-limpeza"
              type="range"
              className="form-range"
              min="1"
              max="20"
              step="1"
              value={form.limiarLimpeza}
              onChange={campo("limiarLimpeza")}
            />
            <div className="form-text">
              A sujeira cresce 0,2 %/dia desde a última limpeza ou chuva forte, até 20 %. Vale para a Home, o
              Monitoramento, as recomendações e o alerta de limpeza.
            </div>
          </div>
        </Secao>

        <Secao
          id="padroes"
          icone="bi-grid-3x2"
          titulo="Padrões do cadastro"
          descricao="Já vêm preenchidos ao criar um grupo."
          status={status.padroes}
          onSubmit={() =>
            salvar("padroes", {
              tarifaPadrao: numOrNull(form.tarifaPadrao),
              custoLimpezaPadrao: numOrNull(form.custoLimpezaPadrao)
            })
          }
        >
          <div className="sv-form-row">
            <div>
              <label className="form-label" htmlFor="padrao-tarifa">Tarifa (R$/kWh)</label>
              <input
                id="padrao-tarifa"
                type="number"
                step="any"
                min="0.0001"
                className="form-control"
                placeholder="Ex.: 0.95"
                value={form.tarifaPadrao}
                onChange={campo("tarifaPadrao")}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="padrao-custo">Limpeza (R$/placa)</label>
              <input
                id="padrao-custo"
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                placeholder="Ex.: 30"
                value={form.custoLimpezaPadrao}
                onChange={campo("custoLimpezaPadrao")}
              />
            </div>
          </div>
          <div className="form-text mt-0">Vazio: o grupo novo começa sem tarifa ou sem custo de limpeza.</div>
        </Secao>
      </div>
    </div>
  );
}
