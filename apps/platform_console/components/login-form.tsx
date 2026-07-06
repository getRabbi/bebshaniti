"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export function LoginForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    const { error: authError } = await createClient().auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) });
    if (authError) { setError("ইমেইল বা পাসওয়ার্ড সঠিক নয়।"); setPending(false); return; }
    window.location.assign("/");
  }
  return <form className="login-card" onSubmit={submit}>
    <div className="lock-mark">ন</div>
    <p className="eyebrow">RESTRICTED OPERATIONS</p>
    <h1>প্ল্যাটফর্ম কন্ট্রোল</h1>
    <p className="muted">শুধু অনুমোদিত platform operator এই console ব্যবহার করতে পারবেন।</p>
    <label><span>অনুমোদিত ইমেইল</span><input name="email" type="email" autoComplete="email" required /></label>
    <label><span>পাসওয়ার্ড</span><input name="password" type="password" autoComplete="current-password" required /></label>
    {error ? <p className="error">{error}</p> : null}
    <button disabled={pending}>{pending ? "যাচাই হচ্ছে…" : "নিরাপদ লগইন"}</button>
    <small>অ্যাকাউন্ট তৈরির public option নেই। প্রতিটি access audit করা হয়।</small>
  </form>;
}
