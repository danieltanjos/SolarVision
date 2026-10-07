import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRecomendacoesLimpeza } from "../lib/api";
import { useLimiarLimpeza } from "../context/AuthContext";

function useRecomendacoes() {
  const [recomendacoes, setRecomendacoes] = useState(null);
  useEffect(() => {
    getRecomendacoesLimpeza().then(setRecomendacoes, () => setRecomendacoes([]));
  }, []);
  return recomendacoes;
}

// Motivo da recomendação de uma placa ("Chuva prevista para quinta (12 mm): espere").
export function MotivoLimpeza({ placaId }) {
  const recomendacao = useRecomendacoes()?.find((item) => item.placaId === placaId);
  return recomendacao?.motivo ?? "—";
}

// Home: placas para limpar agora e as sujas em que a chuva prevista adia a limpeza.
export default function RecomendacoesLimpeza({ panels }) {
  const recomendacoes = useRecomendacoes();
  const limiar = useLimiarLimpeza();
  const itens = (recomendacoes ?? [])
    .filter((item) => item.limpar || (item.perda >= limiar && item.chuvaPrevistaEm))
    .map((item) => ({ ...item, panel: panels.find((panel) => panel.id === item.placaId) }))
    .filter((item) => item.panel);

  return (
    <section className="card">
      <div className="sv-card-head">
        <div>
          <h2>Limpezas recomendadas</h2>
          <p>Pela sujeira, pela chuva prevista e pelo custo da limpeza.</p>
        </div>
      </div>
      <ul className="sv-list">
        {itens.map(({ placaId, limpar, motivo, panel }) => (
          <li key={placaId}>
            <span className="sv-list-icon"><i className={`bi ${limpar ? "bi-droplet-half" : "bi-cloud-rain"}`} /></span>
            <div className="min-w-0">
              <strong>{panel.modelo} · {panel.grupoNome}</strong>
              <span title={motivo}>{motivo}</span>
            </div>
            <span className="ms-auto d-flex gap-2">
              <Link to={`/app/monitoramento?grupo=${panel.grupoId}&placa=${placaId}`} className="btn btn-sm btn-outline-secondary">
                Ver
              </Link>
              <Link to={`/app/limpeza?placa=${placaId}`} className="btn btn-sm btn-outline-primary">
                Registrar limpeza
              </Link>
            </span>
          </li>
        ))}
      </ul>
      {recomendacoes && itens.length === 0 ? (
        <div className="sv-empty sv-empty-sm">
          <i className="bi bi-check2-circle" />
          <p>Nenhuma limpeza recomendada agora.</p>
        </div>
      ) : null}
    </section>
  );
}
