"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { apiRequest } from "@/lib/api";
import { createClient } from "@/lib/supabase-browser";
import { useI18n } from "@/lib/i18n";

type Organization = { id: string; name: string; role: string };

function selectedOrganizationId() {
  return document.cookie
    .split("; ")
    .find((part) => part.startsWith("organization_id="))
    ?.split("=")[1];
}

export function OrganizationSwitcher() {
  const { t } = useI18n();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await createClient().auth.getSession();
      if (!data.session) return;
      try {
        const items = await apiRequest<Organization[]>(
          "/organizations",
          data.session.access_token,
        );
        if (!active) return;
        setOrganizations(items);
        const cookieValue = selectedOrganizationId();
        const next = items.some((item) => item.id === cookieValue)
          ? cookieValue!
          : (items[0]?.id ?? "");
        setSelected(next);
        if (next && next !== cookieValue)
          document.cookie = `organization_id=${next}; Path=/; SameSite=Lax`;
      } catch (error) {
        if (process.env.NODE_ENV !== "production")
          console.error("Organization load failed", error);
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (!loading && organizations.length === 0) {
    return (
      <a
        className="org-switcher org-create"
        href={failed ? "/dashboard" : "/onboarding"}
      >
        <span className="org-icon">
          <Icon name="plus" />
        </span>
        <span>
          <small>{t("selectedBusiness")}</small>
          <strong>{failed ? t("retry") : t("createBusiness")}</strong>
        </span>
      </a>
    );
  }

  return (
    <label className="org-switcher">
      <span className="org-icon">
        <Icon name="building" />
      </span>
      <span className="org-select-copy">
        <small>{t("selectedBusiness")}</small>
        <select
          aria-label={t("selectedBusiness")}
          value={selected}
          disabled={loading}
          onChange={(event) => {
            const value = event.target.value;
            document.cookie = `organization_id=${value}; Path=/; SameSite=Lax`;
            setSelected(value);
            window.location.reload();
          }}
        >
          <option value="">
            {loading ? t("loading") : t("selectWorkspace")}
          </option>
          {organizations.map((organization) => (
            <option value={organization.id} key={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </span>
      <span className="chevron">⌄</span>
    </label>
  );
}
