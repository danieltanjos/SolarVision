import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { quando } from "../lib/alertas";
import { listAlertas, marcarAlertasLidos } from "../lib/api";

const ICONES = { LIMPEZA: "bi-droplet-half", PREVISAO_BAIXA: "bi-cloud-drizzle", DESEMPENHO: "bi-graph-down-arrow" };

// Sino do cabeçalho: limpeza recomendada, previsão de amanhã baixa e placa abaixo do grupo (pg_cron às 07:00).
export default function Alertas() {
  const { pathname } = useLocation();
  const [alertas, setAlertas] = useState([]);
  const sino = useRef(null);

  // O sino é extra: se falhar, fica vazio.
  const carregar = () => listAlertas().then(setAlertas, () => setAlertas([]));
  useEffect(() => {
    carregar();
  }, [pathname]);

  const marcar = (id) => marcarAlertasLidos(id).then(carregar, () => {});
  const naoLidos = alertas.filter((alerta) => !alerta.lidoEm).length;

  return (
    <div className="dropdown">
      <button
        type="button"
        ref={sino}
        className="sv-icon-btn position-relative"
        data-bs-toggle="dropdown"
        aria-expanded="false"
        aria-label={naoLidos ? `Alertas: ${naoLidos} não lidos` : "Alertas"}
        title="Alertas"
      >
        <i className={`bi ${naoLidos ? "bi-bell-fill" : "bi-bell"}`} />
        {naoLidos ? (
          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
            {naoLidos > 9 ? "9+" : naoLidos}
          </span>
        ) : null}
      </button>
      <div className="dropdown-menu dropdown-menu-end sv-alertas">
        <div className="sv-alertas-head">
          <strong>Alertas</strong>
          {naoLidos ? (
            // o botão some quando não há não lidos: o foco volta para o sino
            <button type="button" className="btn btn-link btn-sm" onClick={() => { sino.current.focus(); marcar(); }}>
              Marcar todos como lidos
            </button>
          ) : null}
        </div>
        {alertas.length ? (
          <ul className="sv-list">
            {alertas.map((alerta) => {
              // Abrir o alerta pelo link conta como lido.
              const ler = alerta.lidoEm ? undefined : () => marcar(alerta.id);
              return (
                <li key={alerta.id} className={alerta.lidoEm ? "is-lido" : ""}>
                  <span className="sv-list-icon"><i className={`bi ${ICONES[alerta.tipo]}`} /></span>
                  <div className="min-w-0">
                    <strong>{alerta.placaModelo ? `${alerta.placaModelo} · ${alerta.grupoNome}` : alerta.grupoNome}</strong>
                    <span>{alerta.mensagem}</span>
                    <small>
                      <time dateTime={alerta.criadoEm}>{quando(alerta.criadoEm)}</time>
                      <Link
                        to={`/app/monitoramento?grupo=${alerta.grupoId}${alerta.placaId ? `&placa=${alerta.placaId}` : ""}`}
                        onClick={ler}
                      >
                        Ver no monitoramento
                      </Link>
                      {alerta.tipo === "LIMPEZA" ? (
                        <Link to={`/app/limpeza?placa=${alerta.placaId}`} onClick={ler}>Registrar limpeza</Link>
                      ) : null}
                    </small>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="sv-empty sv-empty-sm">
            <i className="bi bi-bell-slash" />
            <p>Nenhum alerta.</p>
          </div>
        )}
      </div>
    </div>
  );
}
