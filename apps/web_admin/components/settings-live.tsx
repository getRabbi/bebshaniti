"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase-browser";
type Organization = {
  id: string;
  name: string;
  slug: string;
  business_type: string;
  currency: string;
  timezone: string;
  permissions: string[];
};
type Branch = { id: string; name: string; warehouse_count: number };
function orgCookie() {
  return (
    document.cookie
      .split("; ")
      .find((part) => part.startsWith("organization_id="))
      ?.split("=")[1] ?? ""
  );
}
export function SettingsLive() {
  const { t } = useI18n();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    void (async () => {
      const { data } = await createClient().auth.getSession();
      if (!data.session) return;
      try {
        const organizations = await apiRequest<Array<{ id: string }>>(
          "/organizations",
          data.session.access_token,
        );
        if (!organizations.length) {
          location.assign("/onboarding");
          return;
        }
        const cookie = orgCookie();
        const id = organizations.some((item) => item.id === cookie)
          ? cookie
          : organizations[0].id;
        const [current, branchList] = await Promise.all([
          apiRequest<Organization>(
            "/organizations/current",
            data.session.access_token,
            id,
          ),
          apiRequest<Branch[]>("/branches", data.session.access_token, id),
        ]);
        setOrganization(current);
        setBranches(branchList);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t("loadError"));
      }
    })();
  }, [t]);
  return (
    <>
      {error ? <div className="error module-error">{error}</div> : null}
      <div className="settings-grid">
        <article className="settings-card">
          <span>
            <Icon name="building" />
          </span>
          <div>
            <h2>{t("settingsOrganization")}</h2>
            <p>
              {organization
                ? `${organization.name} · ${organization.business_type}`
                : t("loading")}
            </p>
            <small>
              {organization
                ? `${organization.currency} · ${organization.timezone} · /${organization.slug}`
                : t("secureWorkspace")}
            </small>
          </div>
        </article>
        <article className="settings-card">
          <span>
            <Icon name="branch" />
          </span>
          <div>
            <h2>{t("settingsBranches")}</h2>
            <p>
              {branches.length
                ? branches.map((item) => item.name).join(", ")
                : t("noActiveBranch")}
            </p>
            <small>
              {branches.reduce(
                (sum, item) => sum + Number(item.warehouse_count),
                0,
              )}{" "}
              {t("stockPoints")}
            </small>
          </div>
        </article>
        <article className="settings-card">
          <span>
            <Icon name="users" />
          </span>
          <div>
            <h2>{t("settingsTeam")}</h2>
            <p>{t("staffControls")}</p>
            <small>{t("roleEnforced")}</small>
          </div>
        </article>
        <article className="settings-card">
          <span>
            <Icon name="device" />
          </span>
          <div>
            <h2>{t("settingsDevices")}</h2>
            <p>{t("deviceControls")}</p>
          </div>
        </article>
        {organization?.permissions.includes("audit.view") ? (
          <Link className="settings-card" href="/settings/audit">
            <span>
              <Icon name="reports" />
            </span>
            <div>
              <h2>{t("auditLogs")}</h2>
              <p>
                {t("filter")}: {t("user")}, {t("action")}, {t("date")},{" "}
                {t("module")}
              </p>
            </div>
          </Link>
        ) : null}
      </div>
    </>
  );
}
