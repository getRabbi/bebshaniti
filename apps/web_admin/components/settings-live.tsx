"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { apiRequest } from "@/lib/api";
import { createClient } from "@/lib/supabase-browser";

type Organization = { id: string; name: string; slug: string; business_type: string; currency: string; timezone: string };
type Branch = { id: string; name: string; code: string; warehouse_count: number; is_main: boolean };

function organizationCookie() { return document.cookie.split("; ").find((part) => part.startsWith("organization_id="))?.split("=")[1] ?? ""; }

export function SettingsLive() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await createClient().auth.getSession();
      if (!data.session) return;
      try {
        const organizations = await apiRequest<Array<{ id: string }>>("/organizations", data.session.access_token);
        if (!organizations.length) { window.location.assign("/onboarding"); return; }
        const cookie = organizationCookie();
        const id = organizations.some((item) => item.id === cookie) ? cookie : organizations[0].id;
        const [org, branchList] = await Promise.all([
          apiRequest<Organization>("/organizations/current", data.session.access_token, id),
          apiRequest<Branch[]>("/branches", data.session.access_token, id)
        ]);
        setOrganization(org); setBranches(branchList);
      } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load settings"); }
    }
    void load();
  }, []);

  return <>{error ? <div className="error module-error">{error}</div> : null}<div className="settings-grid">
    <article className="settings-card"><span><Icon name="building" /></span><div><h2>Organization profile</h2><p>{organization ? `${organization.name} · ${organization.business_type}` : "Loading workspace…"}</p><small>{organization ? `${organization.currency} · ${organization.timezone} · /${organization.slug}` : "Secure organization context"}</small></div></article>
    <article className="settings-card"><span><Icon name="branch" /></span><div><h2>Branches and stock points</h2><p>{branches.length ? branches.map((branch) => branch.name).join(", ") : "No active branch loaded"}</p><small>{branches.reduce((sum, branch) => sum + Number(branch.warehouse_count), 0)} stock points across {branches.length} branches</small></div></article>
    <article className="settings-card"><span><Icon name="users" /></span><div><h2>Team and permissions</h2><p>Owner access is active. Staff invitation controls are the next protected workflow.</p><small>Role-based access enforced by API and RLS</small></div></article>
    <article className="settings-card"><span><Icon name="device" /></span><div><h2>Trusted devices</h2><p>Device activation remains closed until a device is explicitly registered.</p><small>No implicit device trust</small></div></article>
  </div></>;
}
