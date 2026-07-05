"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase-browser";

const links = [
  ["Dashboard", "/dashboard", "dashboard"], ["Products", "/products", "products"],
  ["Inventory", "/inventory", "inventory"], ["Sales", "/sales", "sales"],
  ["Customers", "/customers", "customers"], ["Due / Baki", "/due", "due"],
  ["Reports", "/reports", "reports"], ["Settings", "/settings", "settings"]
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    window.location.assign("/login");
  }

  return (
    <aside className="sidebar">
      <Link className="admin-brand" href="/dashboard"><span className="admin-brand-mark">B</span><span>Business OS<small>Admin workspace</small></span></Link>
      <div className="nav-label">Workspace</div>
      <nav className="side-nav" aria-label="Main navigation">
        {links.map(([label, href, icon]) => (
          <Link className={pathname === href ? "active" : undefined} key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
            <Icon name={icon} /><span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="security-note"><Icon name="lock" /><span>Secure workspace<small>RLS and tenant isolation</small></span></div>
        <button type="button" className="sign-out" onClick={signOut} disabled={signingOut}>{signingOut ? "Signing out…" : "Sign out"}</button>
      </div>
    </aside>
  );
}
