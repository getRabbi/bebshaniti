"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase-browser";

type Statement = {
  customer: {
    id: string;
    name: string;
    phone?: string;
    address?: string;
    organization_name: string;
    organization_address?: string;
    organization_phone?: string;
    branch_name?: string;
  };
  date_from?: string;
  date_to?: string;
  opening_balance: number;
  total_due: number;
  total_paid: number;
  current_balance: number;
  closing_balance: number;
  ledger: Array<{
    id: string;
    entry_type: string;
    debit: number;
    credit: number;
    balance: number;
    note?: string;
    created_at: string;
  }>;
  sales: Array<{
    id: string;
    memo_no: string;
    grand_total: number;
    paid_total: number;
    due_total: number;
    completed_at: string;
  }>;
  payments: Array<{
    id: string;
    method: string;
    amount: number;
    payment_type: string;
    paid_at: string;
  }>;
};
function org() {
  return (
    document.cookie
      .split("; ")
      .find((part) => part.startsWith("organization_id="))
      ?.split("=")[1] ?? ""
  );
}

export function CustomerStatement({ customerId }: { customerId: string }) {
  const { t, locale } = useI18n();
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  });
  const [data, setData] = useState<Statement | null>(null);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [receipt, setReceipt] = useState(false);
  const load = useCallback(async () => {
    setError("");
    try {
      const { data: session } = await createClient().auth.getSession();
      if (!session.session) {
        location.assign("/login");
        return;
      }
      const query = new URLSearchParams();
      if (dateFrom) query.set("date_from", dateFrom);
      if (dateTo) query.set("date_to", dateTo);
      setData(
        await apiRequest<Statement>(
          `/customers/${customerId}/statement?${query}`,
          session.session.access_token,
          org(),
        ),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("loadError"));
    }
  }, [customerId, dateFrom, dateTo, t]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!data)
    return (
      <>
        {error ? (
          <div className="error module-error">
            {error}
            <button onClick={() => void load()}>{t("retry")}</button>
          </div>
        ) : (
          <div className="empty-state">{t("loading")}</div>
        )}
      </>
    );
  return (
    <>
      <div className="statement-toolbar no-print">
        <Link href="/customers">← {t("back")}</Link>
        <div className="statement-filters">
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
          <button className="filter-button" onClick={() => void load()}>
            {t("applyFilters")}
          </button>
          <label>
            <input
              type="checkbox"
              checked={receipt}
              onChange={(event) => setReceipt(event.target.checked)}
            />
            80mm
          </label>
          <button className="button" onClick={() => window.print()}>
            {t("savePdf")}
          </button>
        </div>
      </div>
      <article
        className={`customer-statement ${receipt ? "statement-80mm" : ""}`}
      >
        <header>
          <h1>{data.customer.organization_name}</h1>
          <p>{data.customer.organization_address}</p>
          <p>{data.customer.organization_phone}</p>
          <h2>{t("customerStatement")}</h2>
        </header>
        <div className="statement-parties">
          <div>
            <strong>{data.customer.name}</strong>
            <span>{data.customer.phone}</span>
            <span>{data.customer.address}</span>
          </div>
          <div>
            <span>
              {t("dateFrom")}:{" "}
              {data.date_from
                ? new Date(data.date_from).toLocaleDateString(locale)
                : "—"}
            </span>
            <span>
              {t("dateTo")}:{" "}
              {data.date_to
                ? new Date(data.date_to).toLocaleDateString(locale)
                : "—"}
            </span>
          </div>
        </div>
        <div className="statement-summary">
          <span>
            {t("totalDue")}
            <strong>{money.format(data.total_due)}</strong>
          </span>
          <span>
            {t("totalPaid")}
            <strong>{money.format(data.total_paid)}</strong>
          </span>
          <span>
            {t("currentBalance")}
            <strong>{money.format(data.current_balance)}</strong>
          </span>
        </div>
        <h3>{t("ledgerHistory")}</h3>
        <table>
          <thead>
            <tr>
              <th>{t("date")}</th>
              <th>{t("description")}</th>
              <th>{t("debit")}</th>
              <th>{t("credit")}</th>
              <th>{t("balance")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={2}>{t("openingBalance")}</td>
              <td />
              <td />
              <td>{money.format(data.opening_balance)}</td>
            </tr>
            {data.ledger.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.created_at).toLocaleDateString(locale)}</td>
                <td>
                  {row.entry_type}
                  {row.note ? ` · ${row.note}` : ""}
                </td>
                <td>{row.debit ? money.format(row.debit) : "—"}</td>
                <td>{row.credit ? money.format(row.credit) : "—"}</td>
                <td>{money.format(row.balance)}</td>
              </tr>
            ))}
            <tr className="statement-closing">
              <td colSpan={4}>{t("closingBalance")}</td>
              <td>{money.format(data.closing_balance)}</td>
            </tr>
          </tbody>
        </table>
        <div className="statement-history no-print">
          <section>
            <h3>{t("saleHistory")}</h3>
            {data.sales.map((sale) => (
              <Link href={`/sales/${sale.id}`} key={sale.id}>
                <span>{sale.memo_no}</span>
                <strong>{money.format(sale.grand_total)}</strong>
              </Link>
            ))}
          </section>
          <section>
            <h3>{t("paymentHistory")}</h3>
            {data.payments.map((payment) => (
              <div key={payment.id}>
                <span>
                  {payment.method} ·{" "}
                  {new Date(payment.paid_at).toLocaleDateString(locale)}
                </span>
                <strong>{money.format(payment.amount)}</strong>
              </div>
            ))}
          </section>
        </div>
      </article>
    </>
  );
}
