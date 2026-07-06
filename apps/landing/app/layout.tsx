import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { SiteShell } from "@/components/site-shell";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bebshaniti-landing.vercel.app";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bebshaniti-app.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "ব্যবসানীতি — ব্যবসা পরিচালনা সহজ করুন", template: "%s | ব্যবসানীতি" },
  description: "বিক্রয়, স্টক, বাকি, ক্রয় ও ব্যবসার রিপোর্ট—বাংলাদেশের ব্যবসায়ীদের জন্য এক প্ল্যাটফর্মে।",
  openGraph: { title: "ব্যবসানীতি — বাংলাদেশের ব্যবসার ডিজিটাল প্ল্যাটফর্ম", description: "বিক্রয়, স্টক, বাকি, ক্রয় ও মালিকের রিপোর্ট এক জায়গায়।", url: siteUrl, locale: "bn_BD", type: "website" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="bn-BD"><body><SiteShell appUrl={appUrl}>{children}</SiteShell></body></html>;
}
