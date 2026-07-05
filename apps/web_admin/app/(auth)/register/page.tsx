"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { createClient } from "@/lib/supabase-browser";

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password.length < 10) {
      setError("Use at least 10 characters for your password.");
      setPending(false);
      return;
    }
    const { data, error: authError } = await createClient().auth.signUp({
      email: String(form.get("email")),
      password,
      options: {
        data: { full_name: String(form.get("fullName")) },
        emailRedirectTo: `${window.location.origin}/onboarding`
      }
    });
    if (authError) {
      setError(authError.message);
      setPending(false);
      return;
    }
    if (data.session) window.location.assign("/onboarding");
    else setMessage("Check your email and confirm the account, then sign in.");
    setPending(false);
  }

  return (
    <main className="auth-shell">
      <section className="auth-story" aria-label="Create a secure business workspace">
        <div className="auth-brand"><span className="auth-brand-mark">B</span><span>Business OS<small>Bangladesh</small></span></div>
        <div className="auth-message"><p className="auth-kicker">Owner registration</p><h2>Start with a secure foundation.</h2><p>Create the owner identity first. Your organization, main branch and access boundary are configured in the next step.</p></div>
        <div className="auth-points"><span>Verified identity</span><span>Isolated workspace</span><span>No demo data</span></div>
      </section>
      <section className="auth-form-side">
        <form className="auth-card" onSubmit={submit}>
          <div className="auth-brand mobile-brand"><span className="auth-brand-mark">B</span><span>Business OS<small>Bangladesh</small></span></div>
          <p className="page-eyebrow">Owner account</p><h1>Create your account</h1><p className="auth-intro">Use an email address you control for business administration.</p>
          <label className="field"><span>Full name</span><input name="fullName" type="text" autoComplete="name" required /></label>
          <label className="field"><span>Email address</span><input name="email" type="email" autoComplete="email" required /></label>
          <label className="field"><span>Password</span><input name="password" type="password" autoComplete="new-password" minLength={10} required /></label>
          {error ? <p className="error" role="alert">{error}</p> : null}
          {message ? <p className="success" role="status">{message}</p> : null}
          <button className="button auth-submit" type="submit" disabled={pending}>{pending ? "Creating account…" : "Create owner account"}</button>
          <p className="auth-switch">Already registered? <Link href="/login">Sign in</Link></p>
        </form>
      </section>
    </main>
  );
}
