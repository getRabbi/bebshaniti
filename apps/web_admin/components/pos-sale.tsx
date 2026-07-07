"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PosCustomerSelector,
  type PosCustomer,
} from "@/components/pos-customer-selector";
import { apiRequest } from "@/lib/api";
import { createClient } from "@/lib/supabase-browser";
import { useI18n } from "@/lib/i18n";
import { normalizeNumericInput, parseLocalizedNumber } from "@/lib/numbers";

type Product = {
  id: string;
  variant_id: string;
  name: string;
  name_bn?: string;
  sku: string;
  barcode?: string;
  retail_price: number;
  wholesale_price: number;
  stock_quantity: number;
};
type Customer = PosCustomer;
type CartLine = Product & {
  quantity: string;
  unitPrice: string;
  discount: string;
};
function orgCookie() {
  return (
    document.cookie
      .split("; ")
      .find((p) => p.startsWith("organization_id="))
      ?.split("=")[1] ?? ""
  );
}

export function PosSale() {
  const { t, locale } = useI18n();
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  });
  const router = useRouter();
  const searchParams = useSearchParams();
  const input = useRef<HTMLInputElement>(null);
  const preselectedProduct = useRef("");
  const [token, setToken] = useState("");
  const [org, setOrg] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [customer, setCustomer] = useState("");
  const [method, setMethod] = useState("cash");
  const [paid, setPaid] = useState("");
  const [paidTouched, setPaidTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [accessChecked, setAccessChecked] = useState(false);
  const [notice, setNotice] = useState("");
  const [memoFailure, setMemoFailure] = useState<{
    saleId: string;
    memoNo?: string;
  } | null>(null);
  const load = useCallback(async () => {
    setLoadFailed(false);
    setError(null);
    try {
      const { data } = await createClient().auth.getSession();
      if (!data.session) {
        location.assign("/login");
        return;
      }
      setToken(data.session.access_token);
      const orgs = await apiRequest<Array<{ id: string }>>(
        "/organizations",
        data.session.access_token,
      );
      const id = orgs.some((o) => o.id === orgCookie())
        ? orgCookie()
        : orgs[0]?.id;
      if (!id) {
        location.assign("/onboarding");
        return;
      }
      setOrg(id);
      const [p, c, context] = await Promise.all([
        apiRequest<Product[]>(
          "/products?limit=500",
          data.session.access_token,
          id,
        ),
        apiRequest<Customer[]>(
          "/customers?limit=500",
          data.session.access_token,
          id,
        ),
        apiRequest<{ permissions: string[] }>(
          "/organizations/current",
          data.session.access_token,
          id,
        ),
      ]);
      setProducts(p);
      setCustomers(c);
      setPermissions(context.permissions);
    } catch (e) {
      setLoadFailed(true);
      setError(e instanceof Error ? e.message : t("loadError"));
    } finally {
      setAccessChecked(true);
    }
  }, [t]);
  useEffect(() => {
    void load();
    input.current?.focus();
  }, [load]);
  const matches = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return products.slice(0, 12);
    return products
      .filter((p) =>
        [p.name, p.name_bn, p.sku, p.barcode].some((x) =>
          String(x ?? "")
            .toLowerCase()
            .includes(q),
        ),
      )
      .slice(0, 12);
  }, [products, query]);
  function firstMatch(value: string) {
    const normalized = value.toLowerCase().trim();
    if (!normalized) return products[0];
    return products.find((product) =>
      [product.name, product.name_bn, product.sku, product.barcode].some(
        (field) =>
          String(field ?? "")
            .toLowerCase()
            .includes(normalized),
      ),
    );
  }
  const total = useMemo(
    () =>
      cart.reduce(
        (sum, line) =>
          sum +
          parseLocalizedNumber(line.quantity) *
            parseLocalizedNumber(line.unitPrice) -
          parseLocalizedNumber(line.discount),
        0,
      ),
    [cart],
  );
  const paidValue = parseLocalizedNumber(paid);
  const due = Math.max(0, total - paidValue);
  const paymentValid =
    paid.trim() !== "" &&
    Number.isFinite(paidValue) &&
    paidValue >= 0 &&
    paidValue <= total;
  const customerRequired = total > 0 && due > 0;
  const blockingReason = !cart.length
    ? t("cartEmptyError")
    : !paymentValid
      ? t("invalidPaymentError")
      : customerRequired && !customer
        ? t("dueCustomerWarning")
        : "";
  useEffect(() => {
    if (!paidTouched) setPaid(String(total));
  }, [paidTouched, total]);
  const add = useCallback((p: Product) => {
    setCart((lines) => {
      const exists = lines.find((l) => l.variant_id === p.variant_id);
      return exists
        ? lines.map((l) =>
            l.variant_id === p.variant_id
              ? { ...l, quantity: String(parseLocalizedNumber(l.quantity) + 1) }
              : l,
          )
        : [
            ...lines,
            {
              ...p,
              quantity: "1",
              unitPrice: String(Number(p.retail_price)),
              discount: "0",
            },
          ];
    });
    setQuery("");
    input.current?.focus();
  }, []);
  useEffect(() => {
    const requestedId = searchParams.get("product") ?? "";
    if (!requestedId || preselectedProduct.current === requestedId) return;
    const product = products.find((item) => item.id === requestedId);
    if (!product) return;
    preselectedProduct.current = requestedId;
    add(product);
  }, [add, products, searchParams]);
  async function complete(action: "memo" | "print" | "new") {
    if (blockingReason) {
      setError(blockingReason);
      return;
    }
    setSaving(true);
    setLoadFailed(false);
    setError(null);
    setNotice("");
    setMemoFailure(null);
    try {
      const sale = await apiRequest<{ id: string; memo_no?: string }>(
        "/sales",
        token,
        org,
        {
          method: "POST",
          body: JSON.stringify({
            customer_id: customer || null,
            items: cart.map((l) => ({
              product_variant_id: l.variant_id,
              quantity: parseLocalizedNumber(l.quantity),
              unit_price: parseLocalizedNumber(l.unitPrice),
              discount: parseLocalizedNumber(l.discount),
            })),
            paid_amount: paidValue,
            payment_method: method,
          }),
        },
      );
      localStorage.setItem("last-sale-id", sale.id);
      if (action === "new") {
        setCart([]);
        setCustomer("");
        setPaidTouched(false);
        setPaid("");
        setNotice(
          sale.memo_no
            ? `${t("cashMemo")}: ${sale.memo_no}`
            : t("statusCompleted"),
        );
        input.current?.focus();
      } else {
        try {
          await apiRequest(`/sales/${sale.id}/memo`, token, org);
          router.push(
            `/sales/${sale.id}/${action === "print" ? "print" : "memo"}`,
          );
        } catch {
          setCart([]);
          setCustomer("");
          setPaidTouched(false);
          setPaid("");
          setMemoFailure({ saleId: sale.id, memoNo: sale.memo_no });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("saleFailedError"));
    } finally {
      setSaving(false);
    }
  }
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        void complete("memo");
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  });
  if (accessChecked && !permissions.includes("sales.create")) {
    return <div className="error module-error">{t("permissionDenied")}</div>;
  }
  return (
    <>
      <header className="page-header">
        <div>
          <p className="page-eyebrow">FAST POS</p>
          <h1>{t("newSale")}</h1>
          <p className="page-description">{t("posIntro")}</p>
        </div>
      </header>
      {error ? (
        <div className="error module-error">
          <span>{error}</span>
          {loadFailed ? (
            <button onClick={() => void load()}>{t("retry")}</button>
          ) : null}
        </div>
      ) : null}
      {notice ? (
        <div className="success module-notice" role="status">
          {notice}
        </div>
      ) : null}
      {memoFailure ? (
        <div className="error module-error" role="alert">
          <span>
            {t("saleCompletedMemoFailed")}
            {memoFailure.memoNo ? ` (${memoFailure.memoNo})` : ""}
          </span>
          <Link href={`/sales/${memoFailure.saleId}/memo`}>
            {t("retryMemo")}
          </Link>
        </div>
      ) : null}
      <div className="pos-layout">
        <section className="panel pos-catalog">
          <label className="pos-search">
            <span>{t("searchProduct")}</span>
            <input
              ref={input}
              value={query}
              disabled={!accessChecked || !org}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const product = firstMatch(e.currentTarget.value);
                if (product) add(product);
              }}
              placeholder={t("productSearchPlaceholder")}
            />
          </label>
          <div className="pos-products">
            {matches.map((p) => (
              <button type="button" key={p.variant_id} onClick={() => add(p)}>
                <strong>{p.name_bn || p.name}</strong>
                <span>
                  {p.sku}
                  {p.barcode ? ` · ${p.barcode}` : ""}
                </span>
                <small>
                  {money.format(Number(p.retail_price))} · {t("stock")}{" "}
                  {Number(p.stock_quantity || 0)}
                </small>
              </button>
            ))}
          </div>
        </section>
        <section className="panel pos-cart">
          <div className="panel-header">
            <h2>{t("cart")}</h2>
            <span>
              {cart.length} {t("items")}
            </span>
          </div>
          {cart.length ? (
            <div className="cart-lines">
              {cart.map((line) => (
                <div className="cart-line" key={line.variant_id}>
                  <div>
                    <strong>{line.name_bn || line.name}</strong>
                    <small>{line.sku}</small>
                  </div>
                  <input
                    aria-label={t("quantity")}
                    type="text"
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(e) =>
                      setCart((c) =>
                        c.map((x) =>
                          x.variant_id === line.variant_id
                            ? {
                                ...x,
                                quantity: normalizeNumericInput(e.target.value),
                              }
                            : x,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label={t("sellingPrice")}
                    type="text"
                    inputMode="decimal"
                    value={line.unitPrice}
                    disabled={!permissions.includes("sales.price_override")}
                    onChange={(e) =>
                      setCart((c) =>
                        c.map((x) =>
                          x.variant_id === line.variant_id
                            ? {
                                ...x,
                                unitPrice: normalizeNumericInput(
                                  e.target.value,
                                ),
                              }
                            : x,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label={t("discount")}
                    type="text"
                    inputMode="decimal"
                    value={line.discount}
                    disabled={!permissions.includes("sales.discount")}
                    onChange={(event) =>
                      setCart((current) =>
                        current.map((item) =>
                          item.variant_id === line.variant_id
                            ? {
                                ...item,
                                discount: normalizeNumericInput(
                                  event.target.value,
                                ),
                              }
                            : item,
                        ),
                      )
                    }
                  />
                  <strong>
                    {money.format(
                      parseLocalizedNumber(line.quantity) *
                        parseLocalizedNumber(line.unitPrice) -
                        parseLocalizedNumber(line.discount),
                    )}
                  </strong>
                  <button
                    onClick={() =>
                      setCart((c) =>
                        c.filter((x) => x.variant_id !== line.variant_id),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>{t("emptyCart")}</h2>
              <p>{t("addFromLeft")}</p>
            </div>
          )}
          <div className="checkout-fields">
            <PosCustomerSelector
              customers={customers}
              selectedId={customer}
              onSelect={setCustomer}
              onCustomerCreated={(created) => {
                setCustomers((current) => [...current, created]);
                setCustomer(created.id);
                setNotice(t("customerCreated"));
              }}
              accessToken={token}
              organizationId={org}
              canCreate={permissions.includes("customers.create")}
              required={customerRequired}
              onDone={() => input.current?.focus()}
            />
            <label>
              <span>{t("payment")}</span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="cash">{t("cash")}</option>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="card">{t("card")}</option>
                <option value="bank">{t("bank")}</option>
              </select>
            </label>
            <label>
              <span>{t("paidAmount")}</span>
              <input
                type="text"
                inputMode="decimal"
                value={paid}
                onChange={(e) => {
                  setPaidTouched(true);
                  setPaid(normalizeNumericInput(e.target.value));
                }}
              />
            </label>
          </div>
          <div className="checkout-total">
            <span>
              {t("grandTotal")} <strong>{money.format(total)}</strong>
            </span>
            <span className={due > 0 ? "due-total" : ""}>
              {t("due")} <strong>{money.format(due)}</strong>
            </span>
          </div>
          {blockingReason && blockingReason !== t("dueCustomerWarning") ? (
            <p className="completion-reason" role="status">
              {blockingReason}
            </p>
          ) : null}
          <div className="pos-actions">
            <button
              className="button secondary"
              disabled={saving || Boolean(blockingReason)}
              onClick={() => void complete("new")}
            >
              {t("completeNew")}
            </button>
            <button
              className="button secondary"
              disabled={saving || Boolean(blockingReason)}
              onClick={() => void complete("print")}
            >
              {t("completePrint")}
            </button>
            <button
              className="button"
              disabled={saving || Boolean(blockingReason)}
              onClick={() => void complete("memo")}
            >
              {saving ? t("completing") : t("completeSale")}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
