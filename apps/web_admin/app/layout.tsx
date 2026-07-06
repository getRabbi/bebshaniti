import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { I18nProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: { default: "ব্যবসানীতি অ্যাপ", template: "%s | ব্যবসানীতি" },
  description: "ব্যবসায়ীদের বিক্রয়, স্টক, বাকি ও রিপোর্ট পরিচালনার নিরাপদ অ্যাপ",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="bn-BD">
      <body><I18nProvider>{children}</I18nProvider></body>
    </html>
  );
}
