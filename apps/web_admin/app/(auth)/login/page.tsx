"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase-browser";
export default function LoginPage() {
  const { t } = useI18n();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const { error: authError } = await createClient().auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (authError) {
      if (process.env.NODE_ENV !== "production") console.error(authError);
      setError(t("permissionDenied"));
      setPending(false);
      return;
    }
    location.assign("/dashboard");
  }
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="auth-brand">
          <span className="auth-brand-mark">B</span>
          <span>
            BebshaNiti<small>Business OS</small>
          </span>
        </div>
        <div className="auth-message">
          <p className="auth-kicker">{t("secureWorkspace")}</p>
          <h2>{t("loginTitle")}</h2>
          <p>{t("loginIntro")}</p>
        </div>
        <div className="auth-points">
          <span>{t("tenantIsolation")}</span>
          <span>{t("rolePermission")}</span>
          <span>{t("auditReady")}</span>
        </div>
      </section>
      <section className="auth-form-side">
        <form className="auth-card" onSubmit={submit}>
          <p className="page-eyebrow">{t("adminPortal")}</p>
          <h1>{t("login")}</h1>
          <label className="field">
            <span>{t("email")}</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="field">
            <span>{t("password")}</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="button auth-submit" disabled={pending}>
            {pending ? t("loggingIn") : t("login")}
          </button>
          <p className="auth-switch">
            {t("newBusiness")}{" "}
            <Link href="/register">{t("createAccount")}</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
