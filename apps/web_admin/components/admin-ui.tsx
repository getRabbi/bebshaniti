import type { ReactNode } from "react";

import { Icon } from "@/components/icons";

export function PageHeader({ eyebrow, title, description, action, actionEnabled = false, onAction }: { eyebrow: string; title: string; description: string; action?: string; actionEnabled?: boolean; onAction?: () => void }) {
  return (
    <header className="page-header">
      <div><p className="page-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>
      {action ? <button className="button primary-action" type="button" disabled={!actionEnabled} onClick={onAction} title={actionEnabled ? undefined : "Complete workspace setup to enable this action"}><Icon name="plus" />{action}</button> : null}
    </header>
  );
}

export function MetricCard({ label, hint, tone = "green" }: { label: string; hint: string; tone?: "green" | "amber" | "blue" | "red" }) {
  return (
    <article className="metric-card">
      <div className={`metric-dot ${tone}`} /><span>{label}</span><strong>—</strong><p>{hint}</p>
    </article>
  );
}

export function SetupNotice({ phase, children }: { phase: string; children: ReactNode }) {
  return (
    <div className="setup-notice" role="status">
      <span className="notice-icon"><Icon name="lock" /></span>
      <div><strong>Workspace setup required</strong><p>{children}</p></div>
      <span className="phase-badge">{phase}</span>
    </div>
  );
}

export function ModuleTable({ columns, title, copy }: { columns: readonly string[]; title: string; copy: string }) {
  return (
    <section className="data-panel">
      <div className="data-toolbar">
        <div className="search-shell"><Icon name="search" /><span>Search records</span></div>
        <button type="button" className="filter-button" disabled>All records</button>
      </div>
      <div className="table-scroll">
        <div className="table-head" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(130px, 1fr))` }}>
          {columns.map((column) => <span key={column}>{column}</span>)}
        </div>
        <div className="empty-state">
          <span className="empty-mark">{title.slice(0, 1)}</span>
          <h2>{title}</h2><p>{copy}</p>
        </div>
      </div>
    </section>
  );
}

export function ModulePage({ eyebrow, title, description, action, phase, metrics, columns, emptyTitle, emptyCopy }: {
  eyebrow: string; title: string; description: string; action: string; phase: string;
  metrics: ReadonlyArray<{ label: string; hint: string; tone?: "green" | "amber" | "blue" | "red" }>;
  columns: readonly string[]; emptyTitle: string; emptyCopy: string;
}) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} action={action} />
      <SetupNotice phase={phase}>Connect an active organization and branch before this module can read or write production data.</SetupNotice>
      <div className="metric-grid">{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</div>
      <ModuleTable columns={columns} title={emptyTitle} copy={emptyCopy} />
    </>
  );
}
