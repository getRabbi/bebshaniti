import { apiRequest } from "@/lib/api";

type Organization = { id: string };

export function readOrganizationId() {
  if (typeof document === "undefined") return "";
  return (
    document.cookie
      .split("; ")
      .find((part) => part.startsWith("organization_id="))
      ?.split("=")[1] ?? ""
  );
}

export function writeOrganizationId(organizationId: string) {
  document.cookie = `organization_id=${organizationId}; Path=/; SameSite=Lax`;
}

export async function resolveOrganizationId(
  accessToken: string,
  preferredId = "",
) {
  const organizations = await apiRequest<Organization[]>(
    "/organizations",
    accessToken,
  );
  if (!organizations.length) return "";

  const requested = preferredId || readOrganizationId();
  const organizationId = organizations.some((item) => item.id === requested)
    ? requested
    : organizations[0].id;
  writeOrganizationId(organizationId);
  return organizationId;
}
