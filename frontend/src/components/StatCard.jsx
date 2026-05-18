export default function StatCard({ title, value, subtitle, icon }) {
  return (
    <div className="card kpi-card h-100">
      <div className="d-flex justify-content-between align-items-start gap-3">
        <div>
          <div className="kpi-title">{title}</div>
          <div className="kpi-value">{value}</div>
          {subtitle ? <div className="text-muted mt-2 small">{subtitle}</div> : null}
        </div>
        <div className="sv-kpi-icon">
          <i className={`bi ${icon}`} />
        </div>
      </div>
    </div>
  );
}
