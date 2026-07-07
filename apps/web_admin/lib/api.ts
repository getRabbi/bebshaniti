import { publicEnv } from "@/lib/env";
import { translate } from "@/lib/i18n";

type CacheEntry = {
  value: unknown;
  expiresAt: number;
  staleUntil: number;
};

const responseCache = new Map<string, CacheEntry>();
const inFlightGets = new Map<string, Promise<unknown>>();
const cacheEpoch = new Map<string, number>();

function cacheScope(organizationId?: string) {
  return organizationId || "public";
}

function cacheKey(path: string, accessToken: string, organizationId?: string) {
  return `${cacheScope(organizationId)}\u001f${accessToken}\u001f${path}`;
}

function cacheTtl(path: string) {
  if (
    path === "/organizations" ||
    path === "/organizations/current" ||
    path.startsWith("/branches") ||
    path.startsWith("/products/metadata") ||
    path.startsWith("/product-master/categories") ||
    path.startsWith("/product-master/subcategories")
  )
    return 5 * 60_000;
  if (/^\/sales\/[^/]+\/memo/.test(path)) return 60_000;
  if (path.startsWith("/reports")) return 15_000;
  if (
    path.startsWith("/products") ||
    path.startsWith("/customers") ||
    path.startsWith("/inventory") ||
    path.startsWith("/sales") ||
    path.startsWith("/due") ||
    path.startsWith("/audit-logs")
  )
    return 20_000;
  return 0;
}

export function invalidateApiCache(organizationId?: string) {
  const scope = cacheScope(organizationId);
  cacheEpoch.set(scope, (cacheEpoch.get(scope) ?? 0) + 1);
  for (const key of responseCache.keys()) {
    if (key.startsWith(`${scope}\u001f`)) responseCache.delete(key);
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function friendlyMessage(status: number, detail?: string) {
  if (status === 401) return translate("sessionExpired");
  if (status === 403) return translate("permissionDenied");
  if (status === 404) return translate("resourceNotFound");
  if (status === 409) {
    if (detail === "A customer with this phone already exists")
      return translate("customerPhoneExists");
    return translate("conflictError");
  }
  if (status === 422) {
    if (detail === "A customer is required for a due sale")
      return translate("dueCustomerWarning");
    if (detail === "Paid amount exceeds the sale total")
      return translate("invalidPaymentError");
    if (detail === "Insufficient stock for a sale item")
      return translate("insufficientStockError");
    return translate("validationError");
  }
  if (status >= 500) return translate("serverError");
  return detail ?? translate("requestError");
}

async function requestOnce<T>(
  path: string,
  accessToken: string,
  organizationId: string | undefined,
  init: RequestInit,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (organizationId) headers.set("X-Organization-ID", organizationId);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${publicEnv.apiBaseUrl}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
        detail?: string;
      } | null;
      const detail = body?.error?.message ?? body?.detail;
      throw new ApiError(
        friendlyMessage(response.status, detail),
        response.status,
        response.status >= 500,
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (process.env.NODE_ENV !== "production")
      console.error("API network error", { path, error });
    throw new ApiError(translate("connectionError"), 0, true);
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function apiRequest<T>(
  path: string,
  accessToken: string,
  organizationId?: string,
  init: RequestInit = {},
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  if (method === "GET") {
    const key = cacheKey(path, accessToken, organizationId);
    const ttl = cacheTtl(path);
    const cached = responseCache.get(key);
    const now = Date.now();
    if (cached && now < cached.expiresAt) return cached.value as T;

    const scope = cacheScope(organizationId);
    const epoch = cacheEpoch.get(scope) ?? 0;
    const request = async () => {
      try {
        return await requestOnce<T>(path, accessToken, organizationId, init);
      } catch (error) {
        if (error instanceof ApiError && error.retryable) {
          await new Promise((resolve) => window.setTimeout(resolve, 450));
          return requestOnce<T>(path, accessToken, organizationId, init);
        }
        throw error;
      }
    };
    const startRequest = () => {
      const pending = request().then((value) => {
        if (ttl > 0 && (cacheEpoch.get(scope) ?? 0) === epoch) {
          const savedAt = Date.now();
          responseCache.set(key, {
            value,
            expiresAt: savedAt + ttl,
            staleUntil: savedAt + ttl * 4,
          });
        }
        return value;
      });
      inFlightGets.set(key, pending);
      void pending.then(
        () => inFlightGets.delete(key),
        () => inFlightGets.delete(key),
      );
      return pending;
    };

    if (cached && now < cached.staleUntil) {
      if (!inFlightGets.has(key)) void startRequest().catch(() => undefined);
      return cached.value as T;
    }
    return (inFlightGets.get(key) ?? startRequest()) as Promise<T>;
  }

  try {
    const result = await requestOnce<T>(
      path,
      accessToken,
      organizationId,
      init,
    );
    invalidateApiCache(organizationId);
    return result;
  } catch (error) {
    throw error;
  }
}

export function apiConnectionMessage() {
  return translate("connectionError");
}
