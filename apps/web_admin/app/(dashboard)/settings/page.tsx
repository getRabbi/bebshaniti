import { PageHeader } from "@/components/admin-ui";
import { SettingsLive } from "@/components/settings-live";

export default function SettingsPage() {
  return <><PageHeader eyebrow="ওয়ার্কস্পেস" title="সেটিংস" description="ব্যবসা, শাখা, সদস্য, ভাষা ও নিরাপত্তা সেটিংস।" /><SettingsLive /></>;
}
