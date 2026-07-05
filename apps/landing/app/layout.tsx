import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.example.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Business OS Bangladesh", template: "%s | Business OS Bangladesh" },
  description: "Sales, inventory, due/baki and owner control for retail and wholesale businesses in Bangladesh.",
  openGraph: {
    title: "Business OS Bangladesh",
    description: "One secure operating system for retail and wholesale business operations.",
    url: siteUrl,
    locale: "en_BD",
    type: "website"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-BD">
      <body>
        <header className="header">
          <nav className="container nav" aria-label="Primary navigation">
            <Link className="logo" href="/" aria-label="Business OS home">
              <span className="brand-mark">B</span><span>Business OS<small>Bangladesh</small></span>
            </Link>
            <div className="links">
              <Link href="/#platform">Platform</Link>
              <Link href="/#operations">How it works</Link>
              <Link href="/#pricing">Plans</Link>
              <Link href="/#contact">Contact</Link>
            </div>
            <a className="nav-login" href={appUrl}>Admin sign in <span>↗</span></a>
          </nav>
        </header>
        {children}
        <footer className="footer">
          <div className="container footer-main">
            <div><Link className="logo footer-logo" href="/"><span className="brand-mark">B</span><span>Business OS<small>Bangladesh</small></span></Link><p>Built for the realities of retail and wholesale operations in Bangladesh.</p></div>
            <div className="footer-links"><Link href="/#platform">Platform</Link><Link href="/#pricing">Plans</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div>
          </div>
          <div className="container footer-bottom"><span>© {new Date().getFullYear()} Business OS Bangladesh</span><span>Secure by design · Built for scale</span></div>
        </footer>
      </body>
    </html>
  );
}
