"use client";

import { useCallback, useEffect, useState } from "react";
import { MetricCard } from "@/components/admin-ui";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase-browser";

type Report = {
  sales_today: number;
  profit_today: number;
  receivable_due: number;
  low_stock_items: number;
  inventory_value: number;
  total_products: number;
  total_customers: number;
  collection_today: number;
  sales_this_month: number;
};
function cookie() {
  return (
    document.cookie
      .split("; ")
      .find((p) => p.startsWith("organization_id="))
      ?.split("=")[1] ?? ""
  );
}

export function DashboardLive() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { locale, t } = useI18n();
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  });
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await createClient().auth.getSession();
      if (!data.session) {
        location.assign("/login");
        return;
      }
      const orgs = await apiRequest<Array<{ id: string }>>(
        "/organizations",
        data.session.access_token,
      );
      if (!orgs.length) {
        location.assign("/onboarding");
        return;
      }
      const existing = cookie();
      const id = orgs.some((o) => o.id === existing) ? existing : orgs[0].id;
      document.cookie = `organization_id=${id}; Path=/; SameSite=Lax`;
      setReport(
        await apiRequest<Report>(
          "/reports/summary",
          data.session.access_token,
          id,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => {
    void load();
  }, [load]);
  const labels = [
    t("todaySales"),
    t("todayProfit"),
    t("totalDue"),
    t("lowStockProducts"),
    t("totalProducts"),
    t("totalCustomers"),
    t("todayCollection"),
    t("monthlySales"),
  ];
  const values = report
    ? [
        money.format(report.sales_today),
        money.format(report.profit_today),
        money.format(report.receivable_due),
        String(report.low_stock_items),
        String(report.total_products),
        String(report.total_customers),
        money.format(report.collection_today),
        money.format(report.sales_this_month),
      ]
    : Array(8).fill(t("loading"));
  return (
    <>
      {error ? (
        <div className="error module-error" role="alert">
          {error}{" "}
          <button type="button" onClick={() => void load()}>
            {t("retry")}
          </button>
        </div>
      ) : null}
      <div className="metric-grid dashboard-metrics">
        {labels.map((label, i) => (
          <MetricCard
            key={label}
            label={label}
            hint={loading ? t("loading") : values[i]}
            tone={
              i === 2 ? "amber" : i === 3 ? "red" : i === 7 ? "blue" : "green"
            }
          />
        ))}
      </div>
    </>
  );
}
