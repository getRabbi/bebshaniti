import "server-only";

function required(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function serverEnv() {
  return {
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
    adminEmails: required("PLATFORM_ADMIN_EMAILS", process.env.PLATFORM_ADMIN_EMAILS)
      .split(",").map((email) => email.trim().toLowerCase()).filter(Boolean),
  };
}

export function isPlatformAdmin(email: string | null | undefined) {
  if (!email) return false;
  return serverEnv().adminEmails.includes(email.trim().toLowerCase());
}
