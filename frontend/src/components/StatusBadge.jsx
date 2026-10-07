import { useLimiarLimpeza } from "../context/AuthContext";
import { formatPerda } from "../lib/placas";

const STATUS = {
  ATIVO: ["Ativo", "success"],
  ATIVA: ["Ativa", "success"],
  INATIVO: ["Inativo", "muted"],
  INATIVA: ["Inativa", "muted"],
  MANUTENCAO: ["Manutenção", "warning"]
};

export default function StatusBadge({ status }) {
  const [label, tone] = STATUS[status] ?? [status, "muted"];
  return <span className={`sv-badge sv-badge-${tone}`}>{label}</span>;
}

// Perda por sujeira: âmbar a partir do ponto em que a limpeza é recomendada.
export function SujeiraBadge({ perda }) {
  const limiar = useLimiarLimpeza();
  if (perda == null) return <span className="sv-muted">—</span>;
  const limpar = perda >= limiar;
  return (
    <span className={`sv-badge sv-badge-${limpar ? "warning" : "success"}`} title="Perda por sujeira">
      {formatPerda(perda)}{limpar ? " · limpar" : ""}
    </span>
  );
}
