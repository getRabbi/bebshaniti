"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

export function TopbarTools() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      const routes: Record<string, string> = {
        s: "/sales/new",
        p: "/products?add=1",
        c: "/customers?add=1",
        d: "/due?collect=1",
      };
      const route = routes[event.key.toLowerCase()];
      if (route) {
        event.preventDefault();
        window.location.assign(route);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
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
          onChange={(e) => setLocale(e.target.value as "bn-BD" | "en")}
        >
          <option value="bn-BD">বাংলা</option>
          <option value="en">English</option>
        </select>
      </label>
      <div className="quick-actions">
        <button className="button" type="button" onClick={() => setOpen(!open)}>
          ＋ দ্রুত কাজ
        </button>
        {open ? (
          <div className="quick-menu" onClick={() => setOpen(false)}>
            <Link href="/sales/new">
              {t("addSale")} <kbd>Alt+S</kbd>
            </Link>
            <Link href="/products?add=1">
              {t("addProduct")} <kbd>Alt+P</kbd>
            </Link>
            <Link href="/customers?add=1">
              {t("addCustomer")} <kbd>Alt+C</kbd>
            </Link>
            <Link href="/due?collect=1">
              {t("receiveDue")} <kbd>Alt+D</kbd>
            </Link>
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
