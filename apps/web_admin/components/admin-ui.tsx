import { Icon } from "@/components/icons";
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  actionEnabled = false,
  onAction,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: string;
  actionEnabled?: boolean;
  onAction?: () => void;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="page-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {action ? (
        <button
          className="button primary-action"
          type="button"
          disabled={!actionEnabled}
          onClick={onAction}
        >
          <Icon name="plus" />
          {action}
        </button>
      ) : null}
    </header>
  );
}
export function MetricCard({
  label,
  hint,
  tone = "green",
}: {
  label: string;
  hint: string;
  tone?: "green" | "amber" | "blue" | "red";
}) {
  return (
    <article className="metric-card">
      <div className={`metric-dot ${tone}`} />
      <span>{label}</span>
      <strong>—</strong>
      <p>{hint}</p>
    </article>
  );
}
