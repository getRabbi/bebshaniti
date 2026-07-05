"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { createClient } from "@/lib/supabase-browser";

type Memo = {
  id: string;
  memo_no: string;
  organization_name: string;
  organization_address?: string;
  organization_phone?: string;
  branch_name: string;
  branch_address?: string;
  branch_phone?: string;
  customer_name?: string;
  customer_phone?: string;
  cashier_name: string;
  completed_at: string;
  subtotal: number;
  discount_total: number;
  vat_total: number;
  grand_total: number;
  paid_total: number;
  due_total: number;
  payment_status: string;
  receipt_size: string;
  invoice_footer?: string;
  footer_note?: string;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    discount: number;
    line_total: number;
    unit_symbol?: string;
  }>;
  payments: Array<{ method: string; amount: number }>;
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
export function CashMemo({
  saleId,
  autoPrint = false,
}: {
  saleId: string;
  autoPrint?: boolean;
}) {
  const [memo, setMemo] = useState<Memo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const { data } = await createClient().auth.getSession();
      if (!data.session) {
        location.assign("/login");
        return;
      }
      setMemo(
        await apiRequest<Memo>(
          `/sales/${saleId}/memo`,
          data.session.access_token,
          org(),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "মেমো লোড করা যায়নি।");
    }
  }, [saleId]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (memo && autoPrint) setTimeout(() => window.print(), 250);
  }, [autoPrint, memo]);
  if (error)
    return (
      <div className="error module-error">
        {error} <button onClick={() => void load()}>আবার চেষ্টা করুন</button>
      </div>
    );
  if (!memo) return <div className="empty-state">মেমো লোড হচ্ছে…</div>;
  return (
    <>
      <div className="memo-toolbar no-print">
        <Link href="/sales">← বিক্রয় তালিকা</Link>
        <div>
          <button onClick={() => window.print()}>PDF / প্রিন্ট</button>
          <button className="button" onClick={() => window.print()}>
            সরাসরি প্রিন্ট
          </button>
        </div>
      </div>
      <article className={`cash-memo receipt-${memo.receipt_size}`}>
        <header>
          <h1>{memo.organization_name}</h1>
          <p>{memo.branch_address || memo.organization_address}</p>
          <p>{memo.branch_phone || memo.organization_phone}</p>
          <h2>ক্যাশ মেমো</h2>
        </header>
        <div className="memo-meta">
          <span>
            মেমো: <strong>{memo.memo_no}</strong>
          </span>
          <span>
            তারিখ: {new Date(memo.completed_at).toLocaleString("bn-BD")}
          </span>
          <span>ক্যাশিয়ার: {memo.cashier_name || "—"}</span>
          <span>
            কাস্টমার: {memo.customer_name || "ওয়াক-ইন"}{" "}
            {memo.customer_phone || ""}
          </span>
        </div>
        <table>
          <thead>
            <tr>
              <th>পণ্য</th>
              <th>পরিমাণ</th>
              <th>দর</th>
              <th>ছাড়</th>
              <th>মোট</th>
            </tr>
          </thead>
          <tbody>
            {memo.items.map((i) => (
              <tr key={i.id}>
                <td>{i.description}</td>
                <td>
                  {Number(i.quantity)} {i.unit_symbol}
                </td>
                <td>{money.format(i.unit_price)}</td>
                <td>{money.format(i.discount)}</td>
                <td>{money.format(i.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="memo-totals">
          <span>
            সাবটোটাল <strong>{money.format(memo.subtotal)}</strong>
          </span>
          <span>
            ছাড় <strong>{money.format(memo.discount_total)}</strong>
          </span>
          <span>
            VAT <strong>{money.format(memo.vat_total)}</strong>
          </span>
          <span className="grand">
            সর্বমোট <strong>{money.format(memo.grand_total)}</strong>
          </span>
          <span>
            পরিশোধ <strong>{money.format(memo.paid_total)}</strong>
          </span>
          <span>
            বাকি <strong>{money.format(memo.due_total)}</strong>
          </span>
        </div>
        <footer>
          <p>
            {memo.footer_note ||
              memo.invoice_footer ||
              "আমাদের সাথে কেনাকাটার জন্য ধন্যবাদ।"}
          </p>
          <small>Business OS দ্বারা তৈরি · পুনরায় প্রিন্টযোগ্য</small>
        </footer>
      </article>
    </>
  );
}
