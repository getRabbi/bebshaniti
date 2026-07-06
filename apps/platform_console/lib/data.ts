import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/public-env";
import { serverEnv } from "@/lib/server-env";

export type MerchantOverview = {
  id: string; name: string; slug: string; business_type: string; phone: string | null; email: string | null;
  is_active: boolean; created_at: string; owner_name: string | null; owner_email: string | null;
  branch_count: number; active_branch_count: number; member_count: number; active_member_count: number;
  device_count: number; active_device_count: number; product_count: number; customer_count: number;
  completed_sale_count: number; lifetime_sales: number | string; sales_last_30_days: number | string;
  receivable_balance: number | string; last_sale_at: string | null; last_activity_at: string | null;
  plan_code: string | null; license_type: string | null; license_status: string | null;
  max_branches: number | null; max_devices: number | null; activated_at: string | null; expires_at: string | null;
};

export type AuditEntry = { id: string; organization_id: string; action: string; entity_type: string; entity_id: string | null; created_at: string };
export type AccessEntry = { id: string; actor_email: string; action: string; target_organization_id: string | null; created_at: string };

export async function loadPlatformData(actor: User) {
  const service = createClient(publicEnv.supabaseUrl, serverEnv().serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const [merchantResult, auditResult, accessResult] = await Promise.all([
    service.from("platform_merchant_overview").select("*").order("created_at", { ascending: false }),
    service.from("audit_logs").select("id,organization_id,action,entity_type,entity_id,created_at").order("created_at", { ascending: false }).limit(50),
    service.from("platform_access_logs").select("id,actor_email,action,target_organization_id,created_at").order("created_at", { ascending: false }).limit(30),
  ]);
  if (merchantResult.error) throw new Error(`Merchant overview failed: ${merchantResult.error.message}`);
  if (auditResult.error) throw new Error(`Audit feed failed: ${auditResult.error.message}`);
  if (accessResult.error) throw new Error(`Access audit failed: ${accessResult.error.message}`);

  const logResult = await service.from("platform_access_logs").insert({
    actor_user_id: actor.id,
    actor_email: actor.email ?? "unknown",
    action: "platform.dashboard.view",
    metadata: { merchant_count: merchantResult.data.length },
  });
  if (logResult.error) throw new Error(`Platform access audit failed: ${logResult.error.message}`);

  return {
    merchants: merchantResult.data as MerchantOverview[],
    audit: auditResult.data as AuditEntry[],
    access: accessResult.data as AccessEntry[],
  };
}
