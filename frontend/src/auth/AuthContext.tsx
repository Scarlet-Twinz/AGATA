import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setAccessToken } from "../lib/api";

type User = {
  id: string;
  company_id: string;
  email: string;
  full_name: string;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (companyName: string, fullName: string, email: string, password: string, acceptedTerms: boolean) => Promise<void>;
  refreshUser: () => Promise<User | null>;
  signOut: () => void;
};

const TOKEN_KEY = "agata_access_token";
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadUser(token: string) {
  setAccessToken(token);
  return api<User>("/auth/me");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }

    loadUser(token)
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      return null;
    }

    const nextUser = await loadUser(token);
    setUser(nextUser);
    return nextUser;
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    signIn: async (email, password) => {
      const result = await api<{ access_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem(TOKEN_KEY, result.access_token);
      setUser(await loadUser(result.access_token));
    },
    signUp: async (companyName, fullName, email, password, acceptedTerms) => {
      const result = await api<{ access_token: string }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          company_name: companyName,
          full_name: fullName,
          email,
          password,
          accepted_terms: acceptedTerms,
        }),
      });
      localStorage.setItem(TOKEN_KEY, result.access_token);
      setUser(await loadUser(result.access_token));
    },
    refreshUser,
    signOut() {
      localStorage.removeItem(TOKEN_KEY);
      setAccessToken(null);
      setUser(null);
    },
  }), [user, loading, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
