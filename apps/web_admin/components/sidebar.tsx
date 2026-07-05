"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase-browser";

const links = [
  ["dashboard", "/dashboard", "dashboard"],
  ["products", "/products", "products"],
  ["inventory", "/inventory", "inventory"],
  ["sales", "/sales", "sales"],
  ["customers", "/customers", "customers"],
  ["due", "/due", "due"],
  ["reports", "/reports", "reports"],
  ["settings", "/settings", "settings"],
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const { t } = useI18n();
  useEffect(() => {
    void (async () => {
      const { data } = await createClient().auth.getSession();
      const organizationId = document.cookie
        .split("; ")
        .find((part) => part.startsWith("organization_id="))
        ?.split("=")[1];
      if (!data.session || !organizationId) return;
      try {
        const context = await apiRequest<{ permissions: string[] }>(
          "/organizations/current",
          data.session.access_token,
          organizationId,
        );
        setPermissions(context.permissions ?? []);
      } catch {
        setPermissions([]);
      }
    })();
  }, []);
  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    window.location.assign("/login");
  }
  return (
    <aside className="sidebar">
      <Link className="admin-brand" href="/dashboard">
        <span className="admin-brand-mark">B</span>
        <span>
          BebshaNiti<small>Business OS</small>
        </span>
      </Link>
      <div className="nav-label">{t("workspace")}</div>
      <nav className="side-nav" aria-label="Main navigation">
        {links
          .filter(
            ([key]) =>
              key !== "reports" || permissions.includes("reports.view"),
          )
          .map(([key, href, icon]) => (
            <Link
              className={
                pathname === href || pathname.startsWith(`${href}/`)
                  ? "active"
                  : undefined
              }
              key={href}
              href={href}
            >
              <Icon name={icon} />
              <span>{t(key)}</span>
            </Link>
          ))}
      </nav>
      <div className="sidebar-footer">
        <div className="security-note">
          <Icon name="lock" />
          <span>
            {t("secureWorkspace")}
            <small>{t("tenantIsolation")}</small>
          </span>
        </div>
        <button
          type="button"
          className="sign-out"
          onClick={signOut}
          disabled={signingOut}
        >
          {signingOut ? t("loading") : t("signOut")}
        </button>
      </div>
    </aside>
  );
}
