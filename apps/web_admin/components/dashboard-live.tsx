"use client";

import { useEffect, useState } from "react";

import { MetricCard } from "@/components/admin-ui";
import { apiRequest } from "@/lib/api";
import { createClient } from "@/lib/supabase-browser";

type Report = { sales_today: number; transactions_today: number; receivable_due: number; low_stock_items: number; inventory_value: number };
const money = new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 2 });

function organizationCookie() {
  return document.cookie.split("; ").find((part) => part.startsWith("organization_id="))?.split("=")[1] ?? "";
}

export function DashboardLive() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await createClient().auth.getSession();
      if (!data.session) return;
      try {
        const organizations = await apiRequest<Array<{ id: string }>>("/organizations", data.session.access_token);
        if (organizations.length === 0) { window.location.assign("/onboarding"); return; }
        const cookie = organizationCookie();
        const organizationId = organizations.some((item) => item.id === cookie) ? cookie : organizations[0].id;
        document.cookie = `organization_id=${organizationId}; Path=/; SameSite=Lax`;
        setReport(await apiRequest<Report>("/reports/dashboard", data.session.access_token, organizationId));
      } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load dashboard"); }
    }
    void load();
  }, []);

  return <>{error ? <div className="error module-error">{error}</div> : null}<div className="metric-grid dashboard-metrics">
    <MetricCard label="Sales today" hint={report ? money.format(Number(report.sales_today)) : "Loading live data…"} />
    <MetricCard label="Receivable due" hint={report ? money.format(Number(report.receivable_due)) : "Loading live data…"} tone="amber" />
    <MetricCard label="Low-stock items" hint={report ? String(report.low_stock_items) : "Loading live data…"} tone="red" />
    <MetricCard label="Inventory value" hint={report ? money.format(Number(report.inventory_value)) : "Loading live data…"} tone="blue" />
  </div></>;
}
