"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { apiRequest } from "@/lib/api";
import { createClient } from "@/lib/supabase-browser";

type Organization = { id: string; name: string; role: string };

function selectedOrganizationId() {
  return document.cookie.split("; ").find((part) => part.startsWith("organization_id="))?.split("=")[1];
}

export function OrganizationSwitcher() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await createClient().auth.getSession();
      if (!data.session) return;
      try {
        const items = await apiRequest<Organization[]>("/organizations", data.session.access_token);
        if (!active) return;
        setOrganizations(items);
        const cookieValue = selectedOrganizationId();
        const next = items.some((item) => item.id === cookieValue) ? cookieValue! : items[0]?.id ?? "";
        setSelected(next);
        if (next && next !== cookieValue) document.cookie = `organization_id=${next}; Path=/; SameSite=Lax`;
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  if (!loading && organizations.length === 0) {
    return <a className="org-switcher org-create" href="/onboarding"><span className="org-icon"><Icon name="plus" /></span><span><small>Current workspace</small><strong>Create your business</strong></span></a>;
  }

  return (
    <label className="org-switcher">
      <span className="org-icon"><Icon name="building" /></span>
      <span className="org-select-copy"><small>Current workspace</small><select aria-label="Current organization" value={selected} disabled={loading} onChange={(event) => { const value = event.target.value; document.cookie = `organization_id=${value}; Path=/; SameSite=Lax`; setSelected(value); window.location.reload(); }}><option value="">{loading ? "Loading…" : "Select workspace"}</option>{organizations.map((organization) => <option value={organization.id} key={organization.id}>{organization.name}</option>)}</select></span>
      <span className="chevron">⌄</span>
    </label>
  );
}
