"use client";
import { FormEvent, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase-browser";
function slugify(value: string) {
  const ascii = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (ascii) return ascii;
  const hash = Array.from(value).reduce(
    (total, char) => (total * 31 + char.charCodeAt(0)) >>> 0,
    2166136261,
  );
  return value.trim() ? `business-${hash.toString(36)}` : "";
}
export default function OnboardingPage() {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const slug = useMemo(() => slugify(name), [name]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const { data } = await createClient().auth.getSession();
    if (!data.session) {
      location.assign("/login");
      return;
    }
    try {
      const organization = await apiRequest<{ id: string }>(
        "/organizations",
        data.session.access_token,
        undefined,
        {
          method: "POST",
          body: JSON.stringify({
            name: form.get("name"),
            slug: form.get("slug"),
            business_type: form.get("businessType"),
            phone: form.get("phone") || null,
            address: form.get("address") || null,
            branch_name: form.get("branchName"),
            branch_code: "MAIN",
          }),
        },
      );
      document.cookie = `organization_id=${organization.id}; Path=/; SameSite=Lax`;
      location.assign("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("saveError"));
      setPending(false);
    }
  }
  return (
    <div className="onboarding-wrap">
      <header className="onboarding-head">
        <span className="notice-icon">
          <Icon name="building" />
        </span>
        <div>
          <p className="page-eyebrow">{t("workspaceSetup")}</p>
          <h1>{t("createBusiness")}</h1>
          <p>{t("businessCreateIntro")}</p>
        </div>
      </header>
      <form className="onboarding-form panel" onSubmit={submit}>
        <div className="form-grid">
          <label className="field">
            <span>{t("businessName")}</span>
            <input
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>{t("workspaceSlug")}</span>
            <input name="slug" value={slug} readOnly required />
          </label>
          <label className="field">
            <span>{t("businessType")}</span>
            <select name="businessType">
              <option value="mixed">{t("mixedBusiness")}</option>
              <option value="retail">{t("retail")}</option>
              <option value="wholesale">{t("wholesaleDistribution")}</option>
            </select>
          </label>
          <label className="field">
            <span>{t("mainBranchName")}</span>
            <input name="branchName" defaultValue="Main Branch" required />
          </label>
          <label className="field">
            <span>{t("businessPhone")}</span>
            <input name="phone" type="tel" />
          </label>
          <label className="field field-wide">
            <span>{t("businessAddress")}</span>
            <input name="address" />
          </label>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <div className="form-actions">
          <p>{t("noDemoData")}</p>
          <button className="button" disabled={pending || !slug}>
            {pending ? t("creating") : t("createSecureWorkspace")}
          </button>
        </div>
      </form>
    </div>
  );
}
