"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase-browser";
export default function RegisterPage() {
  const { t, locale, setLocale } = useI18n();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password.length < 10) {
      setError(`${t("password")}: 10+`);
      setPending(false);
      return;
    }
    const { data, error: authError } = await createClient().auth.signUp({
      email: String(form.get("email")),
      password,
      options: {
        data: { full_name: String(form.get("fullName")) },
        emailRedirectTo: `${location.origin}/onboarding`,
      },
    });
    if (authError) {
      if (process.env.NODE_ENV !== "production") console.error(authError);
      setError(t("saveError"));
      setPending(false);
      return;
    }
    if (data.session) location.assign("/onboarding");
    else setMessage(t("login"));
    setPending(false);
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
          <p className="auth-kicker">{t("ownerAccount")}</p>
          <h2>{t("registerTitle")}</h2>
          <p>{t("registerIntro")}</p>
        </div>
        <div className="auth-points">
          <span>{t("verifiedIdentity")}</span>
          <span>{t("isolatedWorkspace")}</span>
          <span>{t("noDemo")}</span>
        </div>
      </section>
      <section className="auth-form-side">
        <form className="auth-card" onSubmit={submit}>
          <label className="language-switch auth-language">
            {t("language")}
            <select
              value={locale}
              onChange={(event) =>
                setLocale(event.target.value as "bn-BD" | "en")
              }
            >
              <option value="bn-BD">{t("bangla")}</option>
              <option value="en">{t("english")}</option>
            </select>
          </label>
          <p className="page-eyebrow">{t("ownerAccount")}</p>
          <h1>{t("createAccount")}</h1>
          <label className="field">
            <span>{t("fullName")}</span>
            <input name="fullName" required />
          </label>
          <label className="field">
            <span>{t("email")}</span>
            <input name="email" type="email" required />
          </label>
          <label className="field">
            <span>{t("password")}</span>
            <input name="password" type="password" minLength={10} required />
          </label>
          {error ? <p className="error">{error}</p> : null}
          {message ? <p className="success">{message}</p> : null}
          <button className="button auth-submit" disabled={pending}>
            {pending ? t("creating") : t("createAccount")}
          </button>
          <p className="auth-switch">
            {t("alreadyRegistered")} <Link href="/login">{t("login")}</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
