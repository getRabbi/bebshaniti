import { PageHeader } from "@/components/admin-ui";
import { DashboardLive } from "@/components/dashboard-live";

const reports = [
  ["Sales summary", "Completed invoices, collections and branch performance."],
  ["Inventory valuation", "On-hand quantities valued from the stock projection ledger."],
  ["Customer receivables", "Outstanding due grouped by customer and credit exposure."],
  ["Cash position", "Cashbook inflow and outflow by payment method and branch."]
] as const;

export default function ReportsPage() {
  return <><PageHeader eyebrow="Decision support" title="Reports" description="Live operational indicators from canonical transaction and inventory ledgers." /><DashboardLive /><div className="settings-grid">{reports.map(([title, copy]) => <article className="settings-card report-card" key={title}><div><h2>{title}</h2><p>{copy}</p><small>Detailed filters and exports follow verified transaction history.</small></div></article>)}</div></>;
}
