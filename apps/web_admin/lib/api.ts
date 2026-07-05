import { publicEnv } from "@/lib/env";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  accessToken: string,
  organizationId?: string,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Content-Type", "application/json");
  if (organizationId) headers.set("X-Organization-ID", organizationId);

  const response = await fetch(`${publicEnv.apiBaseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new ApiError(body?.error?.message ?? "API request failed", response.status);
  }
  return (await response.json()) as T;
}
