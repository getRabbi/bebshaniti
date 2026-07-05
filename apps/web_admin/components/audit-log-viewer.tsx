"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase-browser";

type AuditRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  created_at: string;
  branch_name?: string;
  actor_name?: string;
  actor_email?: string;
};
function org() {
  return (
    document.cookie
      .split("; ")
      .find((part) => part.startsWith("organization_id="))
      ?.split("=")[1] ?? ""
  );
}
export function AuditLogViewer() {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");
  useEffect(() => {
    void (async () => {
      const { data } = await createClient().auth.getSession();
      if (!data.session) {
        location.assign("/login");
        return;
      }
      setToken(data.session.access_token);
      setRows(
        await apiRequest<AuditRow[]>(
          "/audit-logs",
          data.session.access_token,
          org(),
        ),
      );
    })();
  }, []);
  async function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const query = new URLSearchParams();
    for (const key of ["action", "module", "date_from", "date_to"]) {
      const value = String(form.get(key) || "");
      if (value) query.set(key, value);
    }
    try {
      setRows(
        await apiRequest<AuditRow[]>(`/audit-logs?${query}`, token, org()),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <header className="page-header">
        <div>
          <p className="page-eyebrow">SECURITY</p>
          <h1>{t("auditLogs")}</h1>
        </div>
        <Link className="button secondary" href="/settings">
          ← {t("back")}
        </Link>
      </header>
      {error ? <div className="error">{error}</div> : null}
      <form className="panel audit-filters no-print" onSubmit={filter}>
        <label>
          {t("action")}
          <select name="action">
            <option value="">{t("all")}</option>
            <option value="insert">insert</option>
            <option value="update">update</option>
            <option value="delete">delete</option>
          </select>
        </label>
        <label>
          {t("module")}
          <input name="module" />
        </label>
        <label>
          {t("dateFrom")}
          <input type="date" name="date_from" />
        </label>
        <label>
          {t("dateTo")}
          <input type="date" name="date_to" />
        </label>
        <button className="button" disabled={loading}>
          {loading ? t("loading") : t("filter")}
        </button>
      </form>
      <section className="data-panel">
        <div className="table-scroll">
          <table className="standard-table">
            <thead>
              <tr>
                <th>{t("time")}</th>
                <th>{t("user")}</th>
                <th>{t("action")}</th>
                <th>{t("module")}</th>
                <th>{t("branch")}</th>
                <th>{t("objectId")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString(locale)}</td>
                  <td>{row.actor_name || row.actor_email || "—"}</td>
                  <td>
                    <span className="status-badge">{row.action}</span>
                  </td>
                  <td>{row.entity_type}</td>
                  <td>{row.branch_name || "—"}</td>
                  <td>
                    <code>{row.entity_id || "—"}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? (
            <div className="empty-state">{t("noData")}</div>
          ) : null}
        </div>
      </section>
    </>
  );
}
