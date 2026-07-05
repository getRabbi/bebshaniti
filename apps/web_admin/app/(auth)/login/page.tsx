"use client";

import { FormEvent, useState } from "react";

import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const { error: authError } = await createClient().auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) });
    if (authError) { setError(authError.message); setPending(false); return; }
    window.location.assign("/dashboard");
  }

  return (
    <main className="auth-shell">
      <section className="auth-story" aria-label="About the admin workspace">
        <div className="auth-brand"><span className="auth-brand-mark">B</span><span>Business OS<small>Bangladesh</small></span></div>
        <div className="auth-message"><p className="auth-kicker">Secure owner workspace</p><h2>Your business, under control.</h2><p>Monitor operations, protect business data and give every team member the access they need—nothing more.</p></div>
        <div className="auth-points"><span>Tenant isolated</span><span>Permission aware</span><span>Audit ready</span></div>
      </section>
      <section className="auth-form-side">
        <form className="auth-card" onSubmit={submit}>
          <div className="auth-brand mobile-brand"><span className="auth-brand-mark">B</span><span>Business OS<small>Bangladesh</small></span></div>
          <p className="page-eyebrow">Admin portal</p><h1>Welcome back</h1><p className="auth-intro">Sign in with the account assigned to your business workspace.</p>
          <label className="field"><span>Email address</span><input name="email" type="email" autoComplete="email" placeholder="you@business.com" required /></label>
          <label className="field"><span>Password</span><input name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required /></label>
          {error ? <p className="error" role="alert">{error}</p> : null}
          <button className="button auth-submit" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in securely"}</button>
          <p className="auth-switch">New business owner? <a href="/register">Create an account</a></p>
          <p className="auth-footnote">Access is limited to approved organization members.</p>
        </form>
      </section>
    </main>
  );
}
