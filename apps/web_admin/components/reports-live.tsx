"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase-browser";

type Sales = {
  best_sellers: Array<{ description: string; quantity: number; sales: number }>;
  payment_methods: Array<{
    method: string;
    amount: number;
    transactions: number;
  }>;
  daily: Array<{
    date: string;
    transactions: number;
    sales: number;
    profit: number;
    due: number;
  }>;
};
type Due = {
  customers: Array<{
    id: string;
    name: string;
    phone?: string;
    balance: number;
  }>;
  receivable_due: number;
};
type Profit = {
  net_sales: number;
  gross_profit: number;
  tax_total: number;
  profit_margin: number;
};
type Inventory = {
  items: Array<{
    name: string;
    name_bn?: string;
    sku: string;
    quantity: number;
    stock_value: number;
    low_stock: boolean;
  }>;
  inventory_value: number;
  low_stock_count: number;
};
type Branch = { id: string; name: string };
function org() {
  return (
    document.cookie
      .split("; ")
      .find((part) => part.startsWith("organization_id="))
      ?.split("=")[1] ?? ""
  );
}
export function ReportsLive() {
  const { t, locale } = useI18n();
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  });
  const [sales, setSales] = useState<Sales | null>(null);
  const [due, setDue] = useState<Due | null>(null);
  const [profit, setProfit] = useState<Profit | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [branch, setBranch] = useState("");
  const [method, setMethod] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const { data } = await createClient().auth.getSession();
      if (!data.session) return;
      const base = new URLSearchParams();
      if (dateFrom) base.set("date_from", dateFrom);
      if (dateTo) base.set("date_to", dateTo);
      if (branch) base.set("branch_id", branch);
      if (method) base.set("payment_method", method);
      const inventoryQuery = new URLSearchParams();
      if (branch) inventoryQuery.set("branch_id", branch);
      const [s, d, p, i, b] = await Promise.all([
        apiRequest<Sales>(
          `/reports/sales?${base}`,
          data.session.access_token,
          org(),
        ),
        apiRequest<Due>(
          `/reports/due?${inventoryQuery}`,
          data.session.access_token,
          org(),
        ),
        apiRequest<Profit>(
          `/reports/profit?${base}`,
          data.session.access_token,
          org(),
        ),
        apiRequest<Inventory>(
          `/reports/inventory?${inventoryQuery}`,
          data.session.access_token,
          org(),
        ),
        apiRequest<Branch[]>("/branches", data.session.access_token, org()),
      ]);
      setSales(s);
      setDue(d);
      setProfit(p);
      setInventory(i);
      setBranches(b);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("loadError"));
    }
  }, [branch, dateFrom, dateTo, method, t]);
  useEffect(() => {
    void load();
  }, [load]);
  function exportCsv() {
    if (!sales) return;
    const rows = [
      ["date", "transactions", "sales", "profit", "due"],
      ...sales.daily.map((item) => [
        item.date,
        item.transactions,
        item.sales,
        item.profit,
        item.due,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "sales-report.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
  return (
    <>
      {error ? (
        <div className="error module-error">
          {error}
          <button onClick={() => void load()}>{t("retry")}</button>
        </div>
      ) : null}
      <section className="panel report-filters no-print">
        <label>
          {t("dateFrom")}
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </label>
        <label>
          {t("dateTo")}
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </label>
        <label>
          {t("branch")}
          <select
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
          >
            <option value="">{t("all")}</option>
            {branches.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("paymentMethod")}
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value)}
          >
            <option value="">{t("all")}</option>
            {["cash", "bkash", "nagad", "card", "bank"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <button className="button" onClick={() => void load()}>
          {t("applyFilters")}
        </button>
        <button className="filter-button" onClick={exportCsv} disabled={!sales}>
          {t("exportCsv")}
        </button>
      </section>
      <div className="settings-grid report-summary">
        <article className="settings-card">
          <div>
            <h2>{t("profitSummary")}</h2>
            <p>{profit ? money.format(profit.gross_profit) : t("loading")}</p>
            <small>
              {t("profitMargin")}: {profit?.profit_margin ?? 0}%
            </small>
          </div>
        </article>
        <article className="settings-card">
          <div>
            <h2>{t("inventoryValue")}</h2>
            <p>
              {inventory
                ? money.format(inventory.inventory_value)
                : t("loading")}
            </p>
            <small>
              {t("lowStockProducts")}: {inventory?.low_stock_count ?? 0}
            </small>
          </div>
        </article>
        <article className="settings-card">
          <div>
            <h2>{t("totalDue")}</h2>
            <p>{due ? money.format(due.receivable_due) : t("loading")}</p>
          </div>
        </article>
      </div>
      <div className="dashboard-grid">
        <ReportTable
          title={t("bestSelling")}
          rows={
            sales?.best_sellers.map((item) => [
              item.description,
              String(item.quantity),
              money.format(item.sales),
            ]) ?? []
          }
        />
        <ReportTable
          title={t("topDue")}
          rows={
            due?.customers
              .slice(0, 10)
              .map((item) => [
                item.name,
                item.phone ?? "",
                money.format(item.balance),
              ]) ?? []
          }
        />
        <ReportTable
          title={t("lowStockProducts")}
          rows={
            inventory?.items
              .filter((item) => item.low_stock)
              .slice(0, 10)
              .map((item) => [
                item.name_bn || item.name,
                item.sku,
                String(item.quantity),
              ]) ?? []
          }
        />
        <ReportTable
          title={t("paymentMethod")}
          rows={
            sales?.payment_methods.map((item) => [
              item.method,
              String(item.transactions),
              money.format(item.amount),
            ]) ?? []
          }
        />
      </div>
    </>
  );
}
function ReportTable({ title, rows }: { title: string; rows: string[][] }) {
  const { t } = useI18n();
  return (
    <section className="panel report-table">
      <div className="panel-header">
        <h2>{title}</h2>
      </div>
      {rows.length ? (
        <table>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row[0]}-${index}`}>
                {row.map((value, column) => (
                  <td key={column}>{value}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty-copy">{t("noData")}</p>
      )}
    </section>
  );
}
