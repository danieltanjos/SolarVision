export default function StatCard({ title, value, subtitle, icon, tone = "primary" }) {
  return (
    <div className="sv-stat">
      <span className={`sv-stat-icon sv-tone-${tone}`}>
        <i className={`bi ${icon}`} />
      </span>
      <div className="sv-stat-body">
        <div className="sv-stat-title">{title}</div>
        <div className="sv-stat-value">{value}</div>
        {subtitle ? <div className="sv-stat-subtitle">{subtitle}</div> : null}
      </div>
    </div>
  );
}
