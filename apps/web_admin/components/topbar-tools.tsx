"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase-browser";

const shortcuts: Record<string, { permission: string; route: string }> = {
  s: { permission: "sales.create", route: "/sales/new" },
  p: { permission: "products.create", route: "/products?add=1" },
  c: { permission: "customers.create", route: "/customers?add=1" },
  d: { permission: "due.receive", route: "/due?collect=1" },
};

function organizationCookie() {
  return document.cookie
    .split("; ")
    .find((part) => part.startsWith("organization_id="))
    ?.split("=")[1];
}

export function TopbarTools() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    async function loadPermissions() {
      const { data } = await createClient().auth.getSession();
      const organizationId = organizationCookie();
      if (!data.session || !organizationId) return;
      try {
        const context = await apiRequest<{ permissions: string[] }>(
          "/organizations/current",
          data.session.access_token,
          organizationId,
        );
        setPermissions(context.permissions);
      } catch {
        setPermissions([]);
      }
    }
    void loadPermissions();
  }, []);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      const shortcut = shortcuts[event.key.toLowerCase()];
      if (shortcut && permissions.includes(shortcut.permission)) {
        event.preventDefault();
        window.location.assign(shortcut.route);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [permissions]);

  const lastSale =
    typeof window !== "undefined"
      ? window.localStorage.getItem("last-sale-id")
      : null;
  return (
    <div className="topbar-tools">
      <label className="language-switch">
        <span>{t("language")}</span>
        <select
          value={locale}
          onChange={(event) => setLocale(event.target.value as "bn-BD" | "en")}
        >
          <option value="bn-BD">{t("bangla")}</option>
          <option value="en">{t("english")}</option>
        </select>
      </label>
      <div className="quick-actions">
        <button className="button" type="button" onClick={() => setOpen(!open)}>
          + {t("quickActions")}
        </button>
        {open ? (
          <div className="quick-menu" onClick={() => setOpen(false)}>
            {permissions.includes("sales.create") ? (
              <Link href="/sales/new">
                {t("addSale")} <kbd>Alt+S</kbd>
              </Link>
            ) : null}
            {permissions.includes("products.create") ? (
              <Link href="/products?add=1">
                {t("addProduct")} <kbd>Alt+P</kbd>
              </Link>
            ) : null}
            {permissions.includes("customers.create") ? (
              <Link href="/customers?add=1">
                {t("addCustomer")} <kbd>Alt+C</kbd>
              </Link>
            ) : null}
            {permissions.includes("due.receive") ? (
              <Link href="/due?collect=1">
                {t("receiveDue")} <kbd>Alt+D</kbd>
              </Link>
            ) : null}
            {lastSale ? (
              <Link href={`/sales/${lastSale}/print`}>
                {t("printLastMemo")}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
