import { publicEnv } from "@/lib/env";

const CONNECTION_MESSAGE = "সার্ভারের সাথে সংযোগ করা যাচ্ছে না। আবার চেষ্টা করুন।";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly retryable = false) {
    super(message);
    this.name = "ApiError";
  }
}

function friendlyMessage(status: number, detail?: string) {
  if (status === 401) return "আপনার সেশন শেষ হয়েছে। আবার লগইন করুন।";
  if (status === 403) return "এই কাজটি করার অনুমতি আপনার নেই।";
  if (status === 404) return "অনুরোধ করা তথ্য পাওয়া যায়নি।";
  if (status === 409) return detail ?? "তথ্যটি আগে থেকেই আছে বা পরিবর্তনটি গ্রহণযোগ্য নয়।";
  if (status === 422) return detail ?? "দেওয়া তথ্যগুলো যাচাই করুন।";
  if (status >= 500) return "সার্ভারে সাময়িক সমস্যা হয়েছে। আবার চেষ্টা করুন।";
  return detail ?? "অনুরোধটি সম্পন্ন করা যায়নি।";
}

async function requestOnce<T>(path: string, accessToken: string, organizationId: string | undefined, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body) headers.set("Content-Type", "application/json");
  if (organizationId) headers.set("X-Organization-ID", organizationId);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${publicEnv.apiBaseUrl}${path}`, {...init, headers, cache: "no-store", signal: controller.signal});
    if (!response.ok) {
      const body = await response.json().catch(() => null) as {error?: {message?: string}; detail?: string} | null;
      const detail = body?.error?.message ?? body?.detail;
      throw new ApiError(friendlyMessage(response.status, detail), response.status, response.status >= 500);
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (process.env.NODE_ENV !== "production") console.error("API network error", {path, error});
    throw new ApiError(CONNECTION_MESSAGE, 0, true);
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function apiRequest<T>(path: string, accessToken: string, organizationId?: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  try {
    return await requestOnce<T>(path, accessToken, organizationId, init);
  } catch (error) {
    if (method === "GET" && error instanceof ApiError && error.retryable) {
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      return requestOnce<T>(path, accessToken, organizationId, init);
    }
    throw error;
  }
}

export const apiConnectionMessage = CONNECTION_MESSAGE;
