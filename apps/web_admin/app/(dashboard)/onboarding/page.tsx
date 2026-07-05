"use client";

import { FormEvent, useMemo, useState } from "react";

import { Icon } from "@/components/icons";
import { apiRequest } from "@/lib/api";
import { createClient } from "@/lib/supabase-browser";

function slugify(value: string) {
  const ascii = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (ascii) return ascii;
  const hash = Array.from(value).reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
  return value.trim() ? `business-${hash.toString(36)}` : "";
}

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const suggestedSlug = useMemo(() => slugify(name), [name]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const { data } = await createClient().auth.getSession();
    if (!data.session) { window.location.assign("/login"); return; }
    try {
      const organization = await apiRequest<{ id: string }>("/organizations", data.session.access_token, undefined, {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name")), slug: String(form.get("slug")),
          business_type: String(form.get("businessType")), phone: String(form.get("phone")) || null,
          address: String(form.get("address")) || null, branch_name: String(form.get("branchName")), branch_code: "MAIN"
        })
      });
      document.cookie = `organization_id=${organization.id}; Path=/; SameSite=Lax`;
      window.location.assign("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the workspace");
      setPending(false);
    }
  }

  return (
    <div className="onboarding-wrap">
      <header className="onboarding-head"><span className="notice-icon"><Icon name="building" /></span><div><p className="page-eyebrow">Workspace setup</p><h1>Create your business</h1><p>This transaction creates the organization, main branch, owner access, stock point and base catalog structure together.</p></div></header>
      <form className="onboarding-form panel" onSubmit={submit}>
        <div className="form-grid">
          <label className="field"><span>Business name</span><input name="name" value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label className="field"><span>Workspace slug</span><input name="slug" value={suggestedSlug} onChange={() => undefined} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required readOnly /></label>
          <label className="field"><span>Business type</span><select name="businessType" defaultValue="mixed"><option value="mixed">Retail + wholesale</option><option value="retail">Retail</option><option value="wholesale">Wholesale / distribution</option></select></label>
          <label className="field"><span>Main branch name</span><input name="branchName" defaultValue="Main Branch" required /></label>
          <label className="field"><span>Business phone</span><input name="phone" type="tel" /></label>
          <label className="field field-wide"><span>Business address</span><input name="address" /></label>
        </div>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <div className="form-actions"><p>Production data remains empty until you add it.</p><button className="button" type="submit" disabled={pending || !suggestedSlug}>{pending ? "Creating workspace…" : "Create secure workspace"}</button></div>
      </form>
    </div>
  );
}
