"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { createClient } from "@/lib/supabase-browser";
import { useI18n } from "@/lib/i18n";

type Product = {
  variant_id: string;
  name: string;
  name_bn?: string;
  sku: string;
  barcode?: string;
  retail_price: number;
  wholesale_price: number;
  stock_quantity: number;
};
type Customer = { id: string; name: string; phone?: string };
type CartLine = Product & {
  quantity: number;
  unitPrice: number;
  discount: number;
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
  const input = useRef<HTMLInputElement>(null);
  const [token, setToken] = useState("");
  const [org, setOrg] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [customer, setCustomer] = useState("");
  const [method, setMethod] = useState("cash");
  const [paid, setPaid] = useState(0);
  const [paidTouched, setPaidTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [accessChecked, setAccessChecked] = useState(false);
  const load = useCallback(async () => {
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
  const total = cart.reduce(
    (s, l) => s + l.quantity * l.unitPrice - l.discount,
    0,
  );
  const due = Math.max(0, total - paid);
  useEffect(() => {
    if (!paidTouched) setPaid(total);
  }, [paidTouched, total]);
  function add(p: Product) {
    setCart((lines) => {
      const exists = lines.find((l) => l.variant_id === p.variant_id);
      return exists
        ? lines.map((l) =>
            l.variant_id === p.variant_id
              ? { ...l, quantity: l.quantity + 1 }
              : l,
          )
        : [
            ...lines,
            {
              ...p,
              quantity: 1,
              unitPrice: Number(p.retail_price),
              discount: 0,
            },
          ];
    });
    setQuery("");
    input.current?.focus();
  }
  async function complete(action: "memo" | "print" | "new") {
    if (!cart.length) return;
    setSaving(true);
    setError(null);
    try {
      const sale = await apiRequest<{ id: string }>("/sales", token, org, {
        method: "POST",
        body: JSON.stringify({
          customer_id: customer || null,
          items: cart.map((l) => ({
            product_variant_id: l.variant_id,
            quantity: l.quantity,
            unit_price: l.unitPrice,
            discount: l.discount,
          })),
          paid_amount: paid,
          payment_method: method,
        }),
      });
      localStorage.setItem("last-sale-id", sale.id);
      if (action === "new") {
        setCart([]);
        setCustomer("");
        setPaidTouched(false);
        setPaid(0);
        input.current?.focus();
      } else
        router.push(
          `/sales/${sale.id}/${action === "print" ? "print" : "memo"}`,
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : t("saveError"));
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
          {error} <button onClick={() => void load()}>{t("retry")}</button>
        </div>
      ) : null}
      <div className="pos-layout">
        <section className="panel pos-catalog">
          <label className="pos-search">
            <span>{t("searchProduct")}</span>
            <input
              ref={input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches[0]) add(matches[0]);
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
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={line.quantity}
                    onChange={(e) =>
                      setCart((c) =>
                        c.map((x) =>
                          x.variant_id === line.variant_id
                            ? { ...x, quantity: Number(e.target.value) }
                            : x,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label={t("sellingPrice")}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    disabled={!permissions.includes("sales.price_override")}
                    onChange={(e) =>
                      setCart((c) =>
                        c.map((x) =>
                          x.variant_id === line.variant_id
                            ? { ...x, unitPrice: Number(e.target.value) }
                            : x,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label={t("discount")}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.discount}
                    disabled={!permissions.includes("sales.discount")}
                    onChange={(event) =>
                      setCart((current) =>
                        current.map((item) =>
                          item.variant_id === line.variant_id
                            ? { ...item, discount: Number(event.target.value) }
                            : item,
                        ),
                      )
                    }
                  />
                  <strong>
                    {money.format(
                      line.quantity * line.unitPrice - line.discount,
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
            <label>
              <span>{t("optionalCustomer")}</span>
              <select
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
              >
                <option value="">{t("walkIn")}</option>
                {customers.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name} {c.phone ? `· ${c.phone}` : ""}
                  </option>
                ))}
              </select>
            </label>
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
                type="number"
                min="0"
                max={total}
                step="0.01"
                value={paid}
                onChange={(e) => {
                  setPaidTouched(true);
                  setPaid(Number(e.target.value));
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
          {due > 0 && !customer ? (
            <p className="price-warning">{t("dueCustomerWarning")}</p>
          ) : null}
          <div className="pos-actions">
            <button
              className="button secondary"
              disabled={saving || !cart.length || Boolean(due && !customer)}
              onClick={() => void complete("new")}
            >
              {t("completeNew")}
            </button>
            <button
              className="button secondary"
              disabled={saving || !cart.length || Boolean(due && !customer)}
              onClick={() => void complete("print")}
            >
              {t("completePrint")}
            </button>
            <button
              className="button"
              disabled={saving || !cart.length || Boolean(due && !customer)}
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
