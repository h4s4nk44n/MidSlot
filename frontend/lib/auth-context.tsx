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
import { toast } from "sonner";
import { api, apiPost, configureTokenStore, onLogout, ApiError } from "./api";
import type { User } from "./types";

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
  accessToken: string;
  user: User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  // Token is mirrored into a ref for synchronous reads by the fetch wrapper
  // (no re-render) and into React state so consumers re-render on change.
  // Not persisted in localStorage.
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
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    });
    return off;
  }, [setAccessToken]);

  // Hydrate session on mount. The refresh-token cookie (httpOnly) lets the
  // backend issue a fresh access token via /auth/refresh. Then fetch /auth/me.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const refreshed = await apiPost<{ accessToken?: string }>(
          "/auth/refresh",
          undefined,
          { _skipRefresh: true },
        ).catch(() => null);
        if (cancelled) return;
        if (refreshed?.accessToken) {
          setAccessToken(refreshed.accessToken);
          const me = await api<User>("/auth/me").catch(() => null);
          if (cancelled) return;
          if (me) {
            setUser(me);
            setStatus("authenticated");
            return;
          }
        }
        setStatus("unauthenticated");
      } catch {
        if (!cancelled) setStatus("unauthenticated");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setAccessToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const res = await apiPost<LoginResponse>(
          "/auth/login",
          { email, password },
          { _skipRefresh: true },
        );
        setAccessToken(res.accessToken);
        setUser(res.user);
        setStatus("authenticated");
        return res.user; 
      } catch (err) {
        throw err;
      }
    },
    [setAccessToken],
  );

  const logout = useCallback(async () => {
    try {
      await apiPost("/auth/logout", undefined, { _skipRefresh: true });
    } catch {
      // logout is best-effort — clear local state regardless
    }
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
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
