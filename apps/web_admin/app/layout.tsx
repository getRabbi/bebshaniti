import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Business OS Admin", template: "%s | Business OS" },
  description: "Secure owner and operations dashboard for Bangladesh Business OS",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
