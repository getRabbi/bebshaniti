"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { LandingI18nProvider, useLandingI18n } from "@/lib/i18n";

const copy = {
  bn: { product: "ব্যবসা পরিচালনা", platform: "সুবিধাসমূহ", operations: "কীভাবে কাজ করে", plans: "পরিকল্পনা", contact: "যোগাযোগ", login: "লগইন", register: "অ্যাকাউন্ট খুলুন", footer: "বাংলাদেশের খুচরা ও পাইকারি ব্যবসার বাস্তব কাজের জন্য তৈরি।", privacy: "গোপনীয়তা", terms: "শর্তাবলি", secure: "নিরাপদ নকশা · বড় হওয়ার জন্য প্রস্তুত", language: "ভাষা" },
  en: { product: "Business platform", platform: "Features", operations: "How it works", plans: "Plans", contact: "Contact", login: "Sign in", register: "Create account", footer: "Built for real retail and wholesale operations in Bangladesh.", privacy: "Privacy", terms: "Terms", secure: "Secure by design · Ready to scale", language: "Language" },
} as const;

function Shell({ children, appUrl }: { children: ReactNode; appUrl: string }) {
  const { locale, setLocale } = useLandingI18n();
  const t = copy[locale];
  return <>
    <header className="header"><nav className="container nav" aria-label="Primary navigation">
      <Link className="logo" href="/" aria-label="BebshaNiti home"><span className="brand-mark">ব</span><span>ব্যবসানীতি<small>{t.product}</small></span></Link>
      <div className="links"><Link href="/#platform">{t.platform}</Link><Link href="/#operations">{t.operations}</Link><Link href="/#pricing">{t.plans}</Link><Link href="/#contact">{t.contact}</Link></div>
      <div className="nav-actions">
        <label className="site-language"><span className="sr-only">{t.language}</span><select value={locale} onChange={(event) => setLocale(event.target.value as "bn" | "en")}><option value="bn">বাংলা</option><option value="en">English</option></select></label>
        <a className="nav-login" href={`${appUrl}/login`}>{t.login}</a><a className="button nav-register" href={`${appUrl}/register`}>{t.register}</a>
      </div>
    </nav></header>
    {children}
    <footer className="footer"><div className="container footer-main"><div><Link className="logo footer-logo" href="/"><span className="brand-mark">ব</span><span>ব্যবসানীতি<small>{t.product}</small></span></Link><p>{t.footer}</p></div><div className="footer-links"><Link href="/#platform">{t.platform}</Link><Link href="/#pricing">{t.plans}</Link><Link href="/privacy">{t.privacy}</Link><Link href="/terms">{t.terms}</Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} ব্যবসানীতি</span><span>{t.secure}</span></div></footer>
  </>;
}

export function SiteShell({ children, appUrl }: { children: ReactNode; appUrl: string }) {
  return <LandingI18nProvider><Shell appUrl={appUrl}>{children}</Shell></LandingI18nProvider>;
}
