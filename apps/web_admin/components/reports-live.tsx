"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { createClient } from "@/lib/supabase-browser";

type Sales = {
  best_sellers: Array<{ description: string; quantity: number; sales: number }>;
  payment_methods: Array<{ method: string; amount: number }>;
};
type Due = {
  customers: Array<{
    id: string;
    name: string;
    phone?: string;
    balance: number;
  }>;
};
type Profit = {
  net_sales: number;
  gross_profit: number;
  tax_total: number;
  profit_margin: number;
};
const money = new Intl.NumberFormat("bn-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 2,
});
function org() {
  return (
    document.cookie
      .split("; ")
      .find((p) => p.startsWith("organization_id="))
      ?.split("=")[1] ?? ""
  );
}
export function ReportsLive() {
  const [sales, setSales] = useState<Sales | null>(null);
  const [due, setDue] = useState<Due | null>(null);
  const [profit, setProfit] = useState<Profit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await createClient().auth.getSession();
      if (!data.session) return;
      const id = org();
      const [s, d, p] = await Promise.all([
        apiRequest<Sales>("/reports/sales", data.session.access_token, id),
        apiRequest<Due>("/reports/due", data.session.access_token, id),
        apiRequest<Profit>("/reports/profit", data.session.access_token, id),
      ]);
      setSales(s);
      setDue(d);
      setProfit(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "রিপোর্ট লোড করা যায়নি।");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <>
      {error ? (
        <div className="error module-error">
          {error}
          <button onClick={() => void load()}>আবার চেষ্টা করুন</button>
        </div>
      ) : null}
      <div className="settings-grid report-summary">
        <article className="settings-card">
          <div>
            <h2>৩০ দিনের নেট বিক্রয়</h2>
            <p>{profit ? money.format(profit.net_sales) : "লোড হচ্ছে…"}</p>
            <small>VAT বাদে, ডিসকাউন্টের পরে</small>
          </div>
        </article>
        <article className="settings-card">
          <div>
            <h2>গ্রস লাভ</h2>
            <p>{profit ? money.format(profit.gross_profit) : "লোড হচ্ছে…"}</p>
            <small>লাভের হার {profit ? `${profit.profit_margin}%` : "—"}</small>
          </div>
        </article>
        <article className="settings-card">
          <div>
            <h2>VAT</h2>
            <p>{profit ? money.format(profit.tax_total) : "লোড হচ্ছে…"}</p>
            <small>সম্পন্ন বিক্রয় থেকে</small>
          </div>
        </article>
      </div>
      <div className="dashboard-grid">
        <section className="panel report-table">
          <div className="panel-header">
            <h2>সেরা বিক্রিত পণ্য</h2>
          </div>
          {sales?.best_sellers.length ? (
            <table>
              <tbody>
                {sales.best_sellers.map((x) => (
                  <tr key={x.description}>
                    <td>{x.description}</td>
                    <td>{Number(x.quantity)}</td>
                    <td>{money.format(x.sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty-copy">এখনও বিক্রয় তথ্য নেই।</p>
          )}
        </section>
        <section className="panel report-table">
          <div className="panel-header">
            <h2>শীর্ষ বাকি কাস্টমার</h2>
          </div>
          {due?.customers.length ? (
            <table>
              <tbody>
                {due.customers.slice(0, 10).map((x) => (
                  <tr key={x.id}>
                    <td>
                      {x.name}
                      <small>{x.phone}</small>
                    </td>
                    <td>{money.format(x.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty-copy">কোনো বাকি নেই।</p>
          )}
        </section>
      </div>
    </>
  );
}
