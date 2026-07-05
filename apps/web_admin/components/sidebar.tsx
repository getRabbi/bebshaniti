"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useState} from "react";
import {Icon} from "@/components/icons";
import {useI18n} from "@/lib/i18n";
import {createClient} from "@/lib/supabase-browser";

const links = [
  ["dashboard","/dashboard","dashboard"],["products","/products","products"],
  ["inventory","/inventory","inventory"],["sales","/sales","sales"],
  ["customers","/customers","customers"],["due","/due","due"],
  ["reports","/reports","reports"],["settings","/settings","settings"]
] as const;

export function Sidebar(){
  const pathname=usePathname();const [signingOut,setSigningOut]=useState(false);const {t}=useI18n();
  async function signOut(){setSigningOut(true);await createClient().auth.signOut();window.location.assign("/login");}
  return <aside className="sidebar">
    <Link className="admin-brand" href="/dashboard"><span className="admin-brand-mark">B</span><span>ব্যবসানীতি<small>Business OS</small></span></Link>
    <div className="nav-label">{t("workspace")}</div>
    <nav className="side-nav" aria-label="Main navigation">{links.map(([key,href,icon])=><Link className={pathname===href||pathname.startsWith(`${href}/`)?"active":undefined} key={href} href={href}><Icon name={icon}/><span>{t(key)}</span></Link>)}</nav>
    <div className="sidebar-footer"><div className="security-note"><Icon name="lock"/><span>নিরাপদ ওয়ার্কস্পেস<small>RLS ও tenant isolation</small></span></div><button type="button" className="sign-out" onClick={signOut} disabled={signingOut}>{signingOut?t("loading"):t("signOut")}</button></div>
  </aside>;
}
