import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return <main className="login-shell"><section className="login-context"><p>ব্যবসানীতি</p><h2>সব ব্যবসার অবস্থা,<br />একটি সুরক্ষিত দৃশ্যে।</h2><ul><li>Merchant lifecycle ও licensing</li><li>Platform usage ও service status</li><li>Cross-tenant security audit</li></ul></section><LoginForm /></main>;
}
