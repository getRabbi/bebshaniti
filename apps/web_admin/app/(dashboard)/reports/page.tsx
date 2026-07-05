"use client";
import { PageHeader } from "@/components/admin-ui";
import { DashboardLive } from "@/components/dashboard-live";
import { ReportsLive } from "@/components/reports-live";
import { useI18n } from "@/lib/i18n";
export default function ReportsPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        eyebrow={t("decisionSupport")}
        title={t("reports")}
        description={t("reportsIntro")}
      />
      <DashboardLive />
      <ReportsLive />
    </>
  );
}
