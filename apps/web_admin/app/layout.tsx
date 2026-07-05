import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { I18nProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: { default: "Business OS Admin", template: "%s | Business OS" },
  description: "Secure owner and operations dashboard for Bangladesh Business OS",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="bn-BD">
      <body><I18nProvider>{children}</I18nProvider></body>
    </html>
  );
}
