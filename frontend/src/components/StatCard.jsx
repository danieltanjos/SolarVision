export default function StatCard({ title, value, subtitle, icon }) {
  return (
    <div className="sv-stat-card">
      <div className="sv-stat-head">
        <span className="sv-stat-title">{title}</span>
        <i className={`bi ${icon}`} />
      </div>
      <div className="sv-stat-value">{value}</div>
      {subtitle ? <div className="sv-stat-subtitle">{subtitle}</div> : null}
    </div>
  );
}
