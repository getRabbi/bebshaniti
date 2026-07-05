"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase-browser";

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
const money = new Intl.NumberFormat("bn-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 2,
});
const config = {
  products: {
    endpoint: "/products",
    title: "পণ্য",
    description: "দ্রুত পণ্য যোগ, দাম, স্টক ও বারকোড পরিচালনা করুন।",
    action: "পণ্য যোগ করুন",
    columns: [
      ["name", "পণ্য"],
      ["sku", "SKU"],
      ["retail_price", "বিক্রয় মূল্য"],
      ["purchase_price", "ক্রয় মূল্য"],
      ["stock_quantity", "স্টক"],
    ],
  },
  inventory: {
    endpoint: "/inventory",
    title: "স্টক / ইনভেন্টরি",
    description: "শাখাভিত্তিক বর্তমান স্টক ও কম-স্টক সতর্কতা।",
    action: "স্টক সমন্বয়",
    columns: [
      ["product_name", "পণ্য"],
      ["sku", "SKU"],
      ["quantity", "পরিমাণ"],
      ["avg_cost", "গড় মূল্য"],
      ["stock_value", "স্টক মূল্য"],
    ],
  },
  sales: {
    endpoint: "/sales",
    title: "বিক্রয়",
    description: "বিক্রয় ইতিহাস, পেমেন্ট ও ক্যাশ মেমো।",
    action: "নতুন বিক্রয়",
    columns: [
      ["invoice_no", "মেমো"],
      ["customer_name", "কাস্টমার"],
      ["grand_total", "মোট"],
      ["paid_total", "পরিশোধ"],
      ["due_total", "বাকি"],
      ["status", "অবস্থা"],
    ],
  },
  customers: {
    endpoint: "/customers",
    title: "কাস্টমার",
    description: "কাস্টমার প্রোফাইল, ক্রেডিট ও বাকি হিসাব।",
    action: "কাস্টমার যোগ করুন",
    columns: [
      ["name", "নাম"],
      ["phone", "ফোন"],
      ["customer_type", "ধরন"],
      ["due_balance", "বাকি"],
      ["credit_limit", "ক্রেডিট সীমা"],
    ],
  },
  due: {
    endpoint: "/due",
    title: "বাকি / পাওনা",
    description: "কাস্টমার বাকি, লেজার ও কালেকশন।",
    action: "বাকি আদায়",
    columns: [
      ["customer_name", "কাস্টমার"],
      ["phone", "ফোন"],
      ["balance", "বাকি"],
      ["credit_limit", "সীমা"],
      ["over_credit_limit", "সতর্কতা"],
    ],
  },
} as const;
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
function display(key: string, value: unknown) {
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
  if (typeof value === "boolean") return value ? "হ্যাঁ" : "না";
  return String(value);
}

export function OperationsModule({ kind }: { kind: ModuleKind }) {
  const c = config[kind] as {
    endpoint: string;
    title: string;
    description: string;
    action: string;
    columns: readonly (readonly [string, string])[];
  };
  const params = useSearchParams();
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [org, setOrg] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Row[]>([]);
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
      setError(e instanceof Error ? e.message : "তথ্য লোড করা যায়নি।");
    } finally {
      setLoading(false);
    }
  }, [c.endpoint, kind]);
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
            ["মোট পণ্য", rows.length],
            ["বারকোড ছাড়া", rows.filter((r) => !r.barcode).length],
            [
              "কম স্টক",
              rows.filter((r) => num(r.stock_quantity) <= num(r.reorder_level))
                .length,
            ],
          ]
        : kind === "sales"
          ? [
              [
                "মোট বিক্রয়",
                money.format(rows.reduce((s, r) => s + num(r.grand_total), 0)),
              ],
              ["লেনদেন", rows.length],
              [
                "মোট বাকি",
                money.format(rows.reduce((s, r) => s + num(r.due_total), 0)),
              ],
            ]
          : [["মোট রেকর্ড", rows.length]],
    [kind, rows],
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
      setError(err instanceof Error ? err.message : "সেভ করা যায়নি।");
    } finally {
      setSaving(false);
    }
  }
  const action =
    kind === "sales" ? (
      <Link className="button primary-action" href="/sales/new">
        {c.action}
      </Link>
    ) : (
      <button
        className="button primary-action"
        type="button"
        onClick={() => setOpen(true)}
      >
        {c.action}
      </button>
    );
  return (
    <>
      <header className="page-header">
        <div>
          <p className="page-eyebrow">BUSINESS OS</p>
          <h1>{c.title}</h1>
          <p className="page-description">{c.description}</p>
        </div>
        {action}
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
                  <Field label="নাম" name="name" required />
                  <Field label="ফোন" name="phone" />
                  <Field label="ঠিকানা" name="address" />
                  <label className="field">
                    <span>ধরন</span>
                    <select name="customerType">
                      <option value="retail">খুচরা</option>
                      <option value="wholesale">পাইকারি</option>
                    </select>
                  </label>
                  <Field
                    label="ক্রেডিট সীমা"
                    name="creditLimit"
                    type="number"
                  />
                </>
              ) : kind === "inventory" ? (
                <>
                  <label className="field field-wide">
                    <span>পণ্য</span>
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
                    label="পরিমাণ (+/-)"
                    name="quantity"
                    type="number"
                    required
                  />
                  <Field label="ইউনিট খরচ" name="cost" type="number" />
                  <Field label="কারণ" name="note" required />{" "}
                </>
              ) : (
                <>
                  <label className="field field-wide">
                    <span>কাস্টমার</span>
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
                    label="আদায়ের পরিমাণ"
                    name="amount"
                    type="number"
                    required
                  />
                  <label className="field">
                    <span>পেমেন্ট</span>
                    <select name="method">
                      <option value="cash">ক্যাশ</option>
                      <option value="bkash">বিকাশ</option>
                      <option value="nagad">নগদ</option>
                    </select>
                  </label>
                  <Field label="নোট" name="note" />
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
          <strong>{loading ? t("loading") : `${rows.length}টি রেকর্ড`}</strong>
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
                      {kind === "sales" && key === "invoice_no" ? (
                        <Link href={`/sales/${row.id}/memo`}>
                          {display(key, row[key])}
                        </Link>
                      ) : (
                        display(key, row[key])
                      )}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>{loading ? t("loading") : t("noData")}</h2>
              <p>
                {loading
                  ? "নিরাপদ ওয়ার্কস্পেস থেকে তথ্য আনা হচ্ছে।"
                  : "প্রথম রেকর্ড যোগ করলে এখানে দেখা যাবে।"}
              </p>
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
  const [name, setName] = useState("");
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
    try {
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
        (e.currentTarget as HTMLFormElement).reset();
        await onSaved();
        return;
      }
      onClose();
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "পণ্য সেভ করা যায়নি।");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="panel record-form premium-form">
      <div className="panel-header">
        <div>
          <p className="page-eyebrow">QUICK ADD</p>
          <h2>নতুন পণ্য</h2>
        </div>
        <button className="close-button" onClick={onClose}>
          ×
        </button>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <form onSubmit={submit}>
        <div className="form-section">
          <h3>প্রয়োজনীয় তথ্য</h3>
          <div className="form-grid">
            <label className="field field-wide suggestion-field">
              <span>পণ্যের নাম *</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSelected(null);
                }}
                required
                autoComplete="off"
                placeholder="যেমন: ACI Salt / ইস্পাহানি চা"
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
              <span>ক্যাটাগরি *</span>
              <select name="categoryId" required={!selected}>
                {selected ? (
                  <option value="">{selected.category_bn_name}</option>
                ) : (
                  <option value="">নির্বাচন করুন</option>
                )}
                {metadata.categories.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name_bn || x.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>ইউনিট *</span>
              <select name="unitId" required={!selected}>
                {selected ? (
                  <option value="">{selected.common_unit}</option>
                ) : (
                  <option value="">নির্বাচন করুন</option>
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
            <span>ক্রয় মূল্য *</span>
            <input
              aria-label="ক্রয় মূল্য"
              type="number"
              min="0"
              step="0.01"
              value={buy}
              onChange={(e) => setBuy(num(e.target.value))}
              required
            />
          </label>
          <label className="field">
            <span>বিক্রয় মূল্য *</span>
            <input
              aria-label="বিক্রয় মূল্য"
              type="number"
              min="0"
              step="0.01"
              value={sell}
              onChange={(e) => setSell(num(e.target.value))}
              required
            />
          </label>
          <div className={profit < 0 ? "profit-negative" : "profit-positive"}>
            <span>লাভ</span>
            <strong>{money.format(profit)}</strong>
            <small>
              Margin {margin.toFixed(1)}% · Markup {markup.toFixed(1)}%
            </small>
          </div>
        </div>
        {profit < 0 ? (
          <p className="price-warning">⚠ বিক্রয় মূল্য ক্রয় মূল্যের চেয়ে কম।</p>
        ) : null}
        <button
          type="button"
          className="advanced-toggle"
          onClick={() => setAdvanced(!advanced)}
        >
          {advanced ? "উন্নত তথ্য বন্ধ করুন" : "＋ উন্নত তথ্য যোগ করুন"}
        </button>
        {advanced ? (
          <div className="advanced-product">
            <div className="form-grid">
              <Field label="SKU (খালি রাখলে অটো)" name="sku" />
              <Field label="বারকোড" name="barcode" />
              <Field label="ব্র্যান্ড" name="brand" />
              <Field label="সাপ্লায়ার" name="supplier" />
              <Field label="ভ্যারিয়েন্ট" name="variant" />
              <Field label="সাইজ / প্যাক" name="packSize" />
              <Field label="পাইকারি মূল্য" name="wholesale" type="number" />
              <Field label="MRP" name="mrp" type="number" />
              <Field label="ওপেনিং স্টক" name="openingStock" type="number" />
              <Field label="লো স্টক সতর্কতা" name="reorder" type="number" />
              <Field label="VAT %" name="vat" type="number" />
              <Field label="র‍্যাক / শেলফ" name="rack" />
              <Field label="ব্যাচ" name="batch" />
              <Field label="সিরিয়াল" name="serial" />
              <Field label="মেয়াদ" name="expiryDate" type="date" />
              <label className="field field-wide">
                <span>বিবরণ</span>
                <textarea name="description" />
              </label>
              <label className="field field-wide">
                <span>নোট</span>
                <textarea name="notes" />
              </label>
              <label className="check-field">
                <input type="checkbox" name="discountAllowed" defaultChecked />{" "}
                ডিসকাউন্ট অনুমোদিত
              </label>
              <label className="check-field">
                <input type="checkbox" name="expiryTracking" /> মেয়াদ ট্র্যাক
                করুন
              </label>
            </div>
          </div>
        ) : null}
        <div className="form-actions product-actions">
          <button type="button" onClick={onClose}>
            বাতিল
          </button>
          <button
            className="button secondary"
            data-another="1"
            disabled={saving}
          >
            সেভ ও আরেকটি যোগ
          </button>
          <button className="button secondary" data-pos="1" disabled={saving}>
            সেভ ও POS-এ যান
          </button>
          <button className="button" disabled={saving}>
            {saving ? "সেভ হচ্ছে…" : "সেভ"}
          </button>
        </div>
      </form>
    </section>
  );
}
