import { userManager } from "../auth/userManager";
import { Me, MeSchema } from "./types";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

/** Thrown for any non-2xx backend response. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function bearerHeaders(): Promise<Record<string, string>> {
  const user = await userManager.getUser();
  if (!user?.access_token) {
    // Session is gone (expired & unrenewable) — kick off a re-login.
    void userManager.signinRedirect();
    throw new ApiError(401, "Not signed in");
  }
  return { Authorization: `Bearer ${user.access_token}` };
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers = { "Content-Type": "application/json", ...(await bearerHeaders()) };

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (res.status === 401) {
    void userManager.signinRedirect();
    throw new ApiError(401, "Your session expired — signing you back in…");
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, detail);
  }

  return (await res.json()) as T;
}

export async function fetchMe(): Promise<Me> {
  const raw = await api<unknown>("/me");
  return MeSchema.parse(raw);
}
