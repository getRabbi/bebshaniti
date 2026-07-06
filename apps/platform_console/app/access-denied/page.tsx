"use client";

import { createClient } from "@/lib/supabase-browser";

export default function AccessDeniedPage() {
  return <main className="center-message"><div><p className="eyebrow">ACCESS DENIED</p><h1>এই account অনুমোদিত নয়</h1><p>Platform console-এর allowlist-এ এই ইমেইল নেই। কোনো merchant data দেখানো হয়নি।</p><button onClick={async () => { await createClient().auth.signOut(); window.location.assign("/login"); }}>অন্য account দিয়ে লগইন</button></div></main>;
}
