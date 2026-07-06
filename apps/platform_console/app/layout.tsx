import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Niti Operations",
  description: "Restricted BebshaNiti platform operations console",
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="bn-BD"><body>{children}</body></html>;
}
