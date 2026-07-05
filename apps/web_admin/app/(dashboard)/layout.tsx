import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { Icon } from "@/components/icons";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { Sidebar } from "@/components/sidebar";
import { TopbarTools } from "@/components/topbar-tools";
import { createClient } from "@/lib/supabase-server";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { data } = await (await createClient()).auth.getUser();
  if (!data.user) redirect("/login");
  const email = data.user.email ?? "Signed-in user";

  return (
    <div className="dashboard-shell">
      <Sidebar />
      <div className="workspace">
        <header className="topbar">
          <OrganizationSwitcher />
          <div className="topbar-actions">
            <TopbarTools />
            <button
              className="icon-button"
              type="button"
              aria-label="Notifications"
              disabled
            >
              <Icon name="bell" />
            </button>
            <div className="user-chip">
              <span>{email.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{email}</strong>
              </div>
            </div>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
