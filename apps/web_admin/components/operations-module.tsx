"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase-browser";
import {
  ProductImageManager,
  ProductImagePicker,
  uploadProductImage,
} from "@/components/product-image";

export type ModuleKind =
  | "products"
  | "inventory"
  | "sales"
  | "customers"
  | "due";
type Row = Record<string, unknown>;
type Metadata = {
  categories: Array<{ id: string; name: string; name_bn?: string }>;
  units: Array<{ id: string; name: string; symbol: string }>;
  brands: Array<{ id: string; name: string }>;
};
type Suggestion = {
  id: string;
  bn_name: string;
  en_name: string;
  brand_name?: string;
  common_unit: string;
  common_pack_size?: string;
  category_bn_name?: string;
  source: "master" | "local";
};
function moneyFormatter(locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  });
}
const config: Record<
  ModuleKind,
  {
    endpoint: string;
    title: TranslationKey;
    description: TranslationKey;
    action: TranslationKey;
    columns: Array<[string, TranslationKey]>;
  }
> = {
  products: {
    endpoint: "/products",
    title: "products",
    description: "productManagementIntro",
    action: "addProduct",
    columns: [
      ["image_url", "image"],
      ["name", "products"],
      ["sku", "sku"],
      ["retail_price", "sellingPrice"],
      ["purchase_price", "buyingPrice"],
      ["stock_quantity", "stock"],
    ],
  },
  inventory: {
    endpoint: "/inventory",
    title: "inventory",
    description: "inventoryManagementIntro",
    action: "adjustStock",
    columns: [
      ["product_name", "products"],
      ["sku", "sku"],
      ["quantity", "quantity"],
      ["avg_cost", "averageCost"],
      ["stock_value", "stockValue"],
    ],
  },
  sales: {
    endpoint: "/sales",
    title: "sales",
    description: "salesManagementIntro",
    action: "newSale",
    columns: [
      ["invoice_no", "memoNumber"],
      ["customer_name", "customers"],
      ["grand_total", "total"],
      ["paid_total", "paid"],
      ["due_total", "due"],
      ["status", "status"],
    ],
  },
  customers: {
    endpoint: "/customers",
    title: "customers",
    description: "customerManagementIntro",
    action: "addCustomer",
    columns: [
      ["name", "name"],
      ["phone", "phone"],
      ["customer_type", "type"],
      ["due_balance", "due"],
      ["credit_limit", "creditLimit"],
    ],
  },
  due: {
    endpoint: "/due",
    title: "due",
    description: "dueIntro",
    action: "receiveDue",
    columns: [
      ["customer_name", "customers"],
      ["phone", "phone"],
      ["balance", "due"],
      ["credit_limit", "creditLimit"],
      ["over_credit_limit", "warning"],
    ],
  },
};
function orgCookie() {
  return (
    document.cookie
      .split("; ")
      .find((p) => p.startsWith("organization_id="))
      ?.split("=")[1] ?? ""
  );
}
function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function display(
  key: string,
  value: unknown,
  yes: string,
  no: string,
  money: Intl.NumberFormat,
  statuses: Record<string, string>,
) {
  if (value === null || value === undefined || value === "") return "—";
  if (
    [
      "retail_price",
      "purchase_price",
      "stock_value",
      "avg_cost",
      "grand_total",
      "paid_total",
      "due_total",
      "balance",
      "credit_limit",
    ].includes(key)
  )
    return money.format(num(value));
  if (key === "status") return statuses[String(value)] ?? String(value);
  if (typeof value === "boolean") return value ? yes : no;
  return String(value);
}

export function OperationsModule({ kind }: { kind: ModuleKind }) {
  const { t, locale } = useI18n();
  const money = useMemo(() => moneyFormatter(locale), [locale]);
  const statuses = {
    draft: t("statusDraft"),
    completed: t("statusCompleted"),
    cancelled: t("statusCancelled"),
    void: t("statusVoid"),
    returned: t("statusReturned"),
    partially_returned: t("statusPartiallyReturned"),
    pending: t("statusPending"),
  };
  const raw = config[kind];
  const c = {
    ...raw,
    title: t(raw.title),
    description: t(raw.description),
    action: t(raw.action),
    columns: raw.columns.map(([key, label]) => [key, t(label)] as const),
  };
  const params = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [org, setOrg] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Row[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<Metadata>({
    categories: [],
    units: [],
    brands: [],
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
      setToken(data.session.access_token);
      const orgs = await apiRequest<Array<{ id: string }>>(
        "/organizations",
        data.session.access_token,
      );
      if (!orgs.length) {
        location.assign("/onboarding");
        return;
      }
      const existing = orgCookie();
      const id = orgs.some((o) => o.id === existing) ? existing : orgs[0].id;
      setOrg(id);
      document.cookie = `organization_id=${id}; Path=/; SameSite=Lax`;
      const current = await apiRequest<{ permissions: string[] }>(
        "/organizations/current",
        data.session.access_token,
        id,
      );
      setPermissions(current.permissions ?? []);
      const requests: Promise<unknown>[] = [
        apiRequest<Row[]>(c.endpoint, data.session.access_token, id),
      ];
      if (kind === "products")
        requests.push(
          apiRequest<Metadata>(
            "/products/metadata",
            data.session.access_token,
            id,
          ),
        );
      if (kind === "inventory")
        requests.push(
          apiRequest<Row[]>("/products", data.session.access_token, id),
        );
      const result = await Promise.all(requests);
      setRows(result[0] as Row[]);
      if (kind === "products") setMetadata(result[1] as Metadata);
      if (kind === "inventory") setProducts(result[1] as Row[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [c.endpoint, kind, t]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (params.get("add") === "1" || params.get("collect") === "1")
      setOpen(true);
  }, [params]);
  const metrics = useMemo(
    () =>
      kind === "products"
        ? [
            [t("totalProducts"), rows.length],
            [t("withoutBarcode"), rows.filter((r) => !r.barcode).length],
            [
              t("lowStockProducts"),
              rows.filter((r) => num(r.stock_quantity) <= num(r.reorder_level))
                .length,
            ],
          ]
        : kind === "sales"
          ? [
              [
                t("totalSales"),
                money.format(rows.reduce((s, r) => s + num(r.grand_total), 0)),
              ],
              [t("transactions"), rows.length],
              [
                t("totalDue"),
                money.format(rows.reduce((s, r) => s + num(r.due_total), 0)),
              ],
            ]
          : [[t("totalRecords"), rows.length]],
    [kind, money, rows, t],
  );
  async function genericSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    let endpoint = c.endpoint;
    let body: Record<string, unknown>;
    if (kind === "customers")
      body = {
        name: f.get("name"),
        phone: f.get("phone") || null,
        address: f.get("address") || null,
        customer_type: f.get("customerType"),
        credit_limit: num(f.get("creditLimit")),
      };
    else if (kind === "inventory") {
      endpoint = "/inventory/adjustments";
      body = {
        product_variant_id: f.get("productVariantId"),
        quantity_change: num(f.get("quantity")),
        unit_cost: f.get("cost") ? num(f.get("cost")) : null,
        note: f.get("note"),
      };
    } else {
      endpoint = "/due/collections";
      body = {
        customer_id: f.get("customerId"),
        amount: num(f.get("amount")),
        method: f.get("method"),
        note: f.get("note") || null,
      };
    }
    try {
      await apiRequest(endpoint, token, org, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }
  const action =
    kind === "sales" && permissions.includes("sales.create") ? (
      <Link className="button primary-action" href="/sales/new">
        {c.action}
      </Link>
    ) : kind !== "sales" &&
      permissions.includes(
        kind === "products"
          ? "products.create"
          : kind === "inventory"
            ? "inventory.adjust"
            : kind === "customers"
              ? "customers.create"
              : "due.receive",
      ) ? (
      <button
        className="button primary-action"
        type="button"
        onClick={() => setOpen(true)}
      >
        {c.action}
      </button>
    ) : null;
  return (
    <>
      <header className="page-header">
        <div>
          <p className="page-eyebrow">BUSINESS OS</p>
          <h1>{c.title}</h1>
          <p className="page-description">{c.description}</p>
        </div>
        <div className="header-actions">
          {kind === "products" && permissions.includes("products.import") ? (
            <Link className="button secondary" href="/products/import">
              {t("importProducts")}
            </Link>
          ) : null}
          {action}
        </div>
      </header>
      {error ? (
        <div className="error module-error" role="alert">
          {error} <button onClick={() => void load()}>{t("retry")}</button>
        </div>
      ) : null}
      <div className="metric-grid compact-metrics">
        {metrics.map(([label, value]) => (
          <article className="metric-card" key={String(label)}>
            <span>{label}</span>
            <strong>{loading ? t("loading") : String(value)}</strong>
          </article>
        ))}
      </div>
      {open && kind === "products" ? (
        <ProductForm
          token={token}
          org={org}
          metadata={metadata}
          onClose={() => setOpen(false)}
          onSaved={load}
        />
      ) : null}
      {open && kind !== "products" && kind !== "sales" ? (
        <section className="panel record-form">
          <div className="panel-header">
            <h2>{c.action}</h2>
            <button className="close-button" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>
          <form onSubmit={genericSubmit}>
            <div className="form-grid">
              {kind === "customers" ? (
                <>
                  <Field label={t("name")} name="name" required />
                  <Field label={t("phone")} name="phone" />
                  <Field label={t("description")} name="address" />
                  <label className="field">
                    <span>{t("customerType")}</span>
                    <select name="customerType">
                      <option value="retail">{t("retail")}</option>
                      <option value="wholesale">{t("wholesale")}</option>
                    </select>
                  </label>
                  <Field
                    label={t("creditLimit")}
                    name="creditLimit"
                    type="number"
                  />
                </>
              ) : kind === "inventory" ? (
                <>
                  <label className="field field-wide">
                    <span>{t("products")}</span>
                    <select name="productVariantId" required>
                      {products.map((p) => (
                        <option
                          key={String(p.variant_id)}
                          value={String(p.variant_id)}
                        >
                          {String(p.name)} · {String(p.sku)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label={t("quantity")}
                    name="quantity"
                    type="number"
                    required
                  />
                  <Field label={t("cost")} name="cost" type="number" />
                  <Field label={t("reason")} name="note" required />{" "}
                </>
              ) : (
                <>
                  <label className="field field-wide">
                    <span>{t("customers")}</span>
                    <select name="customerId" required>
                      {rows.map((r) => (
                        <option
                          key={String(r.customer_id)}
                          value={String(r.customer_id)}
                        >
                          {String(r.customer_name)} ·{" "}
                          {money.format(num(r.balance))}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label={t("receiveAmount")}
                    name="amount"
                    type="number"
                    required
                  />
                  <label className="field">
                    <span>{t("payment")}</span>
                    <select name="method">
                      <option value="cash">Cash</option>
                      <option value="bkash">bKash</option>
                      <option value="nagad">Nagad</option>
                    </select>
                  </label>
                  <Field label={t("notes")} name="note" />
                </>
              )}
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => setOpen(false)}>
                {t("cancel")}
              </button>
              <button className="button" disabled={saving}>
                {saving ? t("loading") : t("save")}
              </button>
            </div>
          </form>
        </section>
      ) : null}
      <section className="data-panel">
        <div className="data-toolbar">
          <strong>
            {loading ? t("loading") : `${rows.length} ${t("records")}`}
          </strong>
          <button
            className="filter-button"
            onClick={() => void load()}
            disabled={loading}
          >
            {t("retry")}
          </button>
        </div>
        <div className="table-scroll">
          <div
            className="table-head"
            style={{
              gridTemplateColumns: `repeat(${c.columns.length},minmax(130px,1fr))`,
            }}
          >
            {c.columns.map(([, label]) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          {rows.length ? (
            <div className="table-body">
              {rows.map((row, i) => (
                <div
                  className="table-row clickable-row"
                  style={{
                    gridTemplateColumns: `repeat(${c.columns.length},minmax(130px,1fr))`,
                  }}
                  key={String(row.id ?? row.customer_id ?? i)}
                >
                  {c.columns.map(([key, label]) => (
                    <span data-label={label} key={key}>
                      {kind === "products" && key === "image_url" ? (
                        <ProductImageManager
                          productId={String(row.id)}
                          imagePath={
                            row.image_path ? String(row.image_path) : undefined
                          }
                          imageUrl={
                            row.image_url ? String(row.image_url) : undefined
                          }
                          organizationId={org}
                          token={token}
                          canUpdate={permissions.includes("products.update")}
                          onChanged={load}
                        />
                      ) : kind === "sales" && key === "invoice_no" ? (
                        <Link href={`/sales/${row.id}/memo`}>
                          {display(
                            key,
                            row[key],
                            t("yes"),
                            t("no"),
                            money,
                            statuses,
                          )}
                        </Link>
                      ) : kind === "customers" && key === "name" ? (
                        <Link href={`/customers/${row.id}`}>
                          {display(
                            key,
                            row[key],
                            t("yes"),
                            t("no"),
                            money,
                            statuses,
                          )}
                        </Link>
                      ) : (
                        display(
                          key,
                          row[key],
                          t("yes"),
                          t("no"),
                          money,
                          statuses,
                        )
                      )}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>{loading ? t("loading") : t("noData")}</h2>
              <p>{loading ? t("loadingWorkspace") : t("firstRecordHint")}</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        step={type === "number" ? "0.01" : undefined}
      />
    </label>
  );
}

function ProductForm({
  token,
  org,
  metadata,
  onClose,
  onSaved,
}: {
  token: string;
  org: string;
  metadata: Metadata;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const money = moneyFormatter(locale);
  const [name, setName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [buy, setBuy] = useState(0);
  const [sell, setSell] = useState(0);
  const [advanced, setAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (name.trim().length < 1 || selected?.bn_name === name) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setSuggestions(
          await apiRequest<Suggestion[]>(
            `/product-master/search?q=${encodeURIComponent(name)}`,
            token,
            org,
          ),
        );
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [name, org, selected, token]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const profit = sell - buy,
    margin = sell > 0 ? (profit / sell) * 100 : 0,
    markup = buy > 0 ? (profit / buy) * 100 : 0;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    let uploadedPath = "";
    try {
      if (imageFile) uploadedPath = await uploadProductImage(imageFile, org);
      const result = await apiRequest<{ id: string }>("/products", token, org, {
        method: "POST",
        body: JSON.stringify({
          name,
          name_bn: name,
          master_item_id: selected?.source === "master" ? selected.id : null,
          category_id: f.get("categoryId") || null,
          base_unit_id: f.get("unitId") || null,
          sku: f.get("sku") || null,
          barcode: f.get("barcode") || null,
          brand_name: f.get("brand") || selected?.brand_name || null,
          supplier_name: f.get("supplier") || null,
          description: f.get("description") || null,
          variant_name: f.get("variant") || "Default",
          pack_size: f.get("packSize") || selected?.common_pack_size || null,
          purchase_price: buy,
          retail_price: sell,
          wholesale_price: num(f.get("wholesale")),
          mrp: f.get("mrp") ? num(f.get("mrp")) : null,
          opening_stock: num(f.get("openingStock")),
          reorder_level: num(f.get("reorder")),
          vat_rate: num(f.get("vat")),
          discount_allowed: f.get("discountAllowed") === "on",
          expiry_tracking: f.get("expiryTracking") === "on",
          expiry_date: f.get("expiryDate") || null,
          batch_number: f.get("batch") || null,
          serial_number: f.get("serial") || null,
          rack_location: f.get("rack") || null,
          notes: f.get("notes") || null,
          image_path: uploadedPath || null,
        }),
      });
      if (
        (e.nativeEvent as SubmitEvent).submitter?.getAttribute("data-pos") ===
        "1"
      ) {
        location.assign(`/sales/new?product=${result.id}`);
        return;
      }
      if (
        (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
          "data-another",
        ) === "1"
      ) {
        setName("");
        setSelected(null);
        setImageFile(null);
        (e.currentTarget as HTMLFormElement).reset();
        await onSaved();
        return;
      }
      onClose();
      await onSaved();
    } catch (err) {
      if (uploadedPath)
        await createClient()
          .storage.from("product-media")
          .remove([uploadedPath]);
      setError(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="panel record-form premium-form">
      <div className="panel-header">
        <div>
          <p className="page-eyebrow">QUICK ADD</p>
          <h2>{t("newProduct")}</h2>
        </div>
        <button className="close-button" onClick={onClose}>
          ×
        </button>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <form onSubmit={submit}>
        <ProductImagePicker file={imageFile} onChange={setImageFile} />
        <div className="form-section">
          <h3>{t("requiredInfo")}</h3>
          <div className="form-grid">
            <label className="field field-wide suggestion-field">
              <span>{t("productName")} *</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSelected(null);
                }}
                required
                autoComplete="off"
                placeholder={t("productSearchPlaceholder")}
              />
              {suggestions.length ? (
                <div className="suggestion-list">
                  {suggestions.map((s) => (
                    <button
                      type="button"
                      key={`${s.source}-${s.id}`}
                      onClick={() => {
                        setSelected(s);
                        setName(s.bn_name);
                        setSuggestions([]);
                      }}
                    >
                      <strong>{s.bn_name}</strong>
                      <span>
                        {s.en_name}
                        {s.brand_name ? ` · ${s.brand_name}` : ""}
                      </span>
                      <small>
                        {s.category_bn_name} · {s.common_unit}
                      </small>
                    </button>
                  ))}
                </div>
              ) : null}
            </label>
            <label className="field">
              <span>{t("category")} *</span>
              <select name="categoryId" required={!selected}>
                {selected ? (
                  <option value="">{selected.category_bn_name}</option>
                ) : (
                  <option value="">{t("select")}</option>
                )}
                {metadata.categories.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name_bn || x.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t("unit")} *</span>
              <select name="unitId" required={!selected}>
                {selected ? (
                  <option value="">{selected.common_unit}</option>
                ) : (
                  <option value="">{t("select")}</option>
                )}
                {metadata.units.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.symbol} · {x.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="price-profit-card">
          <label className="field">
            <span>{t("buyingPrice")} *</span>
            <input
              aria-label={t("buyingPrice")}
              type="number"
              min="0"
              step="0.01"
              value={buy}
              onChange={(e) => setBuy(num(e.target.value))}
              required
            />
          </label>
          <label className="field">
            <span>{t("sellingPrice")} *</span>
            <input
              aria-label={t("sellingPrice")}
              type="number"
              min="0"
              step="0.01"
              value={sell}
              onChange={(e) => setSell(num(e.target.value))}
              required
            />
          </label>
          <div className={profit < 0 ? "profit-negative" : "profit-positive"}>
            <span>{t("profit")}</span>
            <strong>{money.format(profit)}</strong>
            <small>
              Margin {margin.toFixed(1)}% · Markup {markup.toFixed(1)}%
            </small>
          </div>
        </div>
        {profit < 0 ? (
          <p className="price-warning">⚠ {t("profitWarning")}</p>
        ) : null}
        <button
          type="button"
          className="advanced-toggle"
          onClick={() => setAdvanced(!advanced)}
        >
          {advanced ? t("closeAdvanced") : `＋ ${t("addAdvanced")}`}
        </button>
        {advanced ? (
          <div className="advanced-product">
            <div className="form-grid">
              <Field label={t("sku")} name="sku" />
              <Field label={t("barcode")} name="barcode" />
              <Field label={t("brand")} name="brand" />
              <Field label={t("supplier")} name="supplier" />
              <Field label={t("variant")} name="variant" />
              <Field label={t("packSize")} name="packSize" />
              <Field
                label={t("wholesalePrice")}
                name="wholesale"
                type="number"
              />
              <Field label="MRP" name="mrp" type="number" />
              <Field
                label={t("openingStock")}
                name="openingStock"
                type="number"
              />
              <Field label={t("lowStockAlert")} name="reorder" type="number" />
              <Field label="VAT %" name="vat" type="number" />
              <Field label={t("rack")} name="rack" />
              <Field label={t("batch")} name="batch" />
              <Field label={t("serial")} name="serial" />
              <Field label={t("expiryDate")} name="expiryDate" type="date" />
              <label className="field field-wide">
                <span>{t("description")}</span>
                <textarea name="description" />
              </label>
              <label className="field field-wide">
                <span>{t("notes")}</span>
                <textarea name="notes" />
              </label>
              <label className="check-field">
                <input type="checkbox" name="discountAllowed" defaultChecked />{" "}
                {t("allowDiscount")}
              </label>
              <label className="check-field">
                <input type="checkbox" name="expiryTracking" />{" "}
                {t("trackExpiry")}
              </label>
            </div>
          </div>
        ) : null}
        <div className="form-actions product-actions">
          <button type="button" onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            className="button secondary"
            data-another="1"
            disabled={saving}
          >
            {t("saveAddAnother")}
          </button>
          <button className="button secondary" data-pos="1" disabled={saving}>
            {t("saveGoPos")}
          </button>
          <button className="button" disabled={saving}>
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </form>
    </section>
  );
}
