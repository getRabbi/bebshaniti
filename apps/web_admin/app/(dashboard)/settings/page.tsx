import { PageHeader } from "@/components/admin-ui";
import { SettingsLive } from "@/components/settings-live";

export default function SettingsPage() {
  return <><PageHeader eyebrow="Workspace" title="Settings" description="Review the organization, branches, people and trusted devices defining the tenant boundary." /><SettingsLive /></>;
}
