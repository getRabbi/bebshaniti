"use client";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/admin-ui";
import { DashboardLive } from "@/components/dashboard-live";
import { useI18n } from "@/lib/i18n";
export default function DashboardPage() {
  const { t } = useI18n();
  const modules: [
    [string, string, string, "products" | "inventory" | "sales" | "customers"],
    ...Array<
      [string, string, string, "products" | "inventory" | "sales" | "customers"]
    >,
  ] = [
    [t("products"), t("productsIntro"), "/products", "products"],
    [t("inventory"), t("inventoryIntro"), "/inventory", "inventory"],
    [t("sales"), t("salesIntro"), "/sales", "sales"],
    [t("customers"), t("customersIntro"), "/customers", "customers"],
  ];
  return (
    <>
      <PageHeader
        eyebrow={t("ownerOverview")}
        title={t("dashboard")}
        description={t("dashboardIntro")}
      />
      <DashboardLive />
      <section className="module-section">
        <div className="section-title">
          <div>
            <p className="page-eyebrow">{t("operations")}</p>
            <h2>{t("businessModules")}</h2>
          </div>
          <p>{t("moduleIsolation")}</p>
        </div>
        <div className="module-grid">
          {modules.map(([title, copy, href, icon]) => (
            <Link
              className="module-card"
              href={
                href as "/products" | "/inventory" | "/sales" | "/customers"
              }
              key={href}
            >
              <span>
                <Icon name={icon} />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
              <Icon className="module-arrow" name="arrow" />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
