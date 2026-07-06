"use client";

import { createClient } from "@/lib/supabase-browser";

export function SignOutButton() {
  return <button className="sign-out" onClick={async () => { await createClient().auth.signOut(); window.location.assign("/login"); }}>লগআউট</button>;
}
