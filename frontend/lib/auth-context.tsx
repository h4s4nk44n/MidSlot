"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, apiPost, configureTokenStore, onLogout, ApiError, refreshAccessToken } from "./api";
import type { User } from "./types";

const SESSION_USER_KEY = "midslot_session_user";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface LoginResponse {
  token: string;
  user: User;
}

function readCachedUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function writeCachedUser(user: User | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(SESSION_USER_KEY);
    }
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize from sessionStorage so navigations don't flash unauthenticated.
  // Defer reading sessionStorage to after mount to avoid SSR hydration mismatch.
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [hydrated, setHydrated] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);

  const setAccessToken = useCallback((next: string | null) => {
    tokenRef.current = next;
    setAccessTokenState(next);
  }, []);

  // Register the token store + logout listener with the fetch wrapper.
  useEffect(() => {
    configureTokenStore(
      () => tokenRef.current,
      (next) => setAccessToken(next),
    );
    const off = onLogout(() => {
      setUser(null);
      setAccessToken(null);
      setStatus("unauthenticated");
      writeCachedUser(null);
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    });
    return off;
  }, [setAccessToken]);

  // Read cached user from sessionStorage AFTER mount (not during SSR).
  // This prevents hydration mismatches between server and client HTML.
  useEffect(() => {
    const cached = readCachedUser();
    if (cached) {
      setUser(cached);
      setStatus("authenticated");
    }
    setHydrated(true);
  }, []);

  // On mount: refresh access token in the background. The user state is
  // already populated from sessionStorage if we had a session, so the UI
  // doesn't flash. We just need a fresh in-memory token to make API calls.
  // On mount: refresh access token in the background.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    // If we already have a cached user, we're authenticated. Don't refresh
    // on every navigation — that triggers a fresh rotation each time, and
    // any race with another tab/mount blows up reuse detection.
    // The access token will be refreshed lazily by api.ts on the first 401.
    if (user) return;

    // First visit (or sessionStorage cleared) — try to resurrect a session
    // from the refresh cookie.
    (async () => {
      const newToken = await refreshAccessToken();
      if (cancelled) return;

      if (newToken) {
        setAccessToken(newToken);
        const me = await api<User>("/auth/me").catch(() => null);
        if (cancelled) return;
        if (me) {
          setUser(me);
          setStatus("authenticated");
          writeCachedUser(me);
        } else {
          setStatus("unauthenticated");
          writeCachedUser(null);
        }
      } else {
        setUser(null);
        setAccessToken(null);
        setStatus("unauthenticated");
        writeCachedUser(null);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiPost<LoginResponse>(
        "/auth/login",
        { email, password },
        { _skipRefresh: true },
      );
      setAccessToken(res.token);
      setUser(res.user);
      setStatus("authenticated");
      writeCachedUser(res.user);
      return res.user;
    },
    [setAccessToken],
  );

  const logout = useCallback(async () => {
    try {
      await apiPost("/auth/logout", undefined, { _skipRefresh: true });
    } catch {
      // best-effort
    }
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
    writeCachedUser(null);
    if (typeof window !== "undefined") {
    sessionStorage.removeItem("midslot_active_doctor");
    }
    if (typeof window !== "undefined") window.location.assign("/login");
  }, [setAccessToken]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, accessToken, login, logout }),
    [user, status, accessToken, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}