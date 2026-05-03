/**
 * Typed fetch wrapper for the MediSlot backend.
 *
 * MEDI-84: base wrapper with token injection, abort + timeout, typed errors.
 * MEDI-85: 401 -> /auth/refresh -> retry -> logout-on-second-fail (single-flight).
 *
 * No React imports — safe to use in server components, route handlers, and
 * client components.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, "body" | "signal"> {
  /** JSON body (will be serialised and Content-Type set automatically). */
  body?: unknown;
  /** User-supplied abort signal. Will be composed with the timeout signal. */
  signal?: AbortSignal;
  /** Request timeout in ms. Default 15000. Pass `0` to disable. */
  timeoutMs?: number;
  /**
   * Internal flag — set to true when we are performing the retry attempt
   * after a successful token refresh so we don't loop forever.
   */
  _isRetry?: boolean;
  /** Skip the refresh/retry flow (e.g. for the refresh call itself). */
  _skipRefresh?: boolean;
}

// ------------------------ token + logout plumbing ------------------------

type TokenGetter = () => string | null;
type TokenSetter = (token: string | null) => void;
type LogoutCallback = () => void;

let getAccessToken: TokenGetter = () => null;
let setAccessToken: TokenSetter = () => {};
const logoutListeners = new Set<LogoutCallback>();

/**
 * Wire the wrapper to an access-token store. The provider (see auth-context)
 * registers its in-memory token here. Keep the store OUT of localStorage.
 */
export function configureTokenStore(getter: TokenGetter, setter: TokenSetter) {
  getAccessToken = getter;
  setAccessToken = setter;
}

/**
 * Register a callback that fires when the wrapper decides the session is dead
 * (e.g. refresh failed, or a second 401 after a successful refresh).
 */
export function onLogout(cb: LogoutCallback): () => void {
  logoutListeners.add(cb);
  return () => logoutListeners.delete(cb);
}

function triggerLogout() {
  setAccessToken(null);
  for (const cb of logoutListeners) {
    try {
      cb();
    } catch {
      // listeners must not break other listeners
    }
  }
}

// ------------------------ single-flight refresh ------------------------

let refreshInFlight: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return null;
      const data = (await safeJson(res)) as { accessToken?: string } | null;
      const next = data?.accessToken ?? null;
      if (next) setAccessToken(next);
      return next;
    } catch {
      return null;
    } finally {
      // release on next microtask so concurrent awaiters all see the same value
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();

  return refreshInFlight;
}

// ------------------------ helpers ------------------------

function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new ApiError(
      "NEXT_PUBLIC_API_URL is not set. Copy .env.local.example to .env.local.",
      0,
      "CONFIG_MISSING",
    );
  }
  return url.replace(/\/$/, "");
}

async function safeJson(res: Response): Promise<unknown> {
  // 204 No Content / empty body / non-JSON: don't crash.
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function composeSignal(
  userSignal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const onUserAbort = () => controller.abort(userSignal!.reason);
  if (userSignal) {
    if (userSignal.aborted) controller.abort(userSignal.reason);
    else userSignal.addEventListener("abort", onUserAbort, { once: true });
  }
  if (timeoutMs > 0) {
    timer = setTimeout(
      () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
      timeoutMs,
    );
  }
  return {
    signal: controller.signal,
    clear: () => {
      if (timer) clearTimeout(timer);
      if (userSignal) userSignal.removeEventListener("abort", onUserAbort);
    },
  };
}

// ------------------------ main wrapper ------------------------

export async function api<T = unknown>(path: string, opts: ApiRequestOptions = {}): Promise<T> {
  const {
    body,
    headers,
    signal: userSignal,
    timeoutMs = 15_000,
    _isRetry = false,
    _skipRefresh = false,
    ...rest
  } = opts;

  const token = getAccessToken();

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(headers as Record<string, string> | undefined),
  };

  const baseUrl = getBaseUrl();
  const url = path.startsWith("http") ? path : `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const { signal, clear } = composeSignal(userSignal, timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "include",
      signal,
    });
  } catch (err: unknown) {
    clear();
    if (err instanceof DOMException && (err.name === "AbortError" || err.name === "TimeoutError")) {
      throw err;
    }
    throw new ApiError(
      err instanceof Error ? err.message : "Network error",
      0,
      "NETWORK_ERROR",
    );
  }
  clear();

  // 401 handling: single refresh + single retry, per request.
  if (res.status === 401 && !_skipRefresh && !_isRetry) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      triggerLogout();
      throw new ApiError("Session expired", 401, "SESSION_EXPIRED");
    }
    return api<T>(path, { ...opts, _isRetry: true });
  }
  if (res.status === 401 && _isRetry) {
    triggerLogout();
    throw new ApiError("Session expired", 401, "SESSION_EXPIRED");
  }

  const payload = (await safeJson(res)) as
    | (T & { message?: string; code?: string; error?: string })
    | null;

  if (!res.ok) {
    const message =
      (payload && typeof payload === "object" && (payload.message || payload.error)) ||
      res.statusText ||
      "Request failed";
    throw new ApiError(message, res.status, payload?.code, payload);
  }

  return (payload ?? (undefined as unknown)) as T;
}

// Convenience helpers — thin sugar over api().
export const apiGet = <T = unknown>(path: string, opts?: ApiRequestOptions) =>
  api<T>(path, { ...opts, method: "GET" });

export const apiPost = <T = unknown>(path: string, body?: unknown, opts?: ApiRequestOptions) =>
  api<T>(path, { ...opts, method: "POST", body });

export const apiPatch = <T = unknown>(path: string, body?: unknown, opts?: ApiRequestOptions) =>
  api<T>(path, { ...opts, method: "PATCH", body });

export const apiDelete = <T = unknown>(path: string, opts?: ApiRequestOptions) =>
  api<T>(path, { ...opts, method: "DELETE" });
