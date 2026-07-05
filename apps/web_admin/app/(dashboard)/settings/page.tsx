"use client";
import { PageHeader } from "@/components/admin-ui";
import { SettingsLive } from "@/components/settings-live";
import { useI18n } from "@/lib/i18n";
export default function SettingsPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        eyebrow={t("workspace")}
        title={t("settings")}
        description={t("settingsIntro")}
      />
      <SettingsLive />
    </>
  );
}
