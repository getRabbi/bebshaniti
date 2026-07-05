import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return <main className="container legal"><h1>Privacy Policy</h1><p>Last updated: 4 July 2026</p><h2>Scope</h2><p>This page is the publication shell for the production privacy policy. Before customer onboarding, legal counsel must approve the final data collection, processing, retention, subprocessors and user-rights language.</p><h2>Current foundation</h2><p>Business data is designed for organization-level isolation, role-based access, audit logging and private document storage. Secrets and service credentials are not shipped to client applications.</p><h2>Contact</h2><p>Set the production privacy contact and company identity before launch.</p></main>;
}
