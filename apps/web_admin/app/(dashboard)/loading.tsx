export default function DashboardRouteLoading() {
  return (
    <div className="route-loading" aria-label="Loading page">
      <div className="route-loading-heading" />
      <div className="metric-grid compact-metrics">
        <span className="skeleton-line" />
        <span className="skeleton-line" />
        <span className="skeleton-line" />
      </div>
      <div className="table-skeleton panel">
        <span className="skeleton-line" />
        <span className="skeleton-line" />
        <span className="skeleton-line" />
      </div>
    </div>
  );
}
