"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="center-message"><div><p className="eyebrow">DATA UNAVAILABLE</p><h1>Monitoring data লোড হয়নি</h1><p>Database migration ও production environment যাচাই করে আবার চেষ্টা করুন।</p><button onClick={reset}>আবার চেষ্টা করুন</button></div></main>;
}
