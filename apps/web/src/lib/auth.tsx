import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@power-app/core/meta";
import { ApiError, api, startLogin } from "./api";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (returnTo?: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .me()
      .then((res) => active && setUser(res.user))
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) {
          console.error("Failed to load session", err);
        }
        if (active) setUser(null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback((returnTo?: string) => {
    startLogin(returnTo ?? window.location.pathname + window.location.search);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    window.location.assign("/login");
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
