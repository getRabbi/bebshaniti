import { SignOutButton } from "@/components/sign-out";
import { requirePlatformAdmin } from "@/lib/auth";
import { loadPlatformData } from "@/lib/data";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("bn-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("bn-BD");
const dateTime = new Intl.DateTimeFormat("bn-BD", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });
const n = (value: number | string | null | undefined) => Number(value ?? 0);
const when = (value: string | null | undefined) => value ? dateTime.format(new Date(value)) : "এখনও নেই";

export default async function PlatformDashboard() {
  const actor = await requirePlatformAdmin();
  const { merchants, audit, access } = await loadPlatformData(actor);
  const byId = new Map(merchants.map((merchant) => [merchant.id, merchant.name]));
  const totals = merchants.reduce((sum, merchant) => ({
    branches: sum.branches + merchant.active_branch_count,
    members: sum.members + merchant.active_member_count,
    sales30: sum.sales30 + n(merchant.sales_last_30_days),
    receivable: sum.receivable + n(merchant.receivable_balance),
  }), { branches: 0, members: 0, sales30: 0, receivable: 0 });
  const activeLicenses = merchants.filter((merchant) => merchant.license_status === "active").length;

  return <main className="console-shell">
    <aside className="console-nav"><div className="console-brand"><span>ন</span><div>নীতি অপারেশনস<small>PRIVATE CONSOLE</small></div></div><nav><a href="#overview">সারসংক্ষেপ</a><a href="#merchants">ব্যবসায়ী</a><a href="#licenses">লাইসেন্স</a><a href="#audit">সিকিউরিটি অডিট</a></nav><div className="operator"><small>Operator</small><strong>{actor.email}</strong><SignOutButton /></div></aside>
    <section className="console-main">
      <header className="console-header"><div><p className="eyebrow">PLATFORM CONTROL</p><h1>অপারেশন সারসংক্ষেপ</h1><p>Merchant, subscription, usage, support এবং security signal-এর read-only monitoring।</p></div><div className="live-badge"><span /> Production live</div></header>
      <section id="overview" className="metric-grid">
        <article><small>মোট ব্যবসা</small><strong>{number.format(merchants.length)}</strong><em>{number.format(merchants.filter((m) => m.is_active).length)} সক্রিয়</em></article>
        <article><small>সক্রিয় শাখা</small><strong>{number.format(totals.branches)}</strong><em>{number.format(totals.members)} সক্রিয় ব্যবহারকারী</em></article>
        <article><small>গত ৩০ দিনের বিক্রয়</small><strong>{money.format(totals.sales30)}</strong><em>সব ব্যবসা মিলিয়ে</em></article>
        <article><small>বর্তমান পাওনা</small><strong>{money.format(totals.receivable)}</strong><em>{number.format(activeLicenses)} সক্রিয় লাইসেন্স</em></article>
      </section>

      <section className="panel" id="merchants"><div className="panel-heading"><div><p className="eyebrow">MERCHANTS & USAGE</p><h2>সব ব্যবসার অবস্থা</h2></div><span>{number.format(merchants.length)}টি workspace</span></div>
        <div className="table-wrap"><table><thead><tr><th>ব্যবসা ও support</th><th>অবস্থা</th><th>ব্যবহার</th><th>৩০ দিনের বিক্রয়</th><th>পাওনা</th><th>সর্বশেষ কার্যক্রম</th></tr></thead><tbody>{merchants.map((merchant) => <tr key={merchant.id}><td><strong>{merchant.name}</strong><small>{merchant.owner_name ?? "Owner অনির্ধারিত"} · {merchant.owner_email ?? merchant.email ?? merchant.phone ?? "যোগাযোগ নেই"}</small></td><td><span className={`status ${merchant.is_active ? "ok" : "danger"}`}>{merchant.is_active ? "সক্রিয়" : "বন্ধ"}</span></td><td><strong>{number.format(merchant.product_count)} পণ্য</strong><small>{number.format(merchant.active_member_count)} user · {number.format(merchant.active_device_count)} device</small></td><td>{money.format(n(merchant.sales_last_30_days))}<small>{number.format(merchant.completed_sale_count)} total sale</small></td><td>{money.format(n(merchant.receivable_balance))}</td><td>{when(merchant.last_activity_at)}</td></tr>)}</tbody></table></div>
      </section>

      <section className="panel" id="licenses"><div className="panel-heading"><div><p className="eyebrow">SUBSCRIPTIONS</p><h2>লাইসেন্স ও সীমা</h2></div></div>
        <div className="license-grid">{merchants.map((merchant) => <article key={merchant.id}><div><strong>{merchant.name}</strong><span className={`status ${merchant.license_status === "active" ? "ok" : merchant.license_status ? "warn" : "neutral"}`}>{merchant.license_status ?? "লাইসেন্স নেই"}</span></div><p>{merchant.plan_code ?? "Plan নির্ধারিত নয়"}</p><small>শাখা {merchant.active_branch_count}/{merchant.max_branches ?? "—"} · Device {merchant.active_device_count}/{merchant.max_devices ?? "—"}</small><small>মেয়াদ: {when(merchant.expires_at)}</small></article>)}</div>
      </section>

      <section className="audit-grid" id="audit">
        <div className="panel"><div className="panel-heading"><div><p className="eyebrow">TENANT SECURITY</p><h2>সাম্প্রতিক business audit</h2></div></div><div className="event-list">{audit.map((entry) => <article key={entry.id}><span className="event-dot" /><div><strong>{entry.action}</strong><p>{byId.get(entry.organization_id) ?? entry.organization_id} · {entry.entity_type}</p></div><time>{when(entry.created_at)}</time></article>)}</div></div>
        <div className="panel"><div className="panel-heading"><div><p className="eyebrow">OPERATOR ACCESS</p><h2>Console access log</h2></div></div><div className="event-list">{access.map((entry) => <article key={entry.id}><span className="event-dot operator-dot" /><div><strong>{entry.action}</strong><p>{entry.actor_email}</p></div><time>{when(entry.created_at)}</time></article>)}</div></div>
      </section>
    </section>
  </main>;
}
