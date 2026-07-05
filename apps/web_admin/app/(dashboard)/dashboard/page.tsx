import Link from "next/link";

import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/admin-ui";
import { DashboardLive } from "@/components/dashboard-live";

const modules = [
  ["Products", "Create the catalog structure your operation will use.", "/products", "products"],
  ["Inventory", "Track balances, movements and stock alerts by branch.", "/inventory", "inventory"],
  ["Sales", "Review completed sales, payments and invoices.", "/sales", "sales"],
  ["Customers", "Manage customer profiles, due and statements.", "/customers", "customers"]
] as const;

export default function DashboardPage() {
  return (
    <>
      <PageHeader eyebrow="Owner overview" title="Dashboard" description="Your operational picture will appear here as soon as the business workspace is activated." />
      <DashboardLive />

      <div className="dashboard-grid">
        <section className="panel getting-started">
          <div className="panel-header"><div><p className="page-eyebrow">Launch path</p><h2>Workspace configuration</h2></div><span className="progress-label">Review setup</span></div>
          <ol className="setup-list">
            <li><span>1</span><div><strong>Create your organization</strong><p>Add the legal and trading identity used across the platform.</p></div><Icon name="arrow" /></li>
            <li><span>2</span><div><strong>Configure the main branch</strong><p>Set the operating location, timezone and stock point.</p></div><Icon name="arrow" /></li>
            <li><span>3</span><div><strong>Invite your team</strong><p>Assign role-based access before staff sign in.</p></div><Icon name="arrow" /></li>
            <li><span>4</span><div><strong>Activate the first device</strong><p>Bind a trusted device to the correct branch.</p></div><Icon name="arrow" /></li>
          </ol>
        </section>

        <aside className="panel activity-panel">
          <div className="panel-header"><div><p className="page-eyebrow">Audit stream</p><h2>Recent activity</h2></div></div>
          <div className="activity-empty"><span><Icon name="reports" /></span><h3>No workspace activity yet</h3><p>Sign-ins, setup changes and business events will be listed here with their audit details.</p></div>
        </aside>
      </div>

      <section className="module-section">
        <div className="section-title"><div><p className="page-eyebrow">Operations</p><h2>Business modules</h2></div><p>Each module stays isolated to the selected organization and branch.</p></div>
        <div className="module-grid">
          {modules.map(([title, copy, href, icon]) => (
            <Link className="module-card" href={href} key={href}><span><Icon name={icon} /></span><div><h3>{title}</h3><p>{copy}</p></div><Icon className="module-arrow" name="arrow" /></Link>
          ))}
        </div>
      </section>
    </>
  );
}
