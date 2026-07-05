"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase-browser";

type Item = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  line_total: number;
  unit_symbol?: string;
};
type Memo = {
  id: string;
  memo_no: string;
  organization_name: string;
  organization_address?: string;
  organization_phone?: string;
  branch_address?: string;
  branch_phone?: string;
  customer_name?: string;
  customer_phone?: string;
  cashier_name: string;
  completed_at: string;
  status: string;
  subtotal: number;
  discount_total: number;
  vat_total: number;
  grand_total: number;
  paid_total: number;
  due_total: number;
  receipt_size: string;
  invoice_footer?: string;
  footer_note?: string;
  items: Item[];
  returns: Array<{
    id: string;
    return_no: string;
    return_total: number;
    created_at: string;
  }>;
  void_event?: { id: string; reason: string; created_at: string };
};
function org() {
  return (
    document.cookie
      .split("; ")
      .find((part) => part.startsWith("organization_id="))
      ?.split("=")[1] ?? ""
  );
}

export function CashMemo({
  saleId,
  autoPrint = false,
}: {
  saleId: string;
  autoPrint?: boolean;
}) {
  const { t, locale } = useI18n();
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  });
  const [memo, setMemo] = useState<Memo | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [action, setAction] = useState<"void" | "return" | null>(null);
  const [reason, setReason] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const statusLabel =
    {
      draft: t("statusDraft"),
      completed: t("statusCompleted"),
      cancelled: t("statusCancelled"),
      void: t("statusVoid"),
      returned: t("statusReturned"),
      partially_returned: t("statusPartiallyReturned"),
      pending: t("statusPending"),
    }[memo?.status ?? ""] ?? memo?.status;
  const load = useCallback(async () => {
    setError("");
    try {
      const { data } = await createClient().auth.getSession();
      if (!data.session) {
        location.assign("/login");
        return;
      }
      const [sale, current] = await Promise.all([
        apiRequest<Memo>(
          `/sales/${saleId}/memo`,
          data.session.access_token,
          org(),
        ),
        apiRequest<{ permissions: string[] }>(
          "/organizations/current",
          data.session.access_token,
          org(),
        ),
      ]);
      setMemo(sale);
      setPermissions(current.permissions ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("loadError"));
    }
  }, [saleId, t]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (memo && autoPrint) setTimeout(() => window.print(), 250);
  }, [autoPrint, memo]);
  async function submitAction() {
    if (!action || !memo || reason.trim().length < 3) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await createClient().auth.getSession();
      if (!data.session) return;
      if (action === "void")
        await apiRequest(
          `/sales/${saleId}/void`,
          data.session.access_token,
          org(),
          {
            method: "POST",
            body: JSON.stringify({ reason, refund_method: "cash" }),
          },
        );
      else {
        const items = memo.items
          .filter((item) => (quantities[item.id] ?? 0) > 0)
          .map((item) => ({
            sale_item_id: item.id,
            quantity: quantities[item.id],
          }));
        if (!items.length) {
          setError(t("returnQuantity"));
          return;
        }
        await apiRequest(
          `/sales/${saleId}/returns`,
          data.session.access_token,
          org(),
          {
            method: "POST",
            body: JSON.stringify({ reason, refund_method: "cash", items }),
          },
        );
      }
      setAction(null);
      setReason("");
      setQuantities({});
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }
  if (error && !memo)
    return (
      <div className="error module-error">
        {error}
        <button onClick={() => void load()}>{t("retry")}</button>
      </div>
    );
  if (!memo) return <div className="empty-state">{t("loading")}</div>;
  return (
    <>
      {error ? (
        <div className="error module-error no-print">{error}</div>
      ) : null}
      <div className="memo-toolbar no-print">
        <Link href="/sales">← {t("back")}</Link>
        <div>
          {memo.status !== "void" && permissions.includes("sales.return") ? (
            <button onClick={() => setAction("return")}>
              {t("returnItems")}
            </button>
          ) : null}
          {memo.status === "completed" && permissions.includes("sales.void") ? (
            <button className="danger" onClick={() => setAction("void")}>
              {t("voidSale")}
            </button>
          ) : null}
          <button onClick={() => window.print()}>{t("savePdf")}</button>
          <button className="button" onClick={() => window.print()}>
            {t("directPrint")}
          </button>
        </div>
      </div>
      <article className={`cash-memo receipt-${memo.receipt_size}`}>
        <header>
          <h1>{memo.organization_name}</h1>
          <p>{memo.branch_address || memo.organization_address}</p>
          <p>{memo.branch_phone || memo.organization_phone}</p>
          <h2>{t("cashMemo")}</h2>
        </header>
        <div className="memo-meta">
          <span>
            {t("memoNumber")}: <strong>{memo.memo_no}</strong>
          </span>
          <span>
            {t("date")}: {new Date(memo.completed_at).toLocaleString(locale)}
          </span>
          <span>
            {t("cashier")}: {memo.cashier_name || "—"}
          </span>
          <span>
            {t("customers")}: {memo.customer_name || t("walkIn")}{" "}
            {memo.customer_phone || ""}
          </span>
          <span>
            {t("status")}: <strong>{statusLabel}</strong>
          </span>
        </div>
        <table>
          <thead>
            <tr>
              <th>{t("products")}</th>
              <th>{t("quantity")}</th>
              <th>{t("sellingPrice")}</th>
              <th>{t("discount")}</th>
              <th>{t("grandTotal")}</th>
            </tr>
          </thead>
          <tbody>
            {memo.items.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td>
                  {Number(item.quantity)} {item.unit_symbol}
                </td>
                <td>{money.format(item.unit_price)}</td>
                <td>{money.format(item.discount)}</td>
                <td>{money.format(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="memo-totals">
          <span>
            {t("subtotal")}
            <strong>{money.format(memo.subtotal)}</strong>
          </span>
          <span>
            {t("discount")}
            <strong>{money.format(memo.discount_total)}</strong>
          </span>
          <span>
            {t("vat")}
            <strong>{money.format(memo.vat_total)}</strong>
          </span>
          <span className="grand">
            {t("grandTotal")}
            <strong>{money.format(memo.grand_total)}</strong>
          </span>
          <span>
            {t("totalPaid")}
            <strong>{money.format(memo.paid_total)}</strong>
          </span>
          <span>
            {t("due")}
            <strong>{money.format(memo.due_total)}</strong>
          </span>
        </div>
        {memo.returns.length ? (
          <div className="memo-events">
            <h3>{t("returnItems")}</h3>
            {memo.returns.map((item) => (
              <p key={item.id}>
                {item.return_no} · {money.format(item.return_total)}
              </p>
            ))}
          </div>
        ) : null}
        {memo.void_event ? (
          <div className="memo-events danger">
            <h3>{t("voidSale")}</h3>
            <p>{memo.void_event.reason}</p>
          </div>
        ) : null}
        <footer>
          <p>{memo.footer_note || memo.invoice_footer || t("thankYou")}</p>
          <small>{t("generatedBy")}</small>
        </footer>
      </article>
      {action ? (
        <div className="modal-backdrop no-print">
          <section className="panel action-modal">
            <div className="panel-header">
              <h2>{action === "void" ? t("voidSale") : t("returnItems")}</h2>
              <button onClick={() => setAction(null)}>×</button>
            </div>
            {action === "return" ? (
              <div className="return-items">
                {memo.items.map((item) => (
                  <label key={item.id}>
                    <span>
                      {item.description}
                      <small>
                        {t("quantity")}: {item.quantity}
                      </small>
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={item.quantity}
                      step="0.0001"
                      value={quantities[item.id] ?? 0}
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [item.id]: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            ) : null}
            <label className="field">
              <span>{t("reason")} *</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={3}
              />
            </label>
            <label className="field">
              <span>{t("refundMethod")}</span>
              <select disabled>
                <option>Cash</option>
              </select>
            </label>
            <div className="form-actions">
              <button onClick={() => setAction(null)}>{t("cancel")}</button>
              <button
                className="button danger"
                disabled={saving || reason.trim().length < 3}
                onClick={() => void submitAction()}
              >
                {saving
                  ? t("loading")
                  : action === "void"
                    ? t("confirmVoid")
                    : t("confirmReturn")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
