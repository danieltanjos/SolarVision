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
