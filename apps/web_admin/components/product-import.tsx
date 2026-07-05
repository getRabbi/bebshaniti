"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase-browser";

type PreviewRow = {
  row_number: number;
  product_name: string;
  category: string;
  unit: string;
  buying_price: string;
  selling_price: string;
  sku?: string;
  barcode?: string;
  duplicate_by?: string;
  errors: string[];
};
type Preview = {
  file_name: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  rows: PreviewRow[];
};
type Result = {
  total_rows: number;
  created_rows: number;
  updated_rows: number;
  skipped_rows: number;
  failed_rows: number;
  errors: Array<{ row_number: number; errors: string[] }>;
};
function org() {
  return (
    document.cookie
      .split("; ")
      .find((part) => part.startsWith("organization_id="))
      ?.split("=")[1] ?? ""
  );
}

export function ProductImport() {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [token, setToken] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [mode, setMode] = useState("skip");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  function rowError(message: string) {
    const [field, issue] = message.split(":", 2).map((part) => part.trim());
    const fieldNames: Record<string, string> = {
      product_name: t("productName"),
      category: t("category"),
      unit: t("unit"),
      buying_price: t("buyingPrice"),
      selling_price: t("sellingPrice"),
      opening_stock: t("openingStock"),
      low_stock_alert: t("lowStockAlert"),
      wholesale_price: t("wholesalePrice"),
      mrp: "MRP",
      expiry_date: t("expiryDate"),
    };
    const issues: Record<string, string> = {
      required: t("requiredField"),
      "invalid number": t("invalidNumber"),
      "cannot be negative": t("cannotNegative"),
      "use YYYY-MM-DD": t("expiryFormat"),
      "database validation failed": t("databaseValidation"),
    };
    if (message.startsWith("duplicate "))
      return `${t("duplicateValue")}: ${message.slice(10)}`;
    if (!issue) return issues[field] ?? message;
    return `${fieldNames[field] ?? field}: ${issues[issue] ?? issue}`;
  }
  useEffect(() => {
    void (async () => {
      const { data } = await createClient().auth.getSession();
      if (!data.session) {
        location.assign("/login");
        return;
      }
      setToken(data.session.access_token);
      setOrganizationId(org());
    })();
  }, []);
  async function previewFile() {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      setPreview(
        await apiRequest<Preview>(
          "/products/import/preview",
          token,
          organizationId,
          { method: "POST", body },
        ),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }
  async function commit() {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("mode", mode);
      const response = await apiRequest<Result>(
        "/products/import/commit",
        token,
        organizationId,
        { method: "POST", body },
      );
      setResult(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("saveError"));
    } finally {
      setLoading(false);
    }
  }
  function sample() {
    const header =
      "product_name,category,unit,buying_price,selling_price,sku,barcode,brand,opening_stock,low_stock_alert,wholesale_price,mrp,supplier,rack,expiry_date\n";
    const example =
      "Sample Product,General,pcs,80,100,SKU-001,,Sample Brand,10,2,90,110,Sample Supplier,A-1,2027-12-31\n";
    const url = URL.createObjectURL(
      new Blob(["\ufeff", header, example], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "product-import-sample.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <header className="page-header">
        <div>
          <p className="page-eyebrow">PRODUCT CATALOG</p>
          <h1>{t("importProducts")}</h1>
          <p className="page-description">
            CSV/XLSX · UTF-8 · 5 MB · 5,000 rows
          </p>
        </div>
        <Link className="button secondary" href="/products">
          ← {t("back")}
        </Link>
      </header>
      {error ? <div className="error module-error">{error}</div> : null}
      <section className="panel import-panel">
        <div className="import-controls">
          <label className="field">
            <span>{t("chooseFile")}</span>
            <input
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
                setResult(null);
              }}
            />
          </label>
          <button type="button" className="filter-button" onClick={sample}>
            {t("downloadSample")}
          </button>
          <button
            type="button"
            className="button"
            disabled={!file || loading}
            onClick={() => void previewFile()}
          >
            {loading ? t("loading") : t("preview")}
          </button>
        </div>
        {preview ? (
          <>
            <div className="metric-grid compact-metrics">
              <article className="metric-card">
                <span>{t("totalRows")}</span>
                <strong>{preview.total_rows}</strong>
              </article>
              <article className="metric-card">
                <span>{t("validRows")}</span>
                <strong>{preview.valid_rows}</strong>
              </article>
              <article className="metric-card">
                <span>{t("invalidRows")}</span>
                <strong>{preview.invalid_rows}</strong>
              </article>
              <article className="metric-card">
                <span>{t("duplicateRows")}</span>
                <strong>{preview.duplicate_rows}</strong>
              </article>
            </div>
            <div className="import-table">
              <table>
                <thead>
                  <tr>
                    <th>{t("row")}</th>
                    <th>{t("productName")}</th>
                    <th>{t("category")}</th>
                    <th>{t("unit")}</th>
                    <th>{t("buyingPrice")}</th>
                    <th>{t("sellingPrice")}</th>
                    <th>{t("status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 200).map((row) => (
                    <tr
                      key={row.row_number}
                      className={row.errors.length ? "invalid-row" : ""}
                    >
                      <td>{row.row_number}</td>
                      <td>
                        {row.product_name}
                        <small>{row.sku}</small>
                      </td>
                      <td>{row.category}</td>
                      <td>{row.unit}</td>
                      <td>{row.buying_price}</td>
                      <td>{row.selling_price}</td>
                      <td>
                        {row.errors.length
                          ? row.errors.map(rowError).join(", ")
                          : row.duplicate_by
                            ? `${t("duplicateRows")}: ${row.duplicate_by}`
                            : "✓"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-actions">
              <label className="field">
                <span>{t("importMode")}</span>
                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value)}
                >
                  <option value="skip">{t("modeSkip")}</option>
                  <option value="update">{t("modeUpdate")}</option>
                  <option value="create">{t("modeCreate")}</option>
                </select>
              </label>
              <button
                className="button"
                type="button"
                disabled={
                  loading || preview.invalid_rows === preview.total_rows
                }
                onClick={() => void commit()}
              >
                {t("importNow")}
              </button>
            </div>
          </>
        ) : null}
      </section>
      {result ? (
        <section className="panel import-result">
          <h2>{t("importResult")}</h2>
          <div className="metric-grid compact-metrics">
            <article className="metric-card">
              <span>{t("created")}</span>
              <strong>{result.created_rows}</strong>
            </article>
            <article className="metric-card">
              <span>{t("updated")}</span>
              <strong>{result.updated_rows}</strong>
            </article>
            <article className="metric-card">
              <span>{t("skipped")}</span>
              <strong>{result.skipped_rows}</strong>
            </article>
            <article className="metric-card">
              <span>{t("failed")}</span>
              <strong>{result.failed_rows}</strong>
            </article>
          </div>
          {result.errors.length ? (
            <ul className="import-errors">
              {result.errors.map((item) => (
                <li key={item.row_number}>
                  {t("row")} {item.row_number}:{" "}
                  {item.errors.map(rowError).join(", ")}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
