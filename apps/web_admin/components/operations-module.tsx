"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { MetricCard, PageHeader } from "@/components/admin-ui";
import { Icon } from "@/components/icons";
import { apiRequest } from "@/lib/api";
import { createClient } from "@/lib/supabase-browser";

type ModuleKind = "products" | "inventory" | "sales" | "customers" | "due";
type Row = Record<string, unknown>;
type Column = { key: string; label: string; money?: boolean };

const configs: Record<ModuleKind, { eyebrow: string; title: string; description: string; action?: string; endpoint: string; columns: Column[]; emptyTitle: string; emptyCopy: string }> = {
  products: { eyebrow: "Catalog", title: "Products", description: "Manage sellable items, variants, prices and barcodes.", action: "Add product", endpoint: "/products", columns: [{ key: "name", label: "Product" }, { key: "sku", label: "SKU" }, { key: "barcode", label: "Barcode" }, { key: "retail_price", label: "Retail price", money: true }, { key: "status", label: "Status" }], emptyTitle: "Your product catalog starts here", emptyCopy: "Add the first real product after your workspace is active." },
  inventory: { eyebrow: "Stock control", title: "Inventory", description: "Review branch balances from the append-only stock movement ledger.", action: "Adjust stock", endpoint: "/inventory/balances", columns: [{ key: "product_name", label: "Product" }, { key: "branch_name", label: "Branch" }, { key: "warehouse_name", label: "Stock point" }, { key: "quantity", label: "On hand" }, { key: "stock_value", label: "Value", money: true }], emptyTitle: "No inventory balance to display", emptyCopy: "Balances appear after opening stock or another audited movement is posted." },
  sales: { eyebrow: "Transactions", title: "Sales", description: "Review completed invoices, payment totals and due amounts.", action: "New sale", endpoint: "/sales", columns: [{ key: "invoice_no", label: "Invoice" }, { key: "customer_name", label: "Customer" }, { key: "branch_name", label: "Branch" }, { key: "grand_total", label: "Total", money: true }, { key: "due_total", label: "Due", money: true }, { key: "status", label: "Status" }], emptyTitle: "Completed sales will appear here", emptyCopy: "Sales stay empty until the server-calculated checkout flow posts an invoice." },
  customers: { eyebrow: "Relationships", title: "Customers", description: "Maintain customer identities and ledger-linked balances.", action: "Add customer", endpoint: "/customers", columns: [{ key: "name", label: "Customer" }, { key: "phone", label: "Phone" }, { key: "branch_name", label: "Branch" }, { key: "customer_type", label: "Type" }, { key: "due_balance", label: "Outstanding due", money: true }], emptyTitle: "Build a clean customer book", emptyCopy: "Add customers as they become part of real business activity." },
  due: { eyebrow: "Receivables", title: "Due / Baki", description: "Track customer balances backed by immutable ledger entries.", action: "Record collection", endpoint: "/due", columns: [{ key: "customer_name", label: "Customer" }, { key: "phone", label: "Phone" }, { key: "balance", label: "Balance", money: true }, { key: "credit_limit", label: "Credit limit", money: true }, { key: "last_activity", label: "Last activity" }], emptyTitle: "No outstanding due", emptyCopy: "Due sales and collections will update this view through customer ledger entries." }
};

const money = new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 2 });
const numeric = (value: unknown) => Number(value ?? 0);
const display = (value: unknown, asMoney?: boolean) => asMoney ? money.format(numeric(value)) : value === null || value === undefined || value === "" ? "—" : String(value);

function organizationCookie() {
  return document.cookie.split("; ").find((part) => part.startsWith("organization_id="))?.split("=")[1] ?? "";
}

function FormFields({ kind, products, customers, dueRows }: { kind: ModuleKind; products: Row[]; customers: Row[]; dueRows: Row[] }) {
  if (kind === "products") return <><label className="field"><span>Name</span><input name="name" required /></label><label className="field"><span>SKU</span><input name="sku" required /></label><label className="field"><span>Barcode</span><input name="barcode" /></label><label className="field"><span>Purchase price</span><input name="purchasePrice" type="number" min="0" step="0.01" defaultValue="0" /></label><label className="field"><span>Retail price</span><input name="retailPrice" type="number" min="0" step="0.01" required /></label><label className="field"><span>Wholesale price</span><input name="wholesalePrice" type="number" min="0" step="0.01" defaultValue="0" /></label></>;
  if (kind === "customers") return <><label className="field"><span>Name</span><input name="name" required /></label><label className="field"><span>Phone</span><input name="phone" type="tel" /></label><label className="field"><span>Customer type</span><select name="customerType"><option value="retail">Retail</option><option value="wholesale">Wholesale</option><option value="dealer">Dealer</option><option value="vip">VIP</option></select></label><label className="field"><span>Credit limit</span><input name="creditLimit" type="number" min="0" step="0.01" defaultValue="0" /></label><label className="field field-wide"><span>Address</span><input name="address" /></label></>;
  if (kind === "inventory") return <><label className="field field-wide"><span>Product</span><select name="productVariantId" required><option value="">Select product</option>{products.map((product) => <option value={String(product.variant_id)} key={String(product.variant_id)}>{String(product.name)} · {String(product.sku)}</option>)}</select></label><label className="field"><span>Quantity change</span><input name="quantityChange" type="number" step="0.0001" placeholder="Use negative to reduce" required /></label><label className="field"><span>Unit cost</span><input name="unitCost" type="number" min="0" step="0.01" /></label><label className="field field-wide"><span>Reason / note</span><input name="note" required /></label></>;
  if (kind === "sales") return <><label className="field field-wide"><span>Product</span><select name="productVariantId" required><option value="">Select product</option>{products.map((product) => <option value={String(product.variant_id)} key={String(product.variant_id)}>{String(product.name)} · {String(product.sku)} · {money.format(numeric(product.retail_price))}</option>)}</select></label><label className="field"><span>Quantity</span><input name="quantity" type="number" min="0.0001" step="0.0001" defaultValue="1" required /></label><label className="field"><span>Unit price override</span><input name="unitPrice" type="number" min="0" step="0.01" placeholder="Catalog price" /></label><label className="field"><span>Customer for due sale</span><select name="customerId"><option value="">Walk-in customer</option>{customers.map((customer) => <option value={String(customer.id)} key={String(customer.id)}>{String(customer.name)}</option>)}</select></label><label className="field"><span>Paid amount</span><input name="paidAmount" type="number" min="0" step="0.01" defaultValue="0" /></label><label className="field"><span>Payment method</span><select name="paymentMethod"><option value="cash">Cash</option><option value="bkash">bKash</option><option value="nagad">Nagad</option><option value="bank">Bank</option><option value="card">Card</option></select></label></>;
  return <><label className="field field-wide"><span>Customer</span><select name="customerId" required><option value="">Select customer</option>{dueRows.map((row) => <option value={String(row.customer_id)} key={String(row.customer_id)}>{String(row.customer_name)} · {money.format(numeric(row.balance))}</option>)}</select></label><label className="field"><span>Collection amount</span><input name="amount" type="number" min="0.01" step="0.01" required /></label><label className="field"><span>Payment method</span><select name="method"><option value="cash">Cash</option><option value="bkash">bKash</option><option value="nagad">Nagad</option><option value="bank">Bank</option><option value="card">Card</option></select></label><label className="field field-wide"><span>Reference / note</span><input name="note" /></label></>;
}

export function OperationsModule({ kind }: { kind: ModuleKind }) {
  const config = configs[kind];
  const [rows, setRows] = useState<Row[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const { data } = await createClient().auth.getSession();
    if (!data.session) { window.location.assign("/login"); return; }
    try {
      const organizations = await apiRequest<Array<{ id: string }>>("/organizations", data.session.access_token);
      if (organizations.length === 0) { window.location.assign("/onboarding"); return; }
      const cookie = organizationCookie();
      const org = organizations.some((item) => item.id === cookie) ? cookie : organizations[0].id;
      document.cookie = `organization_id=${org}; Path=/; SameSite=Lax`;
      setOrganizationId(org);
      setRows(await apiRequest<Row[]>(config.endpoint, data.session.access_token, org));
      if (["inventory", "sales"].includes(kind)) setProducts(await apiRequest<Row[]>("/products", data.session.access_token, org));
      if (kind === "sales") setCustomers(await apiRequest<Row[]>("/customers", data.session.access_token, org));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load data"); }
    finally { setLoading(false); }
  }, [config.endpoint, kind]);

  useEffect(() => { void load(); }, [load]);

  const metrics = useMemo(() => {
    if (kind === "products") return [["Active products", rows.length], ["Missing retail price", rows.filter((r) => numeric(r.retail_price) === 0).length], ["Without barcode", rows.filter((r) => !r.barcode).length], ["Catalog value", null]];
    if (kind === "inventory") return [["Stock value", rows.reduce((sum, r) => sum + numeric(r.stock_value), 0), true], ["Units on hand", rows.reduce((sum, r) => sum + numeric(r.quantity), 0)], ["Low-stock items", rows.filter((r) => numeric(r.quantity) <= numeric(r.reorder_level)).length], ["Out of stock", rows.filter((r) => numeric(r.quantity) <= 0).length]];
    if (kind === "sales") return [["Recorded sales", rows.reduce((sum, r) => sum + numeric(r.grand_total), 0), true], ["Transactions", rows.length], ["Due sales", rows.reduce((sum, r) => sum + numeric(r.due_total), 0), true], ["Returns", rows.filter((r) => r.status === "returned").length]];
    if (kind === "customers") return [["Active customers", rows.length], ["With outstanding due", rows.filter((r) => numeric(r.due_balance) > 0).length], ["Credit limit alerts", rows.filter((r) => numeric(r.due_balance) > numeric(r.credit_limit)).length], ["Total receivable", rows.reduce((sum, r) => sum + numeric(r.due_balance), 0), true]];
    return [["Total receivable", rows.reduce((sum, r) => sum + numeric(r.balance), 0), true], ["Customers with due", rows.length], ["Over credit limit", rows.filter((r) => r.over_credit_limit).length], ["Collections today", null]];
  }, [kind, rows]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null);
    const form = new FormData(event.currentTarget);
    const { data } = await createClient().auth.getSession();
    if (!data.session) return;
    let endpoint = config.endpoint;
    let body: Record<string, unknown>;
    if (kind === "products") body = { name: String(form.get("name")), sku: String(form.get("sku")), barcode: String(form.get("barcode")) || null, purchase_price: numeric(form.get("purchasePrice")), retail_price: numeric(form.get("retailPrice")), wholesale_price: numeric(form.get("wholesalePrice")) };
    else if (kind === "customers") body = { name: String(form.get("name")), phone: String(form.get("phone")) || null, address: String(form.get("address")) || null, customer_type: String(form.get("customerType")), credit_limit: numeric(form.get("creditLimit")) };
    else if (kind === "inventory") { endpoint = "/inventory/adjustments"; body = { product_variant_id: String(form.get("productVariantId")), quantity_change: numeric(form.get("quantityChange")), unit_cost: form.get("unitCost") ? numeric(form.get("unitCost")) : null, note: String(form.get("note")) }; }
    else if (kind === "sales") { endpoint = "/sales"; body = { customer_id: form.get("customerId") || null, items: [{ product_variant_id: String(form.get("productVariantId")), quantity: numeric(form.get("quantity")), unit_price: form.get("unitPrice") ? numeric(form.get("unitPrice")) : null }], paid_amount: numeric(form.get("paidAmount")), payment_method: String(form.get("paymentMethod")) }; }
    else { endpoint = "/due/collections"; body = { customer_id: String(form.get("customerId")), amount: numeric(form.get("amount")), method: String(form.get("method")), note: String(form.get("note")) || null }; }
    try {
      await apiRequest(endpoint, data.session.access_token, organizationId, { method: "POST", body: JSON.stringify(body) });
      setFormOpen(false); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save record"); }
    finally { setSaving(false); }
  }

  return <>
    <PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description} action={config.action} actionEnabled={Boolean(config.action && organizationId)} onAction={() => setFormOpen(true)} />
    {error ? <div className="error module-error" role="alert">{error}</div> : null}
    <div className="metric-grid">{metrics.map(([label, value, asMoney], index) => <MetricCard key={String(label)} label={String(label)} hint={loading ? "Loading live data…" : value === null ? "Available with transaction data" : asMoney ? money.format(Number(value)) : String(value)} tone={index === 2 ? "amber" : index === 3 ? "blue" : "green"} />)}</div>
    {formOpen ? <section className="panel record-form"><div className="panel-header"><div><p className="page-eyebrow">New record</p><h2>{config.action}</h2></div><button className="close-button" type="button" onClick={() => setFormOpen(false)} aria-label="Close form">×</button></div><form onSubmit={submit}><div className="form-grid"><FormFields kind={kind} products={products} customers={customers} dueRows={rows} /></div><div className="form-actions"><span /><button className="button" type="submit" disabled={saving}>{saving ? "Saving…" : "Save record"}</button></div></form></section> : null}
    <section className="data-panel"><div className="data-toolbar"><div className="search-shell"><Icon name="search" /><span>{loading ? "Loading live records…" : `${rows.length} records`}</span></div><button className="filter-button" type="button" onClick={() => void load()} disabled={loading}>Refresh</button></div><div className="table-scroll"><div className="table-head" style={{ gridTemplateColumns: `repeat(${config.columns.length}, minmax(130px, 1fr))` }}>{config.columns.map((column) => <span key={column.key}>{column.label}</span>)}</div>{rows.length ? <div className="table-body">{rows.map((row, index) => <div className="table-row" style={{ gridTemplateColumns: `repeat(${config.columns.length}, minmax(130px, 1fr))` }} key={String(row.id ?? row.customer_id ?? index)}>{config.columns.map((column) => <span key={column.key} data-label={column.label}>{display(row[column.key], column.money)}</span>)}</div>)}</div> : <div className="empty-state"><span className="empty-mark">{config.title.slice(0,1)}</span><h2>{loading ? "Loading live data" : config.emptyTitle}</h2><p>{loading ? "Securely reading the selected workspace." : config.emptyCopy}</p></div>}</div></section>
  </>;
}
